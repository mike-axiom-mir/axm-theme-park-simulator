from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping


@dataclass(frozen=True)
class ChangeRequest:
    change_request_id: str
    reason: str
    affected_roots: tuple[str, ...]
    before_hashes: Mapping[str, str]
    after_hashes: Mapping[str, str]
    evidence: tuple[str, ...]
    rollback_plan: str
    approval_status: str = "proposed"
    approved_by: tuple[str, ...] = ()


@dataclass(frozen=True)
class MergeDecision:
    accepted: bool
    changed_roots: tuple[str, ...]
    reasons: tuple[str, ...]


class MergeGate:
    @staticmethod
    def evaluate(
        base_hashes: Mapping[str, str],
        candidate_hashes: Mapping[str, str],
        change_request: ChangeRequest | None = None,
    ) -> MergeDecision:
        all_roots = set(base_hashes) | set(candidate_hashes)
        changed = tuple(sorted(
            root for root in all_roots
            if base_hashes.get(root) != candidate_hashes.get(root)
        ))
        if not changed:
            return MergeDecision(True, (), ("No canonical-root change detected.",))

        reasons = []
        if change_request is None:
            return MergeDecision(
                False,
                changed,
                ("Canonical roots changed without an explicit change request.",),
            )
        if change_request.approval_status != "approved":
            reasons.append("Change request is not approved.")
        if not change_request.reason.strip():
            reasons.append("Change request has no reason.")
        if not change_request.evidence:
            reasons.append("Change request has no evidence.")
        if not change_request.rollback_plan.strip():
            reasons.append("Change request has no rollback plan.")
        if not set(changed).issubset(set(change_request.affected_roots)):
            reasons.append("Changed roots are not fully declared.")
        for name in changed:
            if change_request.before_hashes.get(name) != base_hashes.get(name):
                reasons.append(f"Before hash mismatch for {name}.")
            if change_request.after_hashes.get(name) != candidate_hashes.get(name):
                reasons.append(f"After hash mismatch for {name}.")
        if reasons:
            return MergeDecision(False, changed, tuple(reasons))
        return MergeDecision(
            True,
            changed,
            (f"Approved canonical change: {change_request.change_request_id}",),
        )
