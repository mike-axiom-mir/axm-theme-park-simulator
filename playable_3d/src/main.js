import { createNewGame, advanceOneMinute, applyAction } from "./core/simulation.js";
import { applyStaffDevelopmentAction } from "./core/staff.js";
import {
  deserializeGame, loadFromSlot, saveToSlot, serializeGame, slotMetadata
} from "./core/save.js";
import { stateHash } from "./core/random.js";
import { WorldRenderer } from "./render/expressiveWorldRenderer.js";
import { GameInterface } from "./ui/interface.js";
import { deriveOpeningSignal } from "./presentation/openingSequence.js";

const canvas = document.getElementById("game-canvas");
const visionButton = document.createElement("button");
visionButton.id = "vision-button";
visionButton.type = "button";
visionButton.textContent = "Vision · Off";
visionButton.title = "Park Vision: cycle Crowd flow, Queue pressure, Guest needs, and Operations (V)";
visionButton.setAttribute("aria-pressed", "false");
document.querySelector(".top-actions")?.prepend(visionButton);

let state = createNewGame();
let speed = 1;
let accumulator = 0;
let lastTime = performance.now();
let lastUiUpdate = 0;
let lastAutosave = performance.now();

const STAFF_DEVELOPMENT_ACTIONS = new Set(["trainStaff", "setStaffZone", "cycleStaffZone"]);

function guardedStorage(callback, fallback = null) {
  try { return callback(); } catch { return fallback; }
}

function act(action, { quiet = false } = {}) {
  const result = STAFF_DEVELOPMENT_ACTIONS.has(action?.type)
    ? applyStaffDevelopmentAction(state, action)
    : applyAction(state, action);
  if (!result.ok && !quiet) ui.toast(result.reason ?? "That action could not be completed.", "error");
  if (result.ok) {
    state.stateHash = stateHash(state);
    world.syncWorld();
    ui.render(state);
    if (result.message && !quiet) ui.toast(result.message, "good");
  }
  return result;
}

function replaceState(nextState) {
  state = nextState;
  speed = state.operations?.dayReport ? 0 : 1;
  accumulator = 0;
  ui.resetTransientState();
  world.setState(state);
  ui.render(state);
  ui.setSpeed(speed);
  ui.closeInspector();
}

function slotInfo() {
  return Object.fromEntries([1, 2, 3].map((slot) => [slot, guardedStorage(() => slotMetadata(slot))]));
}

function autosave() {
  guardedStorage(() => saveToSlot(state, 0));
}

async function playOpening({ resumeSpeed = 1 } = {}) {
  const openingState = state;
  state.stateHash = stateHash(state);
  speed = 0;
  accumulator = 0;
  ui.setSpeed(0);
  const signal = deriveOpeningSignal(state);
  world.startOpeningCamera(signal);
  try {
    await ui.playOpeningSequence(signal);
  } finally {
    world.finishOpeningCamera();
  }
  if (state !== openingState) return;
  speed = state.operations?.dayReport ? 0 : resumeSpeed;
  ui.setSpeed(speed);
}

const world = new WorldRenderer(canvas, {
  onBuild: (payload) => {
    const result = act({ type: "build", ...payload });
    if (result.ok) world.updateGhost();
  },
  onRemovePath: (payload) => act({ type: "removePath", ...payload }),
  onSelectEntity: (entityId) => ui.openInspector(entityId),
  onSelectVisitor: (visitorId) => ui.openVisitorInspector(visitorId),
  onSelectStaff: (staffId) => ui.openStaffInspector(staffId),
  onStaffDevelopment: (action) => act(action),
  onCloseInspector: () => world.selectEntity(null),
  onBuildRotation: (rotation) => ui.toast(`Build rotation ${rotation * 90}°`, "info"),
  onCancelBuild: () => ui.cancelBuild(),
  onHoverBuild: (payload) => ui.showBuildHint(payload),
  onHoverRemove: (payload) => ui.showRemoveHint(payload),
  onModeChanged: (mode) => ui.setMode(mode),
  onWorldMessage: (message) => ui.toast(message, "info"),
  onInspectFromWorld: (entityId) => act({ type: "inspect", entityId }, { quiet: true }),
  onCollectDiscovery: (stampId) => act({ type: "collectStamp", stampId }),
  onControllerChanged: (connected) => ui.controllerChanged(connected),
  onToggleMode: () => ui.toggleMode()
});

