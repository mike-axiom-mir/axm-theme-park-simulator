import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from park_foundation import (
    DemandInputs, AtmosphereInputs, ContributionInputs,
    evaluate_reachable_demand, evaluate_atmosphere, evaluate_contribution,
    ParkEvent, DeterministicEventLog, ModuleManifest, ModuleRegistry,
)

class FoundationTests(unittest.TestCase):
    def test_age_is_not_a_demand_input(self):
        fields = DemandInputs.__dataclass_fields__
        self.assertNotIn("age", fields)
        self.assertNotIn("attraction_age", fields)

    def test_first_time_audience_can_value_old_attraction(self):
        packet = evaluate_reachable_demand(
            "classic_coaster:tourists",
            DemandInputs(
                geographic_reach=0.9,
                awareness=0.8,
                audience_fit=0.9,
                travel_friction_inverse=0.7,
                price_fit=0.8,
                marketing_fit=0.8,
                expectation_delivery=0.9,
            ),
        )
        self.assertGreater(packet.result, 0.75)

    def test_light_theming_is_not_automatic_failure(self):
        packet = evaluate_atmosphere(
            "coaster_field",
            AtmosphereInputs(
                coherence=0.7,
                visibility=0.3,
                sensory_integration=0.2,
                queue_ride_integration=0.3,
                audience_theme_fit=0.8,
                maintenance=0.9,
                clutter=0.0,
            ),
        )
        self.assertGreater(packet.result, 0.35)

    def test_indirect_value_can_support_an_attraction(self):
        packet = evaluate_contribution(
            "family_boat_ride",
            ContributionInputs(
                direct_revenue=5,
                induced_spend=20,
                visit_attraction_value=30,
                duration_value=15,
                identity_value=20,
                crowd_balance_value=10,
                operating_cost=25,
                maintenance_cost=10,
                staffing_cost=8,
            ),
        )
        self.assertGreater(packet.result, 0)

    def test_event_replay_is_stable(self):
        event = ParkEvent(
            event_id="e1",
            event_type="ride.opened",
            tick=10,
            actor_id="player",
            target_ids=["ride_1"],
            payload={"open": True},
            seed=42,
            module_id="rides",
            module_version="0.1.0",
            evidence_refs=[],
        )
        log_a = DeterministicEventLog()
        log_b = DeterministicEventLog()
        log_a.append(event)
        log_b.append(event)
        self.assertEqual(log_a.replay_packet(), log_b.replay_packet())
        self.assertEqual(log_a.seeded_rng(event).random(), log_b.seeded_rng(event).random())

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

if __name__ == "__main__":
    unittest.main()
