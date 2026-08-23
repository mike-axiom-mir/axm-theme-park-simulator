from __future__ import annotations

from dataclasses import asdict, dataclass
import math
from typing import Dict, Iterable, Mapping, Tuple

from .canonical import sha256_value
from .models import ContributionInputs


BENEFIT_CHANNELS = frozenset({
    "direct_revenue",
    "induced_spend",
    "visit_attraction_value",
    "duration_value",
    "identity_value",
    "crowd_balance_value",
    "heritage_value",
    "strategic_resilience_value",
})
COST_CHANNELS = frozenset({
    "operating_cost",
    "maintenance_cost",
    "staffing_cost",
    "risk_cost",
    "land_opportunity_cost",
})
KNOWN_CHANNELS = BENEFIT_CHANNELS | COST_CHANNELS


@dataclass(frozen=True)
class ContributionClaim:
    claim_id: str
    subject_id: str
    beneficiary_id: str
    causal_event_id: str
    channel: str
    amount: float
    direction: str
    attribution_share: float
    source_module: str
    state_version: int
    confidence: float = 1.0
    evidence_refs: Tuple[str, ...] = ()
    notes: Tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if not all(value.strip() for value in (
            self.claim_id,
            self.subject_id,
            self.beneficiary_id,
            self.causal_event_id,
            self.source_module,
        )):
            raise ValueError("claim identifiers are required")
        if self.channel not in KNOWN_CHANNELS:
            raise ValueError(f"unknown contribution channel: {self.channel}")
        if self.direction not in {"benefit", "cost"}:
            raise ValueError("direction must be benefit or cost")
        if (self.channel in BENEFIT_CHANNELS) != (self.direction == "benefit"):
            raise ValueError("channel and direction disagree")
        if not math.isfinite(float(self.amount)) or self.amount < 0:
            raise ValueError("amount must be finite and non-negative")
        if self.state_version < 0:
            raise ValueError("state version must be non-negative")
        if not math.isfinite(float(self.attribution_share)) or not 0.0 <= self.attribution_share <= 1.0:
            raise ValueError("attribution_share must be finite and between 0 and 1")
        if not math.isfinite(float(self.confidence)) or not 0.0 <= self.confidence <= 1.0:
            raise ValueError("confidence must be finite and between 0 and 1")

    @property
    def occurrence_key(self) -> tuple[str, str, str, str, int]:
        """Identity of one real value occurrence, excluding claimant/amount."""
        return (
            self.causal_event_id,
            self.beneficiary_id,
            self.channel,
            self.direction,
            self.state_version,
        )

    @property
    def attributed_amount(self) -> float:
        return self.amount * self.attribution_share

    @property
    def evidence_adjusted_amount(self) -> float:
        return self.attributed_amount * self.confidence


@dataclass(frozen=True)
class ContributionAudit:
    claim_count: int
    nominal_benefits: float
    nominal_costs: float
    nominal_net: float
    evidence_adjusted_benefits: float
    evidence_adjusted_costs: float
    evidence_adjusted_net: float
    by_channel: Mapping[str, float]
    by_subject: Mapping[str, float]
    unallocated_shares: Mapping[str, float]
    warnings: Tuple[str, ...]
    errors: Tuple[str, ...] = ()

    @property
    def valid(self) -> bool:
        return not self.errors


