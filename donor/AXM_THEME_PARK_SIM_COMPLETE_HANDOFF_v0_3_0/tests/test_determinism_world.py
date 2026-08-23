import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import unittest

from park_foundation import (
    canonical_json, stable_seed, WorldClock, SeasonCalendar,
    OpeningWindow, OpeningSchedule, WeatherProfile, WeatherGenerator,
    ParkEvent, EventRecord, DeterministicEventLog,
)


class DeterminismWorldTests(unittest.TestCase):
    def test_canonical_json_sorts_mapping(self):
        self.assertEqual(canonical_json({"b": 2, "a": 1}), '{"a":1,"b":2}')

    def test_stable_seed_repeats(self):
        self.assertEqual(stable_seed("park", 1, "rain"), stable_seed("park", 1, "rain"))
        self.assertNotEqual(stable_seed("park", 1, "rain"), stable_seed("park", 2, "rain"))

    def test_world_clock_advances_deterministically(self):
        clock = WorldClock(tick=0, tick_minutes=5).advance(300)
        self.assertEqual(clock.elapsed_minutes, 1500)
        self.assertEqual(clock.day_index, 1)
        self.assertEqual(clock.minute_of_day, 60)

    def test_season_calendar_wraps(self):
        calendar = SeasonCalendar(("spring", "summer"), (10, 10))
        self.assertEqual(calendar.season_for_day(0), "spring")
        self.assertEqual(calendar.season_for_day(10), "summer")
        self.assertEqual(calendar.season_for_day(20), "spring")

    def test_opening_schedule(self):
        schedule = OpeningSchedule("park", {
            0: (OpeningWindow(600, 1200),),
            1: (OpeningWindow(1200, 120),),
        })
        self.assertTrue(schedule.is_open(0, 700))
        self.assertFalse(schedule.is_open(0, 500))
        self.assertTrue(schedule.is_open(1, 1300))
        self.assertTrue(schedule.is_open(1, 60))
        self.assertFalse(schedule.is_open(1, 600))

    def test_weather_same_seed_same_state(self):
        profile = WeatherProfile(
            "temperate",
            {"clear": 0.5, "overcast": 0.3, "rain": 0.2},
            16.0, 8.0,
        )
        a = WeatherGenerator(42).generate(10, 2, profile)
        b = WeatherGenerator(42).generate(10, 2, profile)
        self.assertEqual(a, b)

    def _event(self, event_id="e1", tick=10, seed=42):
        return ParkEvent(
            event_id=event_id,
            event_type="ride.opened",
            tick=tick,
            actor_id="player",
            target_ids=["ride_1"],
            payload={"open": True},
            seed=seed,
            module_id="rides",
            module_version="0.1.0",
            evidence_refs=[],
        )

    def test_event_replay_and_hash_chain_are_stable(self):
        log_a = DeterministicEventLog()
        log_b = DeterministicEventLog()
        log_a.append(self._event())
        log_b.append(self._event())
        self.assertEqual(log_a.replay_packet(), log_b.replay_packet())
        self.assertEqual(log_a.event_log_hash(), log_b.event_log_hash())
        self.assertTrue(log_a.validate_chain())

    def test_event_rng_is_stable(self):
        event = self._event()
        log = DeterministicEventLog()
        self.assertEqual(log.seeded_rng(event).random(), log.seeded_rng(event).random())

    def test_event_log_rejects_duplicate_id(self):
        log = DeterministicEventLog()
        log.append(self._event())
        with self.assertRaises(ValueError):
            log.append(self._event())

    def test_event_log_rejects_backwards_tick(self):
        log = DeterministicEventLog()
        log.append(self._event("later", 20))
        with self.assertRaises(ValueError):
            log.append(self._event("earlier", 10))

    def test_tampered_chain_is_detected(self):
        log = DeterministicEventLog()
        record = log.append(self._event())
        log._records[0] = EventRecord(record.event, record.previous_hash, "f" * 64)
        self.assertFalse(log.validate_chain())


if __name__ == "__main__":
    unittest.main()
