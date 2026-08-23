from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Callable, Dict, Mapping

from .util import stable_hash


@dataclass(frozen=True)
class StateSnapshot:
    snapshot_id: str
    tick: int
    contract_version: str
    module_versions: Mapping[str, str]
    state: Mapping[str, object]
    previous_snapshot_hash: str = ""

    def __post_init__(self) -> None:
        if self.tick < 0:
            raise ValueError("tick cannot be negative.")

    def digest(self) -> str:
        return stable_hash(asdict(self))


@dataclass(frozen=True)
class SaveManifest:
    save_id: str
    snapshot_id: str
    snapshot_hash: str
    contract_version: str
    module_versions: Mapping[str, str]
    event_count: int
    previous_save_id: str = ""


class SnapshotStore:
    def __init__(self) -> None:
        self._snapshots: Dict[str, StateSnapshot] = {}

    def add(self, snapshot: StateSnapshot) -> str:
        if snapshot.snapshot_id in self._snapshots:
            raise ValueError(f"Duplicate snapshot_id: {snapshot.snapshot_id}")
        if snapshot.previous_snapshot_hash:
            if snapshot.previous_snapshot_hash not in {s.digest() for s in self._snapshots.values()}:
                raise ValueError("previous_snapshot_hash is not present in the store.")
        self._snapshots[snapshot.snapshot_id] = snapshot
        return snapshot.digest()

    def rollback(self, snapshot_id: str) -> StateSnapshot:
        return self._snapshots[snapshot_id]

    def verify(self, snapshot_id: str, expected_hash: str) -> bool:
        return self._snapshots[snapshot_id].digest() == expected_hash


@dataclass(frozen=True)
class MigrationStep:
    migration_id: str
    from_version: str
    to_version: str
    description: str
    transform: Callable[[dict], dict]
    lossless: bool = True
    rollback_supported: bool = False


class MigrationRegistry:
    def __init__(self) -> None:
        self._by_from: Dict[str, MigrationStep] = {}

    def register(self, step: MigrationStep) -> None:
        if step.from_version in self._by_from:
            raise ValueError(f"Ambiguous migration from {step.from_version}.")
        if step.from_version == step.to_version:
            raise ValueError("Migration must change version.")
        self._by_from[step.from_version] = step

    def path(self, from_version: str, to_version: str) -> list[MigrationStep]:
        current = from_version
        path: list[MigrationStep] = []
        seen: set[str] = set()
        while current != to_version:
            if current in seen:
                raise ValueError("Migration cycle detected.")
            seen.add(current)
            if current not in self._by_from:
                raise KeyError(f"No migration from {current} toward {to_version}.")
            step = self._by_from[current]
            path.append(step)
            current = step.to_version
        return path

    def migrate(self, state: dict, from_version: str, to_version: str) -> dict:
        result = dict(state)
        for step in self.path(from_version, to_version):
            result = step.transform(result)
        return result