class ContributionLedger:
    """Append-only causal attribution with transactional double-count protection."""

    def __init__(self) -> None:
        self._claims: Dict[str, ContributionClaim] = {}
        self._shares: Dict[tuple, float] = {}
        self._base_amounts: Dict[tuple, float] = {}

    @staticmethod
    def _validate_into(
        claim: ContributionClaim,
        claims: Dict[str, ContributionClaim],
        shares: Dict[tuple, float],
        base_amounts: Dict[tuple, float],
    ) -> None:
        if claim.claim_id in claims:
            raise ValueError(f"duplicate claim_id: {claim.claim_id}")
        key = claim.occurrence_key
        existing_amount = base_amounts.get(key)
        if existing_amount is not None and not math.isclose(
            existing_amount, claim.amount, rel_tol=0.0, abs_tol=1e-9
        ):
            raise ValueError("conflicting base amount for one value occurrence")
        used = shares.get(key, 0.0)
        if used + claim.attribution_share > 1.0 + 1e-9:
            raise ValueError("contribution attribution exceeds 100% for one value occurrence")
        claims[claim.claim_id] = claim
        shares[key] = used + claim.attribution_share
        base_amounts[key] = claim.amount

    def add_claim(self, claim: ContributionClaim) -> None:
        self._validate_into(claim, self._claims, self._shares, self._base_amounts)

    # Early reference alias.
    add = add_claim

    def add_batch(self, claims: Iterable[ContributionClaim]) -> None:
        candidate_claims = dict(self._claims)
        candidate_shares = dict(self._shares)
        candidate_amounts = dict(self._base_amounts)
        for claim in tuple(claims):
            self._validate_into(
                claim,
                candidate_claims,
                candidate_shares,
                candidate_amounts,
            )
        # Commit only after the complete batch validates.
        self._claims = candidate_claims
        self._shares = candidate_shares
        self._base_amounts = candidate_amounts

    def totals(
        self,
        subject_id: str | None = None,
        *,
        state_version: int | None = None,
        evidence_adjusted: bool = False,
    ) -> Dict[str, float]:
        grouped: Dict[str, list[float]] = {}
        for claim in sorted(self._claims.values(), key=lambda item: item.claim_id):
            if subject_id is not None and claim.subject_id != subject_id:
                continue
            if state_version is not None and claim.state_version != state_version:
                continue
            amount = (
                claim.evidence_adjusted_amount
                if evidence_adjusted
                else claim.attributed_amount
            )
            signed = amount if claim.direction == "benefit" else -amount
            grouped.setdefault(claim.channel, []).append(signed)
        return {
            channel: math.fsum(values)
            for channel, values in sorted(grouped.items())
        }

    def net(
        self,
        subject_id: str,
        *,
        state_version: int | None = None,
        evidence_adjusted: bool = False,
    ) -> float:
        return math.fsum(self.totals(
            subject_id,
            state_version=state_version,
            evidence_adjusted=evidence_adjusted,
        ).values())

    def to_contribution_inputs(
        self,
        subject_id: str,
        *,
        state_version: int | None = None,
        evidence_adjusted: bool = False,
    ) -> ContributionInputs:
        totals = self.totals(
            subject_id,
            state_version=state_version,
            evidence_adjusted=evidence_adjusted,
        )
        values = {channel: 0.0 for channel in KNOWN_CHANNELS}
        for channel, signed in totals.items():
            values[channel] = abs(signed) if channel in COST_CHANNELS else max(0.0, signed)
        return ContributionInputs(**values)

    def audit(self, *, state_version: int | None = None) -> ContributionAudit:
        claims = [
            claim
            for claim in self._claims.values()
            if state_version is None or claim.state_version == state_version
        ]
        nominal_benefits = math.fsum(
            c.attributed_amount for c in claims if c.direction == "benefit"
        )
        nominal_costs = math.fsum(
            c.attributed_amount for c in claims if c.direction == "cost"
        )
        adjusted_benefits = math.fsum(
            c.evidence_adjusted_amount for c in claims if c.direction == "benefit"
        )
        adjusted_costs = math.fsum(
            c.evidence_adjusted_amount for c in claims if c.direction == "cost"
        )
        by_channel_parts: Dict[str, list[float]] = {}
        by_subject_parts: Dict[str, list[float]] = {}
        for claim in sorted(claims, key=lambda item: item.claim_id):
            signed = claim.evidence_adjusted_amount * (
                1.0 if claim.direction == "benefit" else -1.0
            )
            by_channel_parts.setdefault(claim.channel, []).append(signed)
            by_subject_parts.setdefault(claim.subject_id, []).append(signed)
        by_channel = {
            key: math.fsum(values) for key, values in sorted(by_channel_parts.items())
        }
        by_subject = {
            key: math.fsum(values) for key, values in sorted(by_subject_parts.items())
        }

        included_keys = {claim.occurrence_key for claim in claims}
        unallocated = {
            "|".join(map(str, key)): max(0.0, 1.0 - self._shares[key])
            for key in included_keys
            if self._shares.get(key, 0.0) < 1.0 - 1e-9
        }
        warnings: list[str] = []
        if not claims:
            warnings.append("No contribution claims matched this audit.")
        if claims and not any(c.channel != "direct_revenue" for c in claims):
            warnings.append(
                "Only direct revenue is represented; whole-park contribution remains incomplete."
            )
        if any(c.confidence < 0.5 for c in claims):
            warnings.append(
                "Low-confidence claims are present and shown with evidence adjustment."
            )
        return ContributionAudit(
            claim_count=len(claims),
            nominal_benefits=nominal_benefits,
            nominal_costs=nominal_costs,
            nominal_net=nominal_benefits - nominal_costs,
            evidence_adjusted_benefits=adjusted_benefits,
            evidence_adjusted_costs=adjusted_costs,
            evidence_adjusted_net=adjusted_benefits - adjusted_costs,
            by_channel=by_channel,
            by_subject=by_subject,
            unallocated_shares=dict(sorted(unallocated.items())),
            warnings=tuple(warnings),
            errors=(),
        )

    def digest(self) -> str:
        """Insertion-order-independent identity of the complete causal ledger."""
        return sha256_value([
            asdict(claim)
            for claim in sorted(self._claims.values(), key=lambda item: item.claim_id)
        ])

    @property
    def claims(self) -> Dict[str, ContributionClaim]:
        return dict(sorted(self._claims.items()))
