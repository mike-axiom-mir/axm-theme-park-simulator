from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List

from .version import FOUNDATION_CONTRACT_VERSION


FORBIDDEN_SHORTCUTS = {
    "age_only_demand_decay",
    "single_global_popularity",
    "decoration_object_count_score",
    "automatic_forced_replacement",
    "unseeded_random_state_change",
    "unexplained_metric_output",
    "adventure_state_fork",
    "beginner_fake_simulation",
    "silent_contract_migration",
    "forced_single_campaign_ending",
    "uncertainty_erasure",
    "marketing_guest_spawn_without_audience",
    "direct_state_mutation_outside_owner",
    "render_state_authority",
    "contribution_double_counting",
    "command_without_expected_state_version",
    "destructive_rollback_without_branch",
    "cohort_population_creation_without_source",
    "counterfactual_auto_commit",
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
    canonical_contract_version: str = FOUNDATION_CONTRACT_VERSION
    capabilities: List[str] = field(default_factory=list)
    status: str = "scaffold"
    seeded_randomness_only: bool = True
    replay_safe: bool = True
    required_capabilities: List[str] = field(default_factory=list)
    state_namespaces: List[str] = field(default_factory=list)
    system_ids: List[str] = field(default_factory=list)


class ModuleRegistry:
    def __init__(self) -> None:
        self._modules: Dict[str, ModuleManifest] = {}
        self._owners: Dict[str, str] = {}

    def register(self, manifest: ModuleManifest) -> None:
        forbidden = FORBIDDEN_SHORTCUTS.intersection(manifest.declared_shortcuts)
        if forbidden:
            raise ValueError(f"Module declares forbidden shortcuts: {sorted(forbidden)}")
        if manifest.canonical_contract_version != FOUNDATION_CONTRACT_VERSION:
            raise ValueError(
                f"Contract mismatch: {manifest.canonical_contract_version} "
                f"!= {FOUNDATION_CONTRACT_VERSION}"
            )
        if not manifest.seeded_randomness_only or not manifest.replay_safe:
            raise ValueError("Module must declare seeded randomness and replay safety.")
        if manifest.status not in {"scaffold", "reference", "implemented", "experimental"}:
            raise ValueError(f"Unsupported module status: {manifest.status}")
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

    def validate_consumers(self, foundation_entities: set[str] | None = None) -> List[str]:
        known = set(self._owners)
        if foundation_entities:
            known.update(foundation_entities)
        missing = []
        for module in self._modules.values():
            for entity in module.consumes:
                if entity not in known:
                    missing.append(f"{module.module_id}:{entity}")
        return sorted(missing)

    @property
    def modules(self) -> Dict[str, ModuleManifest]:
        return dict(self._modules)
