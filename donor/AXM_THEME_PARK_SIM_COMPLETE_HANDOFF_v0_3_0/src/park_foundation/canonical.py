from __future__ import annotations

from dataclasses import asdict, is_dataclass
from enum import Enum
from hashlib import sha256
import json
from pathlib import Path
from typing import Any


def to_primitive(value: Any) -> Any:
    """Convert supported values into a stable JSON-compatible structure."""
    if is_dataclass(value):
        return to_primitive(asdict(value))
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        return {
            str(key): to_primitive(item)
            for key, item in sorted(value.items(), key=lambda pair: str(pair[0]))
        }
    if isinstance(value, (list, tuple)):
        return [to_primitive(item) for item in value]
    if isinstance(value, set):
        return sorted(to_primitive(item) for item in value)
    if isinstance(value, float):
        # Stable precision for deterministic reference packets.
        return round(value, 12)
    return value


def canonical_json(value: Any) -> str:
    return json.dumps(
        to_primitive(value),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    )


def sha256_text(text: str) -> str:
    return sha256(text.encode("utf-8")).hexdigest()


def sha256_value(value: Any) -> str:
    return sha256_text(canonical_json(value))


def sha256_file(path: str | Path) -> str:
    digest = sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def stable_seed(*parts: Any, bits: int = 64) -> int:
    """Derive a deterministic non-negative integer seed from arbitrary parts."""
    if bits <= 0 or bits > 256:
        raise ValueError("bits must be between 1 and 256")
    digest = sha256_text(canonical_json(parts))
    value = int(digest, 16)
    return value & ((1 << bits) - 1)
