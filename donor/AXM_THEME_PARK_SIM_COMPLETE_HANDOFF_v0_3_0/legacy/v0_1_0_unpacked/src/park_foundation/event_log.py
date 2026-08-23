from dataclasses import dataclass, asdict
from typing import Any, Dict, List
import json
import random

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

class DeterministicEventLog:
    def __init__(self) -> None:
        self._events: List[ParkEvent] = []

    def append(self, event: ParkEvent) -> None:
        if self._events and event.tick < self._events[-1].tick:
            raise ValueError("Events must be appended in non-decreasing tick order.")
        if any(existing.event_id == event.event_id for existing in self._events):
            raise ValueError(f"Duplicate event_id: {event.event_id}")
        self._events.append(event)

    def seeded_rng(self, event: ParkEvent) -> random.Random:
        return random.Random(event.seed)

    def replay_packet(self) -> str:
        return json.dumps(
            [asdict(event) for event in self._events],
            sort_keys=True,
            separators=(",", ":")
        )

    @property
    def events(self) -> List[ParkEvent]:
        return list(self._events)
