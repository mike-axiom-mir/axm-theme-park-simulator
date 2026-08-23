from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List


FORBIDDEN_SHORTCUTS = {
    "age_only_demand_decay",
    "single_global_popularity",
    "decoration_object_count_score",
    "automatic_forced_replacement",
    "unseeded_random_state_change",
    "unexplained_metric_output",
    "visual_profile_changes_simulation",
    "beginner_profile_changes_simulation",
    "inspection_silently_mutates_state",
    "automatic_root_canonization",
}


@dataclass(frozen=True)
class ModuleManifest:
    module_id: str
    version: str
    owns: List[str]
    consumes: List[str]
    emits_events: List[str]
    consumes_events: List[str]
    declared_shortcuts: List[str]
    canonical_contract_version: str = "0.2.0"
    capabilities: List[str] = field(default_factory=list)
    direct_state_mutations: List[str] = field(default_factory=list)


class ModuleRegistry:
    def __init__(self) -> None:
        self._modules: Dict[str, ModuleManifest] = {}
        self._owners: Dict[str, str] = {}

    def register(self, manifest: ModuleManifest) -> None:
        forbidden = FORBIDDEN_SHORTCUTS.intersection(manifest.declared_shortcuts)
        if forbidden:
            raise ValueError(f"Module declares forbidden shortcuts: {sorted(forbidden)}")
        if manifest.direct_state_mutations:
            raise ValueError("Modules may not declare direct mutation of another module's state.")
        if manifest.module_id in self._modules:
            raise ValueError(f"Module already registered: {manifest.module_id}")
        for entity in manifest.owns:
            if entity in self._owners:
                raise ValueError(f"Entity '{entity}' already owned by {self._owners[entity]}")
        self._modules[manifest.module_id] = manifest
        for entity in manifest.owns:
            self._owners[entity] = manifest.module_id

    def owner_of(self, entity: str) -> str:
        return self._owners[entity]

    def unresolved_consumers(self) -> Dict[str, List[str]]:
        report: Dict[str, List[str]] = {}
        for module_id, manifest in self._modules.items():
            missing = [entity for entity in manifest.consumes if entity not in self._owners]
            if missing:
                report[module_id] = missing
        return report
