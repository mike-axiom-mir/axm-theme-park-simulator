from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from park_foundation import ModuleManifest, RuntimeAssemblyPlanner


def main() -> int:
    manifests = []
    for path in sorted((ROOT / "manifests").glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        determinism = data.pop("determinism")
        data.pop("notes", None)
        manifests.append(ModuleManifest(
            seeded_randomness_only=determinism["seeded_randomness_only"],
            replay_safe=determinism["replay_safe"], **data,
        ))
    report = RuntimeAssemblyPlanner(manifests).validate()
    print(json.dumps({
        "valid": report.valid,
        "blocking_issues": report.blocking_issues,
        "warnings": report.warnings,
    }, indent=2))
    return 0 if report.valid else 1


if __name__ == "__main__":
    raise SystemExit(main())
