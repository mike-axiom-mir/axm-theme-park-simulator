import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import unittest

from park_foundation import (
    CANONICAL_ROOT_HASH,
    CommandEnvelope,
    CommandPlan,
    DeterministicEventLog,
    EventIntent,
    ParkEvent,
    SimulationKernel,
    SimulationState,
    SimulationTransactionError,
    SnapshotStore,
)


class KernelSnapshotTests(unittest.TestCase):
    def _state(self):
        return SimulationState(
            world_id="park-world",
            world_seed=42,
            tick=10,
            state_version=3,
            module_states={
                "rides": {"open": False},
                "visitors": {"notified": 0},
                "axm.themepark.foundation": {"clock": 10},
            },
        )

    def _kernel(self):
        return SimulationKernel(module_versions={
            "rides": "0.1.0",
            "visitors": "0.1.0",
            "axm.themepark.foundation": "0.3.0",
        })

    def _command(self, **updates):
        values = dict(
            command_id="cmd-open-ride",
            command_type="ride.open",
            actor_id="player",
            target_module="rides",
            expected_state_version=3,
            tick=10,
            payload={"ride_id": "ride-1"},
        )
        values.update(updates)
        return CommandEnvelope(**values)

    def test_state_digest_is_stable_for_mapping_order(self):
        a = SimulationState("w", 1, module_states={"b": {"y": 2}, "a": {"x": 1}})
        b = SimulationState("w", 1, module_states={"a": {"x": 1}, "b": {"y": 2}})
        self.assertEqual(a.digest(), b.digest())

    def test_stale_command_is_rejected_without_event(self):
        kernel = self._kernel()
        log = DeterministicEventLog()
        result = kernel.execute(
            self._state(),
            self._command(expected_state_version=2),
            log,
        )
        self.assertFalse(result.accepted)
        self.assertEqual(log.events, [])
        self.assertEqual(result.state_before_hash, result.state_after_hash)

    def test_atomic_command_updates_only_registered_reducers(self):
        kernel = self._kernel()
        kernel.register_command_handler(
            "rides", "ride.open",
            lambda state, command: CommandPlan.accept(
                EventIntent(
                    "ride.opened", (command.payload["ride_id"],),
                    {"open": True},
                )
            ),
        )
        kernel.register_reducer(
            "rides", "ride.opened",
            lambda current, event: {**current, "open": event.payload["open"]},
        )
        kernel.register_reducer(
            "visitors", "ride.opened",
            lambda current, event: {**current, "notified": current["notified"] + 1},
        )
        log = DeterministicEventLog()
        result = kernel.execute(self._state(), self._command(), log)
        self.assertTrue(result.accepted)
        self.assertTrue(result.committed)
        self.assertEqual(result.resulting_state.module_state("rides")["open"], True)
        self.assertEqual(result.resulting_state.module_state("visitors")["notified"], 1)
        self.assertEqual(result.resulting_state.state_version, 4)
        self.assertEqual(len(log.events), 1)
        self.assertEqual(log.events[0].command_id, "cmd-open-ride")

    def test_duplicate_command_is_idempotently_rejected(self):
        kernel = self._kernel()
        kernel.register_command_handler(
            "rides", "ride.open",
            lambda state, command: CommandPlan.accept(EventIntent("ride.opened")),
        )
        log = DeterministicEventLog()
        first = kernel.execute(self._state(), self._command(), log)
        second = kernel.execute(first.resulting_state, self._command(
            expected_state_version=first.resulting_state.state_version
        ), log)
        self.assertTrue(first.accepted)
        self.assertFalse(second.accepted)
        self.assertEqual(len(log.events), 1)

    def test_non_timekeeper_cannot_advance_tick(self):
        kernel = self._kernel()
        kernel.register_command_handler(
            "rides", "ride.open",
            lambda state, command: CommandPlan.accept(tick_advance=1),
        )
        result = kernel.execute(self._state(), self._command(), DeterministicEventLog())
        self.assertFalse(result.accepted)
        self.assertEqual(result.resulting_state.tick, 10)

    def test_timekeeper_can_advance_tick(self):
        kernel = self._kernel()
        kernel.register_command_handler(
            "axm.themepark.foundation", "world.advance",
            lambda state, command: CommandPlan.accept(
                EventIntent("world.tick", payload={"ticks": 2}),
                tick_advance=2,
            ),
        )
        command = CommandEnvelope(
            "cmd-time", "world.advance", "system", "axm.themepark.foundation",
            3, 10, {"ticks": 2},
        )
        result = kernel.execute(self._state(), command, DeterministicEventLog())
        self.assertTrue(result.accepted)
        self.assertEqual(result.resulting_state.tick, 12)

    def test_reducer_failure_rolls_back_event_batch(self):
        kernel = self._kernel()
        kernel.register_command_handler(
            "rides", "ride.open",
            lambda state, command: CommandPlan.accept(EventIntent("ride.opened")),
        )
        kernel.register_reducer(
            "rides", "ride.opened",
            lambda current, event: (_ for _ in ()).throw(RuntimeError("boom")),
        )
        log = DeterministicEventLog()
        with self.assertRaises(SimulationTransactionError):
            kernel.execute(self._state(), self._command(), log)
        self.assertEqual(log.events, [])

    def test_event_batch_is_atomic_on_duplicate(self):
        log = DeterministicEventLog()
        event = ParkEvent(
            "e1", "x", 1, "a", [], {}, 1, "m", "1", [],
        )
        with self.assertRaises(ValueError):
            log.append_batch((event, event))
        self.assertEqual(log.events, [])

    def test_snapshot_roundtrip_restores_state_and_log(self):
        state = self._state()
        log = DeterministicEventLog()
        log.append(ParkEvent("e1", "x", 10, "a", [], {}, 1, "m", "1", []))
        store = SnapshotStore()
        manifest = store.capture(
            state, log,
            canonical_root_hash=CANONICAL_ROOT_HASH,
            module_versions={"foundation": "0.3.0"},
            reason="before experiment",
            created_by="Mike",
        )
        restored_state, restored_log = store.restore(manifest.snapshot_id)
        self.assertEqual(restored_state.digest(), state.digest())
        self.assertEqual(restored_log.event_log_hash(), log.event_log_hash())

    def test_fork_preserves_parent_and_creates_lineage(self):
        state = self._state()
        log = DeterministicEventLog()
        store = SnapshotStore()
        snapshot = store.capture(
            state, log,
            canonical_root_hash=CANONICAL_ROOT_HASH,
            module_versions={"foundation": "0.3.0"},
            reason="fork point",
            created_by="Mike",
        )
        forked, fork_log, lineage = store.fork(
            snapshot.snapshot_id,
            new_branch_id="experiment-a",
            label="test a new queue model",
            created_by="Mike",
        )
        self.assertEqual(state.branch_id, "main")
        self.assertEqual(forked.branch_id, "experiment-a")
        self.assertEqual(lineage.parent_branch_id, "main")
        self.assertEqual(fork_log.event_log_hash(), log.event_log_hash())

    def test_snapshot_verification_detects_wrong_state(self):
        state = self._state()
        log = DeterministicEventLog()
        store = SnapshotStore()
        snapshot = store.capture(
            state, log,
            canonical_root_hash=CANONICAL_ROOT_HASH,
            module_versions={"foundation": "0.3.0"},
            reason="verify",
            created_by="Mike",
        )
        changed = state.with_updates({**state.module_states, "rides": {"open": True}})
        ok, issues = snapshot.verify(changed, log)
        self.assertFalse(ok)
        self.assertIn("state hash mismatch", issues)


if __name__ == "__main__":
    unittest.main()
