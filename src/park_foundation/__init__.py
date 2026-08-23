"""AXM Theme Park deterministic foundation v0.2.0 reference package."""

from .models import (
    DemandInputs, AtmosphereInputs, ContributionInputs, ExpectationInputs,
    AttendanceInputs, ExplanationPacket,
)
from .evaluator import (
    evaluate_reachable_demand, evaluate_atmosphere, evaluate_contribution,
    evaluate_expectation_delivery, evaluate_attendance_balance,
)
from .clock import ClockConfig, TimePosition, DeterministicClock
from .environment import EnvironmentFrame, EnvironmentTimeline, reference_environment_frame
from .evidence import EvidenceClaim, EvidenceLedger
from .identity import ParkIdentityIntent, IdentityAlignmentPacket, evaluate_identity_alignment
from .lifecycle import (
    LifecycleEvidence, OptionAssessment, LifecycleDecisionPacket,
    evaluate_lifecycle_options,
)
from .campaign import CampaignEnding, CampaignState, CampaignOutcome, evaluate_campaign_endings
from .inspection import InspectionObservation, verify_observation_state
from .guidance import AssistanceProfile, GuidanceCard, render_guidance
from .fidelity import VisualFidelityProfile, PresentationPacket, adapt_presentation
from .event_log import ParkEvent, DeterministicEventLog
from .registry import ModuleManifest, ModuleRegistry
from .saves import (
    StateSnapshot, SaveManifest, SnapshotStore, MigrationStep, MigrationRegistry,
)
from .merge_gate import ChangeRequest, MergeDecision, MergeGate
from .util import canonical_json, stable_hash, stable_seed

__all__ = [name for name in globals() if not name.startswith("_")]
