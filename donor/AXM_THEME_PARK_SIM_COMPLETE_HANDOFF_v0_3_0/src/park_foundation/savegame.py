from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Mapping

from .canonical import sha256_value
from .version import SAVE_FORMAT_VERSION


@dataclass(frozen=True)
class SaveManifest:
    save_id: str
    format_version: str
    foundation_version: str
    canonical_root_hash: str
    module_versions: Mapping[str, str]
    tick: int
    state_hash: str
    event_log_hash: str
    parent_save_id: str | None = None
    migration_history: tuple[str, ...] = ()
    branch_id: str = "main"
    snapshot_id: str | None = None

    def __post_init__(self) -> None:
        if self.tick < 0:
            raise ValueError("tick must be non-negative")
        if not self.branch_id.strip():
            raise ValueError("branch_id is required")
        for label, value in (
            ("canonical_root_hash", self.canonical_root_hash),
            ("state_hash", self.state_hash),
            ("event_log_hash", self.event_log_hash),
        ):
            if len(value) != 64:
                raise ValueError(f"{label} must be a SHA-256 hex string")

    def digest(self) -> str:
        return sha256_value(asdict(self))


@dataclass(frozen=True)
class MigrationPlan:
    migration_id: str
    from_version: str
    to_version: str
    transformations: tuple[str, ...]
    affected_contracts: tuple[str, ...]
    before_root_hash: str
    after_root_hash: str
    requires_user_approval: bool
    rollback_save_id: str
    change_request_id: str | None = None

    def validate(self) -> tuple[bool, tuple[str, ...]]:
        issues = []
        if self.from_version == self.to_version:
            issues.append("migration versions must differ")
        if not self.transformations:
            issues.append("at least one transformation is required")
        if not self.rollback_save_id:
            issues.append("rollback_save_id is required")
        root_changed = self.before_root_hash != self.after_root_hash
        if root_changed and not self.change_request_id:
            issues.append("root-changing migration requires change_request_id")
        if root_changed and not self.requires_user_approval:
            issues.append("root-changing migration requires user approval")
        return (not issues, tuple(issues))


class SaveVerifier:
    @staticmethod
    def verify(
        manifest: SaveManifest,
        *,
        expected_root_hash: str,
        installed_modules: Mapping[str, str],
        supported_format_version: str = SAVE_FORMAT_VERSION,
    ) -> tuple[bool, tuple[str, ...]]:
        issues = []
        if manifest.format_version != supported_format_version:
            issues.append(
                f"unsupported save format {manifest.format_version}; "
                f"expected {supported_format_version}"
            )
        if manifest.canonical_root_hash != expected_root_hash:
            issues.append("canonical root hash mismatch")
        for module_id, required_version in manifest.module_versions.items():
            installed = installed_modules.get(module_id)
            if installed is None:
                issues.append(f"missing module: {module_id}")
            elif installed != required_version:
                issues.append(
                    f"module version mismatch: {module_id} "
                    f"{installed} != {required_version}"
                )
        return (not issues, tuple(issues))
