from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping

from .util import bounded


@dataclass(frozen=True)
class ParkIdentityIntent:
    identity_id: str
    primary_promises: tuple[str, ...]
    target_audiences: tuple[str, ...] = ()
    protected_elements: tuple[str, ...] = ()
    acceptable_tradeoffs: tuple[str, ...] = ()
    forbidden_compromises: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if not self.primary_promises:
            raise ValueError("At least one primary promise is required.")


@dataclass(frozen=True)
class IdentityAlignmentPacket:
    identity_id: str
    alignment_by_promise: Mapping[str, float]
    gaps: tuple[str, ...]
    evidence_refs: tuple[str, ...]


def evaluate_identity_alignment(
    intent: ParkIdentityIntent,
    delivered_by_promise: Mapping[str, float],
    evidence_refs: tuple[str, ...] = (),
) -> IdentityAlignmentPacket:
    alignment = {
        promise: bounded(delivered_by_promise.get(promise, 0.0))
        for promise in intent.primary_promises
    }
    gaps = tuple(promise for promise, value in alignment.items() if value < 0.6)
    return IdentityAlignmentPacket(
        identity_id=intent.identity_id,
        alignment_by_promise=alignment,
        gaps=gaps,
        evidence_refs=evidence_refs,
    )
