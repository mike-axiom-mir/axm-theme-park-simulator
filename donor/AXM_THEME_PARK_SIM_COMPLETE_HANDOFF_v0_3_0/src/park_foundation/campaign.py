from __future__ import annotations

from dataclasses import dataclass, replace
import operator
from typing import Mapping


_OPERATORS = {
    "gte": operator.ge,
    "lte": operator.le,
    "gt": operator.gt,
    "lt": operator.lt,
    "eq": operator.eq,
    "ne": operator.ne,
}


@dataclass(frozen=True)
class Condition:
    metric: str
    operator: str
    value: float

    def __post_init__(self) -> None:
        if self.operator not in _OPERATORS:
            raise ValueError(f"unsupported operator: {self.operator}")

    def matches(self, metrics: Mapping[str, float]) -> bool:
        if self.metric not in metrics:
            return False
        return bool(_OPERATORS[self.operator](float(metrics[self.metric]), self.value))


@dataclass(frozen=True)
class OutcomePath:
    outcome_id: str
    label: str
    conditions: tuple[Condition, ...]
    epilogue: str
    postgame_hook: str | None = None

    def eligible(self, metrics: Mapping[str, float]) -> bool:
        return all(condition.matches(metrics) for condition in self.conditions)


@dataclass(frozen=True)
class CampaignDefinition:
    campaign_id: str
    name: str
    outcome_paths: tuple[OutcomePath, ...]
    description: str = ""
    multiple_valid_outcomes: bool = True

    def __post_init__(self) -> None:
        if self.multiple_valid_outcomes and len(self.outcome_paths) < 2:
            raise ValueError("multiple-valid-outcome campaigns require at least two paths")
        ids = [path.outcome_id for path in self.outcome_paths]
        if len(ids) != len(set(ids)):
            raise ValueError("outcome IDs must be unique")


@dataclass(frozen=True)
class CampaignState:
    campaign_id: str
    phase: str = "active"
    state_version: int = 0
    metrics: Mapping[str, float] = None  # type: ignore[assignment]
    completed_outcomes: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if self.state_version < 0:
            raise ValueError("state_version must be non-negative")
        if self.metrics is None:
            object.__setattr__(self, "metrics", {})

    def with_metrics(self, updates: Mapping[str, float]) -> "CampaignState":
        merged = dict(self.metrics)
        merged.update({key: float(value) for key, value in updates.items()})
        return replace(self, metrics=merged, state_version=self.state_version + 1)


class CampaignEvaluator:
    @staticmethod
    def eligible_outcomes(
        definition: CampaignDefinition,
        state: CampaignState,
    ) -> tuple[OutcomePath, ...]:
        if definition.campaign_id != state.campaign_id:
            raise ValueError("campaign definition/state mismatch")
        return tuple(
            path for path in definition.outcome_paths if path.eligible(state.metrics)
        )

    @staticmethod
    def complete(
        definition: CampaignDefinition,
        state: CampaignState,
        chosen_outcome_id: str,
    ) -> CampaignState:
        eligible = {
            path.outcome_id
            for path in CampaignEvaluator.eligible_outcomes(definition, state)
        }
        if chosen_outcome_id not in eligible:
            raise ValueError("chosen outcome is not currently eligible")
        completed = tuple(dict.fromkeys((*state.completed_outcomes, chosen_outcome_id)))
        return replace(
            state,
            phase="completed",
            completed_outcomes=completed,
            state_version=state.state_version + 1,
        )
