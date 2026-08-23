from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple


@dataclass(frozen=True)
class ChangeRequest:
    request_id: str
    proposer_module: str
    base_contract_version: str
    target_contract_version: str
    requested_changes: Tuple[str, ...]
    rationale: str
    root_impact: Tuple[str, ...] = ()
    evidence_refs: Tuple[str, ...] = ()


@dataclass(frozen=True)
class MergeDecision:
    request_id: str
    eligible_for_human_review: bool
    automatically_merged: bool
    reasons: Tuple[str, ...]


class MergeGate:
    def __init__(self, current_contract_version: str, protected_roots: Tuple[str, ...]) -> None:
        self.current_contract_version = current_contract_version
        self.protected_roots = set(protected_roots)

    def review(self, request: ChangeRequest) -> MergeDecision:
        reasons: list[str] = []
        if request.base_contract_version != self.current_contract_version:
            reasons.append("base contract version does not match current foundation")
        if not request.requested_changes:
            reasons.append("requested_changes is empty")
        if not request.rationale.strip():
            reasons.append("rationale is empty")
        impacted_protected = self.protected_roots.intersection(request.root_impact)
        if impacted_protected and not request.evidence_refs:
            reasons.append("protected-root impact requires evidence references")
        eligible = not reasons
        return MergeDecision(
            request_id=request.request_id,
            eligible_for_human_review=eligible,
            automatically_merged=False,
            reasons=tuple(reasons) if reasons else ("explicit human merge decision still required",),
        )
