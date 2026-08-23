from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List


@dataclass(frozen=True)
class DemandInputs:
    geographic_reach: float
    awareness: float
    audience_fit: float
    travel_friction_inverse: float
    price_fit: float
    marketing_fit: float
    expectation_delivery: float
    first_time_share: float = 1.0
    repeat_strength: float = 0.5
    access_availability: float = 1.0
    context_fit: float = 1.0


@dataclass(frozen=True)
class AtmosphereInputs:
    coherence: float
    visibility: float
    sensory_integration: float
    queue_ride_integration: float
    audience_theme_fit: float
    maintenance: float
    clutter: float = 0.0
    transition_quality: float = 0.5
    environmental_comfort: float = 0.5
    contradiction: float = 0.0
    theme_intensity: float = 0.5


@dataclass(frozen=True)
class ContributionInputs:
    direct_revenue: float = 0.0
    induced_spend: float = 0.0
    visit_attraction_value: float = 0.0
    duration_value: float = 0.0
    identity_value: float = 0.0
    crowd_balance_value: float = 0.0
    heritage_value: float = 0.0
    strategic_resilience_value: float = 0.0
    operating_cost: float = 0.0
    maintenance_cost: float = 0.0
    staffing_cost: float = 0.0
    risk_cost: float = 0.0
    land_opportunity_cost: float = 0.0


@dataclass(frozen=True)
class AttendanceBalanceInputs:
    active_visitors: float
    minimum_viable_attendance: float
    comfortable_capacity: float
    service_capacity: float
    attraction_capacity: float
    operating_cost_per_hour: float
    revenue_per_active_visitor_hour: float


@dataclass(frozen=True)
class StrategyInputs:
    condition: float
    financial_contribution: float
    identity_fit: float
    audience_fit: float
    repeat_strength: float
    replacement_opportunity: float
    heritage_value: float = 0.0
    safety_risk: float = 0.0


@dataclass
class ExplanationPacket:
    subject_id: str
    result: float
    causes: Dict[str, float]
    metric_id: str = ""
    unit: str = "score"
    evidence_refs: List[str] = field(default_factory=list)
    missing_evidence: List[str] = field(default_factory=list)
    assumptions: List[str] = field(default_factory=list)
    player_options: List[str] = field(default_factory=list)
    tradeoffs: List[str] = field(default_factory=list)
    confidence: float = 1.0
    uncertainty_notes: List[str] = field(default_factory=list)
    headline_causes: List[str] = field(default_factory=list)
    state_version: int = 0


@dataclass
class StrategyAssessment:
    subject_id: str
    action_scores: Dict[str, float]
    review_order: List[str]
    explanation: ExplanationPacket
