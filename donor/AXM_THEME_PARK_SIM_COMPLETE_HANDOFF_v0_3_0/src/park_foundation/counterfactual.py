from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Mapping


_ALLOWED_ACTIONS = {
    "maintain",
    "evolve",
    "replace",
    "retarget",
    "refurbish",
    "preserve",
    "seasonal_overlay",
    "capacity_upgrade",
    "close_temporarily_for_safety",
    "change_opening_schedule",
    "no_action",
}


def _is_sha256_hex(value: str) -> bool:
    return len(value) == 64 and all(character in "0123456789abcdef" for character in value)


def _validate_numeric_mapping(
    name: str,
    values: Mapping[str, float],
    *,
    non_negative: bool = False,
) -> None:
    for key, value in values.items():
        if not str(key).strip():
            raise ValueError(f"{name} keys are required")
        number = float(value)
        if not math.isfinite(number):
            raise ValueError(f"{name} values must be finite")
        if non_negative and number < 0:
            raise ValueError(f"{name} values must be non-negative")


@dataclass(frozen=True)
class CounterfactualProjection:
    projection_id: str
    plan_id: str
    target_id: str
    action: str
    baseline_state_hash: str
    baseline_state_version: int
    projected_metrics: Mapping[str, float]
    costs: Mapping[str, float]
    confidence: float
    assumptions: tuple[str, ...] = ()
    evidence_refs: tuple[str, ...] = ()
    reversible: bool = True
    commits_state: bool = False

    def __post_init__(self) -> None:
        if not all(value.strip() for value in (
            self.projection_id, self.plan_id, self.target_id
        )):
            raise ValueError("projection identifiers are required")
        if self.action not in _ALLOWED_ACTIONS:
            raise ValueError("unsupported counterfactual action")
        if not _is_sha256_hex(self.baseline_state_hash):
            raise ValueError("baseline_state_hash must be a lowercase SHA-256 hex string")
        if self.baseline_state_version < 0:
            raise ValueError("baseline_state_version must be non-negative")
        if not math.isfinite(float(self.confidence)) or not 0.0 <= self.confidence <= 1.0:
            raise ValueError("confidence must be finite and between 0 and 1")
        _validate_numeric_mapping("projected_metrics", self.projected_metrics)
        _validate_numeric_mapping("costs", self.costs, non_negative=True)
        if self.commits_state:
            raise ValueError("counterfactual projections may not commit authoritative state")


@dataclass(frozen=True)
class ProjectionReview:
    plan_id: str
    action: str
    weighted_delta: float
    evidence_adjusted_delta: float
    confidence: float
    coverage: float
    metric_deltas: Mapping[str, float]
    costs: Mapping[str, float]
    warnings: tuple[str, ...]


@dataclass(frozen=True)
class CounterfactualComparison:
    baseline_state_hash: str
    baseline_state_version: int
    reviews: Mapping[str, ProjectionReview]
    review_order: tuple[str, ...]
    automatic_selection: bool = False


def compare_counterfactuals(
    *,
    baseline_state_hash: str,
    baseline_state_version: int,
    baseline_metrics: Mapping[str, float],
    projections: tuple[CounterfactualProjection, ...],
    priority_weights: Mapping[str, float],
) -> CounterfactualComparison:
    if not _is_sha256_hex(baseline_state_hash):
        raise ValueError("baseline_state_hash must be a lowercase SHA-256 hex string")
    if baseline_state_version < 0:
        raise ValueError("baseline_state_version must be non-negative")
    _validate_numeric_mapping("baseline_metrics", baseline_metrics)
    if not priority_weights:
        raise ValueError("priority weights must be present and non-negative")
    _validate_numeric_mapping("priority_weights", priority_weights, non_negative=True)
    total_weight = math.fsum(float(value) for value in priority_weights.values())
    if total_weight <= 0:
        raise ValueError("priority weights must sum to more than zero")

    reviews: dict[str, ProjectionReview] = {
        "no_action": ProjectionReview(
            plan_id="no_action",
            action="no_action",
            weighted_delta=0.0,
            evidence_adjusted_delta=0.0,
            confidence=1.0,
            coverage=1.0,
            metric_deltas={key: 0.0 for key in priority_weights},
            costs={},
            warnings=("Baseline remains available; no change is forced.",),
        )
    }

    seen_ids: set[str] = set()
    seen_projection_ids: set[str] = set()
    for projection in projections:
        if projection.plan_id in seen_ids or projection.plan_id == "no_action":
            raise ValueError(f"duplicate or reserved plan_id: {projection.plan_id}")
        if projection.projection_id in seen_projection_ids:
            raise ValueError(f"duplicate projection_id: {projection.projection_id}")
        seen_ids.add(projection.plan_id)
        seen_projection_ids.add(projection.projection_id)
        if projection.baseline_state_hash != baseline_state_hash:
            raise ValueError("all projections must use the same baseline state hash")
        if projection.baseline_state_version != baseline_state_version:
            raise ValueError("all projections must use the same baseline state version")

        deltas: dict[str, float] = {}
        known_weight = 0.0
        weighted_parts: list[float] = []
        missing: list[str] = []
        for metric, weight in priority_weights.items():
            if metric not in baseline_metrics or metric not in projection.projected_metrics:
                missing.append(metric)
                continue
            delta = float(projection.projected_metrics[metric]) - float(
                baseline_metrics[metric]
            )
            deltas[metric] = delta
            weighted_parts.append(delta * float(weight))
            known_weight += float(weight)

        weighted = math.fsum(weighted_parts)
        coverage = known_weight / total_weight
        normalized_delta = weighted / known_weight if known_weight > 0 else 0.0
        effective_confidence = projection.confidence * coverage
        warnings: list[str] = []
        if missing:
            warnings.append("Missing projected evidence: " + ", ".join(sorted(missing)))
        if not projection.reversible:
            warnings.append("This plan is marked irreversible; preserve a rollback branch first.")
        if projection.costs:
            warnings.append("Costs are displayed separately and are not hidden inside the score.")
        if projection.confidence < 0.5:
            warnings.append("Low-confidence projection: gather evidence before commitment.")

        reviews[projection.plan_id] = ProjectionReview(
            plan_id=projection.plan_id,
            action=projection.action,
            weighted_delta=normalized_delta,
            evidence_adjusted_delta=normalized_delta * effective_confidence,
            confidence=projection.confidence,
            coverage=coverage,
            metric_deltas=deltas,
            costs=dict(projection.costs),
            warnings=tuple(warnings),
        )

    order = tuple(sorted(
        reviews,
        key=lambda plan_id: (
            -reviews[plan_id].evidence_adjusted_delta,
            plan_id != "no_action",
            plan_id,
        ),
    ))
    return CounterfactualComparison(
        baseline_state_hash=baseline_state_hash,
        baseline_state_version=baseline_state_version,
        reviews=reviews,
        review_order=order,
        automatic_selection=False,
    )
