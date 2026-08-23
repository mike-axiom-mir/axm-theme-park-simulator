from __future__ import annotations

import json
import sys
from dataclasses import asdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from park_foundation import (
    ClockConfig, DeterministicClock, reference_environment_frame,
    DemandInputs, evaluate_reachable_demand,
    LifecycleEvidence, evaluate_lifecycle_options,
    StateSnapshot, VisualFidelityProfile, adapt_presentation,
    CampaignState, CampaignEnding, evaluate_campaign_endings,
)

clock = DeterministicClock(ClockConfig(ticks_per_sim_minute=1, minutes_per_day=60,
                                       days_per_season=2))
time = clock.advance(125)
environment = reference_environment_frame(42, time.tick, time.day_index, time.season)

demand = evaluate_reachable_demand(
    "classic_coaster:tourists",
    DemandInputs(0.9, 0.8, 0.9, 0.7, 0.8, 0.8, 0.9),
)

lifecycle = evaluate_lifecycle_options(
    "classic_coaster",
    LifecycleEvidence(0.9, 0.8, 0.9, 0.8, 0.7, 0.5, 0.2, 0.1, 1.0,
                      ("inspection:coaster_001",)),
)

snapshot = StateSnapshot(
    "demo_snapshot", time.tick, "0.2.0", {"foundation": "0.2.0"},
    {"time": asdict(time), "environment": asdict(environment), "demand": demand.result},
)
state_hash = snapshot.digest()

low = adapt_presentation(state_hash, VisualFidelityProfile("low_graphic_v1", 120, 12, 0, 0.5, 3))
high = adapt_presentation(state_hash, VisualFidelityProfile("future_high", 2000, 60, 3, 2.0, 1))

campaign = evaluate_campaign_endings(
    CampaignState("forgotten_local_park", {}, {"stable", "historic_saved"}, ["evidence:1"]),
    [
        CampaignEnding("heritage", "Preserved Heritage", frozenset({"stable", "historic_saved"})),
        CampaignEnding("family", "Regional Family Future", frozenset({"stable"})),
    ],
)

output = {
    "time": asdict(time),
    "environment": asdict(environment),
    "segmented_demand": demand.result,
    "lifecycle_options": {key: value.viability for key, value in lifecycle.options.items()},
    "forced_lifecycle_action": lifecycle.forced_action,
    "state_hash": state_hash,
    "low_visual_state_hash": low.authoritative_state_hash,
    "high_visual_state_hash": high.authoritative_state_hash,
    "available_campaign_endings": campaign.available_ending_ids,
}
print(json.dumps(output, indent=2))
