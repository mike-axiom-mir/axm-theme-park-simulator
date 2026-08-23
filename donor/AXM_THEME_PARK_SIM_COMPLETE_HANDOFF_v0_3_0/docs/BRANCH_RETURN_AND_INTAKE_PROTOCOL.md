# Branch Return and Intake Protocol

A completed branch must return one packet containing:

- module manifest;
- system specifications;
- owned state namespaces;
- action and event contracts;
- evidence/metric outputs;
- tests and exact pass/fail counts;
- artifact paths, byte sizes, and SHA-256 hashes;
- implemented capabilities;
- reference-only capabilities;
- placeholders;
- unresolved gaps;
- change request IDs when canonical behavior is affected.

Intake order:

1. Verify the canonical root hash.
2. Verify every artifact hash.
3. Validate the return packet.
4. Register the manifest.
5. Run runtime assembly validation with all current branches.
6. Run the complete regression suite.
7. Run deterministic replay twice.
8. Merge only after all blocking checks pass.

Never copy useful-looking code directly into the root before these checks.
