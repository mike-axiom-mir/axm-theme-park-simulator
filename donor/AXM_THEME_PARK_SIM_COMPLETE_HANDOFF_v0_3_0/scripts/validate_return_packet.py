from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from park_foundation import (
    BranchReturnPacket, ReturnArtifact, ReturnPacketVerifier,
    CANONICAL_ROOT_HASH, FOUNDATION_CONTRACT_VERSION,
)


def load_packet(path: Path) -> BranchReturnPacket:
    data = json.loads(path.read_text(encoding="utf-8"))
    data["artifacts"] = tuple(ReturnArtifact(**item) for item in data["artifacts"])
    for key in (
        "implemented_capabilities", "reference_capabilities", "placeholder_capabilities",
        "unresolved_gaps", "change_request_ids",
    ):
        data[key] = tuple(data[key])
    return BranchReturnPacket(**data)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate an AXM branch return packet.")
    parser.add_argument("packet", type=Path)
    parser.add_argument("--artifact-root", type=Path, default=None)
    args = parser.parse_args()
    packet = load_packet(args.packet)
    artifact_root = args.artifact_root or args.packet.parent
    issues = list(packet.validate(
        expected_root_hash=CANONICAL_ROOT_HASH,
        expected_contract_version=FOUNDATION_CONTRACT_VERSION,
    ))
    issues.extend(ReturnPacketVerifier.verify_files(packet, artifact_root))
    print(json.dumps({"valid": not issues, "issues": sorted(set(issues))}, indent=2))
    return 0 if not issues else 1


if __name__ == "__main__":
    raise SystemExit(main())
