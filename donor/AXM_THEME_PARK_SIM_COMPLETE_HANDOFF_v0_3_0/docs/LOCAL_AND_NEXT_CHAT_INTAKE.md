# Local and Next-Chat Intake

## Local intake

1. Unzip the package without flattening folders.
2. Run `python scripts/verify_package.py`.
3. Read `START_HERE.txt` and `FOUNDATION_ROOTS.md`.
4. Import the project as a versioned foundation, not as loose inspiration.
5. Preserve `legacy/` and `backups/`.
6. Select one branch manifest under `manifests/`.
7. Build inside a new versioned folder or branch.
8. Do not mutate foundation-owned entities from a domain module.
9. Return tests and an Action Report.

Use `prompts/LOCAL_AGENT_INTAKE_PROMPT.txt` as a copy-paste instruction.

## Next Chat intake

Attach the complete ZIP and paste:

`prompts/NEXT_CHAT_MASTER_PROMPT.txt`

Then name the desired branch.

The next chat should first report:

- package version detected;
- verifier result;
- roots read;
- branch selected;
- files it expects to change;
- files it will treat as read-only.

It should not begin by redesigning the project.

## Missing-file behavior

When an attached environment cannot access a file, it must name the missing file
and continue only with clearly labelled partial context. It must not invent
content or claim a successful intake.

## Merge behavior

A branch may propose a canonical change only through:

- `contracts/CHANGE_REQUEST.schema.json`;
- before/after root hashes;
- reason and evidence;
- rollback plan;
- explicit approval status.

Until approved, the proposal remains outside canon.
