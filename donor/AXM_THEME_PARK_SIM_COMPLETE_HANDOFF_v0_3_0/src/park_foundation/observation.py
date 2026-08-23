from __future__ import annotations

from dataclasses import dataclass


SUPPORTED_MODES = {
    "management",
    "adventure",
    "ride_camera",
    "staff_follow",
    "guest_follow",
    "debug",
}


@dataclass(frozen=True)
class ObservationPacket:
    observation_id: str
    observer_id: str
    mode: str
    subject_id: str
    tick: int
    state_version: int
    facts: tuple[str, ...] = ()
    evidence_refs: tuple[str, ...] = ()
    blind_spots: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if self.mode not in SUPPORTED_MODES:
            raise ValueError(f"unsupported observation mode: {self.mode}")
        if self.tick < 0 or self.state_version < 0:
            raise ValueError("tick and state_version must be non-negative")

    def assert_authoritative(
        self,
        *,
        authoritative_tick: int,
        authoritative_state_version: int,
    ) -> None:
        if self.tick != authoritative_tick:
            raise ValueError("observation tick does not match authoritative tick")
        if self.state_version != authoritative_state_version:
            raise ValueError("observation state does not match authoritative state")
