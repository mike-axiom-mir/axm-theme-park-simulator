# Technical Start for Local Use

## What is Python here?

The `src/park_foundation` folder is a small reference implementation. It proves
how the rules can work. It does not require a server or internet connection.

## Check the package

Open a terminal inside the unpacked folder and run:

```bash
python scripts/verify_package.py
```

A successful result ends with:

```text
FINAL: PASS
```

## Run the example

```bash
python examples/run_reference_demo.py
```

This prints reference calculations for tourists, locals, an old ride, park
attendance, identity, campaigns, time/weather, and replay.

## Continue a branch

Choose a manifest in `manifests/`, then use the matching prompt in `prompts/`.

A module should create its own folder rather than putting every game system into
`park_foundation`.

## Do not worry about packaging yet

`pyproject.toml` makes later installation possible, but direct test/demo commands
work without installing anything.
