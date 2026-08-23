from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple


CHECK_STATUSES = frozenset({"pass", "fail", "not_run"})


@dataclass(frozen=True)
class AcceptanceCheck:
    check_id: str
    category: str
    required: bool
    status: str
    evidence_refs: Tuple[str, ...] = ()
    notes: Tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if self.status not in CHECK_STATUSES:
            raise ValueError(f"unsupported check status: {self.status}")
        if self.status == "pass" and not self.evidence_refs:
            raise ValueError("a passing check must cite evidence")


@dataclass(frozen=True)
class AcceptanceReport:
    report_id: str
    build_id: str
    checks: Tuple[AcceptanceCheck, ...]

    def blocking_checks(self) -> Tuple[AcceptanceCheck, ...]:
        return tuple(
            item for item in self.checks
            if item.required and item.status != "pass"
        )

    def ready(self) -> bool:
        return bool(self.checks) and not self.blocking_checks()

    def summary(self) -> dict[str, int | bool]:
        return {
            "ready": self.ready(),
            "passed": sum(item.status == "pass" for item in self.checks),
            "failed": sum(item.status == "fail" for item in self.checks),
            "not_run": sum(item.status == "not_run" for item in self.checks),
            "blocking": len(self.blocking_checks()),
        }
