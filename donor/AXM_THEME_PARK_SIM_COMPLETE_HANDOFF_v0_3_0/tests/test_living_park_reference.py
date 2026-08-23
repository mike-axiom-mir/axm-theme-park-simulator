from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "living_reference", ROOT / "examples/run_living_park_reference.py"
)
living_reference = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(living_reference)


class LivingParkReferenceTests(unittest.TestCase):
    def test_reference_repeats_exactly(self):
        self.assertEqual(
            living_reference.build_reference(),
            living_reference.build_reference(),
        )

    def test_reference_connects_authoritative_organs(self):
        result = living_reference.build_reference()
        self.assertTrue(result["event_chain_valid"])
        self.assertTrue(result["population_conserved"])
        self.assertTrue(result["snapshot_verified"])
        self.assertTrue(result["fork_event_log_preserved"])
        self.assertTrue(result["contribution_ledger_valid"])
        self.assertFalse(result["animation_signal"]["authoritative"])
        self.assertFalse(result["counterfactual_auto_selected"])

    def test_reference_does_not_claim_first_map_done(self):
        result = living_reference.build_reference()
        self.assertFalse(result["first_map_ready"])
        self.assertIn("one_small_map_loads", result["blocking_reference_checks"])
        self.assertIn(
            "self_made_low_graphic_animation_visible",
            result["blocking_reference_checks"],
        )

    def test_old_ride_age_is_history_not_decay(self):
        result = living_reference.build_reference()
        self.assertEqual(result["ride_age_years"], 22)
        self.assertTrue(result["ride_open"])
        self.assertGreater(result["first_time_visits"], 0)
        self.assertGreater(result["repeat_visits"], 0)

    def test_resolution_represents_exact_population(self):
        result = living_reference.build_reference()
        resolution = result["population_resolution"]
        represented = (
            resolution["full_bucket_count"] * resolution["bucket_size"]
            + resolution["remainder_count"]
        )
        self.assertEqual(represented, result["population_initial"])


if __name__ == "__main__":
    unittest.main()
