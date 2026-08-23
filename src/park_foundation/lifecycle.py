from __future__ import annotations

from dataclasses import dataclass
from typing import Dict

from .util import bounded


@dataclass(frozen=True)
class LifecycleEvidence:
    physical_condition: float
    current_contribution: float
    identity_alignment: float
    audience_reach: float
    repeat_strength: float
    improvement_headroom: float
    land_pressure: float
    alternative_value: float
    safety_status: float
    evidence_refs: tuple[str, ...] = ()
    missing_evidence: tuple[str, ...] = ()


@dataclass(frozen=True)
class OptionAssessment:
    action: str
    viability: float
    causes: Dict[str, float]
    note: str


@dataclass(frozen=True)
class LifecycleDecisionPacket:
    subject_id: str
    options: Dict[str, OptionAssessment]
    evidence_refs: tuple[str, ...]
    missing_evidence: tuple[str, ...]
    forced_action: str | None = None


def evaluate_lifecycle_options(subject_id: str, data: LifecycleEvidence) -> LifecycleDecisionPacket:
    values = {name: bounded(getattr(data, name)) for name in (
        "physical_condition", "current_contribution", "identity_alignment",
        "audience_reach", "repeat_strength", "improvement_headroom",
        "land_pressure", "alternative_value", "safety_status",
    )}
    maintain_causes = {
        "physical_condition": values["physical_condition"] * 0.30,
        "current_contribution": values["current_contribution"] * 0.35,
        "identity_alignment": values["identity_alignment"] * 0.20,
        "safety_status": values["safety_status"] * 0.15,
    }
    evolve_causes = {
        "improvement_headroom": values["improvement_headroom"] * 0.40,
        "audience_reach": values["audience_reach"] * 0.20,
        "repeat_strength": values["repeat_strength"] * 0.15,
        "identity_alignment": values["identity_alignment"] * 0.15,
        "physical_feasibility": values["physical_condition"] * 0.10,
    }
    replace_causes = {
        "land_pressure": values["land_pressure"] * 0.25,
        "specific_alternative_value": values["alternative_value"] * 0.35,
        "low_current_contribution": (1.0 - values["current_contribution"]) * 0.15,
        "low_identity_alignment": (1.0 - values["identity_alignment"]) * 0.10,
        "condition_or_safety_pressure": (
            (1.0 - values["physical_condition"]) * 0.08
            + (1.0 - values["safety_status"]) * 0.07
        ),
    }
    options = {
        "maintain": OptionAssessment("maintain", sum(maintain_causes.values()), maintain_causes,
                                     "Preserve current value and history."),
        "evolve": OptionAssessment("evolve", sum(evolve_causes.values()), evolve_causes,
                                   "Improve a specific weakness or opportunity."),
        "replace": OptionAssessment("replace", sum(replace_causes.values()), replace_causes,
                                    "Compare only against a concrete alternative use."),
    }
    return LifecycleDecisionPacket(
        subject_id=subject_id,
        options=options,
        evidence_refs=data.evidence_refs,
        missing_evidence=data.missing_evidence,
        forced_action=None,
    )
