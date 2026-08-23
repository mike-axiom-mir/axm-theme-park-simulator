from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from .canonical import canonical_json, sha256_value
from .event_log import ParkEvent


@dataclass(frozen=True)
class SimulationCadencePlan:
    profile_id: str
    simulation_tick_ms: int
    render_frame_ms: int
    lane_intervals_ticks: Mapping[str, int]
    snapshot_interval_ticks: int
    max_catchup_ticks: int = 8
    authoritative_clock: str = "simulation"

    def __post_init__(self) -> None:
        if not self.profile_id.strip():
            raise ValueError("profile_id is required")
        if self.simulation_tick_ms <= 0 or self.render_frame_ms <= 0:
            raise ValueError("simulation and render cadence must be positive")
        if self.snapshot_interval_ticks <= 0 or self.max_catchup_ticks <= 0:
            raise ValueError("snapshot and catch-up values must be positive")
        if not self.lane_intervals_ticks:
            raise ValueError("at least one update lane is required")
        if any(not str(lane_id).strip() for lane_id in self.lane_intervals_ticks):
            raise ValueError("lane identifiers are required")
        if any(interval <= 0 for interval in self.lane_intervals_ticks.values()):
            raise ValueError("lane intervals must be positive")
        if self.authoritative_clock != "simulation":
            raise ValueError("render time may not become authoritative simulation time")

    def lane_due(self, lane_id: str, tick: int) -> bool:
        if tick < 0:
            raise ValueError("tick must be non-negative")
        interval = self.lane_intervals_ticks[lane_id]
        return tick % interval == 0

    def snapshot_due(self, tick: int) -> bool:
        if tick < 0:
            raise ValueError("tick must be non-negative")
        return tick % self.snapshot_interval_ticks == 0

    def ticks_for_elapsed(
        self,
        elapsed_real_ms: int,
        carried_ms: int = 0,
    ) -> tuple[int, int]:
        if elapsed_real_ms < 0 or carried_ms < 0:
            raise ValueError("elapsed and carried time must be non-negative")
        total = elapsed_real_ms + carried_ms
        available = total // self.simulation_tick_ms
        ticks = min(available, self.max_catchup_ticks)
        remainder = total - ticks * self.simulation_tick_ms
        return int(ticks), int(remainder)


@dataclass(frozen=True)
class AnimationSignal:
    signal_id: str
    source_event_id: str
    entity_id: str
    clip_id: str
    start_tick: int
    duration_ticks: int
    state_version: int
    parameters: Mapping[str, Any]
    authoritative: bool = False
    rebuildable: bool = True

    def __post_init__(self) -> None:
        if not all(value.strip() for value in (
            self.signal_id, self.source_event_id, self.entity_id, self.clip_id
        )):
            raise ValueError("animation signal identifiers are required")
        if self.start_tick < 0 or self.state_version < 0:
            raise ValueError("start_tick and state_version must be non-negative")
        if self.duration_ticks <= 0:
            raise ValueError("duration_ticks must be positive")
        if self.authoritative:
            raise ValueError("animation signals may not own authoritative game state")
        if not self.rebuildable:
            raise ValueError("animation signals must be rebuildable from simulation evidence")
        # Signals must survive logs, save files, process boundaries, and local
        # toolchains. Reject opaque Python objects instead of hashing one form
        # and failing later during serialization.
        canonical_json(self.parameters)

    def progress_at(self, tick: int, frame_fraction: float = 0.0) -> float:
        if tick < 0 or not 0.0 <= frame_fraction <= 1.0:
            raise ValueError("invalid animation sample")
        elapsed = (tick - self.start_tick) + frame_fraction
        return max(0.0, min(1.0, elapsed / self.duration_ticks))


def derive_animation_signal(
    event: ParkEvent,
    *,
    entity_id: str,
    clip_id: str,
    duration_ticks: int,
    state_version: int,
    parameters: Mapping[str, Any] | None = None,
) -> AnimationSignal:
    basis = {
        "event_id": event.event_id,
        "entity_id": entity_id,
        "clip_id": clip_id,
        "duration_ticks": duration_ticks,
        "state_version": state_version,
        "parameters": parameters or {},
    }
    return AnimationSignal(
        signal_id="anim-" + sha256_value(basis)[:32],
        source_event_id=event.event_id,
        entity_id=entity_id,
        clip_id=clip_id,
        start_tick=event.tick,
        duration_ticks=duration_ticks,
        state_version=state_version,
        parameters=dict(parameters or {}),
    )


@dataclass(frozen=True)
class ResolutionDecision:
    tier: str
    exact_population: int
    bucket_size: int
    full_bucket_count: int
    remainder_count: int

    def __post_init__(self) -> None:
        if self.tier not in {"micro", "meso", "macro"}:
            raise ValueError("unsupported population resolution tier")
        if self.bucket_size <= 0:
            raise ValueError("bucket_size must be positive")
        if any(value < 0 for value in (
            self.exact_population, self.full_bucket_count, self.remainder_count
        )):
            raise ValueError("population resolution counts must be non-negative")
        if self.remainder_count >= self.bucket_size:
            raise ValueError("remainder_count must be smaller than bucket_size")
        if self.represented_population != self.exact_population:
            raise ValueError("population resolution must conserve the exact population")

    @property
    def represented_population(self) -> int:
        return self.full_bucket_count * self.bucket_size + self.remainder_count

    @property
    def visual_actor_count(self) -> int:
        """Maximum concrete visual actors needed to depict all represented people."""
        return self.full_bucket_count + (1 if self.remainder_count else 0)


@dataclass(frozen=True)
class PopulationResolutionPolicy:
    micro_max: int = 500
    meso_max: int = 5000
    meso_bucket_size: int = 10
    macro_bucket_size: int = 100

    def __post_init__(self) -> None:
        if self.micro_max < 0 or self.meso_max < self.micro_max:
            raise ValueError("resolution thresholds are invalid")
        if self.meso_bucket_size <= 0 or self.macro_bucket_size <= 0:
            raise ValueError("bucket sizes must be positive")
        if self.macro_bucket_size < self.meso_bucket_size:
            raise ValueError("macro bucket size must not be smaller than meso bucket size")

    def decide(self, population: int) -> ResolutionDecision:
        if population < 0:
            raise ValueError("population must be non-negative")
        if population <= self.micro_max:
            tier, bucket_size = "micro", 1
        elif population <= self.meso_max:
            tier, bucket_size = "meso", self.meso_bucket_size
        else:
            tier, bucket_size = "macro", self.macro_bucket_size
        full, remainder = divmod(population, bucket_size)
        return ResolutionDecision(
            tier=tier,
            exact_population=population,
            bucket_size=bucket_size,
            full_bucket_count=full,
            remainder_count=remainder,
        )
