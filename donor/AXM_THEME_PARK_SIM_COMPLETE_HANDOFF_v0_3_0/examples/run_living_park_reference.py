from __future__ import annotations

from dataclasses import asdict
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from park_foundation import (
    AcceptanceCheck,
    AcceptanceReport,
    AudienceCohortState,
    CANONICAL_ROOT_HASH,
    CohortForces,
    CommandEnvelope,
    CommandPlan,
    ContributionClaim,
    ContributionLedger,
    CounterfactualProjection,
    DeterministicEventLog,
    EventIntent,
    PopulationResolutionPolicy,
    SimulationCadencePlan,
    SimulationKernel,
    SimulationState,
    SnapshotStore,
    compare_counterfactuals,
    derive_animation_signal,
    evolve_market_cohort,
    sha256_value,
)


MODULE_VERSIONS = {
    "axm.themepark.foundation": "0.3.0",
    "rides": "0.1.0-reference",
    "visitors": "0.1.0-reference",
    "economy": "0.1.0-reference",
}


def _scenario() -> dict:
    return json.loads(
        (ROOT / "data/runtime/LIVING_PARK_REFERENCE_SCENARIO.json").read_text(
            encoding="utf-8"
        )
    )


def _cohort_from_mapping(data: dict, *, state_version: int | None = None) -> AudienceCohortState:
    values = dict(data)
    if state_version is not None:
        values["state_version"] = state_version
    return AudienceCohortState(**values)


