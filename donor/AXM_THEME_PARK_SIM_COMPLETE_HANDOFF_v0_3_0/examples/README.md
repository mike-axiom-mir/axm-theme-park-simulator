# Examples

- `run_reference_demo.py` exercises the protected evaluators, world, identity,
  campaign, presentation, and event-history concepts.
- `run_runtime_integration_demo.py` exercises scheduler, manifest assembly,
  action gate, namespace state, fork behavior, event log, and provenance.
- `run_living_park_reference.py` connects a 22-year-old attraction to conserved
  first/repeat visitors, revenue attribution, animation signals, snapshots, and
  counterfactual review—without age-based popularity decay.
- `run_first_map_reference_slice.py` adds a full acceptance matrix and explicit
  implemented/reference/placeholder report. It intentionally remains not-ready.
- `VALID_REFERENCE_RETURN_PACKET.json` is a machine-valid return-packet example.
- `BRANCH_RETURN_PACKET_TEMPLATE.json` is intentionally incomplete and must be edited.
- `FIRST_MAP_ACCEPTANCE_TEMPLATE.json` starts with every check `not_run`, so it
  cannot falsely report readiness.

Run every reference twice and compare output:

```bash
python scripts/run_reference_suite.py
```

Useful validators:

```bash
python scripts/validate_runtime_assembly.py
python scripts/validate_system_plan.py
python scripts/validate_return_packet.py examples/VALID_REFERENCE_RETURN_PACKET.json
python scripts/check_first_map_acceptance.py examples/FIRST_MAP_ACCEPTANCE_TEMPLATE.json
```

The final acceptance command is expected to exit non-zero until an actual first
map has real evidence for every required check.
