from __future__ import annotations

from .models import (
    DemandInputs, AtmosphereInputs, ContributionInputs, ExpectationInputs,
    AttendanceInputs, ExplanationPacket,
)
from .util import bounded


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
    causes = {name: bounded(getattr(data, name)) * weight for name, weight in weights.items()}
    result = sum(causes.values())
    options = []
    if data.awareness < 0.5:
        options.append("Improve awareness for this audience segment.")
    if data.expectation_delivery < 0.5:
        options.append("Repair the gap between marketing promise and delivered experience.")
    if data.travel_friction_inverse < 0.5:
        options.append("Improve access, accommodation, or geographic targeting.")
    if data.audience_fit < 0.5:
        options.append("Retarget a better-fitting audience or evolve the experience.")
    return ExplanationPacket(
        subject_id=subject_id,
        result=result,
        causes=causes,
        player_options=options,
        tradeoffs=["Broader reach can increase crowd and service pressure."],
        confidence=0.75,
        alternatives=["Demand may be constrained by evidence not yet supplied by a domain module."],
    )


def evaluate_atmosphere(subject_id: str, data: AtmosphereInputs) -> ExplanationPacket:
    positive = {
        "coherence": bounded(data.coherence) * 0.22,
        "visibility": bounded(data.visibility) * 0.12,
        "sensory_integration": bounded(data.sensory_integration) * 0.14,
        "queue_ride_integration": bounded(data.queue_ride_integration) * 0.18,
        "audience_theme_fit": bounded(data.audience_theme_fit) * 0.16,
        "maintenance": bounded(data.maintenance) * 0.12,
    }
    penalty = bounded(data.clutter) * 0.06
    result = max(0.0, sum(positive.values()) - penalty)
    causes = dict(positive)
    causes["clutter_penalty"] = -penalty
    return ExplanationPacket(
        subject_id=subject_id,
        result=result,
        causes=causes,
        player_options=[
            "Improve coherence or transitions.",
            "Integrate queue and attraction story.",
            "Remove contradictory clutter.",
            "Remain lightly themed when that better serves park identity.",
        ],
        tradeoffs=["More theming adds cost and maintenance; it is optional."],
        confidence=0.70,
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
            "Compare replacement only with a specific deliberate alternative.",
        ])
    return ExplanationPacket(
        subject_id=subject_id,
        result=result,
        causes=causes,
        player_options=options,
        tradeoffs=["High indirect value can justify low direct revenue; verify the evidence."],
        confidence=0.65,
    )


def evaluate_expectation_delivery(subject_id: str, data: ExpectationInputs) -> ExplanationPacket:
    weights = {
        "promise_match": 0.30,
        "delivery_quality": 0.30,
        "price_fairness": 0.15,
        "crowding_inverse": 0.10,
        "service_reliability": 0.15,
    }
    causes = {name: bounded(getattr(data, name)) * weight for name, weight in weights.items()}
    result = sum(causes.values())
    options = []
    if data.promise_match < 0.6:
        options.append("Change the promise or make the delivered experience match it.")
    if data.service_reliability < 0.6:
        options.append("Repair operational reliability before increasing marketing pressure.")
    return ExplanationPacket(
        subject_id=subject_id,
        result=result,
        causes=causes,
        player_options=options,
        tradeoffs=["More awareness can amplify disappointment when delivery remains weak."],
        confidence=0.75,
    )


def evaluate_attendance_balance(subject_id: str, data: AttendanceInputs) -> ExplanationPacket:
    if min(data.comfortable_capacity, data.service_capacity, data.spatial_capacity) <= 0:
        raise ValueError("All capacity values must be positive.")
    if data.active_visitors < 0:
        raise ValueError("active_visitors cannot be negative.")
    effective_capacity = min(data.comfortable_capacity, data.service_capacity, data.spatial_capacity)
    load_ratio = data.active_visitors / effective_capacity
    comfort = max(0.0, 1.0 - abs(load_ratio - 0.78))
    hourly_guest_value = data.active_visitors * data.average_guest_value_per_hour
    net_hourly_value = hourly_guest_value - data.hourly_operating_cost
    causes = {
        "load_ratio": load_ratio,
        "comfort_balance": comfort,
        "hourly_guest_value": hourly_guest_value,
        "hourly_operating_cost": -abs(data.hourly_operating_cost),
    }
    options = []
    if load_ratio > 1.0:
        options.append("Increase capacity, reduce admissions, or redistribute visitors.")
    elif load_ratio < 0.35:
        options.append("Use compact operations, programming, or stronger reachable demand.")
    return ExplanationPacket(
        subject_id=subject_id,
        result=net_hourly_value,
        causes=causes,
        player_options=options,
        tradeoffs=["Maximum attendance is not automatically maximum experience quality."],
        confidence=0.70,
    )
