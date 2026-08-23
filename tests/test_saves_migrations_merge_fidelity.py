import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from park_foundation import (
    StateSnapshot, SnapshotStore, MigrationStep, MigrationRegistry,
    ChangeRequest, MergeGate, VisualFidelityProfile, adapt_presentation,
)


class SavesMigrationsMergeFidelityTests(unittest.TestCase):
    def test_snapshot_hash_is_stable(self):
        a = StateSnapshot("s", 1, "0.2.0", {"rides": "1"}, {"cash": 10})
        b = StateSnapshot("s", 1, "0.2.0", {"rides": "1"}, {"cash": 10})
        self.assertEqual(a.digest(), b.digest())

    def test_snapshot_store_verifies_and_rolls_back(self):
        store = SnapshotStore()
        snapshot = StateSnapshot("s1", 1, "0.2.0", {}, {"cash": 10})
        digest = store.add(snapshot)
        self.assertTrue(store.verify("s1", digest))
        self.assertEqual(store.rollback("s1"), snapshot)

    def test_snapshot_lineage_requires_existing_parent(self):
        store = SnapshotStore()
        child = StateSnapshot("child", 2, "0.2.0", {}, {}, "f" * 64)
        with self.assertRaises(ValueError):
            store.add(child)

    def test_explicit_migration_chain(self):
        registry = MigrationRegistry()
        registry.register(MigrationStep("m1", "0.1.0", "0.1.5", "add x",
                                        lambda state: {**state, "x": 1}))
        registry.register(MigrationStep("m2", "0.1.5", "0.2.0", "add y",
                                        lambda state: {**state, "y": 2}))
        self.assertEqual(registry.migrate({}, "0.1.0", "0.2.0"), {"x": 1, "y": 2})

    def test_missing_migration_fails_instead_of_guessing(self):
        registry = MigrationRegistry()
        with self.assertRaises(KeyError):
            registry.path("0.1.0", "0.2.0")

    def test_merge_gate_never_auto_merges(self):
        gate = MergeGate("0.2.0", ("R01", "R16"))
        request = ChangeRequest("cr", "rides", "0.2.0", "0.2.1", ("add field",),
                                "needed", (), ("test",))
        decision = gate.review(request)
        self.assertTrue(decision.eligible_for_human_review)
        self.assertFalse(decision.automatically_merged)

    def test_protected_root_change_needs_evidence(self):
        gate = MergeGate("0.2.0", ("R01",))
        request = ChangeRequest("cr", "rides", "0.2.0", "0.3.0", ("change root",),
                                "needed", ("R01",), ())
        self.assertFalse(gate.review(request).eligible_for_human_review)

    def test_visual_profiles_preserve_authoritative_state_hash(self):
        state_hash = "a" * 64
        low = adapt_presentation(state_hash, VisualFidelityProfile("low", 100, 12, 0, 0.5, 3))
        high = adapt_presentation(state_hash, VisualFidelityProfile("high", 2000, 60, 3, 2.0, 1))
        self.assertEqual(low.authoritative_state_hash, high.authoritative_state_hash)


if __name__ == "__main__":
    unittest.main()
