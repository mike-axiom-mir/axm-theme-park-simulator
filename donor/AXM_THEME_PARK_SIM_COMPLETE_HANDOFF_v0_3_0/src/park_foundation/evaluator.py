from __future__ import annotations

from .models import (
    AttendanceBalanceInputs,
    AtmosphereInputs,
    ContributionInputs,
    DemandInputs,
    ExplanationPacket,
    StrategyAssessment,
    StrategyInputs,
)


def _bounded(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def evaluate_reachable_demand(
    subject_id: str,
    data: DemandInputs,
    *,
    state_version: int = 0,
) -> ExplanationPacket:
    """Evaluate normalized demand for one audience segment and context."""
    weights = {
        "geographic_reach": 0.20,
        "awareness": 0.15,
        "audience_fit": 0.20,
        "travel_friction_inverse": 0.10,
        "price_fit": 0.10,
        "marketing_fit": 0.10,
        "expectation_delivery": 0.15,
    }
    market_components = {
        name: _bounded(getattr(data, name)) * weight
        for name, weight in weights.items()
    }
    market_score = sum(market_components.values())

    first_time_share = _bounded(data.first_time_share)
    repeat_strength = _bounded(data.repeat_strength)
    experience_access = first_time_share + (1.0 - first_time_share) * repeat_strength
    availability = _bounded(data.access_availability)
    context_fit = _bounded(data.context_fit)
    result = market_score * experience_access * availability * context_fit

    causes = dict(market_components)
    causes.update({
        "market_score": market_score,
        "first_time_support": first_time_share,
        "repeat_support": (1.0 - first_time_share) * repeat_strength,
        "experience_access_factor": experience_access,
        "access_availability_factor": availability,
        "context_fit_factor": context_fit,
    })

    options = []
    if data.awareness < 0.5:
        options.append("Improve awareness for this audience segment.")
    if data.expectation_delivery < 0.5:
        options.append("Repair the gap between marketing promise and delivered experience.")
    if data.travel_friction_inverse < 0.5:
        options.append("Improve transport access, accommodation, or geographic targeting.")
    if data.audience_fit < 0.5:
        options.append("Retarget a better-fitting audience or evolve the experience.")
    if first_time_share < 0.3 and repeat_strength < 0.5:
        options.append("Add a repeat reason or reach a genuinely new audience.")
    if availability < 0.7:
        options.append("Improve opening hours, uptime, throughput, or accessibility.")

    return ExplanationPacket(
        subject_id=subject_id,
        metric_id="reachable_demand",
        result=result,
        unit="normalized_segment_demand",
        causes=causes,
        player_options=options,
        tradeoffs=["Broader reach can increase crowd, staffing, and service pressure."],
        confidence=0.90,
        assumptions=[
            "Inputs describe one audience segment and one context.",
            "Attraction age is intentionally not a demand input.",
        ],
        headline_causes=[
            name for name, _ in sorted(
                (
                    (name, causes[name])
                    for name in (
                        "geographic_reach", "awareness", "audience_fit",
                        "travel_friction_inverse", "price_fit", "marketing_fit",
                        "expectation_delivery", "first_time_support", "repeat_support"
                    )
                ),
                key=lambda item: (-abs(item[1]), item[0]),
            )
        ],
        state_version=state_version,
    )


def evaluate_atmosphere(
    subject_id: str,
    data: AtmosphereInputs,
    *,
    state_version: int = 0,
) -> ExplanationPacket:
    positive = {
        "coherence": _bounded(data.coherence) * 0.18,
        "visibility": _bounded(data.visibility) * 0.08,
        "sensory_integration": _bounded(data.sensory_integration) * 0.10,
        "queue_ride_integration": _bounded(data.queue_ride_integration) * 0.15,
        "audience_theme_fit": _bounded(data.audience_theme_fit) * 0.13,
        "maintenance": _bounded(data.maintenance) * 0.10,
        "transition_quality": _bounded(data.transition_quality) * 0.08,
        "environmental_comfort": _bounded(data.environmental_comfort) * 0.10,
    }
    clutter_penalty = _bounded(data.clutter) * 0.04
    contradiction_penalty = _bounded(data.contradiction) * 0.04
    quality = max(0.0, sum(positive.values()) - clutter_penalty - contradiction_penalty)

    # A lightly themed area can still provide comfort and coherence. Intensity
    # changes how strongly atmosphere influences the experience; it does not
    # determine whether the whole park succeeds.
    intensity_factor = 0.5 + 0.5 * _bounded(data.theme_intensity)
    result = quality * intensity_factor

    causes = dict(positive)
    causes.update({
        "clutter_penalty": -clutter_penalty,
        "contradiction_penalty": -contradiction_penalty,
        "quality_before_intensity": quality,
        "theme_intensity_factor": intensity_factor,
    })
    return ExplanationPacket(
        subject_id=subject_id,
        metric_id="atmosphere_influence",
        result=result,
        unit="normalized_experience_influence",
        causes=causes,
        player_options=[
            "Improve coherence or transitions.",
            "Integrate the queue and attraction story.",
            "Remove contradictory clutter.",
            "Improve shade, comfort, sound, or lighting.",
            "Keep the area lightly themed if that better serves park identity.",
        ],
        tradeoffs=["More theming adds cost and maintenance; it remains optional."],
        confidence=0.85,
        assumptions=["No value is awarded from scenery object count alone."],
        headline_causes=[
            name for name, _ in sorted(
                (
                    (name, causes[name])
                    for name in (
                        "coherence", "queue_ride_integration", "audience_theme_fit",
                        "maintenance", "transition_quality", "environmental_comfort",
                        "clutter_penalty", "contradiction_penalty"
                    )
                ),
                key=lambda item: (-abs(item[1]), item[0]),
            )
        ],
        state_version=state_version,
    )


def evaluate_contribution(
    subject_id: str,
    data: ContributionInputs,
    *,
    state_version: int = 0,
) -> ExplanationPacket:
    benefits = {
        "direct_revenue": data.direct_revenue,
        "induced_spend": data.induced_spend,
        "visit_attraction_value": data.visit_attraction_value,
        "duration_value": data.duration_value,
        "identity_value": data.identity_value,
        "crowd_balance_value": data.crowd_balance_value,
        "heritage_value": data.heritage_value,
        "strategic_resilience_value": data.strategic_resilience_value,
    }
    costs = {
        "operating_cost": -abs(data.operating_cost),
        "maintenance_cost": -abs(data.maintenance_cost),
        "staffing_cost": -abs(data.staffing_cost),
        "risk_cost": -abs(data.risk_cost),
        "land_opportunity_cost": -abs(data.land_opportunity_cost),
    }
    causes = {**benefits, **costs}
    result = sum(causes.values())
    options = []
    if result < 0:
        options.extend([
            "Maintain more efficiently.",
            "Evolve capacity, audience fit, or surrounding experience.",
            "Retarget marketing.",
            "Verify indirect value before considering replacement.",
            "Replace only if a deliberate alternative is better.",
        ])
    return ExplanationPacket(
        subject_id=subject_id,
        metric_id="net_contribution",
        result=result,
        unit="reference_value_points",
        causes=causes,
        player_options=options,
        tradeoffs=[
            "High indirect or heritage value can justify low direct revenue.",
            "Opportunity cost matters, but it is not a demolition command.",
        ],
        confidence=0.80,
        assumptions=["Reference value points are not final currency balance."],
        headline_causes=[
            name for name, _ in sorted(causes.items(), key=lambda item: (-abs(item[1]), item[0]))
        ],
        state_version=state_version,
    )


def evaluate_active_attendance_balance(
    subject_id: str,
    data: AttendanceBalanceInputs,
    *,
    state_version: int = 0,
) -> ExplanationPacket:
    capacities = [
        max(0.0, data.comfortable_capacity),
        max(0.0, data.service_capacity),
        max(0.0, data.attraction_capacity),
    ]
    effective_capacity = min(capacities)
    if effective_capacity <= 0:
        raise ValueError("All capacity inputs must be greater than zero.")

    active = max(0.0, data.active_visitors)
    occupancy = active / effective_capacity
    minimum = max(0.0, data.minimum_viable_attendance)
    viability_ratio = active / minimum if minimum > 0 else 1.0
    hourly_revenue = active * max(0.0, data.revenue_per_active_visitor_hour)
    hourly_margin = hourly_revenue - max(0.0, data.operating_cost_per_hour)

    # Healthy balance rewards financial viability and occupancy near, but not
    # above, comfortable effective capacity.
    capacity_balance = max(0.0, 1.0 - abs(min(occupancy, 2.0) - 0.75) / 0.75)
    viability_score = _bounded(viability_ratio)
    financial_score = 1.0 if hourly_margin >= 0 else _bounded(
        hourly_revenue / max(data.operating_cost_per_hour, 1.0)
    )
    result = 0.40 * capacity_balance + 0.30 * viability_score + 0.30 * financial_score

    options = []
    if occupancy > 1.0:
        options.append("Add throughput or service capacity before attracting more guests.")
    if viability_ratio < 1.0:
        options.append("Reduce opening cost, concentrate schedules, or grow suitable demand.")
    if hourly_margin < 0:
        options.append("Review price, spending opportunities, staffing, and opening hours.")
    if occupancy < 0.35 and viability_ratio >= 1.0:
        options.append("The park is viable but may feel empty; concentrate activity or improve atmosphere.")

    return ExplanationPacket(
        subject_id=subject_id,
        metric_id="active_attendance_balance",
        result=result,
        unit="normalized_operational_balance",
        causes={
            "effective_capacity": effective_capacity,
            "occupancy_ratio": occupancy,
            "viability_ratio": viability_ratio,
            "hourly_revenue": hourly_revenue,
            "hourly_margin": hourly_margin,
            "capacity_balance_score": capacity_balance,
            "financial_score": financial_score,
        },
        player_options=options,
        tradeoffs=["Higher attendance can improve finances while harming comfort and service."],
        confidence=0.85,
        headline_causes=["occupancy_ratio", "hourly_margin", "viability_ratio"],
        state_version=state_version,
    )


def evaluate_strategy(
    subject_id: str,
    data: StrategyInputs,
    *,
    state_version: int = 0,
) -> StrategyAssessment:
    condition = _bounded(data.condition)
    finance = _bounded(data.financial_contribution)
    identity = _bounded(data.identity_fit)
    audience = _bounded(data.audience_fit)
    repeat = _bounded(data.repeat_strength)
    opportunity = _bounded(data.replacement_opportunity)
    heritage = _bounded(data.heritage_value)
    safety = _bounded(data.safety_risk)

    maintain = (
        0.25 * condition
        + 0.20 * finance
        + 0.20 * identity
        + 0.15 * audience
        + 0.10 * repeat
        + 0.10 * heritage
        - 0.35 * safety
    )
    evolve = (
        0.15 * condition
        + 0.15 * identity
        + 0.15 * audience
        + 0.15 * heritage
        + 0.15 * (1.0 - finance)
        + 0.15 * (1.0 - repeat)
        + 0.10 * (1.0 - opportunity)
        - 0.25 * safety
    )
    replace = (
        0.35 * opportunity
        + 0.20 * (1.0 - finance)
        + 0.15 * (1.0 - identity)
        + 0.10 * (1.0 - audience)
        + 0.10 * (1.0 - condition)
        - 0.15 * heritage
        + 0.05 * safety
    )

    scores = {
        "maintain": _bounded(maintain),
        "evolve": _bounded(evolve),
        "replace": _bounded(replace),
    }
    order = sorted(scores, key=lambda action: (-scores[action], action))

    options = [
        "Review the highest-scoring option first; no action is automatic.",
        "Compare evidence, cost, identity, and player intent before committing.",
    ]
    uncertainty = []
    if safety >= 0.7:
        options.insert(0, "Close temporarily and inspect the safety risk.")
        uncertainty.append("Safety response is not the same as forced permanent replacement.")

    explanation = ExplanationPacket(
        subject_id=subject_id,
        metric_id="maintain_evolve_replace_review",
        result=max(scores.values()),
        unit="review_priority",
        causes={f"{action}_score": score for action, score in scores.items()},
        player_options=options,
        tradeoffs=[
            "Maintaining preserves history but can consume resources.",
            "Evolving can unlock value but adds capital and complexity.",
            "Replacing can improve land use but destroys continuity and sunk identity.",
        ],
        confidence=0.75,
        uncertainty_notes=uncertainty,
        assumptions=["Scores rank review, not a compulsory decision."],
        headline_causes=[f"{action}_score" for action in order],
        state_version=state_version,
    )
    return StrategyAssessment(
        subject_id=subject_id,
        action_scores=scores,
        review_order=order,
        explanation=explanation,
    )
