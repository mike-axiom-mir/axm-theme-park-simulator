from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Dict, Mapping, Tuple

from .canonical import sha256_value
from .evidence import EvidenceRef
from .models import ExplanationPacket


@dataclass(frozen=True)
class DerivedMetricRecord:
    record_id: str
    metric_id: str
    subject_id: str
    module_id: str
    algorithm_version: str
    state_version: int
    result: float
    unit: str
    contributions: Mapping[str, float]
    input_record_ids: Tuple[str, ...] = ()
    evidence_refs: Tuple[str, ...] = ()
    confidence: float = 1.0
    assumptions: Tuple[str, ...] = ()
    uncertainty_notes: Tuple[str, ...] = ()
    historical_inputs_allowed: bool = False

    def __post_init__(self) -> None:
        if not all((self.record_id, self.metric_id, self.subject_id, self.module_id)):
            raise ValueError("record, metric, subject, and module IDs are required")
        if self.state_version < 0:
            raise ValueError("state_version must be non-negative")
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError("confidence must be between 0 and 1")
        if self.record_id in self.input_record_ids:
            raise ValueError("metric cannot depend on itself")
        sha256_value(self.contributions)

    def digest(self) -> str:
        return sha256_value(asdict(self))


class ProvenanceLedger:
    """Append-only lineage for evidence and derived metrics.

    Dependencies must already exist, which prevents cycles and makes every metric
    traceable to earlier evidence instead of an unexplained score.
    """

    def __init__(self) -> None:
        self._evidence: Dict[str, EvidenceRef] = {}
        self._metrics: Dict[str, DerivedMetricRecord] = {}

    def add_evidence(self, evidence: EvidenceRef) -> None:
        if evidence.evidence_id in self._evidence:
            raise ValueError(f"duplicate evidence_id: {evidence.evidence_id}")
        missing = [item for item in evidence.source_refs if item not in self._evidence]
        if missing:
            raise ValueError(f"unresolved evidence sources: {sorted(missing)}")
        self._evidence[evidence.evidence_id] = evidence

    def add_metric(self, record: DerivedMetricRecord) -> None:
        if record.record_id in self._metrics:
            raise ValueError(f"duplicate record_id: {record.record_id}")
        missing_metrics = [item for item in record.input_record_ids if item not in self._metrics]
        if missing_metrics:
            raise ValueError(f"unresolved metric inputs: {sorted(missing_metrics)}")
        missing_evidence = [item for item in record.evidence_refs if item not in self._evidence]
        if missing_evidence:
            raise ValueError(f"unresolved evidence refs: {sorted(missing_evidence)}")
        if not record.historical_inputs_allowed:
            stale_metrics = [
                item for item in record.input_record_ids
                if self._metrics[item].state_version != record.state_version
            ]
            stale_evidence = [
                item for item in record.evidence_refs
                if self._evidence[item].state_version != record.state_version
            ]
            if stale_metrics or stale_evidence:
                raise ValueError(
                    "state-version mismatch in provenance: "
                    f"metrics={sorted(stale_metrics)}, evidence={sorted(stale_evidence)}"
                )
        self._metrics[record.record_id] = record

    def trace_metric(self, record_id: str) -> Tuple[DerivedMetricRecord, ...]:
        if record_id not in self._metrics:
            raise KeyError(record_id)
        ordered: list[DerivedMetricRecord] = []
        seen = set()

        def visit(current: str) -> None:
            if current in seen:
                return
            record = self._metrics[current]
            for dependency in record.input_record_ids:
                visit(dependency)
            seen.add(current)
            ordered.append(record)

        visit(record_id)
        return tuple(ordered)

    def evidence_lineage(self, record_id: str) -> Tuple[EvidenceRef, ...]:
        evidence_ids = set()
        for metric in self.trace_metric(record_id):
            evidence_ids.update(metric.evidence_refs)
        expanded = set()

        def visit(evidence_id: str) -> None:
            if evidence_id in expanded:
                return
            evidence = self._evidence[evidence_id]
            for source in evidence.source_refs:
                visit(source)
            expanded.add(evidence_id)

        for evidence_id in sorted(evidence_ids):
            visit(evidence_id)
        return tuple(self._evidence[item] for item in sorted(expanded))

    def explanation(self, record_id: str) -> ExplanationPacket:
        record = self._metrics[record_id]
        evidence = self.evidence_lineage(record_id)
        missing = []
        if not record.evidence_refs and not record.input_record_ids:
            missing.append("No evidence or derived inputs were attached.")
        headlines = [
            name for name, _ in sorted(
                record.contributions.items(), key=lambda item: (-abs(item[1]), item[0])
            )
        ]
        return ExplanationPacket(
            subject_id=record.subject_id,
            metric_id=record.metric_id,
            result=record.result,
            unit=record.unit,
            causes=dict(record.contributions),
            evidence_refs=[item.evidence_id for item in evidence],
            missing_evidence=missing,
            assumptions=list(record.assumptions),
            confidence=record.confidence,
            uncertainty_notes=list(record.uncertainty_notes),
            headline_causes=headlines,
            state_version=record.state_version,
        )

    def digest(self) -> str:
        return sha256_value({
            "evidence": [asdict(self._evidence[key]) for key in sorted(self._evidence)],
            "metrics": [asdict(self._metrics[key]) for key in sorted(self._metrics)],
        })

    @property
    def metrics(self) -> Dict[str, DerivedMetricRecord]:
        return dict(self._metrics)
