import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from park_foundation import (
    ActionProposal, ActionRouter, ActionRule, DeterministicScheduler,
    NamespaceSpec, NamespaceUpdate, SystemSpec, VersionedStateStore,
)


class SchedulerStateActionTests(unittest.TestCase):
    def test_scheduler_order_is_registration_independent(self):
        specs = [
            SystemSpec("z.world", "m.z", "world", priority=2),
            SystemSpec("a.command", "m.a", "command", priority=50),
            SystemSpec("a.world", "m.a", "world", priority=1),
        ]
        left, right = DeterministicScheduler(), DeterministicScheduler()
        for spec in specs:
            left.register(spec)
        for spec in reversed(specs):
            right.register(spec)
        self.assertEqual(left.plan_tick(0), right.plan_tick(0))
        self.assertEqual(
            [item.system_id for item in left.plan_tick(0).systems],
            ["a.command", "a.world", "z.world"],
        )

    def test_scheduler_cadence(self):
        scheduler = DeterministicScheduler()
        scheduler.register(SystemSpec("every5", "m", "economy", cadence_ticks=5, offset_ticks=2))
        self.assertFalse(scheduler.plan_tick(1).systems)
        self.assertEqual(len(scheduler.plan_tick(2).systems), 1)
        self.assertFalse(scheduler.plan_tick(3).systems)
        self.assertEqual(len(scheduler.plan_tick(7).systems), 1)

    def test_authoritative_system_cannot_be_skippable(self):
        with self.assertRaises(ValueError):
            SystemSpec("bad", "m", "world", authoritative=True, skippable=True)

    def test_animation_cannot_be_authoritative(self):
        with self.assertRaises(ValueError):
            SystemSpec("bad", "m", "animation", authoritative=True)

    def test_visual_frame_can_be_removed_without_removing_authoritative_plan(self):
        scheduler = DeterministicScheduler()
        scheduler.register(SystemSpec("sim", "m.sim", "world"))
        scheduler.register(SystemSpec("visual", "m.visual", "animation", authoritative=False, skippable=True))
        all_ids = [item.system_id for item in scheduler.plan_tick(0).systems]
        reduced = [item.system_id for item in scheduler.plan_tick(0, include_skippable=False).systems]
        self.assertEqual(all_ids, ["sim", "visual"])
        self.assertEqual(reduced, ["sim"])

    def make_store(self):
        return VersionedStateStore((
            NamespaceSpec("rides.core", "rides", True),
            NamespaceSpec("visual.animation", "visual", False),
        ), {"rides.core": {"open": False}, "visual.animation": {"frame": 0}})

    def test_state_owner_can_commit_atomically(self):
        store = self.make_store()
        commit = store.apply_batch((NamespaceUpdate(
            "u1", "rides", "rides.core", 0, {"open": True}, ("e1",)
        ),))
        self.assertTrue(store.read("rides.core")["open"])
        self.assertEqual(store.authoritative_version, 1)
        self.assertTrue(commit.authoritative)

    def test_cross_owner_write_is_rejected_without_mutation(self):
        store = self.make_store()
        before = store.snapshot()
        with self.assertRaises(PermissionError):
            store.apply_batch((NamespaceUpdate(
                "u1", "visual", "rides.core", 0, {"open": True}
            ),))
        self.assertEqual(store.snapshot(), before)

    def test_stale_state_update_is_rejected(self):
        store = self.make_store()
        store.apply_batch((NamespaceUpdate("u1", "rides", "rides.core", 0, {"open": True}),))
        with self.assertRaises(ValueError):
            store.apply_batch((NamespaceUpdate("u2", "rides", "rides.core", 0, {"open": False}),))

    def test_visual_update_does_not_advance_authoritative_version(self):
        store = self.make_store()
        store.apply_batch((NamespaceUpdate("v1", "visual", "visual.animation", 0, {"frame": 1}),))
        self.assertEqual(store.authoritative_version, 0)
        self.assertEqual(store.view_version, 1)

    def test_fork_reproduces_snapshot_state(self):
        store = self.make_store()
        snapshot = store.snapshot()
        fork = store.fork(snapshot)
        self.assertEqual(fork.snapshot(), snapshot)

    def make_router(self):
        router = ActionRouter()
        router.register(ActionRule("ride.open", "rides", "ride.opened", ("ride.operate",)))
        return router

    def proposal(self, **overrides):
        values = dict(
            proposal_id="p1", actor_id="player", actor_kind="player",
            target_module_id="rides", action_type="ride.open", payload={"ride_id":"r1"},
            requested_tick=3, expected_state_version=2,
            authority_scopes=("ride.operate",), evidence_refs=(),
        )
        values.update(overrides)
        return ActionProposal(**values)

    def test_action_rejects_stale_state(self):
        decision = self.make_router().evaluate(self.proposal(), current_state_version=3)
        self.assertFalse(decision.accepted)
        self.assertTrue(any("stale" in item for item in decision.reasons))

    def test_action_rejects_wrong_owner(self):
        decision = self.make_router().evaluate(
            self.proposal(target_module_id="visitors"), current_state_version=2
        )
        self.assertFalse(decision.accepted)

    def test_action_rejects_missing_scope(self):
        decision = self.make_router().evaluate(
            self.proposal(authority_scopes=()), current_state_version=2
        )
        self.assertFalse(decision.accepted)

    def test_accepted_action_creates_stable_event(self):
        router = self.make_router()
        proposal = self.proposal()
        left = router.evaluate(proposal, current_state_version=2)
        right = router.evaluate(proposal, current_state_version=2)
        self.assertTrue(left.accepted)
        self.assertEqual(router.event_for(proposal, left, module_version="1"),
                         router.event_for(proposal, right, module_version="1"))


if __name__ == "__main__":
    unittest.main()
