import json
import sys
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from park_foundation import (
    AcceptanceCheck, AcceptanceReport, BranchReturnPacket, DerivedMetricRecord,
    EvidenceRef, ModuleManifest, ProvenanceLedger, ReturnArtifact,
    ReturnPacketVerifier, RuntimeAssemblyPlanner, sha256_file,
)


class ProvenanceAssemblyReturnAcceptanceTests(unittest.TestCase):
    def test_provenance_requires_existing_evidence(self):
        ledger = ProvenanceLedger()
        with self.assertRaises(ValueError):
            ledger.add_metric(DerivedMetricRecord(
                "m1", "demand", "ride", "visitors", "1", 0, 0.5, "score", {},
                evidence_refs=("missing",),
            ))

    def test_provenance_rejects_state_mismatch(self):
        ledger = ProvenanceLedger()
        ledger.add_evidence(EvidenceRef("e1", "rides", 1, "observed", 1.0, "open"))
        with self.assertRaises(ValueError):
            ledger.add_metric(DerivedMetricRecord(
                "m1", "demand", "ride", "visitors", "1", 2, 0.5, "score", {},
                evidence_refs=("e1",),
            ))

    def test_provenance_trace_and_explanation(self):
        ledger = ProvenanceLedger()
        ledger.add_evidence(EvidenceRef("e1", "rides", 1, "observed", 1.0, "open"))
        ledger.add_metric(DerivedMetricRecord(
            "m1", "capacity", "ride", "rides", "1", 1, 0.8, "normalized",
            {"throughput":0.8}, evidence_refs=("e1",),
        ))
        ledger.add_metric(DerivedMetricRecord(
            "m2", "park_value", "park", "foundation", "1", 1, 0.4, "normalized",
            {"capacity":0.4}, input_record_ids=("m1",),
        ))
        self.assertEqual([item.record_id for item in ledger.trace_metric("m2")], ["m1", "m2"])
        explanation = ledger.explanation("m2")
        self.assertEqual(explanation.evidence_refs, ["e1"])
        self.assertEqual(explanation.state_version, 1)

    def manifest(self, module_id, owns=(), consumes=(), caps=(), required=(), emits=(), consumes_events=(), namespaces=(), systems=()):
        return ModuleManifest(
            module_id=module_id, version="1", owns=list(owns), consumes=list(consumes),
            emits_events=list(emits), consumes_events=list(consumes_events),
            declared_shortcuts=[], capabilities=list(caps), required_capabilities=list(required),
            state_namespaces=list(namespaces), system_ids=list(systems), status="reference",
        )

    def test_assembly_detects_missing_capability_and_event(self):
        report = RuntimeAssemblyPlanner([
            self.manifest("a", caps=("cap.a",), required=("missing.cap",), consumes_events=("missing.event",))
        ]).validate()
        self.assertFalse(report.valid)
        self.assertEqual(report.missing_capabilities, ("a:missing.cap",))
        self.assertEqual(report.missing_event_producers, ("a:missing.event",))

    def test_assembly_detects_namespace_and_system_conflicts(self):
        report = RuntimeAssemblyPlanner([
            self.manifest("a", namespaces=("shared",), systems=("same",)),
            self.manifest("b", namespaces=("shared",), systems=("same",)),
        ]).validate()
        self.assertFalse(report.valid)
        self.assertTrue(report.namespace_conflicts)
        self.assertTrue(report.duplicate_system_ids)

    def test_all_project_manifests_assemble(self):
        manifests = []
        for path in sorted((ROOT / "manifests").glob("*.json")):
            data = json.loads(path.read_text(encoding="utf-8"))
            determinism = data.pop("determinism")
            data.pop("notes", None)
            manifests.append(ModuleManifest(
                seeded_randomness_only=determinism["seeded_randomness_only"],
                replay_safe=determinism["replay_safe"], **data,
            ))
        report = RuntimeAssemblyPlanner(manifests).validate()
        self.assertTrue(report.valid, report.blocking_issues)

    def test_return_packet_rejects_status_overlap(self):
        packet = BranchReturnPacket(
            "p", "b", "m", "1", "0.2.0", "a"*64, "reference",
            ("same",), (), ("same",), 1, 0,
            (ReturnArtifact("x", "0"*64, 0, "code"),),
        )
        issues = packet.validate(expected_root_hash="a"*64, expected_contract_version="0.3.0")
        self.assertTrue(any("both implemented and placeholder" in item for item in issues))

    def test_return_packet_verifies_files(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "file.txt"
            path.write_text("hello", encoding="utf-8")
            packet = BranchReturnPacket(
                "p", "b", "m", "1", "0.2.0", "a"*64, "reference",
                (), ("demo",), (), 1, 0,
                (ReturnArtifact("file.txt", sha256_file(path), path.stat().st_size, "code"),),
            )
            self.assertFalse(ReturnPacketVerifier.verify_files(packet, temp))

    def test_required_not_run_blocks_acceptance(self):
        report = AcceptanceReport("r", "b", (
            AcceptanceCheck("c1", "test", True, "not_run"),
        ))
        self.assertFalse(report.ready())

    def test_pass_requires_evidence(self):
        with self.assertRaises(ValueError):
            AcceptanceCheck("c1", "test", True, "pass")

    def test_optional_failure_does_not_block(self):
        report = AcceptanceReport("r", "b", (
            AcceptanceCheck("required", "test", True, "pass", ("e1",)),
            AcceptanceCheck("optional", "test", False, "fail"),
        ))
        self.assertTrue(report.ready())


    def test_valid_reference_return_packet_example(self):
        data = json.loads((ROOT / "examples/VALID_REFERENCE_RETURN_PACKET.json").read_text(encoding="utf-8"))
        artifacts = tuple(ReturnArtifact(**item) for item in data.pop("artifacts"))
        for key in ("implemented_capabilities", "reference_capabilities", "placeholder_capabilities", "unresolved_gaps", "change_request_ids"):
            data[key] = tuple(data[key])
        packet = BranchReturnPacket(artifacts=artifacts, **data)
        self.assertFalse(packet.validate(expected_root_hash="3ec57d2a387943cd0ade4a4f3e4de0ebd85c0885b84e0e0c9d74c776463ffa0f", expected_contract_version="0.3.0"))
        self.assertFalse(ReturnPacketVerifier.verify_files(packet, ROOT / "examples"))


if __name__ == "__main__":
    unittest.main()
