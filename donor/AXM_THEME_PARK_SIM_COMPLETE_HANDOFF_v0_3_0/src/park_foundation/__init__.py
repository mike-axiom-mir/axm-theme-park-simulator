"""AXM Theme Park deterministic foundation reference package v0.3.0."""

from .version import (
    __version__, FOUNDATION_CONTRACT_VERSION, SAVE_FORMAT_VERSION,
    RUNTIME_PROTOCOL_VERSION, CANONICAL_ROOT_HASH,
)
from .canonical import canonical_json, sha256_file, sha256_text, sha256_value, stable_seed
from .models import (
    DemandInputs, AtmosphereInputs, ContributionInputs, AttendanceBalanceInputs,
    StrategyInputs, ExplanationPacket, StrategyAssessment,
)
from .evaluator import (
    evaluate_reachable_demand, evaluate_atmosphere, evaluate_contribution,
    evaluate_active_attendance_balance, evaluate_strategy,
)
from .evidence import EvidenceRef, UncertainValue, evidence_confidence
from .world import (
    WorldClock, SeasonCalendar, OpeningWindow, OpeningSchedule,
    WeatherProfile, WeatherState, WeatherGenerator,
)
from .event_log import ParkEvent, EventRecord, DeterministicEventLog
from .registry import ModuleManifest, ModuleRegistry, FORBIDDEN_SHORTCUTS
from .identity import ParkIdentityIntent, evaluate_identity_alignment
from .campaign import Condition, OutcomePath, CampaignDefinition, CampaignState, CampaignEvaluator
from .observation import ObservationPacket
from .savegame import SaveManifest, MigrationPlan, SaveVerifier
from .merge_gate import ChangeRequest, MergeDecision, MergeGate
from .presentation import PresentationProfile, BEGINNER, STANDARD, ADVANCED, render_explanation
from .integrity import IntegrityReport, find_forbidden_shortcuts, validate_integrity
from .scheduler import PHASE_ORDER, PRESENTATION_PHASES, SystemSpec, TickPlan, DeterministicScheduler
from .state_store import (
    NamespaceSpec, NamespaceUpdate, StateSnapshot as NamespaceStateSnapshot,
    StateCommit, VersionedStateStore,
)
from .actions import ACTOR_KINDS, ActionProposal, ActionRule, ActionDecision, ActionRouter
from .provenance import DerivedMetricRecord, ProvenanceLedger
from .assembly import AssemblyReport, RuntimeAssemblyPlanner
from .return_packet import ReturnArtifact, BranchReturnPacket, ReturnPacketVerifier
from .acceptance import AcceptanceCheck, AcceptanceReport
from .kernel import (
    SimulationTransactionError, SimulationState, CommandEnvelope,
    EventIntent, CommandPlan, CommandResult, SimulationKernel,
)
from .snapshot import StateSnapshot, BranchLineage, StoredSnapshot, SnapshotStore
from .market import AudienceCohortState, CohortForces, CohortTransition, MarketStepResult, evolve_market_cohort
from .ledger import (
    BENEFIT_CHANNELS, COST_CHANNELS, KNOWN_CHANNELS,
    ContributionClaim, ContributionAudit, ContributionLedger,
)
from .cadence import (
    SimulationCadencePlan, AnimationSignal, derive_animation_signal,
    ResolutionDecision, PopulationResolutionPolicy,
)
from .counterfactual import (
    CounterfactualProjection, ProjectionReview,
    CounterfactualComparison, compare_counterfactuals,
)

__all__ = [name for name in globals() if not name.startswith("_")]
