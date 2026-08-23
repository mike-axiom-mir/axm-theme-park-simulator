from __future__ import annotations

from hashlib import sha256
import importlib.util
import json
from pathlib import Path
import os
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from park_foundation import (
    AcceptanceCheck,
    AcceptanceReport,
    ModuleManifest,
    RuntimeAssemblyPlanner,
)

CANONICAL_ROOT_HASH = "3ec57d2a387943cd0ade4a4f3e4de0ebd85c0885b84e0e0c9d74c776463ffa0f"
INDEX_EXCLUDES = {
    "PROJECT_INDEX.json",
    "CHECKSUMS.sha256",
    "release/VERIFICATION_REPORT.txt",
    "release/TEST_REPORT.txt",
}
CHECKSUM_EXCLUDES = {
    "CHECKSUMS.sha256",
    "release/VERIFICATION_REPORT.txt",
    "release/TEST_REPORT.txt",
}

REQUIRED = [
    "START_HERE.txt", "MASTER_HANDOFF.txt", "FOUNDATION_ROOTS.md", "ARCHITECTURE.md",
    "BRANCH_MAP.md", "ACTION_REPORT.md", "contracts/FOUNDATION_CONTRACT.json",
    "contracts/ROOT_HASH_MANIFEST.json", "contracts/RUNTIME_PROTOCOL_CONTRACT.json",
    "contracts/SYSTEM_SPEC.schema.json", "contracts/BRANCH_RETURN_PACKET.schema.json",
    "contracts/COMMAND_ENVELOPE.schema.json", "contracts/EVENT_INTENT.schema.json",
    "contracts/COMMAND_PLAN.schema.json", "contracts/SIMULATION_STATE.schema.json",
    "contracts/STATE_SNAPSHOT.schema.json", "contracts/AUDIENCE_COHORT.schema.json",
    "contracts/COHORT_FORCES.schema.json", "contracts/MARKET_STEP_RESULT.schema.json",
    "contracts/CONTRIBUTION_CLAIM.schema.json", "contracts/CONTRIBUTION_AUDIT.schema.json",
    "contracts/ANIMATION_SIGNAL.schema.json", "contracts/COUNTERFACTUAL_PROJECTION.schema.json",
    "src/park_foundation/__init__.py", "src/park_foundation/scheduler.py",
    "src/park_foundation/cadence.py", "src/park_foundation/state_store.py",
    "src/park_foundation/actions.py", "src/park_foundation/kernel.py",
    "src/park_foundation/event_log.py", "src/park_foundation/snapshot.py",
    "src/park_foundation/market.py", "src/park_foundation/ledger.py",
    "src/park_foundation/counterfactual.py", "src/park_foundation/provenance.py",
    "src/park_foundation/assembly.py", "src/park_foundation/return_packet.py",
    "src/park_foundation/acceptance.py", "data/runtime/REFERENCE_SYSTEM_PLAN.json",
    "data/runtime/LIVING_PARK_REFERENCE_SCENARIO.json",
    "data/vertical_slice/FIRST_MAP_ACCEPTANCE_DEFINITION.json",
    "docs/RUNTIME_ORGAN_API_MAP.md", "docs/RUNTIME_HARDENING_v0_3_0.md",
    "docs/FIRST_MAP_REFERENCE_SLICE.md",
    "examples/run_runtime_integration_demo.py", "examples/run_living_park_reference.py",
    "examples/run_first_map_reference_slice.py", "scripts/run_reference_suite.py",
    "scripts/generate_release_metadata.py",
    "release/CAPABILITY_STATUS.json", "release/PACKAGE_SUMMARY.txt",
    "release/LIVING_REFERENCE_OUTPUT.json",
    "release/FIRST_MAP_REFERENCE_OUTPUT.json",
    "release/REFERENCE_SUITE_OUTPUT.json",
    "release/FIRST_MAP_READINESS_REPORT.json",
    "release/TEST_REPORT.txt", "release/VERIFICATION_REPORT.txt",
    "tests/test_runtime_hardening.py",
    "prompts/NEXT_CHAT_MASTER_PROMPT.txt", "prompts/LOCAL_AGENT_INTAKE_PROMPT.txt",
    "backups/AXM_THEME_PARK_SIM_COMPLETE_DESIGN_BACKUP_2026-08-04.txt",
    "legacy/AXM_THEME_PARK_DETERMINISTIC_FOUNDATION_v0_1_0.zip",
    "legacy/AXM_THEME_PARK_SIM_COMPLETE_HANDOFF_v0_2_0.zip",
]


