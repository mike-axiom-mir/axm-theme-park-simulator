from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Mapping, Tuple


STAGES = (
    "unaware",
    "aware",
    "considering",
    "first_time_ready",
    "previous_satisfied",
    "loyal_repeat",
    "disappointed",
)


@dataclass(frozen=True)
class AudienceCohortState:
    """Conserved audience lifecycle state for one geography/segment cohort."""

    cohort_id: str
    origin_zone_id: str
    population: float
    unaware: float
    aware: float
    considering: float
    first_time_ready: float
    previous_satisfied: float
    loyal_repeat: float
    disappointed: float
    state_version: int = 0

    def __post_init__(self) -> None:
        if not self.cohort_id.strip() or not self.origin_zone_id.strip():
            raise ValueError("cohort and origin zone IDs are required")
        if not math.isfinite(float(self.population)) or self.population < 0:
            raise ValueError("population must be finite and non-negative")
        if self.state_version < 0:
            raise ValueError("state version must be non-negative")
        values = [float(getattr(self, stage)) for stage in STAGES]
        if any(not math.isfinite(value) or value < 0.0 for value in values):
            raise ValueError("cohort stage counts must be finite and non-negative")
        if not math.isclose(sum(values), self.population, rel_tol=0.0, abs_tol=1e-6):
            raise ValueError("cohort stage counts must conserve population")

    def stage(self, name: str) -> float:
        if name not in STAGES:
            raise KeyError(name)
        return float(getattr(self, name))

    @property
    def counts(self) -> Mapping[str, float]:
        return {stage: self.stage(stage) for stage in STAGES}

    @property
    def first_time_reservoir(self) -> float:
        """People who have not yet completed a first visit."""
        return self.unaware + self.aware + self.considering + self.first_time_ready

    @property
    def repeat_reservoir(self) -> float:
        return self.previous_satisfied + self.loyal_repeat


@dataclass(frozen=True)
class CohortForces:
    awareness_rate: float = 0.0
    consideration_rate: float = 0.0
    readiness_rate: float = 0.0
    first_visit_rate: float = 0.0
    repeat_visit_rate: float = 0.0
    repeat_strength: float = 0.5
    expectation_delivery: float = 0.5
    loyalty_rate: float = 0.0
    recovery_rate: float = 0.0
    visit_capacity: float = 0.0

    # Compatibility controls retained for future specialist models. They are
    # intentionally inactive unless explicitly supplied.
    loyalty_lapse_rate: float = 0.0
    disappointment_rate: float = 0.0

    def __post_init__(self) -> None:
        rate_fields = (
            "awareness_rate",
            "consideration_rate",
            "readiness_rate",
            "first_visit_rate",
            "repeat_visit_rate",
            "repeat_strength",
            "expectation_delivery",
            "loyalty_rate",
            "recovery_rate",
            "loyalty_lapse_rate",
            "disappointment_rate",
        )
        for name in rate_fields:
            value = float(getattr(self, name))
            if not math.isfinite(value) or not 0.0 <= value <= 1.0:
                raise ValueError(f"{name} must be finite and between 0 and 1")
        if not math.isfinite(float(self.visit_capacity)) or self.visit_capacity < 0:
            raise ValueError("visit_capacity must be finite and non-negative")


@dataclass(frozen=True)
class CohortTransition:
    from_stage: str
    to_stage: str
    amount: float
    cause: str

    def __post_init__(self) -> None:
        if self.from_stage not in STAGES or self.to_stage not in STAGES:
            raise ValueError("unsupported cohort stage")
        if self.from_stage == self.to_stage:
            raise ValueError("transition must move between different stages")
        if not math.isfinite(float(self.amount)) or self.amount < 0:
            raise ValueError("transition amount must be finite and non-negative")
        if not self.cause.strip():
            raise ValueError("transition cause is required")


@dataclass(frozen=True)
class MarketStepResult:
    prior_state: AudienceCohortState
    next_state: AudienceCohortState
    transitions: Tuple[CohortTransition, ...]
    first_time_demand: float
    repeat_demand: float
    first_time_visits: float
    repeat_visits: float
    unmet_first_time_demand: float
    unmet_repeat_demand: float
    conservation_error: float

    # Early reference aliases.
    @property
    def prior(self) -> AudienceCohortState:
        return self.prior_state

    @property
    def next(self) -> AudienceCohortState:
        return self.next_state


def _capacity_allocate(
    first_time_demand: float,
    repeat_demand: float,
    capacity: float,
) -> tuple[float, float]:
    total = first_time_demand + repeat_demand
    if total <= 0 or capacity <= 0:
        return 0.0, 0.0
    if total <= capacity:
        return first_time_demand, repeat_demand
    # Proportional allocation keeps the result deterministic and prevents one
    # demand type from silently erasing the other when capacity is constrained.
    ratio = capacity / total
    return first_time_demand * ratio, repeat_demand * ratio


