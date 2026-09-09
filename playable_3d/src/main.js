import { createNewGame, advanceOneMinute, applyAction } from "./core/simulation.js";
import {
  deserializeGame, loadFromSlot, saveToSlot, serializeGame, slotMetadata
} from "./core/save.js";
import { stateHash } from "./core/random.js";
import { WorldRenderer } from "./render/worldRenderer.js";
import { GameInterface } from "./ui/interface.js";
import { deriveOpeningSignal } from "./presentation/openingSequence.js";

const canvas = document.getElementById("game-canvas");
let state = createNewGame();
let speed = 1;
let accumulator = 0;
let lastTime = performance.now();
let lastUiUpdate = 0;
let lastAutosave = performance.now();
const importFeedback = createSaveImportFeedback();

function createSaveImportFeedback() {
  const menu = document.getElementById("menu-dialog");
  const card = menu?.querySelector(".modal-card");
  const actions = card?.querySelector(".modal-actions");
  const input = document.getElementById("import-input");
  if (!card || !actions || !input) return null;

  const style = document.createElement("style");
  style.textContent = `
    #save-import-status {
      margin: 18px 0 4px;
      padding: 14px 16px;
      border: 1px solid rgba(255,255,255,.18);
      border-radius: 14px;
      background: rgba(8,12,18,.86);
      box-shadow: inset 0 1px rgba(255,255,255,.05);
    }
    #save-import-status[data-tone="checking"] { border-color: rgba(123,205,255,.55); }
    #save-import-status[data-tone="held"] { border-color: rgba(255,184,92,.72); }
    #save-import-status .save-import-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
    }
    #save-import-status .save-import-kicker {
      font-size: .72rem;
      font-weight: 800;
      letter-spacing: .12em;
      text-transform: uppercase;
      opacity: .72;
    }
    #save-import-status .save-import-code {
      font: 700 .72rem/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      opacity: .7;
      overflow-wrap: anywhere;
    }
    #save-import-status strong {
      display: block;
      margin-top: 5px;
      font-size: 1rem;
    }
    #save-import-status p {
      margin: 7px 0 0;
      max-width: 72ch;
      line-height: 1.45;
      opacity: .86;
    }
    #save-import-status .save-import-next {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }
    #save-import-status .save-import-next button { min-height: 38px; }
    @media (max-width: 620px) {
      #save-import-status .save-import-head { align-items: flex-start; flex-direction: column; gap: 4px; }
      #save-import-status .save-import-next button { flex: 1 1 100%; }
    }
    @media (prefers-reduced-motion: reduce) {
      #save-import-status, #save-import-status * { scroll-behavior: auto !important; transition: none !important; }
    }
    @media (prefers-contrast: more) {
      #save-import-status { border-width: 2px; background: #080c12; }
    }
  `;
  document.head.appendChild(style);

  const panel = document.createElement("section");
  panel.id = "save-import-status";
  panel.className = "hidden";
  panel.tabIndex = -1;
  panel.setAttribute("role", "status");
  panel.setAttribute("aria-live", "polite");
  panel.innerHTML = `
    <div class="save-import-head">
      <span class="save-import-kicker">Local save admission</span>
      <span class="save-import-code" data-save-import-code></span>
    </div>
    <strong data-save-import-title></strong>
    <p data-save-import-body></p>
    <div class="save-import-next">
      <button type="button" data-save-import-choose>Choose another save</button>
      <button type="button" data-save-import-dismiss>Keep current park</button>
    </div>
  `;
  card.insertBefore(panel, actions);

  const code = panel.querySelector("[data-save-import-code]");
  const title = panel.querySelector("[data-save-import-title]");
  const body = panel.querySelector("[data-save-import-body]");
  const choose = panel.querySelector("[data-save-import-choose]");
  const dismiss = panel.querySelector("[data-save-import-dismiss]");

  function show({ tone, statusCode = "", heading, detail, actionsVisible = true }) {
    panel.dataset.tone = tone;
    code.textContent = statusCode;
    title.textContent = heading;
    body.textContent = detail;
    choose.classList.toggle("hidden", !actionsVisible);
    dismiss.classList.toggle("hidden", !actionsVisible);
    panel.classList.remove("hidden");
  }

  choose.addEventListener("click", () => input.click());
  dismiss.addEventListener("click", () => panel.classList.add("hidden"));

  return Object.freeze({
    checking(file) {
      show({
        tone: "checking",
        statusCode: "CHECKING",
        heading: `Checking ${file.name || "selected save"}…`,
        detail: "Your current park stays open until the selected file passes local save admission.",
        actionsVisible: false
      });
    },
    clear() {
      panel.classList.add("hidden");
      input.value = "";
    },
    hold(error) {
      const errorCode = typeof error?.code === "string" ? error.code : "AXM_SAVE_IMPORT_FAILED";
      const copy = {
        AXM_SAVE_INTEGRITY_REQUIRED: {
          heading: "Save held · integrity evidence missing",
          detail: "This current-version save does not carry the required state hash. Your open park was not replaced. Choose another save or keep playing this park."
        },
        AXM_SAVE_HASH_MISMATCH: {
          heading: "Save held · integrity check failed",
          detail: "The save's recorded state hash does not match its state. Your open park was not replaced. Choose another save or keep playing this park."
        },
        AXM_SAVE_READ_FAILED: {
          heading: "Save held · file could not be read",
          detail: "The browser could not read the selected local file. Your open park was not replaced. Choose another save or keep playing this park."
        }
      }[errorCode] ?? {
        heading: "Save held · file was not admitted",
        detail: `${error?.message || "The selected file is not a valid Theme Park save."} Your open park was not replaced. Choose another save or keep playing this park.`
      };
      show({ tone: "held", statusCode: errorCode, heading: copy.heading, detail: copy.detail });
      input.value = "";
      panel.scrollIntoView({ block: "nearest", inline: "nearest" });
      panel.scrollIntoView({ block: "nearest", inline: "nearest" });
      panel.focus({ preventScroll: true });
    }
  });
}

function guardedStorage(callback, fallback = null) {
  try { return callback(); } catch { return fallback; }
}

function act(action, { quiet = false } = {}) {
  const result = applyAction(state, action);
  if (!result.ok && !quiet) ui.toast(result.reason ?? "That action could not be completed.", "error");
  if (result.ok) {
    state.stateHash = stateHash(state);
    world.syncWorld();
    ui.render(state);
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
    importFeedback?.checking(file);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = deserializeGame(String(reader.result));
        importFeedback?.clear();
        replaceState(imported);
        ui.toast("Imported and verified the park save.", "good");
      } catch (error) {
        importFeedback?.hold(error);
        ui.toast("Save held. Your open park is unchanged.", "error");
      }
    };
    reader.onerror = () => {
      const error = new Error("The selected local file could not be read.");
      error.code = "AXM_SAVE_READ_FAILED";
      importFeedback?.hold(error);
      ui.toast("Save held. Your open park is unchanged.", "error");
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

world.setState(state);
ui.render(state);
ui.setContinueAvailable(Boolean(guardedStorage(() => slotMetadata(0))));
ui.setMode("manage");
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
