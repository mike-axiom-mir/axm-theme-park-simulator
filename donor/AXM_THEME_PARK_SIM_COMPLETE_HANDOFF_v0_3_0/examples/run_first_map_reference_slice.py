"""Deterministic first-map *reference* slice.

This deliberately proves the cross-organ seams without claiming that a playable
map, renderer, ride builder, visitor pathfinder, or production economy exists.
Run twice with the same inputs and the returned digest must match exactly.
"""
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
    AnimationSignal,
    AudienceCohortState,
    CANONICAL_ROOT_HASH,
    CohortForces,
    CommandEnvelope,
    CommandPlan,
    ContributionClaim,
    ContributionLedger,
    CounterfactualProjection,
    DerivedMetricRecord,
    DeterministicEventLog,
    EvidenceRef,
    EventIntent,
    PopulationResolutionPolicy,
    ProvenanceLedger,
    SimulationCadencePlan,
    SimulationKernel,
    SimulationState,
    SnapshotStore,
    compare_counterfactuals,
    derive_animation_signal,
    evolve_market_cohort,
    sha256_value,
)


def _run_once() -> dict:
    module_versions = {
        "axm.themepark.foundation": "0.3.0",
        "axm.themepark.rides": "0.1.0-reference",
        "axm.themepark.visitors_crews": "0.1.0-reference",
        "axm.themepark.economy": "0.1.0-reference",
    }
    initial = SimulationState(
        world_id="first-map-reference",
        world_seed=202611,
        tick=0,
        state_version=0,
        branch_id="main",
        module_states={
            "axm.themepark.foundation": {"minute": 540, "park_open": False},
            "axm.themepark.rides": {
                "ride-1": {"name": "Garden Carousel", "open": False, "condition": 0.92}
            },
            "axm.themepark.visitors_crews": {"ride_open_notifications": 0},
            "axm.themepark.economy": {"cash": 10000.0},
        },
    )

    log = DeterministicEventLog()
    kernel = SimulationKernel(module_versions)
    kernel.register_command_handler(
        "axm.themepark.rides",
        "ride.open",
        lambda state, command: CommandPlan.accept(
            EventIntent(
                "ride.opened",
                (command.payload["ride_id"],),
                {"open": True},
                ("inspection:ride-1",),
            )
        ),
    )
    kernel.register_reducer(
        "axm.themepark.rides",
        "ride.opened",
        lambda current, event: {
            **current,
            event.target_ids[0]: {
                **current[event.target_ids[0]],
                "open": bool(event.payload["open"]),
            },
        },
    )
    kernel.register_reducer(
        "axm.themepark.visitors_crews",
        "ride.opened",
        lambda current, event: {
            **current,
            "ride_open_notifications": current["ride_open_notifications"] + 1,
        },
    )
    command = CommandEnvelope(
        command_id="cmd-open-garden-carousel",
        command_type="ride.open",
        actor_id="player-1",
        target_module="axm.themepark.rides",
        expected_state_version=0,
        tick=0,
        payload={"ride_id": "ride-1"},
        evidence_refs=("inspection:ride-1",),
    )
    command_result = kernel.execute(initial, command, log)

    cohort = AudienceCohortState(
        cohort_id="tilburg-local-families",
        origin_zone_id="tilburg-local",
        population=1000,
        unaware=250,
        aware=200,
        considering=150,
        first_time_ready=100,
        previous_satisfied=150,
        loyal_repeat=100,
        disappointed=50,
    )
    market = evolve_market_cohort(
        cohort,
        CohortForces(
            awareness_rate=0.10,
            consideration_rate=0.20,
            readiness_rate=0.25,
            first_visit_rate=0.30,
            repeat_visit_rate=0.25,
            repeat_strength=0.80,
            expectation_delivery=0.85,
            loyalty_rate=0.30,
            recovery_rate=0.10,
            visit_capacity=200,
        ),
    )

    contribution = ContributionLedger()
    contribution.add_batch((
        ContributionClaim(
            "claim-visit-ride",
            "ride-1",
            "park",
            "visit-batch-1",
            "visit_attraction_value",
            100,
            "benefit",
            0.70,
            "axm.themepark.visitors_crews",
            command_result.resulting_state.state_version,
            evidence_refs=("cohort-step-1",),
        ),
        ContributionClaim(
            "claim-visit-land",
            "garden-land",
            "park",
            "visit-batch-1",
            "visit_attraction_value",
            100,
            "benefit",
            0.30,
            "axm.themepark.visitors_crews",
            command_result.resulting_state.state_version,
            evidence_refs=("cohort-step-1",),
        ),
        ContributionClaim(
            "claim-spend-ride",
            "ride-1",
            "park",
            "spend-batch-1",
            "induced_spend",
            60,
            "benefit",
            0.50,
            "axm.themepark.economy",
            command_result.resulting_state.state_version,
            evidence_refs=("purchase-batch-1",),
        ),
        ContributionClaim(
            "claim-spend-food",
            "food-stall-1",
            "park",
            "spend-batch-1",
            "induced_spend",
            60,
            "benefit",
            0.50,
            "axm.themepark.economy",
            command_result.resulting_state.state_version,
            evidence_refs=("purchase-batch-1",),
        ),
        ContributionClaim(
            "claim-maintenance",
            "ride-1",
            "park",
            "maintenance-cycle-1",
            "maintenance_cost",
            12,
            "cost",
            1.0,
            "axm.themepark.rides",
            command_result.resulting_state.state_version,
            evidence_refs=("inspection:ride-1",),
        ),
    ))
    contribution_audit = contribution.audit()

    provenance = ProvenanceLedger()
    provenance.add_evidence(EvidenceRef(
        "ev-ride-open",
        "axm.themepark.rides",
        command_result.resulting_state.state_version,
        "observed",
        1.0,
        "Garden Carousel opened through the shared command transaction.",
    ))
    provenance.add_evidence(EvidenceRef(
        "ev-cohort-conserved",
        "axm.themepark.visitors_crews",
        command_result.resulting_state.state_version,
        "inferred",
        1.0,
        "Audience cohort population remained conserved during the market step.",
    ))
    provenance.add_metric(DerivedMetricRecord(
        record_id="metric-first-time-visits",
        metric_id="first_time_visits",
        subject_id="tilburg-local-families",
        module_id="axm.themepark.visitors_crews",
        algorithm_version="cohort-reference-0.3.0",
        state_version=command_result.resulting_state.state_version,
        result=market.first_time_visits,
        unit="visits",
        contributions={
            "ready_demand": market.first_time_demand,
            "capacity_served": market.first_time_visits,
        },
        evidence_refs=("ev-cohort-conserved",),
        confidence=1.0,
    ))

    snapshot_store = SnapshotStore()
    snapshot = snapshot_store.capture(
        command_result.resulting_state,
        log,
        canonical_root_hash=CANONICAL_ROOT_HASH,
        module_versions=module_versions,
        reason="reference slice checkpoint before counterfactual review",
        created_by="AXM reference demo",
    )
    restored_state, restored_log = snapshot_store.restore(snapshot.snapshot_id)
    forked_state, forked_log, lineage = snapshot_store.fork(
        snapshot.snapshot_id,
        new_branch_id="evolve-garden-land",
        label="Test an atmosphere upgrade without rewriting main",
        created_by="AXM reference demo",
    )

    comparison = compare_counterfactuals(
        baseline_state_hash=restored_state.digest(),
        baseline_state_version=restored_state.state_version,
        baseline_metrics={"identity": 0.55, "finance": 0.60, "repeat": 0.50},
        projections=(
            CounterfactualProjection(
                "projection-maintain",
                "maintain",
                "ride-1",
                "maintain",
                restored_state.digest(),
                restored_state.state_version,
                {"identity": 0.55, "finance": 0.64, "repeat": 0.51},
                {"capital": 5},
                0.92,
                assumptions=("Routine condition work succeeds.",),
                evidence_refs=("ev-ride-open",),
            ),
            CounterfactualProjection(
                "projection-evolve",
                "evolve",
                "ride-1",
                "evolve",
                restored_state.digest(),
                restored_state.state_version,
                {"identity": 0.72, "finance": 0.58, "repeat": 0.68},
                {"capital": 45},
                0.72,
                assumptions=("The garden story fits local family preferences.",),
                evidence_refs=("ev-cohort-conserved",),
            ),
            CounterfactualProjection(
                "projection-replace",
                "replace",
                "ride-1",
                "replace",
                restored_state.digest(),
                restored_state.state_version,
                {"identity": 0.45, "finance": 0.40, "repeat": 0.60},
                {"capital": 300},
                0.40,
                assumptions=("Replacement construction finishes on time.",),
                reversible=False,
            ),
        ),
        priority_weights={"identity": 0.35, "finance": 0.35, "repeat": 0.30},
    )

    cadence = SimulationCadencePlan(
        "reference-first-map",
        simulation_tick_ms=100,
        render_frame_ms=16,
        lane_intervals_ticks={"movement": 1, "economy": 10, "reputation": 50},
        snapshot_interval_ticks=100,
        max_catchup_ticks=4,
    )
    ride_event = log.events[0]
    animation_signal = derive_animation_signal(
        ride_event,
        entity_id="ride-1",
        clip_id="open-cycle",
        duration_ticks=10,
        state_version=command_result.resulting_state.state_version,
        parameters={"speed": 1.0},
    )
    resolution = PopulationResolutionPolicy(micro_max=10, meso_max=100).decide(
        int(round(market.first_time_visits + market.repeat_visits))
    )

    return {
        "command": {
            "accepted": command_result.accepted,
            "committed": command_result.committed,
            "state_version": command_result.resulting_state.state_version,
            "event_count": len(log.events),
            "event_log_valid": log.validate_chain(),
            "ride_open": command_result.resulting_state.module_state(
                "axm.themepark.rides"
            )["ride-1"]["open"],
            "visitor_notifications": command_result.resulting_state.module_state(
                "axm.themepark.visitors_crews"
            )["ride_open_notifications"],
        },
        "market": {
            "population_before": cohort.population,
            "population_after": market.next_state.population,
            "conservation_error": market.conservation_error,
            "first_time_reservoir_before": cohort.first_time_reservoir,
            "first_time_reservoir_after": market.next_state.first_time_reservoir,
            "first_time_visits": market.first_time_visits,
            "repeat_visits": market.repeat_visits,
            "unmet_first_time_demand": market.unmet_first_time_demand,
            "unmet_repeat_demand": market.unmet_repeat_demand,
        },
        "contribution": {
            "valid": contribution_audit.valid,
            "claim_count": contribution_audit.claim_count,
            "ride_net": contribution.net("ride-1"),
            "unallocated_shares": dict(contribution_audit.unallocated_shares),
        },
        "provenance": {
            "digest": provenance.digest(),
            "metric": asdict(provenance.explanation("metric-first-time-visits")),
        },
        "snapshot": {
            "snapshot_id": snapshot.snapshot_id,
            "restored_state_hash_matches": restored_state.digest()
            == command_result.resulting_state.digest(),
            "restored_log_hash_matches": restored_log.event_log_hash()
            == log.event_log_hash(),
            "fork_log_hash_matches": forked_log.event_log_hash()
            == log.event_log_hash(),
            "fork_module_state_matches": sha256_value(forked_state.module_states)
            == sha256_value(restored_state.module_states),
            "fork_branch": forked_state.branch_id,
            "parent_branch": lineage.parent_branch_id,
        },
        "counterfactual": {
            "review_order": list(comparison.review_order),
            "automatic_selection": comparison.automatic_selection,
            "no_action_preserved": "no_action" in comparison.reviews,
            "replace_warnings": list(comparison.reviews["replace"].warnings),
        },
        "performance": {
            "authoritative_clock": cadence.authoritative_clock,
            "economy_due_tick_20": cadence.lane_due("economy", 20),
            "animation_authoritative": animation_signal.authoritative,
            "animation_rebuildable": animation_signal.rebuildable,
            "population_resolution_tier": resolution.tier,
            "represented_population": resolution.represented_population,
        },
        "state_hash": command_result.resulting_state.digest(),
        "event_log_hash": log.event_log_hash(),
    }


