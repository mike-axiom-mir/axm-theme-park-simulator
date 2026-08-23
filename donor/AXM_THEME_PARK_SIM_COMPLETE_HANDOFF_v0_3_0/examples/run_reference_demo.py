from __future__ import annotations

import json
import sys
sys.dont_write_bytecode = True
from dataclasses import asdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from park_foundation import (
    ADVANCED,
    BEGINNER,
    CANONICAL_ROOT_HASH,
    AttendanceBalanceInputs,
    CampaignDefinition,
    CampaignEvaluator,
    CampaignState,
    Condition,
    ContributionInputs,
    DemandInputs,
    DeterministicEventLog,
    OpeningSchedule,
    OpeningWindow,
    OutcomePath,
    ParkEvent,
    ParkIdentityIntent,
    SeasonCalendar,
    StrategyInputs,
    WeatherGenerator,
    WeatherProfile,
    WorldClock,
    evaluate_active_attendance_balance,
    evaluate_contribution,
    evaluate_identity_alignment,
    evaluate_reachable_demand,
    evaluate_strategy,
    render_explanation,
    stable_seed,
)


def emit(title: str, value) -> None:
    print(f"\n=== {title} ===")
    print(json.dumps(value, indent=2, ensure_ascii=False))


def main() -> None:
    tourist_demand = evaluate_reachable_demand(
        "classic_coaster:tourists",
        DemandInputs(
            0.9, 0.8, 0.9, 0.7, 0.8, 0.8, 0.9,
            first_time_share=0.95,
            repeat_strength=0.2,
        ),
        state_version=12,
    )
    local_demand = evaluate_reachable_demand(
        "classic_coaster:locals",
        DemandInputs(
            0.95, 0.95, 0.8, 0.95, 0.9, 0.8, 0.9,
            first_time_share=0.1,
            repeat_strength=0.65,
        ),
        state_version=12,
    )
    emit("Tourist demand — beginner view", render_explanation(tourist_demand, BEGINNER))
    emit("Local demand — advanced view", render_explanation(local_demand, ADVANCED))

    contribution = evaluate_contribution(
        "classic_boat_ride",
        ContributionInputs(
            direct_revenue=5,
            induced_spend=18,
            visit_attraction_value=25,
            duration_value=14,
            identity_value=20,
            crowd_balance_value=8,
            heritage_value=15,
            operating_cost=22,
            maintenance_cost=10,
            staffing_cost=8,
        ),
        state_version=12,
    )
    emit("Whole-park contribution", render_explanation(contribution, ADVANCED))

    attendance = evaluate_active_attendance_balance(
        "park:afternoon",
        AttendanceBalanceInputs(
            active_visitors=820,
            minimum_viable_attendance=500,
            comfortable_capacity=1000,
            service_capacity=900,
            attraction_capacity=1100,
            operating_cost_per_hour=4200,
            revenue_per_active_visitor_hour=6.5,
        ),
        state_version=12,
    )
    emit("Active attendance balance", render_explanation(attendance, BEGINNER))

    strategy = evaluate_strategy(
        "classic_boat_ride",
        StrategyInputs(
            condition=0.72,
            financial_contribution=0.65,
            identity_fit=0.95,
            audience_fit=0.75,
            repeat_strength=0.80,
            replacement_opportunity=0.35,
            heritage_value=0.90,
        ),
        state_version=12,
    )
    emit("Maintain / evolve / replace review", {
        "action_scores": strategy.action_scores,
        "review_order": strategy.review_order,
        "rule": "Review priority only; the player chooses.",
    })

    identity = ParkIdentityIntent(
        "historic_family",
        "Historic Family Park",
        "living history with regional family use",
        {
            "heritage": 0.30,
            "financial_stability": 0.25,
            "family_fit": 0.25,
            "comfort": 0.20,
        },
        protected_elements=("classic_boat_ride", "original_entrance"),
        acceptable_tradeoffs=("slower expansion",),
    )
    alignment = evaluate_identity_alignment(
        "park",
        identity,
        {"heritage": 0.90, "financial_stability": 0.70, "family_fit": 0.80},
        state_version=12,
    )
    emit("Identity alignment with honest missing evidence", render_explanation(alignment, ADVANCED))

    clock = WorldClock(tick=0, tick_minutes=5).advance(300)
    schedule = OpeningSchedule(
        "park",
        {day: (OpeningWindow(600, 1200),) for day in range(7)},
    )
    seasons = SeasonCalendar()
    profile = WeatherProfile(
        "temperate_reference",
        {"clear": 0.35, "overcast": 0.30, "rain": 0.20,
         "storm": 0.05, "heat": 0.05, "cold": 0.05},
        16.0,
        10.0,
    )
    weather = WeatherGenerator(20260812).generate(clock.day_index, 0, profile)
    emit("World context", {
        "tick": clock.tick,
        "day_index": clock.day_index,
        "minute_of_day": clock.minute_of_day,
        "season": seasons.season_for_day(clock.day_index),
        "park_open": schedule.is_open(clock.day_index, clock.minute_of_day),
        "weather": asdict(weather),
    })

    campaign = CampaignDefinition(
        "forgotten_local_park",
        "The Forgotten Local Park",
        (
            OutcomePath(
                "living_heritage",
                "Living Heritage",
                (
                    Condition("heritage", "gte", 0.75),
                    Condition("stability", "gte", 0.60),
                ),
                "History survives.",
            ),
            OutcomePath(
                "family_renewal",
                "Family Renewal",
                (
                    Condition("family_fit", "gte", 0.75),
                    Condition("stability", "gte", 0.60),
                ),
                "Families return.",
            ),
        ),
    )
    state = CampaignState("forgotten_local_park").with_metrics({
        "heritage": 0.85,
        "family_fit": 0.82,
        "stability": 0.75,
    })
    emit("Eligible campaign futures", [
        {"outcome_id": outcome.outcome_id, "label": outcome.label}
        for outcome in CampaignEvaluator.eligible_outcomes(campaign, state)
    ])

    log = DeterministicEventLog()
    event = ParkEvent(
        event_id="event:ride_opened:1",
        event_type="ride.opened",
        tick=clock.tick,
        actor_id="player",
        target_ids=["classic_boat_ride"],
        payload={"open": True},
        seed=stable_seed("ride.opened", clock.tick, "classic_boat_ride"),
        module_id="axm.themepark.rides",
        module_version="0.1.0",
        evidence_refs=["inspection:12"],
    )
    log.append(event)
    emit("Deterministic event log", {
        "valid_hash_chain": log.validate_chain(),
        "event_log_hash": log.event_log_hash(),
        "canonical_root_hash": CANONICAL_ROOT_HASH,
    })


if __name__ == "__main__":
    main()
