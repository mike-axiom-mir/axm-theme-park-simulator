from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple


@dataclass(frozen=True)
class ClockConfig:
    ticks_per_sim_minute: int = 1
    minutes_per_day: int = 1440
    days_per_season: int = 30
    seasons: Tuple[str, ...] = ("spring", "summer", "autumn", "winter")

    def __post_init__(self) -> None:
        if self.ticks_per_sim_minute < 1 or self.minutes_per_day < 1 or self.days_per_season < 1:
            raise ValueError("Clock units must be positive.")
        if not self.seasons:
            raise ValueError("At least one season is required.")


@dataclass(frozen=True)
class TimePosition:
    tick: int
    sim_minute: int
    day_index: int
    minute_of_day: int
    season_index: int
    season: str
    day_in_season: int
    year_index: int


class DeterministicClock:
    def __init__(self, config: ClockConfig | None = None, tick: int = 0) -> None:
        self.config = config or ClockConfig()
        if tick < 0:
            raise ValueError("tick cannot be negative.")
        self._tick = tick

    @property
    def tick(self) -> int:
        return self._tick

    def advance(self, ticks: int = 1) -> TimePosition:
        if ticks < 0:
            raise ValueError("Clock cannot advance by a negative amount.")
        self._tick += ticks
        return self.position()

    def position(self) -> TimePosition:
        cfg = self.config
        sim_minute = self._tick // cfg.ticks_per_sim_minute
        day_index, minute_of_day = divmod(sim_minute, cfg.minutes_per_day)
        season_index_absolute, day_in_season = divmod(day_index, cfg.days_per_season)
        season_index = season_index_absolute % len(cfg.seasons)
        year_index = season_index_absolute // len(cfg.seasons)
        return TimePosition(
            tick=self._tick,
            sim_minute=sim_minute,
            day_index=day_index,
            minute_of_day=minute_of_day,
            season_index=season_index,
            season=cfg.seasons[season_index],
            day_in_season=day_in_season,
            year_index=year_index,
        )
