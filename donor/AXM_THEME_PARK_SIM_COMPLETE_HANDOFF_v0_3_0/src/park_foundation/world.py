from __future__ import annotations

from dataclasses import dataclass, replace
import random
from typing import Mapping, Sequence

from .canonical import stable_seed


MINUTES_PER_DAY = 1440


@dataclass(frozen=True)
class WorldClock:
    tick: int = 0
    tick_minutes: int = 5

    def __post_init__(self) -> None:
        if self.tick < 0:
            raise ValueError("tick must be non-negative")
        if self.tick_minutes <= 0:
            raise ValueError("tick_minutes must be positive")

    @property
    def elapsed_minutes(self) -> int:
        return self.tick * self.tick_minutes

    @property
    def day_index(self) -> int:
        return self.elapsed_minutes // MINUTES_PER_DAY

    @property
    def minute_of_day(self) -> int:
        return self.elapsed_minutes % MINUTES_PER_DAY

    @property
    def hour(self) -> int:
        return self.minute_of_day // 60

    @property
    def minute(self) -> int:
        return self.minute_of_day % 60

    def advance(self, ticks: int = 1) -> "WorldClock":
        if ticks < 0:
            raise ValueError("ticks must be non-negative")
        return replace(self, tick=self.tick + ticks)


@dataclass(frozen=True)
class SeasonCalendar:
    season_names: tuple[str, ...] = ("spring", "summer", "autumn", "winter")
    season_lengths: tuple[int, ...] = (90, 90, 90, 90)

    def __post_init__(self) -> None:
        if len(self.season_names) != len(self.season_lengths):
            raise ValueError("season names and lengths must match")
        if not self.season_names:
            raise ValueError("at least one season is required")
        if any(length <= 0 for length in self.season_lengths):
            raise ValueError("season lengths must be positive")

    @property
    def days_per_year(self) -> int:
        return sum(self.season_lengths)

    def season_for_day(self, day_index: int) -> str:
        if day_index < 0:
            raise ValueError("day_index must be non-negative")
        day = day_index % self.days_per_year
        boundary = 0
        for name, length in zip(self.season_names, self.season_lengths):
            boundary += length
            if day < boundary:
                return name
        return self.season_names[-1]


@dataclass(frozen=True)
class OpeningWindow:
    start_minute: int
    end_minute: int

    def __post_init__(self) -> None:
        if not 0 <= self.start_minute < MINUTES_PER_DAY:
            raise ValueError("start_minute must be between 0 and 1439")
        if not 0 <= self.end_minute < MINUTES_PER_DAY:
            raise ValueError("end_minute must be between 0 and 1439")

    def contains(self, minute_of_day: int) -> bool:
        minute = minute_of_day % MINUTES_PER_DAY
        if self.start_minute == self.end_minute:
            return False
        if self.start_minute < self.end_minute:
            return self.start_minute <= minute < self.end_minute
        return minute >= self.start_minute or minute < self.end_minute


@dataclass(frozen=True)
class OpeningSchedule:
    schedule_id: str
    weekday_windows: Mapping[int, tuple[OpeningWindow, ...]]

    def is_open(self, day_index: int, minute_of_day: int) -> bool:
        weekday = day_index % 7
        return any(
            window.contains(minute_of_day)
            for window in self.weekday_windows.get(weekday, ())
        )


@dataclass(frozen=True)
class WeatherProfile:
    climate_id: str
    conditions: Mapping[str, float]
    base_temperature_c: float = 16.0
    temperature_variation_c: float = 10.0

    def __post_init__(self) -> None:
        supported = {"clear", "overcast", "rain", "storm", "heat", "cold"}
        if set(self.conditions) - supported:
            raise ValueError("unsupported weather condition")
        if not self.conditions or sum(self.conditions.values()) <= 0:
            raise ValueError("weather weights must sum to more than zero")
        if any(weight < 0 for weight in self.conditions.values()):
            raise ValueError("weather weights cannot be negative")
        if self.temperature_variation_c < 0:
            raise ValueError("temperature variation cannot be negative")


@dataclass(frozen=True)
class WeatherState:
    weather_id: str
    day_index: int
    period_index: int
    condition: str
    temperature_c: float
    precipitation_mm: float
    wind_kph: float
    visibility: float


class WeatherGenerator:
    def __init__(self, world_seed: int) -> None:
        self.world_seed = int(world_seed)

    def generate(
        self,
        day_index: int,
        period_index: int,
        profile: WeatherProfile,
    ) -> WeatherState:
        if day_index < 0 or period_index < 0:
            raise ValueError("day_index and period_index must be non-negative")
        seed = stable_seed(
            "weather",
            self.world_seed,
            profile.climate_id,
            day_index,
            period_index,
        )
        rng = random.Random(seed)
        total = sum(profile.conditions.values())
        draw = rng.random() * total
        running = 0.0
        condition = "clear"
        for name in sorted(profile.conditions):
            running += profile.conditions[name]
            if draw <= running:
                condition = name
                break

        variation = profile.temperature_variation_c
        temperature = profile.base_temperature_c + rng.uniform(-variation, variation)
        if condition == "heat":
            temperature += variation * 0.75
        elif condition == "cold":
            temperature -= variation * 0.75

        precipitation = {
            "clear": 0.0,
            "overcast": rng.uniform(0.0, 0.3),
            "rain": rng.uniform(0.5, 8.0),
            "storm": rng.uniform(5.0, 20.0),
            "heat": 0.0,
            "cold": rng.uniform(0.0, 1.0),
        }[condition]
        wind = {
            "clear": rng.uniform(0.0, 15.0),
            "overcast": rng.uniform(5.0, 20.0),
            "rain": rng.uniform(8.0, 30.0),
            "storm": rng.uniform(25.0, 70.0),
            "heat": rng.uniform(0.0, 18.0),
            "cold": rng.uniform(5.0, 25.0),
        }[condition]
        visibility = {
            "clear": 1.0,
            "overcast": 0.85,
            "rain": 0.65,
            "storm": 0.35,
            "heat": 0.90,
            "cold": 0.80,
        }[condition]
        return WeatherState(
            weather_id=f"{profile.climate_id}:{day_index}:{period_index}",
            day_index=day_index,
            period_index=period_index,
            condition=condition,
            temperature_c=round(temperature, 2),
            precipitation_mm=round(precipitation, 2),
            wind_kph=round(wind, 2),
            visibility=visibility,
        )
