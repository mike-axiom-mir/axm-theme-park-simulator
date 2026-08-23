from .models import (
    DemandInputs, AtmosphereInputs, ContributionInputs, ExplanationPacket
)

def _bounded(value: float) -> float:
    return max(0.0, min(1.0, float(value)))

def evaluate_reachable_demand(subject_id: str, data: DemandInputs) -> ExplanationPacket:
    weights = {
        "geographic_reach": 0.20,
        "awareness": 0.15,
        "audience_fit": 0.20,
        "travel_friction_inverse": 0.10,
        "price_fit": 0.10,
        "marketing_fit": 0.10,
        "expectation_delivery": 0.15,
    }
    causes = {
        name: _bounded(getattr(data, name)) * weight
        for name, weight in weights.items()
    }
    result = sum(causes.values())
    options = []
    if data.awareness < 0.5:
        options.append("Improve awareness for this audience segment.")
    if data.expectation_delivery < 0.5:
        options.append("Repair the gap between marketing promise and delivered experience.")
    if data.travel_friction_inverse < 0.5:
        options.append("Improve transport access, accommodation, or geographic targeting.")
    if data.audience_fit < 0.5:
        options.append("Retarget a better-fitting audience or evolve the experience.")
    return ExplanationPacket(
        subject_id=subject_id,
        result=result,
        causes=causes,
        player_options=options,
        tradeoffs=["Broader reach can increase crowd and service pressure."]
    )

def evaluate_atmosphere(subject_id: str, data: AtmosphereInputs) -> ExplanationPacket:
    positive = {
        "coherence": _bounded(data.coherence) * 0.22,
        "visibility": _bounded(data.visibility) * 0.12,
        "sensory_integration": _bounded(data.sensory_integration) * 0.14,
        "queue_ride_integration": _bounded(data.queue_ride_integration) * 0.18,
        "audience_theme_fit": _bounded(data.audience_theme_fit) * 0.16,
        "maintenance": _bounded(data.maintenance) * 0.12,
    }
    penalty = _bounded(data.clutter) * 0.06
    result = max(0.0, sum(positive.values()) - penalty)
    causes = dict(positive)
    causes["clutter_penalty"] = -penalty
    return ExplanationPacket(
        subject_id=subject_id,
        result=result,
        causes=causes,
        player_options=[
            "Improve coherence or transitions.",
            "Integrate the queue and attraction story.",
            "Remove contradictory clutter.",
            "Keep the area lightly themed if that better serves park identity."
        ],
        tradeoffs=["More theming adds cost and maintenance; it is optional, not mandatory."]
    )

def evaluate_contribution(subject_id: str, data: ContributionInputs) -> ExplanationPacket:
    benefits = {
        "direct_revenue": data.direct_revenue,
        "induced_spend": data.induced_spend,
        "visit_attraction_value": data.visit_attraction_value,
        "duration_value": data.duration_value,
        "identity_value": data.identity_value,
        "crowd_balance_value": data.crowd_balance_value,
    }
    costs = {
        "operating_cost": -abs(data.operating_cost),
        "maintenance_cost": -abs(data.maintenance_cost),
        "staffing_cost": -abs(data.staffing_cost),
    }
    causes = {**benefits, **costs}
    result = sum(causes.values())
    options = []
    if result < 0:
        options.extend([
            "Maintain more efficiently.",
            "Evolve capacity, audience fit, or surrounding experience.",
            "Retarget marketing.",
            "Replace only if a deliberate alternative is better."
        ])
    return ExplanationPacket(
        subject_id=subject_id,
        result=result,
        causes=causes,
        player_options=options,
        tradeoffs=["High indirect value can justify low direct revenue; verify the evidence."]
    )
