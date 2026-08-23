import hashlib
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ContractsAndAssetsTests(unittest.TestCase):
    def test_all_json_files_parse(self):
        for path in ROOT.rglob("*.json"):
            with self.subTest(path=path):
                json.loads(path.read_text(encoding="utf-8"))

    def test_contract_version_is_020(self):
        contract = json.loads((ROOT / "contracts" / "FOUNDATION_CONTRACT.json").read_text())
        self.assertEqual(contract["contract_version"], "0.2.0")

    def test_four_posters_present(self):
        posters = list((ROOT / "assets" / "posters").glob("*.png"))
        self.assertEqual(len(posters), 4)

    def test_original_backup_and_legacy_zip_present(self):
        self.assertTrue((ROOT / "backups" / "AXM_THEME_PARK_SIM_COMPLETE_DESIGN_BACKUP_2026-08-04.txt").exists())
        self.assertTrue((ROOT / "legacy" / "AXM_THEME_PARK_DETERMINISTIC_FOUNDATION_v0_1_0.zip").exists())


if __name__ == "__main__":
    unittest.main()
