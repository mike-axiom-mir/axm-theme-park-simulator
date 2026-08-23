from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List


@dataclass(frozen=True)
class EvidenceClaim:
    claim_id: str
    subject_id: str
    statement: str
    confidence: float
    evidence_refs: tuple[str, ...] = ()
    alternatives: tuple[str, ...] = ()
    uncertainty_notes: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError("confidence must be between 0 and 1.")
        if self.confidence == 1.0 and not self.evidence_refs:
            raise ValueError("Absolute confidence requires explicit evidence references.")
        if not self.statement.strip():
            raise ValueError("statement cannot be empty.")


class EvidenceLedger:
    def __init__(self) -> None:
        self._claims: Dict[str, EvidenceClaim] = {}
        self._conflicts: Dict[str, List[str]] = {}

    def add(self, claim: EvidenceClaim) -> None:
        if claim.claim_id in self._claims:
            raise ValueError(f"Duplicate claim_id: {claim.claim_id}")
        self._claims[claim.claim_id] = claim

    def link_conflict(self, claim_a: str, claim_b: str) -> None:
        if claim_a not in self._claims or claim_b not in self._claims:
            raise KeyError("Both claims must exist before linking a conflict.")
        self._conflicts.setdefault(claim_a, []).append(claim_b)
        self._conflicts.setdefault(claim_b, []).append(claim_a)

    def conflicts_for(self, claim_id: str) -> list[EvidenceClaim]:
        return [self._claims[cid] for cid in self._conflicts.get(claim_id, [])]

    def get(self, claim_id: str) -> EvidenceClaim:
        return self._claims[claim_id]
