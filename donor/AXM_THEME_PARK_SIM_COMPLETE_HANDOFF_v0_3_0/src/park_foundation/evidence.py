from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Literal

EvidenceStatus = Literal["observed", "reported", "inferred", "disputed", "unknown"]


@dataclass(frozen=True)
class EvidenceRef:
    evidence_id: str
    source_module: str
    state_version: int
    status: EvidenceStatus
    reliability: float
    summary: str
    source_refs: tuple[str, ...] = ()
    alternatives: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if self.state_version < 0:
            raise ValueError("state_version must be non-negative")
        if not 0.0 <= self.reliability <= 1.0:
            raise ValueError("reliability must be between 0 and 1")
        if self.status not in {"observed", "reported", "inferred", "disputed", "unknown"}:
            raise ValueError(f"Unsupported evidence status: {self.status}")


@dataclass(frozen=True)
class UncertainValue:
    value: float
    confidence: float
    lower_bound: float | None = None
    upper_bound: float | None = None
    assumptions: tuple[str, ...] = ()
    alternatives: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError("confidence must be between 0 and 1")
        if (
            self.lower_bound is not None
            and self.upper_bound is not None
            and self.lower_bound > self.upper_bound
        ):
            raise ValueError("lower_bound cannot exceed upper_bound")
        if self.lower_bound is not None and self.value < self.lower_bound:
            raise ValueError("value cannot be lower than lower_bound")
        if self.upper_bound is not None and self.value > self.upper_bound:
            raise ValueError("value cannot exceed upper_bound")


def evidence_confidence(evidence: List[EvidenceRef] | tuple[EvidenceRef, ...]) -> float:
    if not evidence:
        return 0.0
    reliability = sum(item.reliability for item in evidence) / len(evidence)
    observed_share = sum(item.status == "observed" for item in evidence) / len(evidence)
    disputed_share = sum(item.status == "disputed" for item in evidence) / len(evidence)
    return max(0.0, min(1.0, 0.65 * reliability + 0.35 * observed_share - 0.25 * disputed_share))