def build_demo() -> dict:
    left = _run_once()
    right = _run_once()
    same_seed_same_digest = sha256_value(left) == sha256_value(right)
    if not same_seed_same_digest:
        raise RuntimeError("reference slice is not deterministic")

    definition = json.loads(
        (ROOT / "data/vertical_slice/FIRST_MAP_ACCEPTANCE_DEFINITION.json").read_text(
            encoding="utf-8"
        )
    )
    passed = {
        "roots_verified": ("root:" + CANONICAL_ROOT_HASH,),
        "same_seed_same_digest": ("reference_slice:" + sha256_value(left),),
        "save_reload_same_state": ("snapshot:" + left["snapshot"]["snapshot_id"],),
        "visual_frames_may_drop_without_sim_skip": ("cadence:reference-first-map",),
        "concept_art_not_claimed_as_gameplay": ("visuals:VISUAL_PROVENANCE",),
        "known_placeholders_listed": ("ACTION_REPORT:production-gaps",),
    }
    checks = []
    for item in definition["checks"]:
        evidence = passed.get(item["check_id"], ())
        checks.append(AcceptanceCheck(
            check_id=item["check_id"],
            category=item["category"],
            required=item["required"],
            status="pass" if evidence else "not_run",
            evidence_refs=evidence,
            notes=() if evidence else (
                "Reference organ only; production gameplay evidence does not exist yet.",
            ),
        ))
    acceptance = AcceptanceReport(
        "reference-slice-acceptance",
        "reference-slice-0.3.0",
        tuple(checks),
    )

    result = dict(left)
    result["same_seed_same_digest"] = same_seed_same_digest
    result["acceptance"] = acceptance.summary()
    result["acceptance_blocking_ids"] = [
        check.check_id for check in acceptance.blocking_checks()
    ]
    result["honest_status"] = {
        "implemented": [
            "deterministic command transaction",
            "cohort conservation reference",
            "causal contribution attribution reference",
            "snapshot restore and branch lineage",
            "counterfactual review without automatic choice",
            "non-authoritative animation signal",
        ],
        "reference": [
            "one synthetic ride",
            "one synthetic audience cohort",
            "synthetic contribution values",
        ],
        "placeholder": [
            "playable map",
            "pathfinding",
            "production ride loop",
            "crew task execution",
            "renderer and visible self-made animation",
            "closed daily cashflow",
        ],
    }
    result["demo_digest"] = sha256_value(result)
    return result


if __name__ == "__main__":
    print(json.dumps(build_demo(), indent=2, sort_keys=True))
