import { createNewGame, applyAction } from "./core/simulation.js";
import { applyStaffDevelopmentAction } from "./core/staff.js";
import {
  applyResearchAction, getResearchView, normalizeResearchState
} from "./core/research.js";
import {
  applyUpgradeAction, normalizeUpgradeState
} from "./core/upgrades.js";
import {
  applyHistoricalEconomyAction, getHistoricalEconomyView, normalizeHistoricalEconomyState,
  processHistoricalOperatingDayTransition
} from "./core/historicalEconomy.js";
import {
  applyLegacyCareerAction, getLegacyCareerView, normalizeLegacyCareerState,
  processLegacyCareerProgress
} from "./core/legacyCareer.js";
import {
  advanceOneMinuteWithLegacyCareer, simulateMinutesWithLegacyCareer
} from "./core/legacyCareerRuntime.js";
import {
  SIMULATION_MILLISECONDS_PER_MINUTE, SIMULATION_SPEEDS, normalizeSimulationSpeed
} from "./core/timeScale.js";
import {
  deserializeGame, loadFromSlot, saveToSlot, serializeGame, slotMetadata
} from "./core/save.js";
import { stateHash } from "./core/random.js";
import { WorldRenderer } from "./render/contentStudioWorldRenderer.js";
import { GameInterface } from "./ui/interface.js";
import { CoasterStudioUI } from "./ui/coasterStudioUI.js";
import { ResearchLabUI } from "./ui/researchLabUI.js";
import { UpgradeBayUI } from "./ui/upgradeBayUI.js";
import { CashOfficeUI } from "./ui/cashOfficeUI.js";
import { LegacyAtelierUI } from "./ui/legacyAtelierUI.js";
import { deriveOpeningSignal } from "./presentation/openingSequence.js";

const canvas = document.getElementById("game-canvas");
const visionButton = document.createElement("button");
visionButton.id = "vision-button";
visionButton.type = "button";
visionButton.textContent = "Vision · Off";
visionButton.title = "Park Vision: cycle Crowd flow, Queue pressure, Guest needs, and Operations (V)";
visionButton.setAttribute("aria-pressed", "false");
const studioButton = document.createElement("button");
studioButton.id = "coaster-studio-button";
studioButton.type = "button";
studioButton.textContent = "Coaster Studio";
studioButton.title = "Design, style, decorate, export, and import custom coaster drafts";
const researchButton = document.createElement("button");
researchButton.id = "research-button";
researchButton.type = "button";
researchButton.textContent = "Research";
researchButton.title = "Research real park evidence and grow attractions, services, stores, and the park itself";
const upgradeButton = document.createElement("button");
upgradeButton.id = "upgrade-button";
upgradeButton.type = "button";
upgradeButton.textContent = "Upgrade Bay";
upgradeButton.title = "Install researched modules on specific park elements or across the whole park";
const topActions = document.querySelector(".top-actions");
topActions?.prepend(studioButton);
topActions?.prepend(upgradeButton);
topActions?.prepend(researchButton);
topActions?.prepend(visionButton);

let state = normalizeLegacyCareerState(
  normalizeHistoricalEconomyState(normalizeUpgradeState(normalizeResearchState(createNewGame())))
);
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
      panel.focus({ preventScroll: true });
    }
  });
}

const STAFF_DEVELOPMENT_ACTIONS = new Set(["trainStaff", "setStaffZone", "cycleStaffZone"]);
const RESEARCH_ACTIONS = new Set(["completeResearch", "growEntity", "growPark"]);
const UPGRADE_ACTIONS = new Set([
  "installEntityUpgrade", "removeEntityUpgrade", "installParkUpgrade", "removeParkUpgrade"
]);
const HISTORICAL_ECONOMY_ACTIONS = new Set(["completePaymentTechnology", "manualBankRun"]);
const LEGACY_CAREER_ACTIONS = new Set(["completeLegacyStyleProject"]);

function guardedStorage(callback, fallback = null) {
  try { return callback(); } catch { return fallback; }
}

function act(action, { quiet = false } = {}) {
  const result = STAFF_DEVELOPMENT_ACTIONS.has(action?.type)
    ? applyStaffDevelopmentAction(state, action)
    : RESEARCH_ACTIONS.has(action?.type)
      ? applyResearchAction(state, action)
      : UPGRADE_ACTIONS.has(action?.type)
        ? applyUpgradeAction(state, action)
        : HISTORICAL_ECONOMY_ACTIONS.has(action?.type)
          ? applyHistoricalEconomyAction(state, action)
          : LEGACY_CAREER_ACTIONS.has(action?.type)
            ? applyLegacyCareerAction(state, action)
            : applyAction(state, action);
  if (!result.ok && !quiet) ui.toast(result.reason ?? "That action could not be completed.", "error");
  if (result.ok) {
    if (action?.type === "startNextDay") {
      processHistoricalOperatingDayTransition(state, { source: "startNextDay" });
    }
    if (result.timeCostMinutes > 0) {
      simulateMinutesWithLegacyCareer(state, result.timeCostMinutes);
      if (state.operations?.dayReport) {
        speed = 0;
        accumulator = 0;
        ui.setSpeed(0);
      }
    }
    processLegacyCareerProgress(state);
    state.stateHash = stateHash(state);
    world.syncWorld();
    ui.render(state);
    if (result.message && !quiet) ui.toast(result.message, "good");
  }
  return result;
}

