import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import unittest

from park_foundation import (
    AnimationSignal,
    CounterfactualProjection,
    ParkEvent,
    PopulationResolutionPolicy,
    SimulationCadencePlan,
    compare_counterfactuals,
    derive_animation_signal,
)


class CadenceCounterfactualTests(unittest.TestCase):
    def _cadence(self):
        return SimulationCadencePlan(
            "first-map",
            simulation_tick_ms=100,
            render_frame_ms=16,
            lane_intervals_ticks={"movement": 1, "economy": 10, "reputation": 50},
            snapshot_interval_ticks=100,
            max_catchup_ticks=4,
        )

    def test_lane_schedule_is_deterministic(self):
        plan = self._cadence()
        self.assertTrue(plan.lane_due("movement", 7))
        self.assertTrue(plan.lane_due("economy", 20))
        self.assertFalse(plan.lane_due("economy", 21))

    def test_catchup_is_capped_without_losing_remainder(self):
        ticks, remainder = self._cadence().ticks_for_elapsed(1000)
        self.assertEqual(ticks, 4)
        self.assertEqual(remainder, 600)

    def test_render_clock_cannot_be_authoritative(self):
        with self.assertRaises(ValueError):
            SimulationCadencePlan(
                "bad", 100, 16, {"x": 1}, 10,
                authoritative_clock="render",
            )

    def _event(self):
        return ParkEvent(
            "e1", "ride.started", 20, "system", ["ride-1"], {}, 5,
            "rides", "0.1.0", [],
        )

    def test_animation_signal_is_deterministically_derived(self):
        a = derive_animation_signal(
            self._event(), entity_id="ride-1", clip_id="cycle", duration_ticks=10,
            state_version=4, parameters={"speed": 1.0},
        )
        b = derive_animation_signal(
            self._event(), entity_id="ride-1", clip_id="cycle", duration_ticks=10,
            state_version=4, parameters={"speed": 1.0},
        )
        self.assertEqual(a, b)
        self.assertFalse(a.authoritative)
        self.assertTrue(a.rebuildable)

    def test_animation_progress_samples_without_mutating_simulation(self):
        signal = derive_animation_signal(
            self._event(), entity_id="ride-1", clip_id="cycle", duration_ticks=10,
            state_version=4,
        )
        self.assertEqual(signal.progress_at(20), 0.0)
        self.assertAlmostEqual(signal.progress_at(25, 0.5), 0.55)
        self.assertEqual(signal.progress_at(40), 1.0)

    def test_authoritative_animation_signal_is_rejected(self):
        with self.assertRaises(ValueError):
            AnimationSignal("s", "e", "x", "clip", 0, 1, 0, {}, authoritative=True)

    def test_population_resolution_conserves_exact_count_at_all_tiers(self):
        policy = PopulationResolutionPolicy(micro_max=10, meso_max=100)
        for population, tier in ((7, "micro"), (57, "meso"), (1007, "macro")):
            decision = policy.decide(population)
            self.assertEqual(decision.tier, tier)
            self.assertEqual(decision.represented_population, population)

    def _projection(self, plan_id, action, metrics, **updates):
        values = dict(
            projection_id="proj-" + plan_id,
            plan_id=plan_id,
            target_id="ride-1",
            action=action,
            baseline_state_hash="a" * 64,
            baseline_state_version=5,
            projected_metrics=metrics,
            costs={"capital": 10},
            confidence=0.8,
        )
        values.update(updates)
        return CounterfactualProjection(**values)

    def test_comparison_always_preserves_no_action(self):
        comparison = compare_counterfactuals(
            baseline_state_hash="a" * 64,
            baseline_state_version=5,
            baseline_metrics={"identity": 0.5, "finance": 0.5},
            projections=(self._projection("evolve", "evolve", {"identity": 0.8, "finance": 0.6}),),
            priority_weights={"identity": 0.6, "finance": 0.4},
        )
        self.assertIn("no_action", comparison.reviews)
        self.assertFalse(comparison.automatic_selection)

    def test_projection_baseline_mismatch_is_rejected(self):
        projection = self._projection(
            "evolve", "evolve", {"identity": 0.8}, baseline_state_hash="b" * 64
        )
        with self.assertRaises(ValueError):
            compare_counterfactuals(
                baseline_state_hash="a" * 64,
                baseline_state_version=5,
                baseline_metrics={"identity": 0.5},
                projections=(projection,),
                priority_weights={"identity": 1.0},
            )

    def test_missing_metrics_reduce_coverage_and_confidence(self):
        comparison = compare_counterfactuals(
            baseline_state_hash="a" * 64,
            baseline_state_version=5,
            baseline_metrics={"identity": 0.5, "finance": 0.5},
            projections=(self._projection("evolve", "evolve", {"identity": 0.8}),),
            priority_weights={"identity": 0.5, "finance": 0.5},
        )
        review = comparison.reviews["evolve"]
        self.assertEqual(review.coverage, 0.5)
        self.assertLess(review.evidence_adjusted_delta, review.weighted_delta)
        self.assertTrue(any("Missing" in warning for warning in review.warnings))

    def test_irreversible_plan_warns_to_preserve_branch(self):
        comparison = compare_counterfactuals(
            baseline_state_hash="a" * 64,
            baseline_state_version=5,
            baseline_metrics={"identity": 0.5},
            projections=(self._projection(
                "replace", "replace", {"identity": 0.7}, reversible=False
            ),),
            priority_weights={"identity": 1.0},
        )
        self.assertTrue(any("rollback branch" in w for w in comparison.reviews["replace"].warnings))

    def test_counterfactual_cannot_commit_state(self):
        with self.assertRaises(ValueError):
            self._projection("bad", "evolve", {"identity": 0.7}, commits_state=True)

    def test_costs_are_visible_but_not_silently_mixed_into_metric_score(self):
        cheap = self._projection("cheap", "evolve", {"identity": 0.8}, costs={"capital": 5})
        expensive = self._projection("expensive", "evolve", {"identity": 0.8}, costs={"capital": 500})
        comparison = compare_counterfactuals(
            baseline_state_hash="a" * 64,
            baseline_state_version=5,
            baseline_metrics={"identity": 0.5},
            projections=(cheap, expensive),
            priority_weights={"identity": 1.0},
        )
        self.assertEqual(
            comparison.reviews["cheap"].weighted_delta,
            comparison.reviews["expensive"].weighted_delta,
        )
        self.assertNotEqual(
            comparison.reviews["cheap"].costs,
            comparison.reviews["expensive"].costs,
        )


if __name__ == "__main__":
    unittest.main()
