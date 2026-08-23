import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import unittest

from park_foundation import (
    DemandInputs, AtmosphereInputs, ContributionInputs,
    AttendanceBalanceInputs, StrategyInputs,
    evaluate_reachable_demand, evaluate_atmosphere, evaluate_contribution,
    evaluate_active_attendance_balance, evaluate_strategy,
)


class EvaluatorTests(unittest.TestCase):
    def test_age_is_not_a_demand_input(self):
        fields = DemandInputs.__dataclass_fields__
        self.assertNotIn("age", fields)
        self.assertNotIn("attraction_age", fields)

    def test_first_time_tourists_can_value_old_attraction(self):
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
                first_time_share=0.95,
                repeat_strength=0.2,
            ),
        )
        self.assertGreater(packet.result, 0.75)
        self.assertNotIn("age", packet.causes)

    def test_repeat_strength_supports_exposed_locals(self):
        high_repeat = evaluate_reachable_demand(
            "classic_boat:locals",
            DemandInputs(0.9, 0.9, 0.8, 0.9, 0.9, 0.8, 0.9,
                         first_time_share=0.1, repeat_strength=0.9),
        )
        low_repeat = evaluate_reachable_demand(
            "one_time_show:locals",
            DemandInputs(0.9, 0.9, 0.8, 0.9, 0.9, 0.8, 0.9,
                         first_time_share=0.1, repeat_strength=0.1),
        )
        self.assertGreater(high_repeat.result, low_repeat.result)

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
                theme_intensity=0.25,
            ),
        )
        self.assertGreater(packet.result, 0.25)
        self.assertIn("Keep the area lightly themed if that better serves park identity.",
                      packet.player_options)

    def test_atmosphere_has_no_object_count_input(self):
        self.assertNotIn("object_count", AtmosphereInputs.__dataclass_fields__)
        self.assertNotIn("decoration_object_count", AtmosphereInputs.__dataclass_fields__)

    def test_indirect_value_can_support_attraction(self):
        packet = evaluate_contribution(
            "family_boat_ride",
            ContributionInputs(
                direct_revenue=5,
                induced_spend=20,
                visit_attraction_value=30,
                duration_value=15,
                identity_value=20,
                crowd_balance_value=10,
                heritage_value=10,
                operating_cost=25,
                maintenance_cost=10,
                staffing_cost=8,
            ),
        )
        self.assertGreater(packet.result, 0)

    def test_attendance_reports_overcrowding_cause(self):
        packet = evaluate_active_attendance_balance(
            "park:peak",
            AttendanceBalanceInputs(
                active_visitors=1500,
                minimum_viable_attendance=500,
                comfortable_capacity=1000,
                service_capacity=900,
                attraction_capacity=1100,
                operating_cost_per_hour=5000,
                revenue_per_active_visitor_hour=6,
            ),
        )
        self.assertGreater(packet.causes["occupancy_ratio"], 1.0)
        self.assertTrue(any("capacity" in option.lower() for option in packet.player_options))

    def test_strategy_is_review_not_forced_action(self):
        assessment = evaluate_strategy(
            "classic_ride",
            StrategyInputs(
                condition=0.7,
                financial_contribution=0.6,
                identity_fit=0.9,
                audience_fit=0.7,
                repeat_strength=0.8,
                replacement_opportunity=0.4,
                heritage_value=0.9,
            ),
        )
        self.assertEqual(set(assessment.action_scores), {"maintain", "evolve", "replace"})
        self.assertIn("no action is automatic",
                      " ".join(assessment.explanation.player_options).lower())

    def test_safety_risk_requests_temporary_closure_not_forced_replacement(self):
        assessment = evaluate_strategy(
            "unsafe_ride",
            StrategyInputs(0.2, 0.5, 0.8, 0.8, 0.7, 0.4, 0.5, 0.9),
        )
        joined = " ".join(assessment.explanation.player_options).lower()
        self.assertIn("close temporarily", joined)
        self.assertIn("not the same as forced permanent replacement",
                      " ".join(assessment.explanation.uncertainty_notes).lower())


if __name__ == "__main__":
    unittest.main()
