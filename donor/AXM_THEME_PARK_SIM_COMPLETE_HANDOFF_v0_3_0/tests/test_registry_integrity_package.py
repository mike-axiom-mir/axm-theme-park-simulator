import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import json
import unittest

from park_foundation import (
    ModuleManifest, ModuleRegistry, validate_integrity,
    EvidenceRef, UncertainValue, evidence_confidence,
)


class RegistryIntegrityPackageTests(unittest.TestCase):
    def test_registry_blocks_forbidden_shortcut(self):
        registry = ModuleRegistry()
        manifest = ModuleManifest(
            module_id="bad.module",
            version="0.1.0",
            owns=["BadThing"],
            consumes=[],
            emits_events=[],
            consumes_events=[],
            declared_shortcuts=["single_global_popularity"],
        )
        with self.assertRaises(ValueError):
            registry.register(manifest)

    def test_registry_blocks_contract_mismatch(self):
        registry = ModuleRegistry()
        manifest = ModuleManifest(
            "old.module", "0.1.0", ["Thing"], [], [], [], [],
            canonical_contract_version="0.1.0",
        )
        with self.assertRaises(ValueError):
            registry.register(manifest)

    def test_registry_blocks_duplicate_ownership(self):
        registry = ModuleRegistry()
        a = ModuleManifest("a", "1", ["Thing"], [], [], [], [])
        b = ModuleManifest("b", "1", ["Thing"], [], [], [], [])
        registry.register(a)
        with self.assertRaises(ValueError):
            registry.register(b)

    def test_integrity_scan_finds_nested_shortcut(self):
        report = validate_integrity({
            "safe": {"declared_shortcuts": ["age_only_demand_decay"]}
        })
        self.assertFalse(report.valid)
        self.assertTrue(report.findings)

    def test_evidence_confidence_preserves_dispute(self):
        evidence = [
            EvidenceRef("e1", "visitors", 1, "observed", 0.9, "queue left early"),
            EvidenceRef("e2", "campaign", 1, "disputed", 0.8, "reason uncertain"),
        ]
        confidence = evidence_confidence(evidence)
        self.assertGreater(confidence, 0)
        self.assertLess(confidence, 0.9)

    def test_uncertain_value_validates_bounds(self):
        value = UncertainValue(0.6, 0.5, 0.3, 0.8)
        self.assertEqual(value.value, 0.6)
        with self.assertRaises(ValueError):
            UncertainValue(0.2, 0.5, 0.3, 0.8)

    def test_all_module_manifests_have_no_declared_shortcuts(self):
        for path in sorted((ROOT / "manifests").glob("*.json")):
            data = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(data["declared_shortcuts"], [], path.name)
            self.assertTrue(data["determinism"]["seeded_randomness_only"])
            self.assertTrue(data["determinism"]["replay_safe"])

    def test_foundation_contract_forbids_age_input(self):
        data = json.loads(
            (ROOT / "contracts" / "FOUNDATION_CONTRACT.json").read_text(encoding="utf-8")
        )
        metric = data["canonical_metrics"]["reachable_demand"]
        self.assertIn("attraction_age", metric["forbidden_inputs"])
        self.assertNotIn("attraction_age", metric["inputs"])

    def test_visuals_are_present_and_labelled_as_concept(self):
        visuals = list((ROOT / "visuals").glob("*.png"))
        self.assertEqual(len(visuals), 4)
        provenance = json.loads(
            (ROOT / "visuals" / "VISUAL_PROVENANCE.json").read_text(encoding="utf-8")
        )
        self.assertTrue(all(item["classification"] == "concept_visual" for item in provenance["assets"]))

    def test_first_map_target_is_not_a_guarantee(self):
        target = json.loads((ROOT / "data" / "FIRST_MAP_TARGET.json").read_text(encoding="utf-8"))
        self.assertEqual(target["status"], "target_not_guarantee")


if __name__ == "__main__":
    unittest.main()