function replaceState(nextState) {
  state = normalizeLegacyCareerState(
    normalizeHistoricalEconomyState(normalizeUpgradeState(normalizeResearchState(nextState)))
  );
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
  speed = state.operations?.dayReport ? 0 : normalizeSimulationSpeed(resumeSpeed);
  ui.setSpeed(speed);
}

const world = new WorldRenderer(canvas, {
  onBuild: (payload) => {
    const result = act({ type: "build", ...payload });
    if (result.ok) {
      world.clearGhost();
      world.confirmPlacement(result.receipt);
      ui.confirmBuild(result.receipt);
    }
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
  onSpeed: (value) => {
    speed = normalizeSimulationSpeed(value);
    ui.setSpeed(speed);
  },
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

const coasterStudio = new CoasterStudioUI({
  onMessage: (message) => ui.toast(message, "info")
});
const researchLab = new ResearchLabUI({
  getState: () => state,
  onAction: (action) => act(action),
  onMessage: (message, tone = "info") => ui.toast(message, tone)
});
const upgradeBay = new UpgradeBayUI({
  getState: () => state,
  onAction: (action) => act(action, { quiet: true }),
  onMessage: (message, tone = "info") => ui.toast(message, tone)
});
const cashOffice = new CashOfficeUI({
  getState: () => state,
  onAction: (action) => act(action, { quiet: true }),
  onMessage: (message, tone = "info") => ui.toast(message, tone)
});
const legacyAtelier = new LegacyAtelierUI({
  getState: () => state,
  onAction: (action) => act(action, { quiet: true }),
  onMessage: (message, tone = "info") => ui.toast(message, tone)
});

coasterStudio.dialog.addEventListener("keydown", (event) => event.stopPropagation());

function closeToolDialogs(except = null) {
  for (const tool of [coasterStudio, researchLab, upgradeBay, cashOffice, legacyAtelier]) {
    if (tool !== except) tool.close();
  }
}

studioButton.addEventListener("click", () => { closeToolDialogs(coasterStudio); coasterStudio.open(); });
researchButton.addEventListener("click", () => { closeToolDialogs(researchLab); researchLab.open(); });
upgradeButton.addEventListener("click", () => { closeToolDialogs(upgradeBay); upgradeBay.open(); });
cashOffice.button.addEventListener("click", () => closeToolDialogs(cashOffice));
legacyAtelier.button.addEventListener("click", () => closeToolDialogs(legacyAtelier));

function toolDialogOpen() {
  return coasterStudio.dialog.open || researchLab.dialog.open || upgradeBay.dialog.open
    || cashOffice.dialog.open || legacyAtelier.dialog.open;
}

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
  if (event.code !== "KeyV" || world.mode !== "manage" || toolDialogOpen()) return;
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
    speed,
    availableSpeeds: [...SIMULATION_SPEEDS],
    day: state.clock.day,
    minute: state.clock.minute,
    visitors: state.visitors.length,
    staff: state.staffAgents?.length ?? 0,
    litterPiles: state.world.litter?.length ?? 0,
    crewJobsToday: (state.operations.todayCleanups ?? 0) + (state.operations.todayRepairs ?? 0),
    benchRestsToday: state.operations.todayBenchRests ?? 0,
    opening: ui.openingActive,
    coasterStudioOpen: coasterStudio.dialog.open,
    researchLabOpen: researchLab.dialog.open,
    upgradeBayOpen: upgradeBay.dialog.open,
    cashOfficeOpen: cashOffice.dialog.open,
    legacyAtelierOpen: legacyAtelier.dialog.open,
    research: (() => {
      const view = getResearchView(state);
      return { insight: view.insight, lifetimeInsight: view.lifetimeInsight, completed: view.completed.length, parkGrowth: view.parkGrowth };
    })(),
    upgrades: {
      park: state.upgrades?.park?.length ?? 0,
      entity: (state.world.entities ?? []).reduce((sum, entity) => sum + (entity.installedUpgrades?.length ?? 0), 0)
    },
    payments: (() => {
      const view = getHistoricalEconomyView(state);
      return {
        year: view.calendar.year,
        careerOperatingDay: view.calendar.careerOperatingDay,
        mapOperatingDay: view.calendar.mapOperatingDay,
        activeMapId: view.calendar.activeMapId,
        bankAvailable: view.bankAvailable,
        officeVault: view.officeVault,
        acceptedElectronicShare: view.acceptedElectronicShare,
        electronicFees: view.ledger.electronicFees,
        technology: view.completedTechnology.length
      };
    })(),
    legacy: (() => {
      const view = getLegacyCareerView(state);
      return {
        fund: view.fund,
        lifetimeEarned: view.lifetimeEarned,
        parkValue: view.parkValue,
        completedStyleProjects: view.projects.filter((item) => item.completed).length
      };
    })(),
    visuals: world.getVisualHealth()
  })
});

function gameLoop(now) {
  const delta = Math.min(1000, now - lastTime);
  lastTime = now;
  if (speed > 0 && !toolDialogOpen()) {
    accumulator += delta * speed;
    let safety = 0;
    while (accumulator >= SIMULATION_MILLISECONDS_PER_MINUTE && safety++ < 40) {
      advanceOneMinuteWithLegacyCareer(state);
      accumulator -= SIMULATION_MILLISECONDS_PER_MINUTE;
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
    if (researchLab.dialog.open) researchLab.render();
    if (upgradeBay.dialog.open) upgradeBay.render();
    if (cashOffice.dialog.open) cashOffice.render();
    if (legacyAtelier.dialog.open) legacyAtelier.render();
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
