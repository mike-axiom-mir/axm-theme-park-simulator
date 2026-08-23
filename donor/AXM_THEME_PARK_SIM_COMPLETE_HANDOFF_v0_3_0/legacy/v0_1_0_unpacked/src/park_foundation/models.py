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

@dataclass(frozen=True)
class AtmosphereInputs:
    coherence: float
    visibility: float
    sensory_integration: float
    queue_ride_integration: float
    audience_theme_fit: float
    maintenance: float
    clutter: float = 0.0

@dataclass(frozen=True)
class ContributionInputs:
    direct_revenue: float = 0.0
    induced_spend: float = 0.0
    visit_attraction_value: float = 0.0
    duration_value: float = 0.0
    identity_value: float = 0.0
    crowd_balance_value: float = 0.0
    operating_cost: float = 0.0
    maintenance_cost: float = 0.0
    staffing_cost: float = 0.0

@dataclass
class ExplanationPacket:
    subject_id: str
    result: float
    causes: Dict[str, float]
    evidence_refs: List[str] = field(default_factory=list)
    missing_evidence: List[str] = field(default_factory=list)
    player_options: List[str] = field(default_factory=list)
    tradeoffs: List[str] = field(default_factory=list)
