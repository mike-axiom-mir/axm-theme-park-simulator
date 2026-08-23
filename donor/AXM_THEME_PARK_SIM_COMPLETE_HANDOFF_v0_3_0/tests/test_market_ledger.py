import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import unittest

from park_foundation import (
    AudienceCohortState,
    CohortForces,
    ContributionClaim,
    ContributionLedger,
    evolve_market_cohort,
)


class MarketLedgerTests(unittest.TestCase):
    def _cohort(self):
        return AudienceCohortState(
            cohort_id="local-families",
            origin_zone_id="tilburg-local",
            population=1000,
            unaware=250,
            aware=200,
            considering=150,
            first_time_ready=100,
            previous_satisfied=150,
            loyal_repeat=100,
            disappointed=50,
        )

    def _forces(self, **updates):
        values = dict(
            awareness_rate=0.10,
            consideration_rate=0.20,
            readiness_rate=0.25,
            first_visit_rate=0.30,
            repeat_visit_rate=0.25,
            repeat_strength=0.80,
            expectation_delivery=0.85,
            loyalty_rate=0.30,
            recovery_rate=0.10,
            visit_capacity=200,
        )
        values.update(updates)
        return CohortForces(**values)

    def test_market_step_conserves_population(self):
        result = evolve_market_cohort(self._cohort(), self._forces())
        self.assertAlmostEqual(sum(result.next_state.counts.values()), 1000)
        self.assertEqual(result.next_state.population, 1000)

    def test_marketing_changes_state_but_does_not_spawn_people(self):
        result = evolve_market_cohort(
            self._cohort(),
            self._forces(awareness_rate=1.0, visit_capacity=0),
        )
        self.assertEqual(result.next_state.population, self._cohort().population)
        self.assertLess(result.next_state.unaware, self._cohort().unaware)

    def test_first_time_reservoir_declines_through_real_visits(self):
        result = evolve_market_cohort(
            self._cohort(), self._forces(first_visit_rate=1.0, visit_capacity=500)
        )
        self.assertGreater(result.first_time_visits, 0)
        self.assertLess(result.next_state.first_time_reservoir, self._cohort().first_time_reservoir)

    def test_repeat_strength_supports_repeat_visits(self):
        high = evolve_market_cohort(self._cohort(), self._forces(repeat_strength=1.0))
        low = evolve_market_cohort(self._cohort(), self._forces(repeat_strength=0.1))
        self.assertGreater(high.repeat_visits, low.repeat_visits)

    def test_capacity_limits_both_visit_types_and_reports_unmet(self):
        result = evolve_market_cohort(self._cohort(), self._forces(visit_capacity=10))
        self.assertLessEqual(result.first_time_visits + result.repeat_visits, 10.000001)
        self.assertGreater(result.unmet_first_time_demand + result.unmet_repeat_demand, 0)

    def test_low_expectation_delivery_grows_disappointment(self):
        high = evolve_market_cohort(self._cohort(), self._forces(expectation_delivery=0.95))
        low = evolve_market_cohort(self._cohort(), self._forces(expectation_delivery=0.10))
        self.assertGreater(low.next_state.disappointed, high.next_state.disappointed)

    def test_recovery_repairs_trust_without_erasing_prior_exposure(self):
        no_recovery = evolve_market_cohort(
            self._cohort(), self._forces(recovery_rate=0.0, visit_capacity=0)
        )
        recovery = evolve_market_cohort(
            self._cohort(), self._forces(recovery_rate=1.0, visit_capacity=0)
        )
        self.assertLess(recovery.next_state.disappointed, no_recovery.next_state.disappointed)
        self.assertGreater(
            recovery.next_state.previous_satisfied,
            no_recovery.next_state.previous_satisfied,
        )
        self.assertEqual(
            recovery.next_state.first_time_reservoir,
            no_recovery.next_state.first_time_reservoir,
        )

    def _claim(self, claim_id, subject, share, *, amount=20, channel="induced_spend", direction="benefit"):
        return ContributionClaim(
            claim_id=claim_id,
            subject_id=subject,
            beneficiary_id="park",
            causal_event_id="purchase-1",
            channel=channel,
            amount=amount,
            direction=direction,
            attribution_share=share,
            source_module="economy",
            state_version=4,
        )

    def test_ledger_allows_split_attribution_up_to_one(self):
        ledger = ContributionLedger()
        ledger.add_claim(self._claim("c1", "ride-a", 0.6))
        ledger.add_claim(self._claim("c2", "land-a", 0.4))
        self.assertAlmostEqual(ledger.net("ride-a"), 12)
        self.assertAlmostEqual(ledger.net("land-a"), 8)
        self.assertTrue(ledger.audit().valid)

    def test_ledger_blocks_double_counting(self):
        ledger = ContributionLedger()
        ledger.add_claim(self._claim("c1", "ride-a", 0.7))
        with self.assertRaises(ValueError):
            ledger.add_claim(self._claim("c2", "land-a", 0.4))
        self.assertEqual(len(ledger.claims), 1)

    def test_ledger_rejects_conflicting_base_amount(self):
        ledger = ContributionLedger()
        ledger.add_claim(self._claim("c1", "ride-a", 0.5, amount=20))
        with self.assertRaises(ValueError):
            ledger.add_claim(self._claim("c2", "land-a", 0.5, amount=25))

    def test_ledger_batch_is_atomic(self):
        ledger = ContributionLedger()
        with self.assertRaises(ValueError):
            ledger.add_batch((
                self._claim("same", "ride-a", 0.4),
                self._claim("same", "land-a", 0.4),
            ))
        self.assertEqual(len(ledger.claims), 0)

    def test_cost_claim_maps_to_contribution_input(self):
        ledger = ContributionLedger()
        claim = ContributionClaim(
            claim_id="cost-1",
            subject_id="ride-a",
            beneficiary_id="park",
            causal_event_id="maintenance-1",
            channel="maintenance_cost",
            amount=30,
            direction="cost",
            attribution_share=1.0,
            source_module="rides",
            state_version=5,
        )
        ledger.add_claim(claim)
        inputs = ledger.to_contribution_inputs("ride-a")
        self.assertEqual(inputs.maintenance_cost, 30)
        self.assertEqual(ledger.net("ride-a"), -30)

    def test_unallocated_share_is_reported_not_invented(self):
        ledger = ContributionLedger()
        ledger.add_claim(self._claim("c1", "ride-a", 0.25))
        audit = ledger.audit()
        self.assertTrue(audit.unallocated_shares)
        self.assertAlmostEqual(next(iter(audit.unallocated_shares.values())), 0.75)


if __name__ == "__main__":
    unittest.main()