def build_reference() -> dict:
    scenario = _scenario()
    cohort = _cohort_from_mapping(scenario["cohort"])
    forces = CohortForces(**scenario["forces"])
    ride = scenario["ride"]
    economy = scenario["economy"]

    state = SimulationState(
        world_id=scenario["world_id"],
        world_seed=scenario["world_seed"],
        module_states={
            "axm.themepark.foundation": {"clock_tick": 0, "park_open": False},
            "rides": {
                "ride_id": ride["ride_id"],
                "name": ride["name"],
                "age_years": ride["age_years"],
                "open": ride["open"],
                "cycles": ride["cycles"],
            },
            "visitors": {
                "cohort": {**cohort.counts, "cohort_id": cohort.cohort_id,
                           "origin_zone_id": cohort.origin_zone_id,
                           "population": cohort.population,
                           "state_version": cohort.state_version},
                "last_first_time_visits": 0.0,
                "last_repeat_visits": 0.0,
                "last_unmet_demand": 0.0,
            },
            "economy": {
                "cash": economy["cash"],
                "first_visit_value": economy["first_visit_value"],
                "repeat_visit_value": economy["repeat_visit_value"],
                "last_visit_revenue": 0.0,
            },
        },
    )
    initial_population = cohort.population
    log = DeterministicEventLog()
    kernel = SimulationKernel(module_versions=MODULE_VERSIONS)

    kernel.register_command_handler(
        "axm.themepark.foundation",
        "park.open",
        lambda current, command: CommandPlan.accept(
            EventIntent("park.opened", (command.payload["park_id"],), {"open": True})
        ),
    )
    kernel.register_reducer(
        "axm.themepark.foundation",
        "park.opened",
        lambda current, event: {**current, "park_open": True},
    )

    kernel.register_command_handler(
        "rides",
        "ride.open",
        lambda current, command: CommandPlan.accept(
            EventIntent("ride.opened", (command.payload["ride_id"],), {"open": True})
        ),
    )
    kernel.register_reducer(
        "rides",
        "ride.opened",
        lambda current, event: {**current, "open": True},
    )

    def plan_market(current: SimulationState, command: CommandEnvelope) -> CommandPlan:
        cohort_data = current.module_state("visitors")["cohort"]
        next_cohort = _cohort_from_mapping(cohort_data)
        result = evolve_market_cohort(next_cohort, CohortForces(**command.payload["forces"]))
        return CommandPlan.accept(EventIntent(
            "market.stepped",
            (result.next_state.cohort_id,),
            {
                "cohort": asdict(result.next_state),
                "first_time_visits": result.first_time_visits,
                "repeat_visits": result.repeat_visits,
                "unmet_first_time_demand": result.unmet_first_time_demand,
                "unmet_repeat_demand": result.unmet_repeat_demand,
            },
        ))

    kernel.register_command_handler("visitors", "market.step", plan_market)
    kernel.register_reducer(
        "visitors",
        "market.stepped",
        lambda current, event: {
            **current,
            "cohort": event.payload["cohort"],
            "last_first_time_visits": event.payload["first_time_visits"],
            "last_repeat_visits": event.payload["repeat_visits"],
            "last_unmet_demand": (
                event.payload["unmet_first_time_demand"]
                + event.payload["unmet_repeat_demand"]
            ),
        },
    )
    kernel.register_reducer(
        "rides",
        "market.stepped",
        lambda current, event: {
            **current,
            "cycles": current["cycles"]
            + event.payload["first_time_visits"]
            + event.payload["repeat_visits"],
        },
    )
    kernel.register_reducer(
        "economy",
        "market.stepped",
        lambda current, event: {
            **current,
            "last_visit_revenue": (
                event.payload["first_time_visits"] * current["first_visit_value"]
                + event.payload["repeat_visits"] * current["repeat_visit_value"]
            ),
            "cash": current["cash"] + (
                event.payload["first_time_visits"] * current["first_visit_value"]
                + event.payload["repeat_visits"] * current["repeat_visit_value"]
            ),
        },
    )

    kernel.register_command_handler(
        "axm.themepark.foundation",
        "world.advance",
        lambda current, command: CommandPlan.accept(
            EventIntent("world.tick", payload={"ticks": command.payload["ticks"]}),
            tick_advance=command.payload["ticks"],
        ),
    )
    kernel.register_reducer(
        "axm.themepark.foundation",
        "world.tick",
        lambda current, event: {
            **current,
            "clock_tick": current["clock_tick"] + event.payload["ticks"],
        },
    )

    commands = (
        CommandEnvelope(
            "cmd-open-park", "park.open", "player", "axm.themepark.foundation",
            0, 0, {"park_id": scenario["scenario_id"]},
        ),
        CommandEnvelope(
            "cmd-open-ride", "ride.open", "player", "rides",
            1, 0, {"ride_id": ride["ride_id"]},
        ),
        CommandEnvelope(
            "cmd-market-step", "market.step", "system", "visitors",
            2, 0, {"forces": asdict(forces)},
        ),
        CommandEnvelope(
            "cmd-world-advance", "world.advance", "system",
            "axm.themepark.foundation", 3, 0, {"ticks": 1},
        ),
    )

    results = []
    for command in commands:
        result = kernel.execute(state, command, log)
        if not result.accepted or not result.committed:
            raise RuntimeError((command.command_id, result.reasons))
        state = result.resulting_state
        results.append(result)

    market_event = next(event for event in log.events if event.event_type == "market.stepped")
    ride_event = next(event for event in log.events if event.event_type == "ride.opened")
    first_visits = market_event.payload["first_time_visits"]
    repeat_visits = market_event.payload["repeat_visits"]
    revenue = state.module_state("economy")["last_visit_revenue"]

    contribution = ContributionLedger()
    contribution.add_batch((
        ContributionClaim(
            claim_id="claim-ride-revenue",
            subject_id=ride["ride_id"],
            beneficiary_id=scenario["scenario_id"],
            causal_event_id=market_event.event_id,
            channel="direct_revenue",
            amount=revenue,
            direction="benefit",
            attribution_share=0.70,
            source_module="economy",
            state_version=state.state_version,
            evidence_refs=(market_event.event_id,),
            notes=("Ride receives the attraction share; remaining value is not duplicated.",),
        ),
        ContributionClaim(
            claim_id="claim-park-revenue",
            subject_id="park-day",
            beneficiary_id=scenario["scenario_id"],
            causal_event_id=market_event.event_id,
            channel="direct_revenue",
            amount=revenue,
            direction="benefit",
            attribution_share=0.30,
            source_module="economy",
            state_version=state.state_version,
            evidence_refs=(market_event.event_id,),
        ),
    ))

    animation = derive_animation_signal(
        ride_event,
        entity_id=ride["ride_id"],
        clip_id="ride-gate-open-lowgraphic-v1",
        duration_ticks=6,
        state_version=2,
        parameters={"style": "self-made-low-graphic", "frames": 6},
    )

    snapshots = SnapshotStore()
    snapshot = snapshots.capture(
        state,
        log,
        canonical_root_hash=CANONICAL_ROOT_HASH,
        module_versions=MODULE_VERSIONS,
        reason="living reference completed",
        created_by="AXM reference runner",
    )
    restored_state, restored_log = snapshots.restore(snapshot.snapshot_id)
    forked_state, forked_log, lineage = snapshots.fork(
        snapshot.snapshot_id,
        new_branch_id="capacity-experiment",
        label="Test capacity growth without changing the main state",
        created_by="AXM reference runner",
    )

    baseline_metrics = {
        "visitor_value": first_visits + repeat_visits,
        "identity_continuity": 0.85,
        "capacity_resilience": 0.55,
    }
    projections = (
        CounterfactualProjection(
            projection_id="projection-maintain",
            plan_id="maintain-classic",
            target_id=ride["ride_id"],
            action="maintain",
            baseline_state_hash=state.digest(),
            baseline_state_version=state.state_version,
            projected_metrics={
                "visitor_value": baseline_metrics["visitor_value"] * 1.02,
                "identity_continuity": 0.90,
                "capacity_resilience": 0.58,
            },
            costs={"maintenance": 40},
            confidence=0.85,
            evidence_refs=(market_event.event_id,),
        ),
        CounterfactualProjection(
            projection_id="projection-evolve",
            plan_id="evolve-capacity",
            target_id=ride["ride_id"],
            action="capacity_upgrade",
            baseline_state_hash=state.digest(),
            baseline_state_version=state.state_version,
            projected_metrics={
                "visitor_value": baseline_metrics["visitor_value"] * 1.12,
                "identity_continuity": 0.84,
                "capacity_resilience": 0.82,
            },
            costs={"capital": 220},
            confidence=0.65,
            evidence_refs=(market_event.event_id,),
        ),
    )
    comparison = compare_counterfactuals(
        baseline_state_hash=state.digest(),
        baseline_state_version=state.state_version,
        baseline_metrics=baseline_metrics,
        projections=projections,
        priority_weights={
            "visitor_value": 0.4,
            "identity_continuity": 0.3,
            "capacity_resilience": 0.3,
        },
    )

    cadence = SimulationCadencePlan(
        profile_id="first-map-reference",
        simulation_tick_ms=100,
        render_frame_ms=16,
        lane_intervals_ticks={"movement": 1, "economy": 10, "reputation": 50},
        snapshot_interval_ticks=100,
        max_catchup_ticks=4,
    )
    resolution = PopulationResolutionPolicy().decide(int(initial_population))

    acceptance = AcceptanceReport(
        report_id="living-reference-not-first-map",
        build_id="foundation-v0.3.0",
        checks=(
            AcceptanceCheck(
                "same_seed_same_digest", "determinism", True, "pass",
                ("tests/test_living_park_reference.py",),
            ),
            AcceptanceCheck(
                "save_reload_same_state", "determinism", True, "pass",
                (snapshot.snapshot_id,),
            ),
            AcceptanceCheck(
                "one_small_map_loads", "playable_slice", True, "not_run", (),
                ("Reference state is not a rendered gameplay map.",),
            ),
            AcceptanceCheck(
                "self_made_low_graphic_animation_visible", "animation", True,
                "not_run", (),
                ("Animation signal exists; production rendering is not implemented.",),
            ),
            AcceptanceCheck(
                "known_placeholders_listed", "honesty", True, "pass",
                ("ACTION_REPORT.md",),
            ),
        ),
    )

    final_cohort = state.module_state("visitors")["cohort"]
    final_population = sum(float(final_cohort[key]) for key in (
        "unaware", "aware", "considering", "first_time_ready",
        "previous_satisfied", "loyal_repeat", "disappointed",
    ))

    core = {
        "scenario_id": scenario["scenario_id"],
        "status": scenario["status"],
        "state_hash": state.digest(),
        "state_version": state.state_version,
        "tick": state.tick,
        "event_log_hash": log.event_log_hash(),
        "event_types": [event.event_type for event in log.events],
        "event_chain_valid": log.validate_chain(),
        "population_initial": initial_population,
        "population_final": final_population,
        "population_conserved": abs(initial_population - final_population) < 1e-6,
        "first_time_visits": first_visits,
        "repeat_visits": repeat_visits,
        "ride_age_years": state.module_state("rides")["age_years"],
        "ride_open": state.module_state("rides")["open"],
        "ride_cycles": state.module_state("rides")["cycles"],
        "revenue": revenue,
        "contribution_ledger_valid": contribution.audit().valid,
        "contribution_unallocated": dict(contribution.audit().unallocated_shares),
        "ride_attributed_value": contribution.net(ride["ride_id"]),
        "animation_signal": asdict(animation),
        "snapshot_id": snapshot.snapshot_id,
        "snapshot_verified": (
            restored_state.digest() == state.digest()
            and restored_log.event_log_hash() == log.event_log_hash()
        ),
        "fork_branch_id": forked_state.branch_id,
        "fork_parent_branch_id": lineage.parent_branch_id,
        "fork_event_log_preserved": forked_log.event_log_hash() == log.event_log_hash(),
        "counterfactual_review_order": list(comparison.review_order),
        "counterfactual_auto_selected": comparison.automatic_selection,
        "cadence_authoritative_clock": cadence.authoritative_clock,
        "population_resolution": asdict(resolution),
        "first_map_ready": acceptance.ready(),
        "first_map_acceptance": acceptance.summary(),
        "blocking_reference_checks": [
            check.check_id for check in acceptance.blocking_checks()
        ],
    }
    return {**core, "reference_digest": sha256_value(core)}


if __name__ == "__main__":
    print(json.dumps(build_reference(), indent=2, sort_keys=True))
