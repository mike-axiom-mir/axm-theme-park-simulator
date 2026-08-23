from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from park_foundation import (
    ActionProposal, ActionRouter, ActionRule, DeterministicEventLog,
    DeterministicScheduler, DerivedMetricRecord, EvidenceRef, ModuleManifest,
    NamespaceSpec, NamespaceUpdate, ProvenanceLedger, RuntimeAssemblyPlanner,
    SystemSpec, VersionedStateStore, sha256_value,
)


def load_manifests() -> list[ModuleManifest]:
    manifests = []
    for path in sorted((ROOT / "manifests").glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        determinism = data.pop("determinism")
        data.pop("notes", None)
        manifests.append(ModuleManifest(
            seeded_randomness_only=determinism["seeded_randomness_only"],
            replay_safe=determinism["replay_safe"],
            **data,
        ))
    return manifests


def build_demo() -> dict:
    manifests = load_manifests()
    report = RuntimeAssemblyPlanner(manifests).validate()
    if not report.valid:
        raise RuntimeError(report.blocking_issues)

    system_data = json.loads(
        (ROOT / "data/runtime/REFERENCE_SYSTEM_PLAN.json").read_text(encoding="utf-8")
    )["systems"]
    scheduler = DeterministicScheduler()
    for item in reversed(system_data):  # deliberately reverse registration order
        scheduler.register(SystemSpec(
            system_id=item["system_id"], module_id=item["module_id"], phase=item["phase"],
            cadence_ticks=item["cadence_ticks"], offset_ticks=item["offset_ticks"],
            priority=item["priority"], reads=tuple(item["reads"]), writes=tuple(item["writes"]),
            authoritative=item["authoritative"], skippable=item["skippable"],
        ))

    namespace_specs = []
    for manifest in manifests:
        for namespace in manifest.state_namespaces:
            namespace_specs.append(NamespaceSpec(
                namespace=namespace,
                owner_module_id=manifest.module_id,
                authoritative=not namespace.startswith("visual."),
            ))
    store = VersionedStateStore(tuple(namespace_specs), {
        "foundation.world": {"minute": 540, "open": False},
        "foundation.evidence": {}, "foundation.save": {},
        "rides.core": {"simple_rides": 3, "open_rides": 0},
        "visitors.population": {"active": 0, "waiting": 0},
        "crews.operations": {"on_shift": 2, "tasks_completed": 0},
        "decoration.world": {"theme_zones": 1},
        "economy.operations": {"cash": 10000, "day_revenue": 0},
        "campaign.progress": {"map": "integration_fixture", "complete": False},
        "visual.animation": {"frame": 0},
    })

    router = ActionRouter()
    router.register(ActionRule(
        action_type="park.open",
        owner_module_id="axm.themepark.foundation",
        emitted_event_type="schedule.opened",
        required_scopes=("park.operations",),
    ))
    proposal = ActionProposal(
        proposal_id="proposal_open_demo",
        actor_id="player_1",
        actor_kind="player",
        target_module_id="axm.themepark.foundation",
        action_type="park.open",
        payload={"open": True},
        requested_tick=0,
        expected_state_version=store.authoritative_version,
        authority_scopes=("park.operations",),
    )
    decision = router.evaluate(proposal, current_state_version=store.authoritative_version)
    event = router.event_for(proposal, decision, module_version="0.3.0")
    event_log = DeterministicEventLog()
    event_log.append(event)
    store.apply_batch((NamespaceUpdate(
        update_id="update_open_demo",
        module_id="axm.themepark.foundation",
        namespace="foundation.world",
        base_version=store.authoritative_version,
        new_state={"minute": 540, "open": True},
        reason_event_ids=(event.event_id,),
    ),))

    ledger = ProvenanceLedger()
    ledger.add_evidence(EvidenceRef(
        evidence_id="ev_open_state", source_module="axm.themepark.foundation",
        state_version=store.authoritative_version, status="observed", reliability=1.0,
        summary="Park opening state was committed through the action gate.",
    ))
    ledger.add_metric(DerivedMetricRecord(
        record_id="metric_open_readiness", metric_id="open_readiness",
        subject_id="integration_fixture", module_id="axm.themepark.foundation",
        algorithm_version="demo-0.3.0", state_version=store.authoritative_version,
        result=1.0, unit="normalized", contributions={"action_gate": 0.5, "state_commit": 0.5},
        evidence_refs=("ev_open_state",), confidence=1.0,
    ))

    plans = [scheduler.plan_tick(tick) for tick in range(0, 11)]
    plan_without_visuals = scheduler.plan_tick(0, include_skippable=False)
    snapshot = store.snapshot()
    fork = store.fork(snapshot)

    return {
        "assembly_valid": report.valid,
        "assembly_warnings": list(report.warnings),
        "action_accepted": decision.accepted,
        "event_log_valid": event_log.validate_chain(),
        "authoritative_state_version": store.authoritative_version,
        "authoritative_state_hash": store.state_hash(),
        "fork_state_hash": fork.state_hash(),
        "provenance_hash": ledger.digest(),
        "metric_explanation": ledger.explanation("metric_open_readiness").__dict__,
        "tick_plan_hashes": [plan.plan_hash for plan in plans],
        "tick_zero_systems": [item.system_id for item in plans[0].systems],
        "tick_zero_without_visuals": [item.system_id for item in plan_without_visuals.systems],
        "demo_digest": sha256_value({
            "state": store.state_hash(), "events": event_log.event_log_hash(),
            "provenance": ledger.digest(), "plans": [plan.plan_hash for plan in plans],
        }),
    }


if __name__ == "__main__":
    print(json.dumps(build_demo(), indent=2, sort_keys=True))
