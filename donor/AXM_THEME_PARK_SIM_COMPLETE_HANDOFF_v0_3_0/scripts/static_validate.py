from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    issues = []
    json_files = sorted(ROOT.rglob("*.json"))
    for path in json_files:
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except Exception as error:
            issues.append(f"{path.relative_to(ROOT)}: {error}")
    print(f"JSON files parsed: {len(json_files)}")
    for issue in issues:
        print(f"- {issue}")
    print(f"FINAL: {'PASS' if not issues else 'FAIL'}")
    return 0 if not issues else 1


if __name__ == "__main__":
    raise SystemExit(main())
