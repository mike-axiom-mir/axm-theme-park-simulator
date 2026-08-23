# Implementation Map

| Organ | Contract | Reference code | Production domain |
|---|---|---|---|
| Events/replay | EVENT.schema.json | event_log.py | runtime |
| Clock/calendar | CLOCK_STATE.schema.json | clock.py | runtime |
| Environment | ENVIRONMENT_FRAME.schema.json | environment.py | weather/domain effects |
| Evidence | EVIDENCE_CLAIM.schema.json | evidence.py | all domains |
| Identity | PARK_IDENTITY.schema.json | identity.py | park ecology/UI |
| Lifecycle | LIFECYCLE_ASSESSMENT.schema.json | lifecycle.py | rides/assets/economy |
| Campaign endings | CAMPAIGN_*.schema.json | campaign.py | campaign authoring |
| Inspection | INSPECTION_OBSERVATION.schema.json | inspection.py | adventure mode |
| Guidance | ASSISTANCE_PROFILE.schema.json | guidance.py | UI/accessibility |
| Fidelity | VISUAL_FIDELITY_PROFILE.schema.json | fidelity.py | renderer/animation |
| Snapshots/saves | STATE_SNAPSHOT + SAVE | saves.py | persistence |
| Migrations | MIGRATION_MANIFEST.schema.json | saves.py | persistence/intake |
| Merge | CHANGE_REQUEST.schema.json | merge_gate.py | integration governance |
