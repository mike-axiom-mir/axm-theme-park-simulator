from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Callable, Dict, Mapping, Tuple

from .canonical import sha256_value, stable_seed
from .event_log import ParkEvent


ACTOR_KINDS = frozenset({"player", "ai", "campaign", "world", "system"})
Validator = Callable[["ActionProposal"], tuple[bool, Tuple[str, ...], Mapping[str, Any]]]


@dataclass(frozen=True)
class ActionProposal:
    proposal_id: str
    actor_id: str
    actor_kind: str
    target_module_id: str
    action_type: str
    payload: Mapping[str, Any]
    requested_tick: int
    expected_state_version: int
    authority_scopes: Tuple[str, ...] = ()
    evidence_refs: Tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if not all((self.proposal_id, self.actor_id, self.target_module_id, self.action_type)):
            raise ValueError("proposal, actor, target module, and action type are required")
        if self.actor_kind not in ACTOR_KINDS:
            raise ValueError(f"unsupported actor_kind: {self.actor_kind}")
        if self.requested_tick < 0 or self.expected_state_version < 0:
            raise ValueError("tick and state version must be non-negative")
        sha256_value(self.payload)

    def digest(self) -> str:
        return sha256_value(asdict(self))


@dataclass(frozen=True)
class ActionRule:
    action_type: str
    owner_module_id: str
    emitted_event_type: str
    required_scopes: Tuple[str, ...] = ()


@dataclass(frozen=True)
class ActionDecision:
    decision_id: str
    proposal_id: str
    accepted: bool
    owner_module_id: str | None
    reasons: Tuple[str, ...]
    normalized_payload: Mapping[str, Any]
    proposal_hash: str

    def digest(self) -> str:
        return sha256_value(asdict(self))


class ActionRouter:
    """Routes player/AI/campaign proposals through the same visible gate."""

    def __init__(self) -> None:
        self._rules: Dict[str, tuple[ActionRule, Validator | None]] = {}

    def register(self, rule: ActionRule, validator: Validator | None = None) -> None:
        if rule.action_type in self._rules:
            raise ValueError(f"duplicate action rule: {rule.action_type}")
        self._rules[rule.action_type] = (rule, validator)

    def evaluate(self, proposal: ActionProposal, *, current_state_version: int) -> ActionDecision:
        reasons = []
        normalized: Mapping[str, Any] = dict(proposal.payload)
        rule_and_validator = self._rules.get(proposal.action_type)
        owner = None
        if rule_and_validator is None:
            reasons.append("unknown action type")
        else:
            rule, validator = rule_and_validator
            owner = rule.owner_module_id
            if proposal.target_module_id != rule.owner_module_id:
                reasons.append("target module does not own this action")
            missing_scopes = sorted(set(rule.required_scopes) - set(proposal.authority_scopes))
            if missing_scopes:
                reasons.append("missing authority scopes: " + ", ".join(missing_scopes))
            if proposal.expected_state_version != current_state_version:
                reasons.append(
                    f"stale state version {proposal.expected_state_version}; current is {current_state_version}"
                )
            if not reasons and validator is not None:
                valid, validator_reasons, normalized = validator(proposal)
                if not valid:
                    reasons.extend(validator_reasons or ("domain validation failed",))
        accepted = not reasons
        proposal_hash = proposal.digest()
        decision_id = "decision_" + sha256_value({
            "proposal_hash": proposal_hash,
            "accepted": accepted,
            "owner": owner,
            "reasons": reasons,
            "payload": normalized,
        })[:24]
        return ActionDecision(
            decision_id=decision_id,
            proposal_id=proposal.proposal_id,
            accepted=accepted,
            owner_module_id=owner,
            reasons=tuple(reasons),
            normalized_payload=dict(normalized),
            proposal_hash=proposal_hash,
        )

    def event_for(
        self,
        proposal: ActionProposal,
        decision: ActionDecision,
        *,
        module_version: str,
    ) -> ParkEvent:
        if not decision.accepted:
            raise ValueError("rejected actions cannot become park events")
        rule, _ = self._rules[proposal.action_type]
        if decision.owner_module_id != rule.owner_module_id:
            raise ValueError("decision owner mismatch")
        seed = stable_seed(proposal.digest(), decision.digest(), rule.emitted_event_type)
        event_id = "event_" + sha256_value({
            "proposal": proposal.digest(),
            "decision": decision.digest(),
            "event_type": rule.emitted_event_type,
        })[:24]
        return ParkEvent(
            event_id=event_id,
            event_type=rule.emitted_event_type,
            tick=proposal.requested_tick,
            actor_id=proposal.actor_id,
            target_ids=[proposal.target_module_id],
            payload={
                **dict(decision.normalized_payload),
                "proposal_id": proposal.proposal_id,
                "decision_id": decision.decision_id,
                "actor_kind": proposal.actor_kind,
            },
            seed=seed,
            module_id=rule.owner_module_id,
            module_version=module_version,
            evidence_refs=list(proposal.evidence_refs),
        )
