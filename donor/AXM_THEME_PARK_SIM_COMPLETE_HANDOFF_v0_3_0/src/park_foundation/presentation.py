from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .models import ExplanationPacket


@dataclass(frozen=True)
class PresentationProfile:
    profile_id: str
    max_causes: int
    max_options: int
    show_confidence: bool
    show_missing_evidence: bool
    show_raw_evidence: bool

    def __post_init__(self) -> None:
        if self.profile_id not in {"beginner", "standard", "advanced"}:
            raise ValueError("unsupported presentation profile")
        if self.max_causes <= 0 or self.max_options <= 0:
            raise ValueError("presentation limits must be positive")


BEGINNER = PresentationProfile(
    "beginner", max_causes=3, max_options=2,
    show_confidence=True, show_missing_evidence=True, show_raw_evidence=False,
)
STANDARD = PresentationProfile(
    "standard", max_causes=6, max_options=4,
    show_confidence=True, show_missing_evidence=True, show_raw_evidence=False,
)
ADVANCED = PresentationProfile(
    "advanced", max_causes=10_000, max_options=10_000,
    show_confidence=True, show_missing_evidence=True, show_raw_evidence=True,
)


def render_explanation(
    packet: ExplanationPacket,
    profile: PresentationProfile,
) -> dict[str, Any]:
    preferred = [
        name for name in packet.headline_causes
        if name in packet.causes
    ]
    preferred_set = set(preferred)
    remaining = sorted(
        (
            item for item in packet.causes.items()
            if item[0] not in preferred_set
        ),
        key=lambda item: (-abs(item[1]), item[0]),
    )
    ordered_causes = [(name, packet.causes[name]) for name in preferred] + remaining
    visible_causes = dict(ordered_causes[:profile.max_causes])
    result = {
        "profile_id": profile.profile_id,
        "subject_id": packet.subject_id,
        "metric_id": packet.metric_id,
        "result": packet.result,
        "unit": packet.unit,
        "state_version": packet.state_version,
        "causes": visible_causes,
        "player_options": packet.player_options[:profile.max_options],
        "tradeoffs": packet.tradeoffs[:profile.max_options],
        "uncertainty_notes": packet.uncertainty_notes,
    }
    if profile.show_confidence:
        result["confidence"] = packet.confidence
    if profile.show_missing_evidence:
        result["missing_evidence"] = packet.missing_evidence
    if profile.show_raw_evidence:
        result["evidence_refs"] = packet.evidence_refs
        result["assumptions"] = packet.assumptions
        result["all_causes"] = packet.causes
    return result
