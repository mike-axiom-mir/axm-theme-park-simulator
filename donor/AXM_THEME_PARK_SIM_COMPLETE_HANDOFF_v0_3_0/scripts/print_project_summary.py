from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]

contract = json.loads(
    (ROOT / "contracts" / "FOUNDATION_CONTRACT.json").read_text(encoding="utf-8")
)
target = json.loads(
    (ROOT / "data" / "FIRST_MAP_TARGET.json").read_text(encoding="utf-8")
)

print("AXM Theme Park Simulator")
print("Foundation version:", contract["contract_version"])
print("Root hash:", contract["canonical_root_hash"])
print("Forbidden shortcuts:", len(contract["forbidden_shortcuts"]))
print("Primary branch groups:", len(contract["branch_ownership"]))
print("First-map target:", target["target_window"], "-", target["status"])
