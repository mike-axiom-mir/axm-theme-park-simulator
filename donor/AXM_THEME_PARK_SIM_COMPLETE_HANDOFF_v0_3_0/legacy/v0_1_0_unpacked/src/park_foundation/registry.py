from dataclasses import dataclass
from typing import Dict, List

FORBIDDEN_SHORTCUTS = {
    "age_only_demand_decay",
    "single_global_popularity",
    "decoration_object_count_score",
    "automatic_forced_replacement",
    "unseeded_random_state_change",
    "unexplained_metric_output",
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

class ModuleRegistry:
    def __init__(self) -> None:
        self._modules: Dict[str, ModuleManifest] = {}
        self._owners: Dict[str, str] = {}

    def register(self, manifest: ModuleManifest) -> None:
        forbidden = FORBIDDEN_SHORTCUTS.intersection(manifest.declared_shortcuts)
        if forbidden:
            raise ValueError(f"Module declares forbidden shortcuts: {sorted(forbidden)}")
        if manifest.module_id in self._modules:
            raise ValueError(f"Module already registered: {manifest.module_id}")
        for entity in manifest.owns:
            if entity in self._owners:
                raise ValueError(
                    f"Entity '{entity}' already owned by {self._owners[entity]}"
                )
        self._modules[manifest.module_id] = manifest
        for entity in manifest.owns:
            self._owners[entity] = manifest.module_id

    def owner_of(self, entity: str) -> str:
        return self._owners[entity]
