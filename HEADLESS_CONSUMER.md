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
