# Portable headless consumer

The active v0.4.6 simulation is available as a dependency-free Node.js library
and command package. This exposes the authoritative park body without requiring
the WebGL client, browser globals, network access, or repository-relative
imports.

## Build and install locally

From a verified source checkout:

```bash
npm pack --ignore-scripts
```

Move the resulting tarball to a consumer directory or machine, then install it
without registry access:

```bash
npm install --offline /path/to/axm-theme-park-simulator-local-0.4.6-intake.1.tgz
axm-theme-park-headless describe
axm-theme-park-headless new park.json local-seed sandbox "Local Park"
```

The command also supports `inspect`, `step`, and `action`; run
`axm-theme-park-headless --help` for the exact arguments. Writes use new files
only and refuse to overwrite an existing save.

A new save is staged into a uniquely named sibling file, flushed with `fsync`,
and only then published by a create-only hard link to the requested path. An
interrupted staging write therefore cannot expose partial bytes at the final
save path. If the filesystem cannot provide that hard-link primitive, the write
fails closed rather than falling back to direct final-path mutation. This is a
single-host filesystem publication boundary, not a claim of directory-entry
power-loss durability or protection from a hostile process running with the
same OS-user filesystem authority.

Headless save reads also fail closed before semantic save admission when the
final path is already a symbolic link, the admitted path no longer identifies
the file descriptor that was opened, the file exceeds the 64 MiB bound, the
opened file changes observably while its bytes are copied, or the copied bytes
are not valid UTF-8. The reader copies through the opened descriptor with one
extra byte of bounded growth detection instead of validating one path and then
reopening it by name. On platforms that expose `O_NOFOLLOW`, final-component
symlink replacement is additionally refused by the open itself.

That is a cooperating local-filesystem read boundary, not a sandbox or an
atomic filesystem snapshot. Symlinked ancestor directories are not rejected;
a hostile same-user writer can still attempt in-place mutation, and the
size/mtime/ctime checks do not claim to defeat an attacker able to rewrite
bytes while restoring every observed metadata value. UTF-8 admission also does
not make save JSON authentic, unique-keyed, or semantically valid; those are
separate layers.

The CLI `action` command applies a separate, tighter action-file boundary before
simulation semantics see the request. Action files are capped at 1 MiB, must be
regular non-symlink final paths, are copied through one admitted descriptor with
the same identity/stability checks, and must decode as valid UTF-8. Native
`JSON.parse` remains the syntax and value decoder, while an additional recursive
walk rejects duplicate decoded object-member names (including escaped-equivalent
spellings) before the parsed action is admitted. JSON nesting beyond 256 levels
is held rather than risking an unbounded verifier call stack. Refusals expose
stable `AXM_ACTION_*` codes through the command's stderr.

This action boundary is still not a filesystem sandbox, hostile-writer proof,
authentication mechanism, or semantic proof that an otherwise unique-keyed JSON
action is allowed. Symlinked ancestor directories remain outside the check, and
the descriptor metadata observations are best-effort race detection rather than
an atomic filesystem snapshot. The simulator's existing `apply()` contract
remains the authority for which admitted action objects are legal.

Save envelopes now pass through the same pure-JavaScript unambiguous JSON parser
before version, state-hash, migration, or simulation admission. Duplicate decoded
member names—including escaped-equivalent spellings—and nesting beyond 256
levels are held with stable `AXM_SAVE_*` error identities. The parser is exported
as `parseUnambiguousJson()` for deterministic local consumers; it performs no
network or AI work and grants no authority. State hashes continue to bind
canonical park state, not authorship, trust, or the derived `savedAt` field.

## Library boundary

```js
import {
  HeadlessSimulator,
  describeCapability,
  readSave,
  validateState,
  writeNewSave
} from "axm-theme-park-simulator-local";

const simulator = HeadlessSimulator.create({
  seed: "local-seed",
  mode: "sandbox",
  parkName: "Local Park"
});

simulator.advance(60);
console.log(simulator.summary());
console.log(describeCapability());
```

The packed boundary contains only the Node adapter, deterministic simulation
core, licensing, provenance, package metadata, and this guide. Browser assets,
preserved donor material, tests, and Python sources are excluded.

The package remains `private` to block accidental registry publication. Local
tarball consumption is the supported handoff in this review lane. The
capability metadata reports `canonical: false`; installation does not merge,
promote, or grant CANON authority.
