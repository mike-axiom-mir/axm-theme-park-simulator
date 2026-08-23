import importlib.util
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

spec = importlib.util.spec_from_file_location(
    "runtime_demo", ROOT / "examples" / "run_runtime_integration_demo.py"
)
runtime_demo = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(runtime_demo)


class RuntimeDemoTests(unittest.TestCase):
    def test_demo_repeats_exactly(self):
        left = runtime_demo.build_demo()
        right = runtime_demo.build_demo()
        self.assertEqual(left, right)
        self.assertTrue(left["assembly_valid"])
        self.assertTrue(left["action_accepted"])
        self.assertTrue(left["event_log_valid"])
        self.assertEqual(left["authoritative_state_hash"], left["fork_state_hash"])

    def test_visual_systems_are_removed_but_authoritative_systems_remain(self):
        result = runtime_demo.build_demo()
        self.assertIn("foundation.world_clock", result["tick_zero_without_visuals"])
        self.assertNotIn("animation.interpolate", result["tick_zero_without_visuals"])
        self.assertNotIn("animation.render_debug", result["tick_zero_without_visuals"])


if __name__ == "__main__":
    unittest.main()
