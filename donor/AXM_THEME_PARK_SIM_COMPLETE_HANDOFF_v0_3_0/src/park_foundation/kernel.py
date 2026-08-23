from __future__ import annotations

from dataclasses import asdict, dataclass, field
import inspect
import json
from typing import Any, Callable, Dict, Mapping, Tuple

from .canonical import canonical_json, sha256_value, stable_seed
from .event_log import DeterministicEventLog, ParkEvent


def _copy(value: Any) -> Any:
    """Return a JSON-safe deep copy in canonical form."""
    return json.loads(canonical_json(value))


class SimulationTransactionError(RuntimeError):
    """Raised when an accepted command cannot be committed atomically."""


@dataclass(frozen=True)
class SimulationState:
    """Authoritative world envelope containing module-owned state payloads.

    The defaults intentionally support lightweight fixtures while production
    saves should always persist every field explicitly.
    """

    world_id: str
    world_seed: int
    module_states: Mapping[str, Any] = field(default_factory=dict)
    tick: int = 0
    state_version: int = 0
    branch_id: str = "main"

    def __post_init__(self) -> None:
        if not self.world_id or not self.branch_id:
            raise ValueError("world_id and branch_id are required")
        if self.world_seed < 0 or self.tick < 0 or self.state_version < 0:
            raise ValueError("seed, tick, and state version must be non-negative")
        canonical_json(self.module_states)

    def digest(self) -> str:
        return sha256_value(asdict(self))

    def module_state(self, module_id: str) -> Any:
        return _copy(self.module_states.get(module_id, {}))

    def with_updates(
        self,
        module_states: Mapping[str, Any] | None = None,
        *,
        tick: int | None = None,
        state_version: int | None = None,
        branch_id: str | None = None,
    ) -> "SimulationState":
        return SimulationState(
            world_id=self.world_id,
            world_seed=self.world_seed,
            module_states=_copy(self.module_states if module_states is None else module_states),
            tick=self.tick if tick is None else tick,
            state_version=self.state_version if state_version is None else state_version,
            branch_id=self.branch_id if branch_id is None else branch_id,
        )

    def replace_module_state(
        self,
        module_id: str,
        value: Any,
        *,
        tick: int | None = None,
        advance_version: bool = True,
    ) -> "SimulationState":
        states = _copy(self.module_states)
        states[module_id] = _copy(value)
        return self.with_updates(
            states,
            tick=self.tick if tick is None else max(self.tick, tick),
            state_version=self.state_version + (1 if advance_version else 0),
        )


@dataclass(frozen=True)
class CommandEnvelope:
    command_id: str
    command_type: str
    actor_id: str
    target_module: str
    expected_state_version: int
    tick: int
    payload: Mapping[str, Any]
    evidence_refs: Tuple[str, ...] = ()
    correlation_id: str | None = None

    def __post_init__(self) -> None:
        if not all((self.command_id, self.command_type, self.actor_id, self.target_module)):
            raise ValueError("command identifiers are required")
        if self.expected_state_version < 0 or self.tick < 0:
            raise ValueError("state version and tick must be non-negative")
        canonical_json(self.payload)

    def digest(self) -> str:
        return sha256_value(asdict(self))


@dataclass(frozen=True)
class EventIntent:
    event_type: str
    target_ids: Tuple[str, ...] = ()
    payload: Mapping[str, Any] = field(default_factory=dict)
    evidence_refs: Tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if not self.event_type:
            raise ValueError("event_type is required")
        canonical_json(self.payload)


@dataclass(frozen=True)
class CommandPlan:
    """Pure domain decision returned before any state or event is committed."""

    accepted: bool
    event_intents: Tuple[EventIntent, ...] = ()
    tick_advance: int = 0
    reasons: Tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if self.tick_advance < 0:
            raise ValueError("tick_advance must be non-negative")
        if self.accepted and self.reasons:
            raise ValueError("accepted plan cannot contain rejection reasons")
        if not self.accepted and (self.event_intents or self.tick_advance):
            raise ValueError("rejected plan cannot emit events or advance time")

    @classmethod
    def accept(cls, *event_intents: EventIntent, tick_advance: int = 0) -> "CommandPlan":
        return cls(True, tuple(event_intents), tick_advance, ())

    @classmethod
    def reject(cls, *reasons: str) -> "CommandPlan":
        return cls(False, (), 0, tuple(reasons) or ("domain rejected command",))


@dataclass(frozen=True)
class CommandResult:
    command_id: str
    accepted: bool
    committed: bool
    reasons: Tuple[str, ...]
    resulting_state: SimulationState
    events: Tuple[ParkEvent, ...]
    state_before_hash: str
    state_after_hash: str

    # Compatibility aliases retained for early v0.3 reference users.
    @property
    def state(self) -> SimulationState:
        return self.resulting_state

    @property
    def prior_state_hash(self) -> str:
        return self.state_before_hash

    @property
    def new_state_hash(self) -> str:
        return self.state_after_hash


CommandHandler = Callable[..., CommandPlan]
Reducer = Callable[[Any, ParkEvent], Any]


