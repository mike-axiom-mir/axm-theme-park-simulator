from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]


class CliValidatorTests(unittest.TestCase):
    def run_script(self, name, *args):
        return subprocess.run(
            [sys.executable, str(ROOT / "scripts" / name), *map(str, args)],
            cwd=ROOT, capture_output=True, text=True,
        )

    def test_runtime_assembly_cli_passes(self):
        result = self.run_script("validate_runtime_assembly.py")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_system_plan_cli_passes(self):
        result = self.run_script("validate_system_plan.py")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_valid_return_packet_cli_passes(self):
        result = self.run_script(
            "validate_return_packet.py", ROOT / "examples/VALID_REFERENCE_RETURN_PACKET.json"
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_first_map_template_blocks_readiness(self):
        result = self.run_script(
            "check_first_map_acceptance.py", ROOT / "examples/FIRST_MAP_ACCEPTANCE_TEMPLATE.json"
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('"ready": false', result.stdout)

    def test_static_json_validation_passes(self):
        result = self.run_script("static_validate.py")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
