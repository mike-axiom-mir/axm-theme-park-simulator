import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "first_map_reference_slice",
    ROOT / "examples/run_first_map_reference_slice.py",
)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


class FirstMapReferenceSliceTests(unittest.TestCase):
    def test_reference_slice_repeats_exactly(self):
        self.assertEqual(MODULE.build_demo(), MODULE.build_demo())

    def test_population_is_conserved_and_first_time_pool_declines(self):
        result = MODULE.build_demo()
        self.assertEqual(result["market"]["population_before"], result["market"]["population_after"])
        self.assertAlmostEqual(result["market"]["conservation_error"], 0.0)
        self.assertLess(
            result["market"]["first_time_reservoir_after"],
            result["market"]["first_time_reservoir_before"],
        )

    def test_snapshot_fork_preserves_truth_and_lineage(self):
        result = MODULE.build_demo()["snapshot"]
        self.assertTrue(result["restored_state_hash_matches"])
        self.assertTrue(result["restored_log_hash_matches"])
        self.assertTrue(result["fork_log_hash_matches"])
        self.assertTrue(result["fork_module_state_matches"])
        self.assertEqual(result["parent_branch"], "main")
        self.assertNotEqual(result["fork_branch"], result["parent_branch"])

    def test_no_fake_first_map_done(self):
        result = MODULE.build_demo()
        self.assertFalse(result["acceptance"]["ready"])
        self.assertIn("one_small_map_loads", result["acceptance_blocking_ids"])
        self.assertIn("renderer and visible self-made animation", result["honest_status"]["placeholder"])

    def test_contribution_and_event_integrity(self):
        result = MODULE.build_demo()
        self.assertTrue(result["command"]["event_log_valid"])
        self.assertTrue(result["contribution"]["valid"])
        self.assertGreater(result["contribution"]["ride_net"], 0)
        self.assertFalse(result["counterfactual"]["automatic_selection"])
        self.assertTrue(result["counterfactual"]["no_action_preserved"])


if __name__ == "__main__":
    unittest.main()
