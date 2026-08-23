import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import unittest

from park_foundation import (
    ParkIdentityIntent, evaluate_identity_alignment,
    Condition, OutcomePath, CampaignDefinition, CampaignState, CampaignEvaluator,
    ObservationPacket,
)


class IdentityCampaignObservationTests(unittest.TestCase):
    def test_identity_missing_evidence_reduces_confidence_not_hidden(self):
        identity = ParkIdentityIntent(
            "historic", "Historic Park", "living history",
            {"heritage": 0.5, "financial_stability": 0.3, "comfort": 0.2},
            protected_elements=("classic_ride",),
        )
        packet = evaluate_identity_alignment(
            "park",
            identity,
            {"heritage": 0.9, "comfort": 0.7},
            state_version=4,
        )
        self.assertIn("financial_stability", packet.missing_evidence)
        self.assertLess(packet.confidence, 1.0)
        self.assertEqual(packet.state_version, 4)

    def _campaign(self):
        return CampaignDefinition(
            "forgotten",
            "Forgotten Park",
            (
                OutcomePath(
                    "heritage", "Living Heritage",
                    (Condition("heritage", "gte", 0.8),
                     Condition("stability", "gte", 0.6)),
                    "History survives.",
                ),
                OutcomePath(
                    "family", "Family Renewal",
                    (Condition("family_fit", "gte", 0.8),
                     Condition("stability", "gte", 0.6)),
                    "Families return.",
                ),
            ),
        )

    def test_campaign_can_offer_multiple_valid_outcomes(self):
        campaign = self._campaign()
        state = CampaignState("forgotten").with_metrics({
            "heritage": 0.9,
            "family_fit": 0.9,
            "stability": 0.8,
        })
        eligible = CampaignEvaluator.eligible_outcomes(campaign, state)
        self.assertEqual({item.outcome_id for item in eligible}, {"heritage", "family"})

    def test_campaign_player_selects_eligible_outcome(self):
        campaign = self._campaign()
        state = CampaignState("forgotten").with_metrics({
            "heritage": 0.9, "family_fit": 0.2, "stability": 0.8
        })
        completed = CampaignEvaluator.complete(campaign, state, "heritage")
        self.assertEqual(completed.phase, "completed")
        self.assertIn("heritage", completed.completed_outcomes)

    def test_campaign_rejects_forced_single_path_definition(self):
        with self.assertRaises(ValueError):
            CampaignDefinition(
                "bad", "Bad",
                (OutcomePath("only", "Only", (), "Only ending."),),
                multiple_valid_outcomes=True,
            )

    def test_observation_uses_authoritative_state(self):
        packet = ObservationPacket(
            "obs1", "player", "adventure", "queue_1", 100, 8,
            facts=("queue shade is missing",),
        )
        packet.assert_authoritative(authoritative_tick=100, authoritative_state_version=8)

    def test_observation_rejects_state_fork(self):
        packet = ObservationPacket("obs1", "player", "adventure", "ride", 100, 8)
        with self.assertRaises(ValueError):
            packet.assert_authoritative(authoritative_tick=100, authoritative_state_version=9)


if __name__ == "__main__":
    unittest.main()