class SimulationKernel:
    """Atomic deterministic command → event batch → reducer transaction.

    Command handlers only decide. Reducers are the only mechanism that changes
    module state, and the complete event batch is appended only after every
    reducer succeeds. Therefore a reducer failure leaves both state and log
    untouched.
    """

    TIMEKEEPER_MODULE = "axm.themepark.foundation"

    def __init__(
        self,
        module_versions: Mapping[str, str],
        event_log: DeterministicEventLog | None = None,
    ) -> None:
        self._module_versions = dict(module_versions)
        self._event_log = event_log or DeterministicEventLog()
        self._handlers: Dict[tuple[str, str], CommandHandler] = {}
        self._reducers: Dict[str, list[tuple[str, int, Reducer]]] = {}
        self._registration_counter = 0

    def register_command_handler(
        self,
        module_id: str,
        command_type: str,
        handler: CommandHandler,
    ) -> None:
        key = (module_id, command_type)
        if key in self._handlers:
            raise ValueError(f"handler already registered: {module_id}:{command_type}")
        if module_id not in self._module_versions:
            raise ValueError(f"unknown module version: {module_id}")
        self._handlers[key] = handler

    # Early reference alias.
    register_handler = register_command_handler

    def register_reducer(
        self,
        module_id: str,
        event_type: str,
        reducer: Reducer,
    ) -> None:
        if module_id not in self._module_versions:
            raise ValueError(f"unknown module version: {module_id}")
        if not event_type:
            raise ValueError("event_type is required")
        self._registration_counter += 1
        self._reducers.setdefault(event_type, []).append(
            (module_id, self._registration_counter, reducer)
        )

    @staticmethod
    def _invoke_handler(
        handler: CommandHandler,
        state: SimulationState,
        command: CommandEnvelope,
    ) -> CommandPlan:
        """Support the current two-argument API and the early three-argument API."""
        try:
            signature = inspect.signature(handler)
            positional = [
                p for p in signature.parameters.values()
                if p.kind in (p.POSITIONAL_ONLY, p.POSITIONAL_OR_KEYWORD)
            ]
            has_varargs = any(
                p.kind == p.VAR_POSITIONAL for p in signature.parameters.values()
            )
        except (TypeError, ValueError):
            positional, has_varargs = [], True

        if has_varargs or len(positional) <= 2:
            return handler(state, command)
        return handler(command, state.module_state(command.target_module), state)

    @staticmethod
    def _rejected(
        command: CommandEnvelope,
        state: SimulationState,
        reason: str,
    ) -> CommandResult:
        digest = state.digest()
        return CommandResult(
            command_id=command.command_id,
            accepted=False,
            committed=False,
            reasons=(reason,),
            resulting_state=state,
            events=(),
            state_before_hash=digest,
            state_after_hash=digest,
        )

    def execute(
        self,
        state: SimulationState,
        command: CommandEnvelope,
        event_log: DeterministicEventLog | None = None,
    ) -> CommandResult:
        log = event_log or self._event_log
        before_hash = state.digest()

        if command.expected_state_version != state.state_version:
            return self._rejected(
                command,
                state,
                f"stale state version {command.expected_state_version}; current is {state.state_version}",
            )
        if command.tick < state.tick:
            return self._rejected(command, state, "command tick is behind world tick")
        if any(event.command_id == command.command_id for event in log.events):
            return self._rejected(command, state, "duplicate command_id already committed")

        handler = self._handlers.get((command.target_module, command.command_type))
        if handler is None:
            return self._rejected(command, state, "no owning command handler")

        try:
            plan = self._invoke_handler(handler, state, command)
        except Exception as error:
            raise SimulationTransactionError(f"command handler failed: {error}") from error
        if not isinstance(plan, CommandPlan):
            raise SimulationTransactionError("command handler did not return CommandPlan")
        if not plan.accepted:
            digest = state.digest()
            return CommandResult(
                command.command_id, False, False,
                plan.reasons or ("domain rejected command",),
                state, (), digest, digest,
            )
        if plan.tick_advance and command.target_module != self.TIMEKEEPER_MODULE:
            return self._rejected(
                command,
                state,
                "only the foundation timekeeper may advance authoritative time",
            )

        events: list[ParkEvent] = []
        for sequence, intent in enumerate(plan.event_intents):
            basis = {
                "world_id": state.world_id,
                "branch_id": state.branch_id,
                "state_version": state.state_version,
                "command": command.digest(),
                "sequence": sequence,
                "intent": asdict(intent),
            }
            events.append(ParkEvent(
                event_id="event_" + sha256_value(basis)[:24],
                event_type=intent.event_type,
                tick=command.tick,
                actor_id=command.actor_id,
                target_ids=list(intent.target_ids),
                payload=dict(intent.payload),
                seed=stable_seed(state.world_seed, command.command_id, sequence),
                module_id=command.target_module,
                module_version=self._module_versions[command.target_module],
                evidence_refs=list(dict.fromkeys(command.evidence_refs + intent.evidence_refs)),
                command_id=command.command_id,
                correlation_id=command.correlation_id,
                sequence=sequence,
            ))

        # Work on a detached state map. Nothing is committed until all reducers
        # and the event-log preflight have succeeded.
        next_module_states = _copy(state.module_states)
        try:
            for event in events:
                reducers = sorted(
                    self._reducers.get(event.event_type, ()),
                    key=lambda item: (item[0], item[1]),
                )
                for module_id, _, reducer in reducers:
                    current = _copy(next_module_states.get(module_id, {}))
                    updated = reducer(current, event)
                    canonical_json(updated)
                    next_module_states[module_id] = _copy(updated)

            next_tick = max(state.tick, command.tick) + plan.tick_advance
            resulting_state = state.with_updates(
                next_module_states,
                tick=next_tick,
                state_version=state.state_version + 1,
            )

            # append_batch/extend_atomic performs a full preflight before any
            # record is appended, completing the transaction boundary.
            log.append_batch(tuple(events))
        except Exception as error:
            raise SimulationTransactionError(
                f"transaction rolled back; no state or event committed: {error}"
            ) from error

        after_hash = resulting_state.digest()
        return CommandResult(
            command_id=command.command_id,
            accepted=True,
            committed=True,
            reasons=(),
            resulting_state=resulting_state,
            events=tuple(events),
            state_before_hash=before_hash,
            state_after_hash=after_hash,
        )

    @property
    def event_log(self) -> DeterministicEventLog:
        return self._event_log
