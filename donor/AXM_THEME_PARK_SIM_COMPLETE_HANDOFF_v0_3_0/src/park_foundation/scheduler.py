from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Dict, Iterable, Tuple

from .canonical import sha256_value


PHASE_ORDER: Dict[str, int] = {
    "command": 10,
    "world": 20,
    "arrival": 30,
    "movement": 40,
    "queue": 50,
    "experience": 60,
    "service": 70,
    "crew": 80,
    "economy": 90,
    "maintenance": 100,
    "evidence": 110,
    "snapshot": 120,
    "animation": 200,
    "presentation": 210,
}

PRESENTATION_PHASES = frozenset({"animation", "presentation"})


@dataclass(frozen=True)
class SystemSpec:
    system_id: str
    module_id: str
    phase: str
    cadence_ticks: int = 1
    offset_ticks: int = 0
    priority: int = 100
    reads: Tuple[str, ...] = ()
    writes: Tuple[str, ...] = ()
    authoritative: bool = True
    skippable: bool = False

    def __post_init__(self) -> None:
        if not self.system_id or not self.module_id:
            raise ValueError("system_id and module_id are required")
        if self.phase not in PHASE_ORDER:
            raise ValueError(f"unsupported phase: {self.phase}")
        if self.cadence_ticks <= 0:
            raise ValueError("cadence_ticks must be positive")
        if not 0 <= self.offset_ticks < self.cadence_ticks:
            raise ValueError("offset_ticks must be within cadence")
        if self.skippable and self.authoritative:
            raise ValueError("authoritative systems cannot be skippable")
        if self.phase in PRESENTATION_PHASES and self.authoritative:
            raise ValueError("animation/presentation systems cannot mutate authoritative state")
        if len(set(self.writes)) != len(self.writes):
            raise ValueError("writes cannot contain duplicates")

    def is_due(self, tick: int) -> bool:
        if tick < 0:
            raise ValueError("tick must be non-negative")
        return tick >= self.offset_ticks and (tick - self.offset_ticks) % self.cadence_ticks == 0


@dataclass(frozen=True)
class TickPlan:
    tick: int
    systems: Tuple[SystemSpec, ...]
    plan_hash: str


class DeterministicScheduler:
    """Pure deterministic system planner.

    It does not execute domain logic. It establishes stable ordering, cadence,
    and the rule that overloaded machines may drop visual work but never skip
    authoritative simulation work.
    """

    def __init__(self) -> None:
        self._systems: Dict[str, SystemSpec] = {}

    def register(self, spec: SystemSpec) -> None:
        if spec.system_id in self._systems:
            raise ValueError(f"duplicate system_id: {spec.system_id}")
        self._systems[spec.system_id] = spec

    def plan_tick(self, tick: int, *, include_skippable: bool = True) -> TickPlan:
        if tick < 0:
            raise ValueError("tick must be non-negative")
        due = [
            spec for spec in self._systems.values()
            if spec.is_due(tick) and (include_skippable or not spec.skippable)
        ]
        ordered = tuple(sorted(
            due,
            key=lambda item: (
                PHASE_ORDER[item.phase],
                item.priority,
                item.module_id,
                item.system_id,
            ),
        ))
        payload = {"tick": tick, "systems": [asdict(item) for item in ordered]}
        return TickPlan(tick=tick, systems=ordered, plan_hash=sha256_value(payload))

    def validate_namespace_ownership(
        self,
        namespace_owners: Dict[str, str],
        authoritative_namespaces: Iterable[str] = (),
    ) -> Tuple[str, ...]:
        issues = []
        authoritative = set(authoritative_namespaces)
        for spec in self._systems.values():
            for namespace in spec.writes:
                owner = namespace_owners.get(namespace)
                if owner is None:
                    issues.append(f"{spec.system_id}:unknown namespace:{namespace}")
                elif owner != spec.module_id:
                    issues.append(
                        f"{spec.system_id}:namespace {namespace} owned by {owner}, not {spec.module_id}"
                    )
                if not spec.authoritative and namespace in authoritative:
                    issues.append(
                        f"{spec.system_id}:visual/non-authoritative system writes authoritative namespace {namespace}"
                    )
        return tuple(sorted(issues))

    @property
    def systems(self) -> Dict[str, SystemSpec]:
        return dict(self._systems)
