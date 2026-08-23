import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from park_foundation import ClockConfig, DeterministicClock, EnvironmentTimeline, reference_environment_frame


class ClockEnvironmentTests(unittest.TestCase):
    def test_clock_reproduces_position(self):
        cfg = ClockConfig(ticks_per_sim_minute=2, minutes_per_day=60, days_per_season=2,
                          seasons=("a", "b"))
        a = DeterministicClock(cfg); b = DeterministicClock(cfg)
        self.assertEqual(a.advance(250), b.advance(250))

    def test_clock_season_wraps_into_year(self):
        cfg = ClockConfig(ticks_per_sim_minute=1, minutes_per_day=10,
                          days_per_season=1, seasons=("spring", "summer"))
        clock = DeterministicClock(cfg, tick=20)
        position = clock.position()
        self.assertEqual(position.year_index, 1)
        self.assertEqual(position.season, "spring")

    def test_reference_environment_is_seeded(self):
        a = reference_environment_frame(99, 100, 2, "summer")
        b = reference_environment_frame(99, 100, 2, "summer")
        self.assertEqual(a, b)

    def test_different_seed_changes_environment(self):
        a = reference_environment_frame(1, 100, 2, "summer")
        b = reference_environment_frame(2, 100, 2, "summer")
        self.assertNotEqual((a.temperature_c, a.precipitation, a.wind),
                            (b.temperature_c, b.precipitation, b.wind))

    def test_environment_timeline_orders_frames(self):
        timeline = EnvironmentTimeline()
        timeline.append(reference_environment_frame(1, 10, 0, "spring"))
        with self.assertRaises(ValueError):
            timeline.append(reference_environment_frame(1, 10, 0, "spring"))

    def test_environment_frame_at_uses_latest_prior(self):
        timeline = EnvironmentTimeline()
        first = reference_environment_frame(1, 10, 0, "spring")
        second = reference_environment_frame(1, 20, 0, "spring")
        timeline.append(first); timeline.append(second)
        self.assertEqual(timeline.frame_at(19), first)


if __name__ == "__main__":
    unittest.main()
