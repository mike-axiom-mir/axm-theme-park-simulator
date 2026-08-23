import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("v0.4.6 interface contains every interactive journey anchor", () => {
  const html = read("../src/index.html");
  for (const id of [
    "campaign-button", "sandbox-button", "mode-button", "remove-path-button",
    "progression", "inspector", "day-report-dialog", "next-day-button",
    "quality-select", "save-slots", "touch-controls", "fullscreen-button",
    "opening-sequence", "skip-opening", "replay-opening-button", "staff-summary", "guest-pulse"
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  }
  assert.match(html, /Playable foundation · v0\.4\.6/);
});

test("production page is offline-local and points to the bundled client", () => {
  const html = read("../dist/index.html");
  assert.match(html, /src="\.\/game\.js"/);
  assert.match(html, /href="\.\/styles\.css"/);
  assert.doesNotMatch(html, /https?:\/\//);
  const bundle = read("../dist/game.js");
  assert.match(bundle, /0\.4\.6/);
  assert.match(bundle, /__AXM_GAME__/);
});

test("the pinned 3D runtime is vendored with its license", () => {
  const module = read("../vendor/three.module.min.js");
  const core = read("../vendor/three.core.min.js");
  const license = read("../vendor/THREE-LICENSE.txt");
  assert.match(module, /three\.core\.min\.js/);
  assert.ok(core.length > 300000);
  assert.match(license, /MIT License/);
});
