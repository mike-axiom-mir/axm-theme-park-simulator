from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping

from .models import ExplanationPacket


@dataclass(frozen=True)
class ParkIdentityIntent:
    identity_id: str
    name: str
    primary_mode: str
    priority_weights: Mapping[str, float]
    target_audiences: tuple[str, ...] = ()
    protected_elements: tuple[str, ...] = ()
    acceptable_tradeoffs: tuple[str, ...] = ()
    notes: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if not self.identity_id or not self.name:
            raise ValueError("identity_id and name are required")
        if not self.priority_weights:
            raise ValueError("at least one identity priority is required")
        if any(weight < 0 for weight in self.priority_weights.values()):
            raise ValueError("identity weights cannot be negative")
        if sum(self.priority_weights.values()) <= 0:
            raise ValueError("identity weights must sum to more than zero")


def evaluate_identity_alignment(
    subject_id: str,
    intent: ParkIdentityIntent,
    published_evidence: Mapping[str, float],
    *,
    state_version: int = 0,
) -> ExplanationPacket:
    weighted_known = 0.0
    known_weight = 0.0
    total_weight = sum(intent.priority_weights.values())
    missing = []
    causes = {}

    for priority, weight in intent.priority_weights.items():
        if priority not in published_evidence:
            missing.append(priority)
            continue
        value = max(0.0, min(1.0, float(published_evidence[priority])))
        contribution = value * weight
        causes[priority] = contribution
        weighted_known += contribution
        known_weight += weight

    result = weighted_known / known_weight if known_weight > 0 else 0.0
    coverage = known_weight / total_weight if total_weight > 0 else 0.0

    options = []
    if missing:
        options.append("Gather evidence for missing identity priorities before major changes.")
    low = [
        priority
        for priority, contribution in causes.items()
        if contribution / intent.priority_weights[priority] < 0.5
    ]
    if low:
        options.append("Review weak identity priorities: " + ", ".join(sorted(low)) + ".")

    return ExplanationPacket(
        subject_id=subject_id,
        metric_id="identity_alignment",
        result=result,
        unit="normalized_alignment",
        causes=causes,
        missing_evidence=sorted(missing),
        player_options=options,
        tradeoffs=list(intent.acceptable_tradeoffs),
        confidence=coverage,
        uncertainty_notes=(
            ["Alignment is based only on published evidence; missing priorities are not assumed bad."]
            if missing else []
        ),
        assumptions=[f"Player-selected identity: {intent.name}"],
        headline_causes=[
            name for name, _ in sorted(causes.items(), key=lambda item: (-abs(item[1]), item[0]))
        ],
        state_version=state_version,
    )
