from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Tuple

from .canonical import sha256_file


@dataclass(frozen=True)
class ReturnArtifact:
    path: str
    sha256: str
    bytes: int
    role: str


@dataclass(frozen=True)
class BranchReturnPacket:
    packet_id: str
    branch_id: str
    module_id: str
    module_version: str
    foundation_contract_version: str
    canonical_root_hash: str
    status: str
    implemented_capabilities: Tuple[str, ...]
    reference_capabilities: Tuple[str, ...]
    placeholder_capabilities: Tuple[str, ...]
    tests_passed: int
    tests_failed: int
    artifacts: Tuple[ReturnArtifact, ...]
    unresolved_gaps: Tuple[str, ...] = ()
    change_request_ids: Tuple[str, ...] = ()

    def validate(self, *, expected_root_hash: str, expected_contract_version: str) -> Tuple[str, ...]:
        issues = []
        if self.status not in {"scaffold", "reference", "implemented", "experimental"}:
            issues.append(f"unsupported status: {self.status}")
        if self.canonical_root_hash != expected_root_hash:
            issues.append("canonical root hash mismatch")
        if self.foundation_contract_version != expected_contract_version:
            issues.append("foundation contract version mismatch")
        groups = {
            "implemented": set(self.implemented_capabilities),
            "reference": set(self.reference_capabilities),
            "placeholder": set(self.placeholder_capabilities),
        }
        names = list(groups)
        for index, left in enumerate(names):
            for right in names[index + 1:]:
                overlap = groups[left].intersection(groups[right])
                if overlap:
                    issues.append(
                        f"capabilities cannot be both {left} and {right}: {sorted(overlap)}"
                    )
        if self.tests_failed:
            issues.append(f"branch reports {self.tests_failed} failing tests")
        if self.status == "implemented" and self.tests_passed <= 0:
            issues.append("implemented branch must report at least one passing test")
        if not self.artifacts:
            issues.append("return packet contains no artifacts")
        return tuple(sorted(issues))


class ReturnPacketVerifier:
    @staticmethod
    def verify_files(packet: BranchReturnPacket, root: str | Path) -> Tuple[str, ...]:
        base = Path(root).resolve()
        issues = []
        for artifact in packet.artifacts:
            path = (base / artifact.path).resolve()
            if base not in path.parents and path != base:
                issues.append(f"artifact escapes packet root: {artifact.path}")
                continue
            if not path.is_file():
                issues.append(f"artifact missing: {artifact.path}")
                continue
            if path.stat().st_size != artifact.bytes:
                issues.append(f"artifact size mismatch: {artifact.path}")
            if sha256_file(path) != artifact.sha256:
                issues.append(f"artifact hash mismatch: {artifact.path}")
        return tuple(sorted(issues))
