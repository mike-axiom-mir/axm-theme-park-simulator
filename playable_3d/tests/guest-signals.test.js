import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  GUEST_SIGNAL_LIMITS, deriveGuestSignalPlan, guestPulseSummary, guestSignalFor
} from "../src/presentation/guestSignals.js";

const visitor = (id, overrides = {}) => ({
  id, state: "idle", toilet: 0, thirst: 0, hunger: 0, energy: 1,
  activityRemaining: 0, patience: 48, ...overrides
});
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("pixel guest-signal plans are deterministic, non-authoritative, and quality bounded", () => {
  const visitors = Array.from({ length: 28 }, (_, index) => visitor(`visitor-${index + 1}`, { toilet: 0.8 + index / 1000 }));
  const before = structuredClone(visitors);
  const crisp = deriveGuestSignalPlan(visitors, "crisp");
  const retro = deriveGuestSignalPlan(visitors, "retro");
  const tiny = deriveGuestSignalPlan(visitors, "tiny");
  assert.deepEqual([crisp.length, retro.length, tiny.length], [18, 12, 6]);
  assert.deepEqual(GUEST_SIGNAL_LIMITS, { crisp: 18, retro: 12, tiny: 6 });
  assert.deepEqual(deriveGuestSignalPlan(visitors, "retro"), retro);
  assert.deepEqual(visitors, before);
  assert.ok(Object.isFrozen(retro));
});

test("Guest Pulse reflects live needs with comfort taking urgent priority", () => {
  const visitors = [
    visitor("comfort", { toilet: 0.91, thirst: 0.95 }),
    visitor("drink", { thirst: 0.88 }),
    visitor("snack", { hunger: 0.8 }),
    visitor("rest", { energy: 0.2 }),
    visitor("seated", { state: "resting", energy: 0.8 }),
    visitor("wait", { state: "queueing", activityRemaining: 40, patience: 44 }),
    visitor("calm")
  ];
  assert.equal(guestSignalFor(visitors[0]).type, "comfort");
  assert.deepEqual(guestPulseSummary(visitors), {
    comfort: 1, drink: 1, snack: 1, rest: 2, wait: 1, active: 6, total: 7
  });
});

test("pixel signals, seated poses, and Guest Pulse stay wired to presentation layers", () => {
  const models = read("../src/render/models.js");
  const renderer = read("../src/render/worldRenderer.js");
  const ui = read("../src/ui/interface.js");
  const html = read("../src/index.html");
  assert.match(models, /animated-pixel-guest-status-signal/);
  assert.match(models, /pose === "resting"/);
  assert.match(renderer, /deriveGuestSignalPlan/);
  assert.match(renderer, /qualityProfile/);
  assert.match(renderer, /visitor\.state === "resting"/);
  assert.match(ui, /guestPulseSummary/);
  assert.match(html, /Guest Pulse/);
  assert.doesNotMatch(models, /todayBenchRests\s*=/);
  assert.doesNotMatch(renderer, /visitor\.energy\s*=/);
});
