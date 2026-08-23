from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, Mapping


@dataclass(frozen=True)
class CampaignEnding:
    ending_id: str
    title: str
    required_tags: frozenset[str]
    forbidden_tags: frozenset[str] = frozenset()
    minimum_evidence_refs: int = 1
    summary: str = ""


@dataclass
class CampaignState:
    campaign_id: str
    inherited_context: Mapping[str, object]
    reached_tags: set[str] = field(default_factory=set)
    evidence_refs: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class CampaignOutcome:
    campaign_id: str
    available_ending_ids: tuple[str, ...]
    blocked_reasons: Mapping[str, tuple[str, ...]]


def evaluate_campaign_endings(
    state: CampaignState,
    endings: Iterable[CampaignEnding],
) -> CampaignOutcome:
    available: list[str] = []
    blocked: dict[str, tuple[str, ...]] = {}
    for ending in endings:
        reasons: list[str] = []
        missing = sorted(ending.required_tags - state.reached_tags)
        forbidden = sorted(ending.forbidden_tags & state.reached_tags)
        if missing:
            reasons.append(f"missing tags: {', '.join(missing)}")
        if forbidden:
            reasons.append(f"forbidden tags present: {', '.join(forbidden)}")
        if len(state.evidence_refs) < ending.minimum_evidence_refs:
            reasons.append("insufficient evidence references")
        if reasons:
            blocked[ending.ending_id] = tuple(reasons)
        else:
            available.append(ending.ending_id)
    return CampaignOutcome(
        campaign_id=state.campaign_id,
        available_ending_ids=tuple(available),
        blocked_reasons=blocked,
    )
