from __future__ import annotations

from dataclasses import asdict, dataclass
import random
from typing import Any, Dict, Iterable, List, Mapping

from .canonical import canonical_json, sha256_text


GENESIS_HASH = "0" * 64


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
    command_id: str | None = None
    correlation_id: str | None = None
    sequence: int = 0

    def __post_init__(self) -> None:
        if not self.event_id:
            raise ValueError("event_id is required")
        if not self.event_type:
            raise ValueError("event_type is required")
        if self.tick < 0:
            raise ValueError("tick must be non-negative")
        if self.seed < 0:
            raise ValueError("seed must be non-negative")
        if self.sequence < 0:
            raise ValueError("sequence must be non-negative")
        canonical_json(self.payload)


@dataclass(frozen=True)
class EventRecord:
    event: ParkEvent
    previous_hash: str
    record_hash: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event": asdict(self.event),
            "previous_hash": self.previous_hash,
            "record_hash": self.record_hash,
        }


class DeterministicEventLog:
    """Append-only hash-chained event log with atomic batch insertion."""

    def __init__(self) -> None:
        self._records: List[EventRecord] = []

    @staticmethod
    def _record_hash(event: ParkEvent, previous_hash: str) -> str:
        return sha256_text(canonical_json({
            "event": asdict(event),
            "previous_hash": previous_hash,
        }))

    def _prepare_atomic(self, events: tuple[ParkEvent, ...]) -> list[EventRecord]:
        if not events:
            return []
        existing_ids = {record.event.event_id for record in self._records}
        batch_ids = [event.event_id for event in events]
        if len(batch_ids) != len(set(batch_ids)):
            raise ValueError("duplicate event_id inside atomic batch")
        duplicate_existing = existing_ids.intersection(batch_ids)
        if duplicate_existing:
            raise ValueError(f"Duplicate event_id: {sorted(duplicate_existing)[0]}")

        prior_tick = self._records[-1].event.tick if self._records else -1
        previous = self._records[-1].record_hash if self._records else GENESIS_HASH
        prepared: list[EventRecord] = []
        for event in events:
            if event.tick < prior_tick:
                raise ValueError("Events must be appended in non-decreasing tick order.")
            record = EventRecord(
                event=event,
                previous_hash=previous,
                record_hash=self._record_hash(event, previous),
            )
            prepared.append(record)
            previous = record.record_hash
            prior_tick = event.tick
        return prepared

    def append(self, event: ParkEvent) -> EventRecord:
        records = self._prepare_atomic((event,))
        self._records.extend(records)
        return records[0]

    def extend_atomic(self, events: Iterable[ParkEvent]) -> tuple[EventRecord, ...]:
        prepared = self._prepare_atomic(tuple(events))
        self._records.extend(prepared)
        return tuple(prepared)

    # Clear public name used by the transaction kernel and tests.
    def append_batch(self, events: Iterable[ParkEvent]) -> tuple[EventRecord, ...]:
        return self.extend_atomic(events)

    def seeded_rng(self, event: ParkEvent) -> random.Random:
        return random.Random(event.seed)

    def has_command(self, command_id: str) -> bool:
        return any(record.event.command_id == command_id for record in self._records)

    def events_for_command(self, command_id: str) -> tuple[ParkEvent, ...]:
        return tuple(
            record.event for record in self._records
            if record.event.command_id == command_id
        )

    def validate_chain(self) -> bool:
        expected_previous = GENESIS_HASH
        seen_ids = set()
        prior_tick = -1
        for record in self._records:
            event = record.event
            if event.event_id in seen_ids or event.tick < prior_tick:
                return False
            if record.previous_hash != expected_previous:
                return False
            if record.record_hash != self._record_hash(event, record.previous_hash):
                return False
            expected_previous = record.record_hash
            seen_ids.add(event.event_id)
            prior_tick = event.tick
        return True

    def replay_packet(self) -> str:
        return canonical_json([record.to_dict() for record in self._records])

    def event_log_hash(self) -> str:
        return sha256_text(self.replay_packet())

    def clone(self) -> "DeterministicEventLog":
        return self.from_records(self._records)

    @classmethod
    def from_records(
        cls,
        records: Iterable[EventRecord | Mapping[str, Any]],
        *,
        verify: bool = True,
    ) -> "DeterministicEventLog":
        log = cls()
        converted: list[EventRecord] = []
        for item in records:
            if isinstance(item, EventRecord):
                event = ParkEvent(**asdict(item.event))
                record = EventRecord(event, item.previous_hash, item.record_hash)
            else:
                raw = dict(item)
                event_raw = raw["event"]
                event = event_raw if isinstance(event_raw, ParkEvent) else ParkEvent(**event_raw)
                record = EventRecord(
                    event=event,
                    previous_hash=raw["previous_hash"],
                    record_hash=raw["record_hash"],
                )
            converted.append(record)
        log._records = converted
        if verify and not log.validate_chain():
            raise ValueError("invalid event hash chain")
        return log

    @property
    def events(self) -> List[ParkEvent]:
        return [record.event for record in self._records]

    @property
    def records(self) -> List[EventRecord]:
        return list(self._records)