def sha256_file(path: Path) -> str:
    digest = sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def actual_stable_files(excludes: set[str]) -> set[str]:
    paths = set()
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT).as_posix()
        if rel in excludes or "__pycache__" in path.parts or path.suffix == ".pyc":
            continue
        paths.add(rel)
    return paths


def verify_required() -> list[str]:
    return [item for item in REQUIRED if not (ROOT / item).is_file()]


def verify_roots() -> list[str]:
    manifest = json.loads(
        (ROOT / "contracts/ROOT_HASH_MANIFEST.json").read_text(encoding="utf-8")
    )
    issues, actual = [], {}
    for name, expected in manifest["files"].items():
        path = ROOT / name
        if not path.is_file():
            issues.append(f"missing canonical root: {name}")
            continue
        value = sha256_file(path)
        actual[name] = value
        if value != expected:
            issues.append(f"canonical root hash mismatch: {name}")
    aggregate = sha256(
        json.dumps(actual, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    if aggregate != manifest["aggregate_root_hash"]:
        issues.append("aggregate canonical root hash mismatch")
    if aggregate != CANONICAL_ROOT_HASH:
        issues.append("v0.3.0 did not preserve the approved v0.2.0 design-root hash")
    return issues


def verify_index() -> list[str]:
    index_path = ROOT / "PROJECT_INDEX.json"
    if not index_path.is_file():
        return ["PROJECT_INDEX.json is missing"]
    index = json.loads(index_path.read_text(encoding="utf-8"))
    issues = []
    indexed_paths = set()
    for item in index.get("files", []):
        rel = item["path"]
        indexed_paths.add(rel)
        path = ROOT / rel
        if not path.is_file():
            issues.append(f"indexed file missing: {rel}")
            continue
        if path.stat().st_size != item["bytes"]:
            issues.append(f"size mismatch: {rel}")
        if sha256_file(path) != item["sha256"]:
            issues.append(f"hash mismatch: {rel}")
    expected = actual_stable_files(set(index.get("excluded_paths", INDEX_EXCLUDES)))
    missing_from_index = sorted(expected - indexed_paths)
    stale_index_entries = sorted(indexed_paths - expected)
    issues.extend(f"unindexed stable file: {item}" for item in missing_from_index)
    issues.extend(f"stale index entry: {item}" for item in stale_index_entries)
    if index.get("file_count") != len(indexed_paths):
        issues.append("PROJECT_INDEX file_count mismatch")
    return issues


def verify_checksums() -> list[str]:
    path = ROOT / "CHECKSUMS.sha256"
    if not path.is_file():
        return ["CHECKSUMS.sha256 is missing"]
    issues = []
    entries = {}
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            digest, rel = line.split("  ", 1)
        except ValueError:
            issues.append(f"invalid checksum line {line_number}")
            continue
        if rel in entries:
            issues.append(f"duplicate checksum entry: {rel}")
        entries[rel] = digest
    expected = actual_stable_files(CHECKSUM_EXCLUDES)
    issues.extend(f"missing checksum: {item}" for item in sorted(expected - set(entries)))
    issues.extend(f"stale checksum entry: {item}" for item in sorted(set(entries) - expected))
    for rel, expected_digest in entries.items():
        file_path = ROOT / rel
        if file_path.is_file() and sha256_file(file_path) != expected_digest:
            issues.append(f"checksum mismatch: {rel}")
    return issues


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


def verify_assembly() -> list[str]:
    try:
        return list(RuntimeAssemblyPlanner(load_manifests()).validate().blocking_issues)
    except Exception as error:
        return [f"assembly validation exception: {error}"]


def load_example(filename: str, module_name: str):
    spec = importlib.util.spec_from_file_location(module_name, ROOT / "examples" / filename)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def verify_integration_demo() -> list[str]:
    try:
        module = load_example("run_runtime_integration_demo.py", "runtime_demo_verify")
        left, right = module.build_demo(), module.build_demo()
        issues = []
        if left != right:
            issues.append("integration demo is not deterministic")
        if not left.get("assembly_valid"):
            issues.append("integration demo assembly is invalid")
        if left.get("authoritative_state_hash") != left.get("fork_state_hash"):
            issues.append("namespace-state fork hash mismatch")
        return issues
    except Exception as error:
        return [f"integration demo exception: {error}"]


def verify_living_reference() -> list[str]:
    try:
        module = load_example("run_living_park_reference.py", "living_reference_verify")
        left, right = module.build_reference(), module.build_reference()
        issues = []
        if left != right:
            issues.append("living reference is not deterministic")
        required_true = (
            "event_chain_valid", "population_conserved", "snapshot_verified",
            "fork_event_log_preserved", "contribution_ledger_valid",
        )
        for key in required_true:
            if not left.get(key):
                issues.append(f"living reference invariant failed: {key}")
        if left.get("ride_age_years") != 22:
            issues.append("living reference lost the old-attraction fixture")
        if not (left.get("first_time_visits", 0) > 0 and left.get("repeat_visits", 0) > 0):
            issues.append("living reference did not preserve separate first/repeat demand")
        if left.get("animation_signal", {}).get("authoritative") is not False:
            issues.append("animation signal became authoritative")
        if left.get("counterfactual_auto_selected") is not False:
            issues.append("counterfactual silently selected an action")
        if left.get("first_map_ready") is not False:
            issues.append("reference world falsely claims first-map readiness")
        recorded = json.loads(
            (ROOT / "release/LIVING_REFERENCE_OUTPUT.json").read_text(encoding="utf-8")
        )
        if recorded != left:
            issues.append("recorded living-reference output is stale")
        return issues
    except Exception as error:
        return [f"living reference exception: {error}"]


def verify_first_map_reference() -> list[str]:
    try:
        module = load_example(
            "run_first_map_reference_slice.py", "first_map_reference_verify"
        )
        left, right = module.build_demo(), module.build_demo()
        issues = []
        if left != right:
            issues.append("first-map reference slice is not deterministic")
        if left.get("same_seed_same_digest") is not True:
            issues.append("first-map reference did not confirm same-seed digest")
        command = left.get("command", {})
        if not (command.get("accepted") and command.get("committed")):
            issues.append("first-map reference command transaction did not commit")
        if command.get("event_log_valid") is not True:
            issues.append("first-map reference event chain is invalid")
        market = left.get("market", {})
        if market.get("population_before") != market.get("population_after"):
            issues.append("first-map reference did not conserve population")
        if market.get("first_time_visits", 0) <= 0 or market.get("repeat_visits", 0) <= 0:
            issues.append("first-map reference lost separate first/repeat flow")
        if left.get("contribution", {}).get("valid") is not True:
            issues.append("first-map contribution audit failed")
        snapshot = left.get("snapshot", {})
        for key in (
            "restored_state_hash_matches", "restored_log_hash_matches",
            "fork_module_state_matches", "fork_log_hash_matches",
        ):
            if snapshot.get(key) is not True:
                issues.append(f"first-map snapshot invariant failed: {key}")
        if left.get("counterfactual", {}).get("automatic_selection") is not False:
            issues.append("first-map counterfactual silently selected an action")
        if left.get("performance", {}).get("animation_authoritative") is not False:
            issues.append("first-map animation output became authoritative")
        if left.get("acceptance", {}).get("ready") is not False:
            issues.append("first-map reference falsely claims playable readiness")
        recorded = json.loads(
            (ROOT / "release/FIRST_MAP_REFERENCE_OUTPUT.json").read_text(encoding="utf-8")
        )
        if recorded != left:
            issues.append("recorded first-map reference output is stale")
        return issues
    except Exception as error:
        return [f"first-map reference exception: {error}"]


def verify_readiness_truth() -> list[str]:
    path = ROOT / "release/FIRST_MAP_READINESS_REPORT.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        checks = tuple(AcceptanceCheck(
            check_id=item["check_id"],
            category=item["category"],
            required=item["required"],
            status=item["status"],
            evidence_refs=tuple(item.get("evidence_refs", [])),
            notes=tuple(item.get("notes", [])),
        ) for item in data["checks"])
        report = AcceptanceReport(data["report_id"], data["build_id"], checks)
        issues = []
        if report.ready():
            issues.append("current package falsely claims a playable first map")
        ids = {item.check_id: item for item in checks}
        for expected_not_run in (
            "one_small_map_loads", "entrance_and_path_work",
            "at_least_three_simple_attractions", "visitors_arrive_move_queue_leave",
            "one_crew_task_loop", "basic_cashflow_closes",
            "management_and_walk_view_same_state",
            "self_made_low_graphic_animation_visible",
        ):
            item = ids.get(expected_not_run)
            if item is None or item.status != "not_run":
                issues.append(f"playable gap is not honestly marked not_run: {expected_not_run}")
        return issues
    except Exception as error:
        return [f"readiness report exception: {error}"]