def evolve_market_cohort(
    state: AudienceCohortState,
    forces: CohortForces,
    *,
    next_state_version: int | None = None,
) -> MarketStepResult:
    values = dict(state.counts)
    transitions: list[CohortTransition] = []

    def move(source: str, target: str, amount: float, cause: str) -> float:
        bounded = max(0.0, min(values[source], float(amount)))
        if bounded <= 1e-12:
            return 0.0
        values[source] -= bounded
        values[target] += bounded
        transitions.append(CohortTransition(source, target, bounded, cause))
        return bounded

    # Marketing and consideration move existing people through awareness states;
    # they can never create population.
    move("unaware", "aware", values["unaware"] * forces.awareness_rate, "awareness")
    move("aware", "considering", values["aware"] * forces.consideration_rate, "consideration")
    move(
        "considering",
        "first_time_ready",
        values["considering"] * forces.readiness_rate,
        "first_time_readiness",
    )

    first_time_demand = values["first_time_ready"] * forces.first_visit_rate
    previous_repeat_demand = (
        values["previous_satisfied"]
        * forces.repeat_visit_rate
        * forces.repeat_strength
    )
    loyal_repeat_demand = (
        values["loyal_repeat"]
        * forces.repeat_visit_rate
        * forces.repeat_strength
    )
    repeat_demand = previous_repeat_demand + loyal_repeat_demand
    first_time_visits, repeat_visits = _capacity_allocate(
        first_time_demand,
        repeat_demand,
        forces.visit_capacity,
    )

    # First-time visitors leave the first-time reservoir only through a real
    # completed visit. Expectation delivery determines the immediate memory.
    first_satisfied = first_time_visits * forces.expectation_delivery
    first_disappointed = first_time_visits - first_satisfied
    first_loyal = first_satisfied * forces.loyalty_rate
    first_previous = first_satisfied - first_loyal
    move("first_time_ready", "previous_satisfied", first_previous, "first_visit_satisfied")
    move("first_time_ready", "loyal_repeat", first_loyal, "first_visit_created_loyalty")
    move("first_time_ready", "disappointed", first_disappointed, "first_visit_disappointed")

    # Allocate repeat visits back across their source stages proportionally to
    # their demand so capacity restrictions remain explainable.
    previous_repeat_visits = 0.0
    loyal_repeat_visits = 0.0
    if repeat_demand > 0:
        previous_repeat_visits = repeat_visits * (previous_repeat_demand / repeat_demand)
        loyal_repeat_visits = repeat_visits - previous_repeat_visits

    previous_disappointed = previous_repeat_visits * (1.0 - forces.expectation_delivery)
    previous_satisfied_visit = previous_repeat_visits - previous_disappointed
    previous_promoted = previous_satisfied_visit * forces.loyalty_rate
    move(
        "previous_satisfied",
        "disappointed",
        previous_disappointed,
        "repeat_visit_disappointed",
    )
    move(
        "previous_satisfied",
        "loyal_repeat",
        previous_promoted,
        "repeat_visit_created_loyalty",
    )

    loyal_disappointed = loyal_repeat_visits * (1.0 - forces.expectation_delivery)
    move("loyal_repeat", "disappointed", loyal_disappointed, "loyal_repeat_disappointed")

    # Optional background deterioration is explicit rather than hidden in age.
    move(
        "previous_satisfied",
        "disappointed",
        values["previous_satisfied"] * forces.disappointment_rate,
        "documented_experience_disappointment",
    )
    move(
        "loyal_repeat",
        "previous_satisfied",
        values["loyal_repeat"] * forces.loyalty_lapse_rate,
        "documented_loyalty_lapse",
    )

    # Recovery repairs willingness/trust but never erases visit history. A
    # recovered person remains in the repeat reservoir and cannot become a
    # first-time visitor again through awareness transitions.
    move(
        "disappointed",
        "previous_satisfied",
        values["disappointed"] * forces.recovery_rate,
        "trust_recovery_preserved_prior_exposure",
    )

    version = state.state_version + 1 if next_state_version is None else next_state_version
    if version <= state.state_version:
        raise ValueError("next_state_version must advance")
    next_state = AudienceCohortState(
        cohort_id=state.cohort_id,
        origin_zone_id=state.origin_zone_id,
        population=state.population,
        state_version=version,
        **values,
    )
    conservation_error = math.fsum(next_state.counts.values()) - state.population
    return MarketStepResult(
        prior_state=state,
        next_state=next_state,
        transitions=tuple(transitions),
        first_time_demand=first_time_demand,
        repeat_demand=repeat_demand,
        first_time_visits=first_time_visits,
        repeat_visits=repeat_visits,
        unmet_first_time_demand=max(0.0, first_time_demand - first_time_visits),
        unmet_repeat_demand=max(0.0, repeat_demand - repeat_visits),
        conservation_error=conservation_error,
    )
