# Public capability discovery

This lane makes the existing headless Theme Park package discoverable without
turning discovery into installation, execution, release, merge, or CANON
authority.

## Dependency

The discovery contract is intentionally stacked on Theme Park PR #5 at exact
head `e30b0859b3d570b67d10c10eb1bed1e2441eb612`. That prerequisite creates the
real offline package, ESM export, installed CLI, and `axmCapability` descriptor.
This lane does not recreate those files.

## Contract

`.axm/discovery-public.json` is an explicit public-safe opt-in for Discovery
Buddy. `registry/capabilities.jsonl` contains exactly one curated declaration,
derived from the package-local descriptor rather than hand-maintained as a
second source of truth.

`tools/generate-public-capability.mjs` fails closed if the source descriptor
changes the capability id/status, widens the runtime to require network access,
drops the private-package publication guard, changes the Apache-2.0 license, or
grants canonical/write authority beyond the bounded CLI contract. It also
rejects source symlinks and seals exact Git blob identities into
`registry/capabilities.receipt.json`.

Regenerate deliberately:

```text
node tools/generate-public-capability.mjs --write
node tools/generate-public-capability.mjs --check
node --test intake-tests/public-capability-discovery.test.js
```

## Provenance

The explicit opt-in + generated JSONL + pinned consumer-smoke pattern follows
the public discovery contract already proven between
`mike-axiom-mir/axm-discovery-buddy` and `mike-axiom-mir/axm-ignition-fabric`.
The implementation here is repository-local and is derived from Theme Park's
own `package.json` / `runtime/package-metadata.js` contract; no Ignition runtime
implementation is copied or required.

CI pins Discovery Buddy at
`1a94fc2481d1cfc9234dea7c86af4777126d3924` and proves that the real public
scanner consumes exactly this declaration.

## Truth boundary

The public record means the package descriptor and declared source bytes exist
and match this generated evidence. It does not prove arbitrary-consumer
compatibility, safe behavior for untrusted inputs, Windows/macOS behavior,
browser rendering, release readiness, authorship, merge approval, or CANON.
Discovery remains evidence for a later explicit consumer decision.
