from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, List
import random

from .util import canonical_json, stable_hash


@dataclass(frozen=True)
class ParkEvent:
    event_id: str
    event_type: str
    tick: int
    actor_id: str
    target_ids: List[str]
    payload: Dict[str, Any]
    seed: int
    module_id: str
    module_version: str
    evidence_refs: List[str]
    sequence: int = 0
    state_before_hash: str = ""
    state_after_hash: str = ""

    def digest(self) -> str:
        return stable_hash(asdict(self))


class DeterministicEventLog:
    def __init__(self) -> None:
        self._events: List[ParkEvent] = []

    def append(self, event: ParkEvent) -> None:
        if event.tick < 0 or event.sequence < 0:
            raise ValueError("tick and sequence must be non-negative.")
        if self._events:
            previous = self._events[-1]
            if (event.tick, event.sequence) < (previous.tick, previous.sequence):
                raise ValueError("Events must be appended in tick/sequence order.")
        if any(existing.event_id == event.event_id for existing in self._events):
            raise ValueError(f"Duplicate event_id: {event.event_id}")
        self._events.append(event)

    def seeded_rng(self, event: ParkEvent) -> random.Random:
        return random.Random(event.seed)

    def replay_packet(self) -> str:
        return canonical_json([asdict(event) for event in self._events])

    def verify_state_chain(self) -> bool:
        for previous, current in zip(self._events, self._events[1:]):
            if previous.state_after_hash and current.state_before_hash:
                if previous.state_after_hash != current.state_before_hash:
                    return False
        return True

    @property
    def events(self) -> List[ParkEvent]:
        return list(self._events)
