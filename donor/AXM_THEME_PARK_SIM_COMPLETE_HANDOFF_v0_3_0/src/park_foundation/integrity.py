from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .registry import FORBIDDEN_SHORTCUTS


@dataclass(frozen=True)
class IntegrityReport:
    valid: bool
    findings: tuple[str, ...]


def find_forbidden_shortcuts(value: Any, path: str = "$") -> tuple[str, ...]:
    findings = []
    if isinstance(value, dict):
        for key, item in value.items():
            key_text = str(key)
            if key_text in FORBIDDEN_SHORTCUTS:
                findings.append(f"{path}.{key_text}")
            findings.extend(find_forbidden_shortcuts(item, f"{path}.{key_text}"))
    elif isinstance(value, (list, tuple, set)):
        for index, item in enumerate(value):
            findings.extend(find_forbidden_shortcuts(item, f"{path}[{index}]"))
    elif isinstance(value, str) and value in FORBIDDEN_SHORTCUTS:
        findings.append(path)
    return tuple(findings)


def validate_integrity(value: Any) -> IntegrityReport:
    findings = find_forbidden_shortcuts(value)
    return IntegrityReport(valid=not findings, findings=findings)
