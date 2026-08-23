import json
import math
import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from park_foundation import (
    AnimationSignal,
    AudienceCohortState,
    CohortForces,
    ContributionClaim,
    ContributionLedger,
    CounterfactualProjection,
    ParkEvent,
    PopulationResolutionPolicy,
    ResolutionDecision,
    SimulationCadencePlan,
    compare_counterfactuals,
    derive_animation_signal,
    evolve_market_cohort,
)


class RuntimeHardeningTests(unittest.TestCase):
    def test_negative_or_nonfinite_cohort_values_are_rejected(self):
        with self.assertRaises(ValueError):
            AudienceCohortState("c", "z", 10, -1, 11, 0, 0, 0, 0, 0)
        with self.assertRaises(ValueError):
            AudienceCohortState("c", "z", math.inf, math.inf, 0, 0, 0, 0, 0, 0)
        with self.assertRaises(ValueError):
            CohortForces(visit_capacity=math.nan)

    def test_recovered_visitor_never_becomes_first_time_again(self):
        cohort = AudienceCohortState(
            "c", "zone", 100, 0, 0, 0, 0, 0, 0, 100
        )
        forces = CohortForces(recovery_rate=1.0, visit_capacity=0)
        result = evolve_market_cohort(cohort, forces)
        self.assertEqual(result.first_time_visits, 0)
        self.assertEqual(result.next_state.first_time_reservoir, 0)
        self.assertEqual(result.next_state.previous_satisfied, 100)

    def test_animation_parameters_must_be_json_safe(self):
        with self.assertRaises((TypeError, ValueError)):
            AnimationSignal("s", "e", "x", "clip", 0, 1, 0, {"bad": object()})

    def test_animation_identity_includes_state_version(self):
        event = ParkEvent(
            "e", "ride.started", 1, "system", ["r"], {}, 1, "rides", "1", []
        )
        one = derive_animation_signal(
            event, entity_id="r", clip_id="cycle", duration_ticks=5, state_version=1
        )
        two = derive_animation_signal(
            event, entity_id="r", clip_id="cycle", duration_ticks=5, state_version=2
        )
        self.assertNotEqual(one.signal_id, two.signal_id)

    def test_resolution_decision_cannot_misrepresent_population(self):
        with self.assertRaises(ValueError):
            ResolutionDecision("meso", 57, 10, 5, 6)
        decision = PopulationResolutionPolicy(micro_max=10, meso_max=100).decide(57)
        self.assertEqual(decision.represented_population, 57)
        self.assertEqual(decision.visual_actor_count, 6)

    def test_invalid_cadence_lanes_and_resolution_order_are_rejected(self):
        with self.assertRaises(ValueError):
            SimulationCadencePlan("x", 100, 16, {"": 1}, 10)
        with self.assertRaises(ValueError):
            PopulationResolutionPolicy(meso_bucket_size=100, macro_bucket_size=10)

    def _claim(self, claim_id: str, subject: str, share: float) -> ContributionClaim:
        return ContributionClaim(
            claim_id, subject, "park", "sale-1", "induced_spend", 30,
            "benefit", share, "economy", 4,
        )

    def test_ledger_digest_and_totals_are_insertion_order_independent(self):
        first = ContributionLedger()
        second = ContributionLedger()
        claims = (self._claim("c1", "ride", 0.6), self._claim("c2", "land", 0.4))
        first.add_batch(claims)
        second.add_batch(tuple(reversed(claims)))
        self.assertEqual(first.digest(), second.digest())
        self.assertEqual(first.totals(), second.totals())

    def test_contribution_claim_rejects_nonfinite_amount(self):
        with self.assertRaises(ValueError):
            ContributionClaim(
                "c", "ride", "park", "e", "direct_revenue", math.nan,
                "benefit", 1.0, "economy", 1,
            )

    def test_counterfactual_requires_real_hex_hash(self):
        with self.assertRaises(ValueError):
            CounterfactualProjection(
                "p", "plan", "ride", "evolve", "z" * 64, 1,
                {"identity": 0.8}, {"capital": 1}, 0.8,
            )

    def test_counterfactual_rejects_nonfinite_numbers(self):
        with self.assertRaises(ValueError):
            CounterfactualProjection(
                "p", "plan", "ride", "evolve", "a" * 64, 1,
                {"identity": math.nan}, {"capital": 1}, 0.8,
            )
        with self.assertRaises(ValueError):
            compare_counterfactuals(
                baseline_state_hash="a" * 64,
                baseline_state_version=1,
                baseline_metrics={"identity": 0.5},
                projections=(),
                priority_weights={"identity": math.inf},
            )

    def test_duplicate_projection_identity_is_rejected(self):
        def projection(plan_id: str) -> CounterfactualProjection:
            return CounterfactualProjection(
                "same-projection", plan_id, "ride", "evolve", "a" * 64, 1,
                {"identity": 0.8}, {"capital": 1}, 0.8,
            )
        with self.assertRaises(ValueError):
            compare_counterfactuals(
                baseline_state_hash="a" * 64,
                baseline_state_version=1,
                baseline_metrics={"identity": 0.5},
                projections=(projection("one"), projection("two")),
                priority_weights={"identity": 1.0},
            )

    def test_state_snapshot_schema_matches_runtime_snapshot(self):
        schema = json.loads((ROOT / "contracts/STATE_SNAPSHOT.schema.json").read_text())
        expected = {
            "snapshot_id", "world_id", "branch_id", "tick", "state_version",
            "state_hash", "event_log_hash", "canonical_root_hash",
            "module_versions", "reason", "created_by",
        }
        self.assertEqual(set(schema["required"]), expected)


if __name__ == "__main__":
    unittest.main()
