from __future__ import annotations

from dataclasses import dataclass

from .models import ExplanationPacket


@dataclass(frozen=True)
class AssistanceProfile:
    profile_id: str
    detail_level: str
    recommendation_limit: int
    auto_pause: bool
    show_confidence: bool
    show_alternatives: bool

    def __post_init__(self) -> None:
        if self.detail_level not in {"beginner", "standard", "expert"}:
            raise ValueError("Unsupported detail_level.")
        if self.recommendation_limit < 0:
            raise ValueError("recommendation_limit cannot be negative.")


@dataclass(frozen=True)
class GuidanceCard:
    subject_id: str
    source_result: float
    headline: str
    top_causes: tuple[tuple[str, float], ...]
    recommendations: tuple[str, ...]
    evidence_refs: tuple[str, ...]
    confidence: float | None
    alternatives: tuple[str, ...]


def render_guidance(packet: ExplanationPacket, profile: AssistanceProfile) -> GuidanceCard:
    ranked_causes = sorted(packet.causes.items(), key=lambda item: abs(item[1]), reverse=True)
    cause_limit = 2 if profile.detail_level == "beginner" else 5 if profile.detail_level == "standard" else len(ranked_causes)
    top_causes = tuple(ranked_causes[:cause_limit])
    recommendations = tuple(packet.player_options[:profile.recommendation_limit])
    headline = (
        f"{packet.subject_id}: evidence shows a positive result."
        if packet.result >= 0
        else f"{packet.subject_id}: evidence shows current pressure."
    )
    return GuidanceCard(
        subject_id=packet.subject_id,
        source_result=packet.result,
        headline=headline,
        top_causes=top_causes,
        recommendations=recommendations,
        evidence_refs=tuple(packet.evidence_refs),
        confidence=packet.confidence if profile.show_confidence else None,
        alternatives=tuple(packet.alternatives) if profile.show_alternatives else (),
    )
