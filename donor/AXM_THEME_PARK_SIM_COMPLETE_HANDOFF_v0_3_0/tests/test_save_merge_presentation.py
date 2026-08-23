import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import unittest

from park_foundation import (
    CANONICAL_ROOT_HASH,
    SaveManifest, SaveVerifier, MigrationPlan,
    ChangeRequest, MergeGate,
    DemandInputs, evaluate_reachable_demand,
    BEGINNER, ADVANCED, render_explanation,
)


class SaveMergePresentationTests(unittest.TestCase):
    def _save(self, root_hash=CANONICAL_ROOT_HASH):
        return SaveManifest(
            save_id="save1",
            format_version="0.2.0",
            foundation_version="0.2.0",
            canonical_root_hash=root_hash,
            module_versions={"axm.themepark.foundation": "0.2.0"},
            tick=100,
            state_hash="a" * 64,
            event_log_hash="b" * 64,
        )

    def test_save_verifier_accepts_matching_environment(self):
        ok, issues = SaveVerifier.verify(
            self._save(),
            expected_root_hash=CANONICAL_ROOT_HASH,
            installed_modules={"axm.themepark.foundation": "0.2.0"},
        )
        self.assertTrue(ok)
        self.assertEqual(issues, ())

    def test_save_verifier_blocks_root_mismatch(self):
        ok, issues = SaveVerifier.verify(
            self._save("c" * 64),
            expected_root_hash=CANONICAL_ROOT_HASH,
            installed_modules={"axm.themepark.foundation": "0.2.0"},
        )
        self.assertFalse(ok)
        self.assertIn("canonical root hash mismatch", issues)

    def test_root_changing_migration_requires_change_request_and_approval(self):
        plan = MigrationPlan(
            "m1", "0.1.0", "0.2.0", ("transform state",), ("Park",),
            "a" * 64, "b" * 64, False, "save_before", None,
        )
        ok, issues = plan.validate()
        self.assertFalse(ok)
        self.assertTrue(any("change_request" in issue for issue in issues))
        self.assertTrue(any("user approval" in issue for issue in issues))

    def test_merge_gate_blocks_silent_root_change(self):
        decision = MergeGate.evaluate(
            {"FOUNDATION_ROOTS.md": "a" * 64},
            {"FOUNDATION_ROOTS.md": "b" * 64},
        )
        self.assertFalse(decision.accepted)

    def test_merge_gate_accepts_approved_exact_change(self):
        base = {"FOUNDATION_ROOTS.md": "a" * 64}
        candidate = {"FOUNDATION_ROOTS.md": "b" * 64}
        request = ChangeRequest(
            "cr1", "Add explicit rule", ("FOUNDATION_ROOTS.md",),
            base, candidate, ("test evidence",), "restore old file",
            "approved", ("Mike",),
        )
        decision = MergeGate.evaluate(base, candidate, request)
        self.assertTrue(decision.accepted)

    def test_beginner_and_advanced_preserve_authoritative_result(self):
        packet = evaluate_reachable_demand(
            "ride:tourists",
            DemandInputs(0.8, 0.8, 0.9, 0.7, 0.8, 0.8, 0.9),
            state_version=12,
        )
        beginner = render_explanation(packet, BEGINNER)
        advanced = render_explanation(packet, ADVANCED)
        self.assertEqual(beginner["result"], advanced["result"])
        self.assertEqual(beginner["confidence"], advanced["confidence"])
        self.assertEqual(beginner["state_version"], advanced["state_version"])
        self.assertLessEqual(len(beginner["causes"]), 3)
        self.assertIn("all_causes", advanced)


if __name__ == "__main__":
    unittest.main()