def verify_reference_suite() -> list[str]:
    completed = subprocess.run(
        [sys.executable, str(ROOT / "scripts/run_reference_suite.py")],
        cwd=ROOT, capture_output=True, text=True,
    )
    if completed.returncode != 0:
        return ["reference suite failed: " + (completed.stdout + completed.stderr).strip()]
    try:
        data = json.loads(completed.stdout)
    except json.JSONDecodeError as error:
        return [f"reference suite returned invalid JSON: {error}"]
    issues = []
    if not data.get("valid"):
        issues.append("reference suite did not report valid")
    demos = {item.get("path"): item for item in data.get("demos", [])}
    expected = {
        "examples/run_reference_demo.py",
        "examples/run_runtime_integration_demo.py",
        "examples/run_living_park_reference.py",
        "examples/run_first_map_reference_slice.py",
    }
    missing = sorted(expected.difference(demos))
    issues.extend(f"reference suite missing demo: {item}" for item in missing)
    for path, item in demos.items():
        if not item.get("deterministic_stdout"):
            issues.append(f"reference demo is not repeatable: {path}")
    for path in (
        "examples/run_living_park_reference.py",
        "examples/run_first_map_reference_slice.py",
    ):
        if path in demos and demos[path].get("first_map_ready") is not False:
            issues.append(f"reference slice made an unsupported first-map-ready claim: {path}")
    recorded = json.loads(
        (ROOT / "release/REFERENCE_SUITE_OUTPUT.json").read_text(encoding="utf-8")
    )
    if recorded != data:
        issues.append("recorded reference-suite output is stale")
    return issues



