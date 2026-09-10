# Canonical Event Cursor and Retained History

## Decision

The playable park keeps at most 400 recent event records in `eventLog`. That array is a retained history window, not the authority that assigns event identity.

`eventStream.lastSequence` is now the canonical monotonic cursor. Emitting an event advances that cursor first, assigns the resulting sequence, then trims only old records. Trimming a projection therefore cannot cause a sequence to be reused.

## Contract

`eventStream` uses schema `axm.theme-park.event-stream/v1` and records:

- `lastSequence`: the latest assigned event sequence;
- `retainedLimit`: the fixed 400-record local memory boundary;
- `continuity`: whether identity is continuous or a legacy ambiguity was preserved.

The headless admission boundary rejects unsupported schemas, cursor drift, changed retention policy, oversized windows, backwards sequences and undeclared duplicates. A stream marked `continuous` must carry the exact contiguous retained suffix ending at `lastSequence`; an empty retained log is valid only at cursor zero. This prevents a re-sealed state from hiding a missing event inside a window while still claiming continuous history. Headless summaries expose the cursor, retained range and the sequence floor before the current window.

## Migration

Existing v1/v2/v3 save envelopes remain accepted. Saves without `eventStream` derive a cursor floor from the greatest retained sequence. Strictly increasing legacy windows are labelled `legacy_retained_window` and may contain gaps because discarded older history cannot be reconstructed. Existing duplicate identities are preserved byte-for-meaning and labelled `legacy_sequence_ambiguity`; the runtime does not renumber history, and the next event receives a new sequence above the retained maximum.

## Boundary

This makes future event identity restart-safe across retained-window trimming. It does not turn the 400-record window into a complete audit ledger, reconstruct events already discarded by old builds, authenticate save authors, or rewrite ambiguous legacy records.
