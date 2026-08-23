from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Dict, Mapping, Tuple

from .canonical import sha256_value
from .event_log import DeterministicEventLog, ParkEvent
from .kernel import SimulationState


@dataclass(frozen=True)
class StateSnapshot:
    snapshot_id: str
    world_id: str
    branch_id: str
    tick: int
    state_version: int
    state_hash: str
    event_log_hash: str
    canonical_root_hash: str
    module_versions: Mapping[str, str]
    reason: str
    created_by: str
    parent_snapshot_id: str | None = None

    def __post_init__(self) -> None:
        if not all((self.snapshot_id, self.world_id, self.branch_id, self.reason, self.created_by)):
            raise ValueError("snapshot identifiers, reason, and creator are required")
        if self.tick < 0 or self.state_version < 0:
            raise ValueError("tick and state_version must be non-negative")
        for name in ("state_hash", "event_log_hash", "canonical_root_hash"):
            value = getattr(self, name)
            if len(value) != 64 or any(c not in "0123456789abcdef" for c in value.lower()):
                raise ValueError(f"{name} must be a SHA-256 hex string")

    def digest(self) -> str:
        return sha256_value(asdict(self))

    def verify(
        self,
        state: SimulationState,
        event_log: DeterministicEventLog,
    ) -> tuple[bool, Tuple[str, ...]]:
        issues: list[str] = []
        if state.digest() != self.state_hash:
            issues.append("state hash mismatch")
        if event_log.event_log_hash() != self.event_log_hash:
            issues.append("event log hash mismatch")
        if state.world_id != self.world_id:
            issues.append("world id mismatch")
        if state.branch_id != self.branch_id:
            issues.append("branch id mismatch")
        if state.tick != self.tick:
            issues.append("tick mismatch")
        if state.state_version != self.state_version:
            issues.append("state version mismatch")
        return not issues, tuple(issues)


@dataclass(frozen=True)
class BranchLineage:
    branch_id: str
    parent_branch_id: str
    fork_snapshot_id: str
    label: str
    created_by: str
    status: str = "active"

    def __post_init__(self) -> None:
        if not all((self.branch_id, self.parent_branch_id, self.fork_snapshot_id, self.created_by)):
            raise ValueError("branch lineage identifiers are required")
        if self.branch_id == self.parent_branch_id:
            raise ValueError("branch cannot be its own parent")
        if self.status not in {"active", "archived", "merged_reference"}:
            raise ValueError("unsupported branch status")


@dataclass(frozen=True)
class StoredSnapshot:
    metadata: StateSnapshot
    state: SimulationState
    events: Tuple[ParkEvent, ...]

    def event_log(self) -> DeterministicEventLog:
        log = DeterministicEventLog()
        log.append_batch(self.events)
        return log

    def verify(self) -> tuple[bool, Tuple[str, ...]]:
        return self.metadata.verify(self.state, self.event_log())


