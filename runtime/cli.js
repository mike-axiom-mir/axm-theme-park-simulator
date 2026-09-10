#!/usr/bin/env node
import path from "node:path";
import { readActionFile } from "./action-file-reader.js";
import { HeadlessSimulator } from "./headless-simulator.js";
import { readSave, writeNewSave } from "./file-save-store.js";
import { describeCapability } from "./package-metadata.js";

function usage() {
  return [
    "Theme Park v0.4.6 headless runtime",
    "",
    "Commands:",
    "  describe",
    "  new <output.json> [seed] [campaign|sandbox] [park name]",
    "  inspect <input.json>",
    "  step <input.json> <output.json> <minutes>",
    "  action <input.json> <output.json> <action.json>"
  ].join("\n");
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function requireArg(value, label) {
  if (!value) throw new Error(`Missing ${label}.\n\n${usage()}`);
  return value;
}

function main(argv) {
  const [command, ...args] = argv;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  if (command === "describe") {
    print({ command, capability: describeCapability() });
    return;
  }

  if (command === "new") {
    const output = requireArg(args[0], "output path");
    const seed = args[1] ?? "AXM-LOCAL-PARK-001";
    const mode = args[2] ?? "campaign";
    if (!new Set(["campaign", "sandbox"]).has(mode)) throw new Error(`Unknown mode: ${mode}`);
    const parkName = args.slice(3).join(" ") || "Moonroot Park";
    const simulator = HeadlessSimulator.create({ seed, mode, parkName });
    const savedTo = writeNewSave(output, simulator.serialize());
    print({ command, savedTo, ...simulator.summary() });
    return;
  }

  if (command === "inspect") {
    const input = requireArg(args[0], "input path");
    print({ command, source: path.resolve(input), ...HeadlessSimulator.fromSerialized(readSave(input)).summary() });
    return;
  }

  if (command === "step") {
    const input = requireArg(args[0], "input path");
    const output = requireArg(args[1], "output path");
    const minutes = Number(requireArg(args[2], "minute count"));
    const simulator = HeadlessSimulator.fromSerialized(readSave(input));
    simulator.advance(minutes);
    const savedTo = writeNewSave(output, simulator.serialize());
    print({ command, source: path.resolve(input), savedTo, ...simulator.summary() });
    return;
  }

  if (command === "action") {
    const input = requireArg(args[0], "input path");
    const output = requireArg(args[1], "output path");
    const actionPath = requireArg(args[2], "action JSON path");
    const simulator = HeadlessSimulator.fromSerialized(readSave(input));
    const result = simulator.apply(readActionFile(actionPath));
    if (!result.ok) throw new Error(`Simulation refused action: ${result.reason ?? "unspecified reason"}`);
    const savedTo = writeNewSave(output, simulator.serialize());
    print({ command, source: path.resolve(input), savedTo, result, ...simulator.summary() });
    return;
  }

  throw new Error(`Unknown command: ${command}\n\n${usage()}`);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  const code = typeof error?.code === "string" ? ` [${error.code}]` : "";
  process.stderr.write(`Theme Park headless runtime refused${code}: ${error.message}\n`);
  process.exitCode = 1;
}
