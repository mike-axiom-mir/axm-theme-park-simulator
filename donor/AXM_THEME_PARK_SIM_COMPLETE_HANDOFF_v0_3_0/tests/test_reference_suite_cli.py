from pathlib import Path
import json
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ReferenceSuiteCliTests(unittest.TestCase):
    def test_all_reference_demos_repeat(self):
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts/run_reference_suite.py")],
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        data = json.loads(result.stdout)
        self.assertTrue(data["valid"])
        self.assertEqual(len(data["demos"]), 4)
        self.assertTrue(all(item["deterministic_stdout"] for item in data["demos"]))

    def test_reference_slices_do_not_claim_playable_first_map(self):
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts/run_reference_suite.py")],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        data = json.loads(result.stdout)
        by_path = {item["path"]: item for item in data["demos"]}
        self.assertFalse(by_path["examples/run_living_park_reference.py"]["first_map_ready"])
        self.assertFalse(by_path["examples/run_first_map_reference_slice.py"]["first_map_ready"])


if __name__ == "__main__":
    unittest.main()