class SnapshotStore:
    """In-memory reference store for verified checkpoints and safe forks."""

    def __init__(self, canonical_root_hash: str | None = None) -> None:
        if canonical_root_hash is not None and len(canonical_root_hash) != 64:
            raise ValueError("canonical_root_hash must be SHA-256")
        self._root_hash = canonical_root_hash
        self._snapshots: Dict[str, StoredSnapshot] = {}
        self._branches: Dict[str, BranchLineage] = {}

    @staticmethod
    def _clone_state(state: SimulationState) -> SimulationState:
        return state.with_updates(state.module_states)

    @staticmethod
    def _clone_log(events: Tuple[ParkEvent, ...]) -> DeterministicEventLog:
        log = DeterministicEventLog()
        log.append_batch(events)
        return log

    def capture(
        self,
        state: SimulationState,
        event_log: DeterministicEventLog,
        *,
        canonical_root_hash: str | None = None,
        module_versions: Mapping[str, str],
        reason: str,
        created_by: str,
        parent_snapshot_id: str | None = None,
    ) -> StateSnapshot:
        root_hash = canonical_root_hash or self._root_hash
        if root_hash is None:
            raise ValueError("canonical_root_hash is required for capture")
        if len(root_hash) != 64:
            raise ValueError("canonical_root_hash must be SHA-256")
        if self._root_hash is not None and root_hash != self._root_hash:
            raise ValueError("capture canonical root hash conflicts with store root")
        self._root_hash = root_hash

        cloned_state = self._clone_state(state)
        events = tuple(event_log.events)
        event_hash = self._clone_log(events).event_log_hash()
        state_hash = cloned_state.digest()
        basis = {
            "world_id": state.world_id,
            "branch_id": state.branch_id,
            "tick": state.tick,
            "state_version": state.state_version,
            "state_hash": state_hash,
            "event_log_hash": event_hash,
            "canonical_root_hash": root_hash,
            "module_versions": dict(module_versions),
            "reason": reason,
            "created_by": created_by,
            "parent_snapshot_id": parent_snapshot_id,
        }
        snapshot_id = "snapshot_" + sha256_value(basis)[:24]
        existing = self._snapshots.get(snapshot_id)
        if existing is not None:
            return existing.metadata

        metadata = StateSnapshot(
            snapshot_id=snapshot_id,
            world_id=state.world_id,
            branch_id=state.branch_id,
            tick=state.tick,
            state_version=state.state_version,
            state_hash=state_hash,
            event_log_hash=event_hash,
            canonical_root_hash=root_hash,
            module_versions=dict(module_versions),
            reason=reason,
            created_by=created_by,
            parent_snapshot_id=parent_snapshot_id,
        )
        stored = StoredSnapshot(metadata, cloned_state, events)
        ok, issues = stored.verify()
        if not ok:
            raise RuntimeError("snapshot verification failed before storage: " + "; ".join(issues))
        self._snapshots[snapshot_id] = stored
        return metadata

    def restore(
        self,
        snapshot_id: str,
        *,
        expected_root_hash: str | None = None,
        installed_modules: Mapping[str, str] | None = None,
    ) -> tuple[SimulationState, DeterministicEventLog]:
        stored = self._snapshots[snapshot_id]
        issues: list[str] = []
        if expected_root_hash is not None and stored.metadata.canonical_root_hash != expected_root_hash:
            issues.append("canonical root hash mismatch")
        if installed_modules is not None:
            for module_id, required in stored.metadata.module_versions.items():
                if installed_modules.get(module_id) != required:
                    issues.append(f"module mismatch: {module_id}")
        ok, verify_issues = stored.verify()
        issues.extend(verify_issues if not ok else ())
        if issues:
            raise ValueError("; ".join(issues))
        return self._clone_state(stored.state), self._clone_log(stored.events)

    def fork(
        self,
        snapshot_id: str,
        *,
        new_branch_id: str | None = None,
        branch_id: str | None = None,
        label: str,
        created_by: str,
    ) -> tuple[SimulationState, DeterministicEventLog, BranchLineage]:
        requested_branch = new_branch_id or branch_id
        if not requested_branch:
            raise ValueError("new_branch_id is required")
        if requested_branch in self._branches:
            raise ValueError(f"branch already exists: {requested_branch}")
        stored = self._snapshots[snapshot_id]
        if requested_branch == stored.state.branch_id:
            raise ValueError("new branch_id must differ from parent")
        forked = stored.state.with_updates(
            stored.state.module_states,
            branch_id=requested_branch,
        )
        lineage = BranchLineage(
            branch_id=requested_branch,
            parent_branch_id=stored.state.branch_id,
            fork_snapshot_id=snapshot_id,
            label=label,
            created_by=created_by,
        )
        self._branches[requested_branch] = lineage
        return forked, self._clone_log(stored.events), lineage

    def get(self, snapshot_id: str) -> StateSnapshot:
        return self._snapshots[snapshot_id].metadata

    @property
    def branches(self) -> Dict[str, BranchLineage]:
        return dict(self._branches)
