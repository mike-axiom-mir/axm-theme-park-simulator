from __future__ import annotations

from dataclasses import asdict, dataclass
import random
from typing import List

from .util import stable_seed, canonical_json


@dataclass(frozen=True)
class EnvironmentFrame:
    tick: int
    day_index: int
    season: str
    weather_type: str
    temperature_c: float
    precipitation: float
    wind: float
    daylight: float
    seed: int
    evidence_refs: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if self.tick < 0 or self.day_index < 0:
            raise ValueError("tick and day_index must be non-negative.")
        for name in ("precipitation", "wind", "daylight"):
            value = getattr(self, name)
            if not 0.0 <= value <= 1.0:
                raise ValueError(f"{name} must be between 0 and 1.")


_SEASON_REFERENCE = {
    "spring": (12.0, 0.60),
    "summer": (21.0, 0.82),
    "autumn": (13.0, 0.52),
    "winter": (5.0, 0.32),
}


def reference_environment_frame(base_seed: int, tick: int, day_index: int, season: str) -> EnvironmentFrame:
    seed = stable_seed(base_seed, tick, day_index, season)
    rng = random.Random(seed)
    base_temp, daylight = _SEASON_REFERENCE.get(season, (14.0, 0.55))
    precipitation = round(rng.random(), 6)
    wind = round(rng.random(), 6)
    temperature = round(base_temp + rng.uniform(-5.0, 5.0), 2)
    weather_type = "rain" if precipitation > 0.68 else "cloud" if precipitation > 0.40 else "clear"
    return EnvironmentFrame(
        tick=tick,
        day_index=day_index,
        season=season,
        weather_type=weather_type,
        temperature_c=temperature,
        precipitation=precipitation,
        wind=wind,
        daylight=daylight,
        seed=seed,
        evidence_refs=("reference_environment_generator_v0.2.0",),
    )


class EnvironmentTimeline:
    def __init__(self) -> None:
        self._frames: List[EnvironmentFrame] = []

    def append(self, frame: EnvironmentFrame) -> None:
        if self._frames and frame.tick <= self._frames[-1].tick:
            raise ValueError("Environment frames must have strictly increasing ticks.")
        self._frames.append(frame)

    def frame_at(self, tick: int) -> EnvironmentFrame:
        candidates = [frame for frame in self._frames if frame.tick <= tick]
        if not candidates:
            raise KeyError(f"No environment frame exists at or before tick {tick}.")
        return candidates[-1]

    def replay_packet(self) -> str:
        return canonical_json([asdict(frame) for frame in self._frames])

    @property
    def frames(self) -> list[EnvironmentFrame]:
        return list(self._frames)
