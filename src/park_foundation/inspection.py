from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping


_ALLOWED_MODES = {"adventure", "camera", "ride", "staff", "ai_observer"}


@dataclass(frozen=True)
class InspectionObservation:
    observation_id: str
    tick: int
    observer_id: str
    subject_ids: tuple[str, ...]
    state_hash: str
    findings: Mapping[str, object]
    evidence_refs: tuple[str, ...]
    mode: str = "adventure"

    def __post_init__(self) -> None:
        if self.tick < 0:
            raise ValueError("tick cannot be negative.")
        if self.mode not in _ALLOWED_MODES:
            raise ValueError(f"Unsupported observation mode: {self.mode}")
        if len(self.state_hash) != 64:
            raise ValueError("state_hash must be a SHA-256 hex digest.")


def verify_observation_state(observation: InspectionObservation, current_state_hash: str) -> bool:
    return observation.state_hash == current_state_hash
