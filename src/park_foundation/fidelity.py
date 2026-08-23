from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class VisualFidelityProfile:
    profile_id: str
    visible_guest_limit: int
    animation_step_hz: int
    shadow_detail: int
    texture_scale: float
    lod_level: int

    def __post_init__(self) -> None:
        if self.visible_guest_limit < 0 or self.animation_step_hz < 1:
            raise ValueError("Invalid visual limits.")
        if self.texture_scale <= 0:
            raise ValueError("texture_scale must be positive.")


@dataclass(frozen=True)
class PresentationPacket:
    authoritative_state_hash: str
    profile_id: str
    visible_guest_limit: int
    animation_step_hz: int
    notes: tuple[str, ...]


def adapt_presentation(authoritative_state_hash: str, profile: VisualFidelityProfile) -> PresentationPacket:
    if len(authoritative_state_hash) != 64:
        raise ValueError("authoritative_state_hash must be a SHA-256 digest.")
    return PresentationPacket(
        authoritative_state_hash=authoritative_state_hash,
        profile_id=profile.profile_id,
        visible_guest_limit=profile.visible_guest_limit,
        animation_step_hz=profile.animation_step_hz,
        notes=("Presentation profile does not modify authoritative simulation state.",),
    )