def run_validator(script_name: str, *args: str) -> list[str]:
    completed = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / script_name), *args],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if completed.returncode == 0:
        return []
    return [f"{script_name} failed: {(completed.stdout + completed.stderr).strip()}"]


def run_tests() -> tuple[int, str]:
    command = [
        sys.executable, "-m", "unittest", "discover", "-s", str(ROOT / "tests"),
        "-p", "test_*.py", "-v",
    ]
    env = dict(os.environ)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    completed = subprocess.run(
        command, cwd=ROOT, capture_output=True, text=True, env=env
    )
    return completed.returncode, (completed.stdout + completed.stderr).strip()


def main() -> int:
    print("AXM Theme Park Simulator package verifier v0.3.0")
    groups = {
        "Required files": verify_required(),
        "Canonical design roots": verify_roots(),
        "Project index": verify_index(),
        "Checksums": verify_checksums(),
        "Runtime assembly": verify_assembly(),
        "Integration-spine demo": verify_integration_demo(),
        "Living reference world": verify_living_reference(),
        "First-map reference slice": verify_first_map_reference(),
        "First-map truth": verify_readiness_truth(),
        "Reference suite": verify_reference_suite(),
        "System plan": run_validator("validate_system_plan.py"),
        "Static JSON": run_validator("static_validate.py"),
        "Reference return packet": run_validator(
            "validate_return_packet.py", "examples/VALID_REFERENCE_RETURN_PACKET.json"
        ),
    }
    test_code, test_output = run_tests()
    for name, issues in groups.items():
        print(f"{name}: {'OK' if not issues else 'FAILED'}")
        for issue in issues:
            print(f"  - {issue}")
    print(f"Tests: {'OK' if test_code == 0 else 'FAILED'}")
    print(test_output)
    ok = all(not issues for issues in groups.values()) and test_code == 0
    print(f"FINAL: {'PASS' if ok else 'FAIL'}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
