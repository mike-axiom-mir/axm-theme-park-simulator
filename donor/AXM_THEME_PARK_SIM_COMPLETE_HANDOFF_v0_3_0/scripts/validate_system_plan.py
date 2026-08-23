from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from park_foundation import DeterministicScheduler, SystemSpec


def validate() -> list[str]:
    manifests = [json.loads(path.read_text(encoding="utf-8")) for path in sorted((ROOT / "manifests").glob("*.json"))]
    namespace_owners = {
        namespace: manifest["module_id"]
        for manifest in manifests
        for namespace in manifest["state_namespaces"]
    }
    authoritative = {name for name in namespace_owners if not name.startswith("visual.")}
    declared_systems = {
        system: manifest["module_id"]
        for manifest in manifests
        for system in manifest["system_ids"]
    }
    scheduler = DeterministicScheduler()
    issues = []
    data = json.loads((ROOT / "data/runtime/REFERENCE_SYSTEM_PLAN.json").read_text(encoding="utf-8"))
    for item in data["systems"]:
        try:
            spec = SystemSpec(
                system_id=item["system_id"], module_id=item["module_id"], phase=item["phase"],
                cadence_ticks=item["cadence_ticks"], offset_ticks=item.get("offset_ticks", 0),
                priority=item["priority"], reads=tuple(item["reads"]), writes=tuple(item["writes"]),
                authoritative=item["authoritative"], skippable=item["skippable"],
            )
            scheduler.register(spec)
            owner = declared_systems.get(spec.system_id)
            if owner != spec.module_id:
                issues.append(f"system {spec.system_id} not declared by {spec.module_id}")
        except Exception as error:
            issues.append(str(error))
    issues.extend(scheduler.validate_namespace_ownership(namespace_owners, authoritative))
    return sorted(set(issues))


def main() -> int:
    issues = validate()
    print(json.dumps({"valid": not issues, "issues": issues}, indent=2))
    return 0 if not issues else 1


if __name__ == "__main__":
    raise SystemExit(main())
