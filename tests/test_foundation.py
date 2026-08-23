import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from park_foundation import (
    DemandInputs, AtmosphereInputs, ContributionInputs, ExpectationInputs,
    AttendanceInputs, evaluate_reachable_demand, evaluate_atmosphere,
    evaluate_contribution, evaluate_expectation_delivery,
    evaluate_attendance_balance, ParkEvent, DeterministicEventLog,
    ModuleManifest, ModuleRegistry,
)


class FoundationTests(unittest.TestCase):
    def test_age_is_not_a_demand_input(self):
        fields = DemandInputs.__dataclass_fields__
        self.assertNotIn("age", fields)
        self.assertNotIn("attraction_age", fields)

    def test_first_time_audience_can_value_old_attraction(self):
        packet = evaluate_reachable_demand(
            "classic_coaster:tourists",
            DemandInputs(0.9, 0.8, 0.9, 0.7, 0.8, 0.8, 0.9),
        )
        self.assertGreater(packet.result, 0.75)

    def test_light_theming_is_not_automatic_failure(self):
        packet = evaluate_atmosphere(
            "coaster_field",
            AtmosphereInputs(0.7, 0.3, 0.2, 0.3, 0.8, 0.9, 0.0),
        )
        self.assertGreater(packet.result, 0.35)

    def test_indirect_value_can_support_an_attraction(self):
        packet = evaluate_contribution(
            "family_boat_ride",
            ContributionInputs(5, 20, 30, 15, 20, 10, 25, 10, 8),
        )
        self.assertGreater(packet.result, 0)

    def test_marketing_delivery_gap_is_explainable(self):
        packet = evaluate_expectation_delivery(
            "enchanted_forest_campaign",
            ExpectationInputs(0.3, 0.4, 0.8, 0.5, 0.7),
        )
        self.assertTrue(any("promise" in option.lower() for option in packet.player_options))

    def test_attendance_scale_detects_overload(self):
        packet = evaluate_attendance_balance(
            "park_day", AttendanceInputs(1500, 1000, 1100, 1200, 4.0, 3000.0)
        )
        self.assertGreater(packet.causes["load_ratio"], 1.0)
        self.assertTrue(packet.player_options)

    def test_event_replay_is_stable(self):
        event = ParkEvent("e1", "ride.opened", 10, "player", ["ride_1"],
                          {"open": True}, 42, "rides", "0.2.0", [])
        log_a = DeterministicEventLog(); log_b = DeterministicEventLog()
        log_a.append(event); log_b.append(event)
        self.assertEqual(log_a.replay_packet(), log_b.replay_packet())
        self.assertEqual(log_a.seeded_rng(event).random(), log_b.seeded_rng(event).random())

    def test_event_state_chain_detects_break(self):
        log = DeterministicEventLog()
        log.append(ParkEvent("a", "x", 1, "p", [], {}, 1, "m", "1", [], state_after_hash="a" * 64))
        log.append(ParkEvent("b", "x", 2, "p", [], {}, 2, "m", "1", [], state_before_hash="b" * 64))
        self.assertFalse(log.verify_state_chain())

    def test_registry_blocks_forbidden_shortcut(self):
        registry = ModuleRegistry()
        manifest = ModuleManifest("bad.module", "0.1.0", ["BadThing"], [], [], [], ["single_global_popularity"])
        with self.assertRaises(ValueError):
            registry.register(manifest)

    def test_registry_blocks_direct_state_mutation(self):
        registry = ModuleRegistry()
        manifest = ModuleManifest("bad.mutator", "0.1.0", ["Thing"], [], [], [], [], direct_state_mutations=["visitor.private_state"])
        with self.assertRaises(ValueError):
            registry.register(manifest)


if __name__ == "__main__":
    unittest.main()
