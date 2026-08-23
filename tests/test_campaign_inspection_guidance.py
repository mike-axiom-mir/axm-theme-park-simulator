import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from park_foundation import (
    CampaignEnding, CampaignState, evaluate_campaign_endings,
    InspectionObservation, verify_observation_state,
    AssistanceProfile, render_guidance, ExplanationPacket,
)


class CampaignInspectionGuidanceTests(unittest.TestCase):
    def test_multiple_campaign_endings_can_be_available(self):
        state = CampaignState("local_park", {}, {"stable", "historic_saved"}, ["e1"])
        endings = [
            CampaignEnding("heritage", "Heritage Future", frozenset({"stable", "historic_saved"})),
            CampaignEnding("family", "Family Future", frozenset({"stable"})),
        ]
        outcome = evaluate_campaign_endings(state, endings)
        self.assertEqual(set(outcome.available_ending_ids), {"heritage", "family"})

    def test_campaign_ending_needs_evidence(self):
        state = CampaignState("x", {}, {"stable"}, [])
        ending = CampaignEnding("end", "End", frozenset({"stable"}), minimum_evidence_refs=1)
        outcome = evaluate_campaign_endings(state, [ending])
        self.assertIn("end", outcome.blocked_reasons)

    def test_inspection_is_bound_to_state_hash(self):
        observation = InspectionObservation("o1", 10, "player", ("ride",), "a" * 64,
                                            {"queue": "uncomfortable"}, ("view1",))
        self.assertTrue(verify_observation_state(observation, "a" * 64))
        self.assertFalse(verify_observation_state(observation, "b" * 64))

    def test_guidance_preserves_source_result(self):
        packet = ExplanationPacket("ride", 0.42, {"a": 0.2, "b": 0.1},
                                   player_options=["maintain", "evolve"], confidence=0.6)
        beginner = AssistanceProfile("beginner", "beginner", 1, True, True, False)
        expert = AssistanceProfile("expert", "expert", 20, False, True, True)
        self.assertEqual(render_guidance(packet, beginner).source_result,
                         render_guidance(packet, expert).source_result)

    def test_beginner_profile_limits_not_rewrites(self):
        packet = ExplanationPacket("ride", 1.0, {"a": 1, "b": 2, "c": 3},
                                   player_options=["1", "2", "3"])
        card = render_guidance(packet, AssistanceProfile("b", "beginner", 1, True, True, False))
        self.assertEqual(len(card.recommendations), 1)
        self.assertEqual(card.source_result, 1.0)


if __name__ == "__main__":
    unittest.main()