const ui = new GameInterface({
  onNewGame: (mode) => {
    replaceState(createNewGame({ seed: `AXM-PARK-${Date.now()}`, mode }));
    ui.dismissStart();
    autosave();
    void playOpening({ resumeSpeed: 1 });
  },
  onContinue: () => {
    const saved = guardedStorage(() => loadFromSlot(0));
    if (!saved) return ui.toast("No valid autosave was found.", "error");
    replaceState(saved);
    ui.dismissStart();
  },
  onMode: (mode) => {
    if (world.mode === "ride") world.stopRideExperience();
    else {
      if (mode !== "manage") ui.cancelBuild();
      world.setMode(mode);
    }
  },
  onSpeed: (value) => { speed = value; ui.setSpeed(value); },
  onBuildTool: (catalogId) => world.setBuildTool(catalogId),
  onRemovePathTool: (active) => world.setRemovePathTool(active),
  onCancelBuild: () => world.clearBuildTool(),
  onAction: (action) => act(action),
  onRide: (entityId) => {
    act({ type: "inspect", entityId, note: "Player entered the live ride camera." }, { quiet: true });
    if (!world.startRideExperience(entityId)) ui.toast("This element has no ride camera yet.", "warning");
  },
  onFocusEntity: (entityId) => world.focusEntity(entityId),
  onQuality: (profile) => {
    world.setQuality(profile);
    guardedStorage(() => localStorage.setItem("axm-theme-park-v046-quality", profile));
  },
  onRefreshSlots: () => ui.renderSaveSlots(slotInfo()),
  onSave: (slot) => {
    const ok = guardedStorage(() => { saveToSlot(state, slot); return true; }, false);
    if (ok) { ui.toast(`Saved World ${slot}.`, "good"); ui.renderSaveSlots(slotInfo()); }
    else ui.toast("The browser refused local save access.", "error");
  },
  onLoad: (slot) => {
    const saved = guardedStorage(() => loadFromSlot(slot));
    if (!saved) return ui.toast(`World ${slot} could not be verified.`, "error");
    replaceState(saved);
    ui.toast(`Loaded World ${slot}.`, "good");
  },
  onExport: () => {
    const blob = new Blob([serializeGame(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${state.park.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-day-${state.clock.day}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  onImport: (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        replaceState(deserializeGame(String(reader.result)));
        ui.toast("Imported and verified the park save.", "good");
      } catch (error) {
        ui.toast(error.message, "error");
      }
    };
    reader.readAsText(file);
  },
  onNextDay: () => {
    const result = act({ type: "startNextDay" });
    if (!result.ok) return;
    if (document.getElementById("day-report-dialog").open) document.getElementById("day-report-dialog").close();
    speed = 1;
    ui.setSpeed(1);
    autosave();
  },
  onReplayOpening: () => void playOpening({ resumeSpeed: speed }),
  onVirtualControl: (code, active) => world.setVirtualControl(code, active),
  onTouchInteract: () => world.interactNearby()
});

function renderParkVisionStatus(status, { announce = false } = {}) {
  visionButton.textContent = `Vision · ${status.label}`;
  visionButton.classList.toggle("primary", status.active);
  visionButton.setAttribute("aria-pressed", status.active ? "true" : "false");
  visionButton.title = status.active
    ? `Park Vision: ${status.label} · ${status.markerCount} live markers · press V to cycle`
    : "Park Vision: cycle Crowd flow, Queue pressure, Guest needs, and Operations (V)";
  if (announce) ui.toast(`Park Vision · ${status.label}${status.active ? ` · ${status.markerCount} live markers` : ""}`, "info");
}

function cycleParkVision({ announce = true } = {}) {
  const status = world.cycleParkVision();
  renderParkVisionStatus(status, { announce });
  return status;
}

visionButton.addEventListener("click", () => cycleParkVision());
addEventListener("keydown", (event) => {
  if (event.code !== "KeyV" || world.mode !== "manage") return;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
  cycleParkVision();
});

world.setState(state);
ui.render(state);
ui.setContinueAvailable(Boolean(guardedStorage(() => slotMetadata(0))));
ui.setMode("manage");
renderParkVisionStatus(world.getParkVisionStatus());
const savedQuality = guardedStorage(() => localStorage.getItem("axm-theme-park-v046-quality")
  ?? localStorage.getItem("axm-theme-park-v045-quality")
  ?? localStorage.getItem("axm-theme-park-v044-quality")
  ?? localStorage.getItem("axm-theme-park-v043-quality")
  ?? localStorage.getItem("axm-theme-park-v042-quality")
  ?? localStorage.getItem("axm-theme-park-v041-quality")
  ?? localStorage.getItem("axm-theme-park-v040-quality"));
if (["retro", "crisp", "tiny"].includes(savedQuality)) {
  document.getElementById("quality-select").value = savedQuality;
  world.setQuality(savedQuality);
}

globalThis.__AXM_GAME__ = Object.freeze({
  version: "0.4.6",
  getState: () => structuredClone(state),
  getMode: () => world.mode,
  health: () => ({
    running: true,
    day: state.clock.day,
    minute: state.clock.minute,
    visitors: state.visitors.length,
    staff: state.staffAgents?.length ?? 0,
    litterPiles: state.world.litter?.length ?? 0,
    crewJobsToday: (state.operations.todayCleanups ?? 0) + (state.operations.todayRepairs ?? 0),
    benchRestsToday: state.operations.todayBenchRests ?? 0,
    opening: ui.openingActive,
    visuals: world.getVisualHealth()
  })
});

function gameLoop(now) {
  const delta = Math.min(1000, now - lastTime);
  lastTime = now;
  if (speed > 0) {
    accumulator += delta * speed;
    const millisecondsPerMinute = 620;
    let safety = 0;
    while (accumulator >= millisecondsPerMinute && safety++ < 40) {
      advanceOneMinute(state);
      accumulator -= millisecondsPerMinute;
      if (state.operations?.dayReport) {
        speed = 0;
        accumulator = 0;
        ui.setSpeed(0);
        break;
      }
    }
  }
  if (now - lastUiUpdate > 250) {
    ui.render(state);
    if (world.getParkVisionStatus().active) renderParkVisionStatus(world.getParkVisionStatus());
    lastUiUpdate = now;
  }
  if (now - lastAutosave > 45000) {
    autosave();
    lastAutosave = now;
  }
  requestAnimationFrame(gameLoop);
}

addEventListener("pagehide", autosave);
addEventListener("visibilitychange", () => {
  if (document.hidden && speed > 0) {
    speed = 0;
    ui.setSpeed(0);
    autosave();
  }
});
addEventListener("error", (event) => {
  const panel = document.getElementById("fatal-error");
  panel.textContent = `The 3D client stopped safely. Your last autosave remains available.\n\n${event.message}`;
  panel.classList.remove("hidden");
});
addEventListener("unhandledrejection", (event) => {
  const panel = document.getElementById("fatal-error");
  panel.textContent = `The 3D client stopped safely. Your last autosave remains available.\n\n${event.reason?.message ?? event.reason}`;
  panel.classList.remove("hidden");
});

requestAnimationFrame(gameLoop);