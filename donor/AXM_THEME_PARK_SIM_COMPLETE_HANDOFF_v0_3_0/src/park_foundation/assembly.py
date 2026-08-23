from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, Mapping, Tuple

from .registry import ModuleManifest, ModuleRegistry


@dataclass(frozen=True)
class AssemblyReport:
    valid: bool
    missing_entities: Tuple[str, ...]
    missing_capabilities: Tuple[str, ...]
    missing_event_producers: Tuple[str, ...]
    namespace_conflicts: Tuple[str, ...]
    duplicate_system_ids: Tuple[str, ...]
    warnings: Tuple[str, ...]

    @property
    def blocking_issues(self) -> Tuple[str, ...]:
        return tuple(sorted(
            self.missing_entities
            + self.missing_capabilities
            + self.missing_event_producers
            + self.namespace_conflicts
            + self.duplicate_system_ids
        ))


class RuntimeAssemblyPlanner:
    """Checks that independently built modules can actually form one runtime."""

    def __init__(self, manifests: Iterable[ModuleManifest]) -> None:
        self._manifests = tuple(manifests)

    def validate(self, *, foundation_entities: set[str] | None = None) -> AssemblyReport:
        registry = ModuleRegistry()
        registration_issues = []
        for manifest in self._manifests:
            try:
                registry.register(manifest)
            except ValueError as error:
                registration_issues.append(str(error))

        missing_entities = tuple(registry.validate_consumers(foundation_entities))

        capability_providers: Dict[str, set[str]] = {}
        event_producers: Dict[str, set[str]] = {}
        event_consumers: Dict[str, set[str]] = {}
        namespace_owner: Dict[str, str] = {}
        namespace_conflicts = list(registration_issues)
        systems: Dict[str, str] = {}
        duplicate_systems = []

        for manifest in self._manifests:
            for capability in manifest.capabilities:
                capability_providers.setdefault(capability, set()).add(manifest.module_id)
            for event in manifest.emits_events:
                event_producers.setdefault(event, set()).add(manifest.module_id)
            for event in manifest.consumes_events:
                event_consumers.setdefault(event, set()).add(manifest.module_id)
            for namespace in manifest.state_namespaces:
                previous = namespace_owner.get(namespace)
                if previous and previous != manifest.module_id:
                    namespace_conflicts.append(
                        f"namespace {namespace} claimed by {previous} and {manifest.module_id}"
                    )
                namespace_owner[namespace] = manifest.module_id
            for system_id in manifest.system_ids:
                previous = systems.get(system_id)
                if previous:
                    duplicate_systems.append(
                        f"system {system_id} declared by {previous} and {manifest.module_id}"
                    )
                systems[system_id] = manifest.module_id

        missing_capabilities = []
        for manifest in self._manifests:
            for capability in manifest.required_capabilities:
                if capability not in capability_providers:
                    missing_capabilities.append(f"{manifest.module_id}:{capability}")

        missing_events = []
        for manifest in self._manifests:
            for event in manifest.consumes_events:
                if event not in event_producers:
                    missing_events.append(f"{manifest.module_id}:{event}")

        warnings = []
        for event, producers in sorted(event_producers.items()):
            if event not in event_consumers:
                warnings.append(
                    f"unconsumed event {event} from {', '.join(sorted(producers))}"
                )
        for capability, providers in sorted(capability_providers.items()):
            if len(providers) > 1:
                warnings.append(
                    f"multiple providers for capability {capability}: {', '.join(sorted(providers))}"
                )

        report = AssemblyReport(
            valid=not (
                missing_entities or missing_capabilities or missing_events
                or namespace_conflicts or duplicate_systems
            ),
            missing_entities=tuple(sorted(missing_entities)),
            missing_capabilities=tuple(sorted(missing_capabilities)),
            missing_event_producers=tuple(sorted(missing_events)),
            namespace_conflicts=tuple(sorted(namespace_conflicts)),
            duplicate_system_ids=tuple(sorted(duplicate_systems)),
            warnings=tuple(sorted(warnings)),
        )
        return report
