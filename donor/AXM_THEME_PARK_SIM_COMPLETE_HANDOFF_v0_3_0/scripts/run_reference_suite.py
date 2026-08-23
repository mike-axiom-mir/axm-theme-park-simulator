from __future__ import annotations

from hashlib import sha256
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]

DEMOS = (
    "examples/run_reference_demo.py",
    "examples/run_runtime_integration_demo.py",
    "examples/run_living_park_reference.py",
    "examples/run_first_map_reference_slice.py",
)


def run(path: str) -> dict:
    command = [sys.executable, str(ROOT / path)]
    first = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    second = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    same = first.returncode == second.returncode and first.stdout == second.stdout
    item = {
        "path": path,
        "exit_code": first.returncode,
        "deterministic_stdout": same,
        "stdout_sha256": sha256(first.stdout.encode("utf-8")).hexdigest(),
    }
    if first.returncode:
        item["stderr"] = first.stderr.strip()
    elif first.stdout.lstrip().startswith("{"):
        data = json.loads(first.stdout)
        for key in (
            "demo_digest", "reference_digest", "assembly_valid",
            "first_map_ready", "same_seed_same_digest",
        ):
            if key in data:
                item[key] = data[key]
        if "acceptance" in data:
            item["first_map_ready"] = data["acceptance"]["ready"]
    return item


def main() -> int:
    results = [run(path) for path in DEMOS]
    valid = all(item["exit_code"] == 0 and item["deterministic_stdout"] for item in results)
    print(json.dumps({"valid": valid, "demos": results}, indent=2, sort_keys=True))
    return 0 if valid else 1


if __name__ == "__main__":
    raise SystemExit(main())
