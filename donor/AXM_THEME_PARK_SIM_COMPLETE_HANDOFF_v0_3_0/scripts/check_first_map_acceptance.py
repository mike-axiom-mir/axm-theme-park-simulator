from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from park_foundation import AcceptanceCheck, AcceptanceReport


def main() -> int:
    parser = argparse.ArgumentParser(description="Check evidence-backed first-map readiness.")
    parser.add_argument("report", type=Path)
    args = parser.parse_args()
    data = json.loads(args.report.read_text(encoding="utf-8"))
    checks = tuple(AcceptanceCheck(
        check_id=item["check_id"], category=item["category"], required=item["required"],
        status=item["status"], evidence_refs=tuple(item.get("evidence_refs", [])),
        notes=tuple(item.get("notes", [])),
    ) for item in data["checks"])
    report = AcceptanceReport(data["report_id"], data["build_id"], checks)
    output = report.summary()
    output["blocking_check_ids"] = [item.check_id for item in report.blocking_checks()]
    print(json.dumps(output, indent=2))
    return 0 if report.ready() else 1


if __name__ == "__main__":
    raise SystemExit(main())
