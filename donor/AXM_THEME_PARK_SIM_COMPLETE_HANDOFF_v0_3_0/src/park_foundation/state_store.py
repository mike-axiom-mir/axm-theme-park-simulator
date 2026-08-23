from __future__ import annotations

from dataclasses import asdict, dataclass
import json
from typing import Any, Dict, Mapping, Tuple

from .canonical import canonical_json, sha256_value


def _copy_json(value: Any) -> Any:
    return json.loads(canonical_json(value))


@dataclass(frozen=True)
class NamespaceSpec:
    namespace: str
    owner_module_id: str
    authoritative: bool = True

    def __post_init__(self) -> None:
        if not self.namespace or not self.owner_module_id:
            raise ValueError("namespace and owner_module_id are required")


@dataclass(frozen=True)
class NamespaceUpdate:
    update_id: str
    module_id: str
    namespace: str
    base_version: int
    new_state: Mapping[str, Any]
    reason_event_ids: Tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if not self.update_id or not self.module_id or not self.namespace:
            raise ValueError("update_id, module_id, and namespace are required")
        if self.base_version < 0:
            raise ValueError("base_version must be non-negative")
        canonical_json(self.new_state)  # validate JSON-safe deterministic data


@dataclass(frozen=True)
class StateSnapshot:
    authoritative_version: int
    view_version: int
    authoritative_hash: str
    full_hash: str
    namespaces: Mapping[str, Any]

    def digest(self) -> str:
        return sha256_value(asdict(self))


@dataclass(frozen=True)
class StateCommit:
    commit_id: str
    authoritative: bool
    before_version: int
    after_version: int
    before_hash: str
    after_hash: str
    update_ids: Tuple[str, ...]
    reason_event_ids: Tuple[str, ...]


class VersionedStateStore:
    """Namespace-owned state with atomic updates and separate visual versions."""

    def __init__(
        self,
        specs: Tuple[NamespaceSpec, ...],
        initial_state: Mapping[str, Mapping[str, Any]] | None = None,
        *,
        authoritative_version: int = 0,
        view_version: int = 0,
    ) -> None:
        if authoritative_version < 0 or view_version < 0:
            raise ValueError("state versions must be non-negative")
        self._specs: Dict[str, NamespaceSpec] = {}
        for spec in specs:
            if spec.namespace in self._specs:
                raise ValueError(f"duplicate namespace: {spec.namespace}")
            self._specs[spec.namespace] = spec
        supplied = dict(initial_state or {})
        unknown = set(supplied) - set(self._specs)
        if unknown:
            raise ValueError(f"initial state has unknown namespaces: {sorted(unknown)}")
        self._state: Dict[str, Any] = {
            namespace: _copy_json(supplied.get(namespace, {}))
            for namespace in self._specs
        }
        self._authoritative_version = authoritative_version
        self._view_version = view_version
        self._commits: list[StateCommit] = []

    @property
    def authoritative_version(self) -> int:
        return self._authoritative_version

    @property
    def view_version(self) -> int:
        return self._view_version

    @property
    def namespace_specs(self) -> Dict[str, NamespaceSpec]:
        return dict(self._specs)

    def read(self, namespace: str) -> Any:
        if namespace not in self._state:
            raise KeyError(namespace)
        return _copy_json(self._state[namespace])

    def state_hash(self, *, authoritative_only: bool = True) -> str:
        payload = {
            name: self._state[name]
            for name, spec in sorted(self._specs.items())
            if not authoritative_only or spec.authoritative
        }
        return sha256_value(payload)

    def snapshot(self) -> StateSnapshot:
        return StateSnapshot(
            authoritative_version=self._authoritative_version,
            view_version=self._view_version,
            authoritative_hash=self.state_hash(authoritative_only=True),
            full_hash=self.state_hash(authoritative_only=False),
            namespaces=_copy_json(self._state),
        )

    def apply_batch(self, updates: Tuple[NamespaceUpdate, ...]) -> StateCommit:
        if not updates:
            raise ValueError("at least one update is required")
        update_ids = [item.update_id for item in updates]
        if len(set(update_ids)) != len(update_ids):
            raise ValueError("duplicate update_id in batch")
        namespaces = [item.namespace for item in updates]
        if len(set(namespaces)) != len(namespaces):
            raise ValueError("only one update per namespace is allowed in an atomic batch")

        kinds = set()
        for item in updates:
            spec = self._specs.get(item.namespace)
            if spec is None:
                raise ValueError(f"unknown namespace: {item.namespace}")
            if spec.owner_module_id != item.module_id:
                raise PermissionError(
                    f"{item.module_id} cannot write {item.namespace}; owned by {spec.owner_module_id}"
                )
            expected = self._authoritative_version if spec.authoritative else self._view_version
            if item.base_version != expected:
                raise ValueError(
                    f"stale update {item.update_id}: base {item.base_version} != current {expected}"
                )
            kinds.add(spec.authoritative)
        if len(kinds) != 1:
            raise ValueError("authoritative and visual updates must commit separately")

        authoritative = kinds.pop()
        before_version = self._authoritative_version if authoritative else self._view_version
        before_hash = self.state_hash(authoritative_only=authoritative)
        proposed = _copy_json(self._state)
        for item in sorted(updates, key=lambda update: (update.namespace, update.update_id)):
            proposed[item.namespace] = _copy_json(item.new_state)

        # Mutation occurs only after all validation and serialization succeeds.
        self._state = proposed
        if authoritative:
            self._authoritative_version += 1
            after_version = self._authoritative_version
        else:
            self._view_version += 1
            after_version = self._view_version
        after_hash = self.state_hash(authoritative_only=authoritative)
        event_ids = tuple(sorted({event for item in updates for event in item.reason_event_ids}))
        commit_id = "commit_" + sha256_value({
            "authoritative": authoritative,
            "before_version": before_version,
            "after_version": after_version,
            "before_hash": before_hash,
            "after_hash": after_hash,
            "updates": [asdict(item) for item in sorted(updates, key=lambda u: u.update_id)],
        })[:24]
        commit = StateCommit(
            commit_id=commit_id,
            authoritative=authoritative,
            before_version=before_version,
            after_version=after_version,
            before_hash=before_hash,
            after_hash=after_hash,
            update_ids=tuple(sorted(update_ids)),
            reason_event_ids=event_ids,
        )
        self._commits.append(commit)
        return commit

    def fork(self, snapshot: StateSnapshot) -> "VersionedStateStore":
        if snapshot.authoritative_hash != sha256_value({
            name: snapshot.namespaces[name]
            for name, spec in sorted(self._specs.items())
            if spec.authoritative
        }):
            raise ValueError("snapshot authoritative hash is invalid")
        if snapshot.full_hash != sha256_value(snapshot.namespaces):
            raise ValueError("snapshot full hash is invalid")
        return VersionedStateStore(
            tuple(self._specs.values()),
            snapshot.namespaces,
            authoritative_version=snapshot.authoritative_version,
            view_version=snapshot.view_version,
        )

    @property
    def commits(self) -> Tuple[StateCommit, ...]:
        return tuple(self._commits)
