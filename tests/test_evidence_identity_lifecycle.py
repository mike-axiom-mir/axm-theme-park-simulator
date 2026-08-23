import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from park_foundation import (
    EvidenceClaim, EvidenceLedger, ParkIdentityIntent, evaluate_identity_alignment,
    LifecycleEvidence, evaluate_lifecycle_options,
)


class EvidenceIdentityLifecycleTests(unittest.TestCase):
    def test_absolute_certainty_needs_evidence(self):
        with self.assertRaises(ValueError):
            EvidenceClaim("c", "ride", "certain", 1.0)

    def test_conflicting_claims_are_preserved(self):
        ledger = EvidenceLedger()
        ledger.add(EvidenceClaim("a", "land", "sound causes avoidance", 0.7, ("obs1",)))
        ledger.add(EvidenceClaim("b", "land", "heat causes avoidance", 0.6, ("obs2",)))
        ledger.link_conflict("a", "b")
        self.assertEqual(ledger.conflicts_for("a")[0].claim_id, "b")

    def test_identity_alignment_is_per_promise_not_global_score(self):
        intent = ParkIdentityIntent("family", ("affordable", "reliable"))
        packet = evaluate_identity_alignment(intent, {"affordable": 0.8, "reliable": 0.4})
        self.assertFalse(hasattr(packet, "score"))
        self.assertEqual(packet.gaps, ("reliable",))

    def test_lifecycle_returns_all_three_choices(self):
        packet = evaluate_lifecycle_options("classic", LifecycleEvidence(
            0.9, 0.7, 0.9, 0.8, 0.6, 0.5, 0.3, 0.2, 1.0, ("inspection1",)
        ))
        self.assertEqual(set(packet.options), {"maintain", "evolve", "replace"})
        self.assertIsNone(packet.forced_action)

    def test_lifecycle_has_no_age_field(self):
        self.assertNotIn("age", LifecycleEvidence.__dataclass_fields__)

    def test_replacement_needs_specific_alternative_value(self):
        low_alt = evaluate_lifecycle_options("ride", LifecycleEvidence(
            0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.9, 0.0, 0.8
        ))
        high_alt = evaluate_lifecycle_options("ride", LifecycleEvidence(
            0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.9, 1.0, 0.8
        ))
        self.assertGreater(high_alt.options["replace"].viability,
                           low_alt.options["replace"].viability)


if __name__ == "__main__":
    unittest.main()
