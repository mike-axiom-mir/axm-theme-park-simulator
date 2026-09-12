import {
  BUILD_CATEGORIES, CATALOG, campaignLevelForCatalog, catalogDefinition
} from "../core/catalog.js";
import {
  catalogUnlocked, formatClock, getAdventureView, getEntityDiagnosis, getParkGuidance,
  getProgressionView, getVisitorInsight
} from "../core/simulation.js";
import { getStaffInsight } from "../core/staff.js";
import { guestPulseSummary } from "../presentation/guestSignals.js";

const euro = (value) => `€${Math.round(value).toLocaleString("en")}`;
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

export class GameInterface {
  constructor(callbacks) {
    this.callbacks = callbacks;
    this.state = null;
    this.activeCategory = "Paths";
    this.activeBuild = null;
    this.removePathActive = false;
    this.mode = "manage";
    this.inspected = null;
    this.dayReportShownDay = null;
    this.walkGuideShown = false;
    this.lastBuildSignature = "";
    this.lastBuildReceipt = null;
    this.renderedNotificationIds = new Set();
    this.endingDialogShown = false;
    this.openingTimer = null;
    this.openingResolve = null;
    this.openingActive = false;
    this.cacheElements();
    this.bindEvents();
    this.renderBuildDock();
  }

  cacheElements() {
    this.elements = Object.fromEntries([
      "park-name", "cash", "guests", "rating", "park-level", "clock", "weather", "mode-button",
      "mission-panel", "campaign-title", "campaign-briefing", "objectives", "guidance",
      "progression", "guest-pulse", "guest-pulse-items",
      "inspector", "inspector-content", "build-hint", "walk-hint", "ride-hint", "touch-controls",
      "build-dock", "category-tabs", "build-items", "remove-path-button", "cancel-build", "toasts",
      "start-dialog", "continue-button", "menu-dialog", "save-slots", "park-name-input",
      "ticket-input", "ticket-output", "quality-select", "marketing-select", "cleaner-count",
      "mechanic-count", "park-open-button", "import-input", "ending-dialog", "ending-options",
      "day-report-dialog", "day-report-title", "day-report-stats", "day-report-note", "next-day-button",
      "staff-summary", "opening-sequence", "opening-kicker", "opening-title", "opening-line", "skip-opening"
    ].map((id) => [id, document.getElementById(id)]));
  }

  bindEvents() {
    document.getElementById("campaign-button").addEventListener("click", () => this.callbacks.onNewGame("campaign"));
    document.getElementById("sandbox-button").addEventListener("click", () => this.callbacks.onNewGame("sandbox"));
    this.elements["continue-button"].addEventListener("click", () => this.callbacks.onContinue());
    document.getElementById("menu-button").addEventListener("click", () => this.openMenu());
    this.elements["mode-button"].addEventListener("click", () => this.callbacks.onMode(this.mode === "manage" ? "walk" : "manage"));
    document.getElementById("inspector-close").addEventListener("click", () => this.closeInspector());
    this.elements["cancel-build"].addEventListener("click", () => this.cancelBuild());
    this.elements["remove-path-button"].addEventListener("click", () => {
      this.removePathActive = !this.removePathActive;
      this.activeBuild = null;
      this.elements["remove-path-button"].classList.toggle("active", this.removePathActive);
      this.elements["cancel-build"].classList.toggle("hidden", !this.removePathActive);
      this.renderBuildDock();
      this.callbacks.onRemovePathTool(this.removePathActive);
    });
    document.querySelectorAll("[data-speed]").forEach((button) => button.addEventListener("click", () => {
      document.querySelectorAll("[data-speed]").forEach((item) => item.classList.toggle("active", item === button));
      this.callbacks.onSpeed(Number(button.dataset.speed));
    }));
    document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => document.getElementById(button.dataset.closeDialog).close()));
    document.querySelectorAll("[data-open-dialog]").forEach((button) => button.addEventListener("click", () => document.getElementById(button.dataset.openDialog).showModal()));
    document.querySelectorAll("[data-collapse]").forEach((button) => button.addEventListener("click", () => document.getElementById(button.dataset.collapse).classList.toggle("collapsed")));
    this.elements["park-name-input"].addEventListener("change", (event) => this.callbacks.onAction({ type: "renamePark", name: event.target.value }));
    this.elements["ticket-input"].addEventListener("input", (event) => { this.elements["ticket-output"].textContent = euro(event.target.value); });
    this.elements["ticket-input"].addEventListener("change", (event) => this.callbacks.onAction({ type: "setTicketPrice", value: event.target.value }));
    this.elements["quality-select"].addEventListener("change", (event) => this.callbacks.onQuality(event.target.value));
    this.elements["marketing-select"].addEventListener("change", (event) => this.callbacks.onAction({ type: "marketing", campaign: event.target.value }));
    document.querySelectorAll("[data-staff]").forEach((button) => button.addEventListener("click", () => this.callbacks.onAction({ type: "staff", role: button.dataset.staff, delta: Number(button.dataset.delta) })));
    this.elements["park-open-button"].addEventListener("click", () => this.callbacks.onAction({ type: "togglePark" }));
    document.getElementById("export-button").addEventListener("click", () => this.callbacks.onExport());
    document.getElementById("fullscreen-button").addEventListener("click", async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch {
        this.toast("Fullscreen is unavailable in this browser.", "warning");
      }
    });
    this.elements["import-input"].addEventListener("change", (event) => this.callbacks.onImport(event.target.files?.[0]));
    document.querySelectorAll("#touch-controls [data-key]").forEach((button) => {
      const change = (active) => this.callbacks.onVirtualControl(button.dataset.key, active);
      button.addEventListener("pointerdown", (event) => { event.preventDefault(); change(true); });
      ["pointerup", "pointercancel", "pointerleave"].forEach((name) => button.addEventListener(name, () => change(false)));
    });
    document.getElementById("touch-interact").addEventListener("click", () => this.callbacks.onTouchInteract());
    this.elements["next-day-button"].addEventListener("click", () => this.callbacks.onNextDay());
    this.elements["skip-opening"].addEventListener("click", () => this.finishOpening());
    document.getElementById("replay-opening-button").addEventListener("click", () => {
      if (this.elements["menu-dialog"].open) this.elements["menu-dialog"].close();
      this.callbacks.onReplayOpening();
    });
  }

  dismissStart() {
    if (this.elements["start-dialog"].open) this.elements["start-dialog"].close();
  }

  resetTransientState() {
    this.renderedNotificationIds.clear();
    this.endingDialogShown = false;
    this.dayReportShownDay = null;
    this.walkGuideShown = false;
    this.inspected = null;
    this.activeBuild = null;
    this.removePathActive = false;
    this.lastBuildSignature = "";
    this.lastBuildReceipt = null;
    this.elements.inspector.classList.add("hidden");
    this.elements["cancel-build"].classList.add("hidden");
    this.elements["remove-path-button"].classList.remove("active");
    for (const id of ["day-report-dialog", "ending-dialog", "menu-dialog"]) {
      if (this.elements[id]?.open) this.elements[id].close();
    }
  }

  setContinueAvailable(available) {
    this.elements["continue-button"].disabled = !available;
    this.elements["continue-button"].textContent = available ? "Continue autosave" : "No autosave yet";
  }

  setMode(mode) {
    this.mode = mode;
    document.body.classList.toggle("walk-mode", mode === "walk");
    this.elements["mode-button"].textContent = mode === "manage" ? "Walk park" : mode === "walk" ? "Manage park" : "Leave ride";
    this.elements["build-dock"].classList.toggle("hidden", mode !== "manage");
    this.elements["walk-hint"].classList.toggle("hidden", mode !== "walk");
    this.elements["ride-hint"].classList.toggle("hidden", mode !== "ride");
    this.elements["touch-controls"].setAttribute("aria-hidden", mode === "walk" ? "false" : "true");
    if (mode === "walk" && !this.walkGuideShown) {
      this.walkGuideShown = true;
      this.toast("Adventure trail: walk toward glowing stamps and press Space or A to collect them.", "story");
    }
  }

  toggleMode() {
    this.callbacks.onMode(this.mode === "manage" ? "walk" : "manage");
  }

  setSpeed(value) {
    document.querySelectorAll("[data-speed]").forEach((button) => {
      button.classList.toggle("active", Number(button.dataset.speed) === Number(value));
    });
  }

  controllerChanged(connected) {
    this.toast(connected ? "Controller connected: left stick moves, right stick looks, A inspects, Y changes view." : "Controller disconnected.", connected ? "good" : "info");
  }

  render(state) {
    this.state = state;
    this.elements["park-name"].textContent = state.park.name;
    this.elements.cash.textContent = euro(state.economy.cash);
    this.elements.guests.textContent = state.visitors.length;
    this.elements.rating.textContent = `${state.park.rating}/100`;
    const progression = getProgressionView(state);
    const adventure = getAdventureView(state);
    this.elements["park-level"].textContent = `L${progression.level}`;
    this.elements.clock.textContent = formatClock(state.clock);
    this.elements.weather.textContent = `${state.weather.type} · ${state.weather.temperature}°`;
    this.elements["campaign-title"].textContent = state.campaign.title;
    this.elements["campaign-briefing"].textContent = state.campaign.briefing;
    this.elements.objectives.innerHTML = state.campaign.objectives.map((objective) => `
      <div class="objective ${objective.complete ? "complete" : ""}"><i>${objective.complete ? "✓" : "·"}</i><span>${escapeHtml(objective.label)}</span></div>
    `).join("");
    this.elements.progression.innerHTML = `<b>Level ${progression.level} · ${escapeHtml(progression.label)}</b><small>${escapeHtml(progression.nextRequirement)}</small><span class="trail-progress">Discovery trail · ${adventure.found}/${adventure.total}${adventure.completed ? " ✓" : ""}</span>`;
    this.elements.guidance.innerHTML = getParkGuidance(state).map((card) => `
      <div class="guide-card ${card.tone}"><b>${escapeHtml(card.title)}</b><p>${escapeHtml(card.body)}</p></div>
    `).join("");
    const pulse = guestPulseSummary(state.visitors);
    const pulseItems = [
      ["comfort", "WC", pulse.comfort], ["drink", "Drink", pulse.drink],
      ["snack", "Snack", pulse.snack], ["rest", "Rest", pulse.rest], ["wait", "Wait", pulse.wait]
    ];
    this.elements["guest-pulse"].classList.toggle("calm", pulse.active === 0);
    this.elements["guest-pulse-items"].innerHTML = pulseItems.map(([type, label, count]) => `
      <span class="pulse-item ${type} ${count ? "active" : ""}"><i>${count}</i><small>${label}</small></span>
    `).join("");
    this.elements["park-name-input"].value = state.park.name;
    this.elements["ticket-input"].value = state.park.ticketPrice;
    this.elements["ticket-output"].textContent = euro(state.park.ticketPrice);
    this.elements["marketing-select"].value = state.park.marketing;
    this.elements["cleaner-count"].textContent = state.staff.cleaners;
    this.elements["mechanic-count"].textContent = state.staff.mechanics;
    this.elements["park-open-button"].textContent = state.park.open ? "Close park" : "Open park";
    const crewJobs = (state.operations.todayCleanups ?? 0) + (state.operations.todayRepairs ?? 0);
    this.elements["staff-summary"].textContent = `${state.staffAgents?.length ?? 0} crew active · ${crewJobs} job${crewJobs === 1 ? "" : "s"} today · ${Math.round(state.park.litter)} litter`;
    const buildSignature = `${state.gameMode}:${progression.level}:${this.activeCategory}:${this.activeBuild}:${this.removePathActive}`;
    if (buildSignature !== this.lastBuildSignature) {
      this.lastBuildSignature = buildSignature;
      this.renderBuildDock();
    }
    this.renderNotifications(state.notifications);
    this.renderDayReport(state.operations?.dayReport ?? null);
    if (this.inspected?.type === "visitor") this.openVisitorInspector(this.inspected.id, { refresh: true });
    if (this.inspected?.type === "staff") this.openStaffInspector(this.inspected.id, { refresh: true });
    if (state.campaign.availableEndings.length && !state.park.selectedEnding && !this.endingDialogShown) {
      this.renderEndings();
      this.endingDialogShown = true;
    }
  }

  renderDayReport(report) {
    if (!report || this.dayReportShownDay === report.day) return;
    this.dayReportShownDay = report.day;
    this.elements["day-report-title"].textContent = `Day ${report.day} report`;
    const profitClass = report.profit >= 0 ? "profit" : "loss";
    this.elements["day-report-stats"].innerHTML = `
      <div class="day-stat"><small>Guests welcomed</small><b>${report.visitors}</b></div>
      <div class="day-stat"><small>Park rating</small><b>${report.rating}</b></div>
      <div class="day-stat"><small>Income</small><b>${euro(report.income)}</b></div>
      <div class="day-stat"><small>Costs &amp; investment</small><b>${euro(report.costs)}</b></div>
      <div class="day-stat ${profitClass}"><small>Day result</small><b>${euro(report.profit)}</b></div>
      <div class="day-stat"><small>Top ride today</small><b>${escapeHtml(report.topRideLabel)}</b><small>${euro(report.topRideRevenue)}</small></div>
      <div class="day-stat"><small>Visible crew work</small><b>${report.cleanups + report.repairs}</b><small>${report.cleanups} cleanups · ${report.repairs} repairs</small></div>
      <div class="day-stat"><small>Bench rests</small><b>${report.benchRests ?? 0}</b><small>Real seated recoveries</small></div>
    `;
    this.elements["day-report-note"].textContent = report.profit >= 0
      ? "The park earned a surplus. Choose the next investment deliberately."
      : "The park spent more than it earned today. Review expansion, prices, queues, staffing, and operating rides.";
    if (!this.elements["day-report-dialog"].open) this.elements["day-report-dialog"].showModal();
  }

  renderNotifications(notifications) {
    for (const item of notifications) {
      if (this.renderedNotificationIds.has(item.id)) continue;
      this.renderedNotificationIds.add(item.id);
      this.toast(item.text, item.tone);
    }
  }

  toast(text, tone = "info") {
    const element = document.createElement("div");
    element.className = `toast ${tone}`;
    element.textContent = text;
    this.elements.toasts.appendChild(element);
    setTimeout(() => element.remove(), 4800);
  }

  renderBuildDock() {
    this.elements["category-tabs"].innerHTML = BUILD_CATEGORIES.map((category) => `<button data-category="${category}" class="${category === this.activeCategory ? "active" : ""}" type="button">${category}</button>`).join("");
    this.elements["category-tabs"].querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
      this.activeCategory = button.dataset.category;
      this.renderBuildDock();
    }));
    const definitions = Object.values(CATALOG).filter((definition) => definition.category === this.activeCategory);
    this.elements["build-items"].innerHTML = definitions.map((definition) => {
      const unlocked = !this.state || catalogUnlocked(this.state, definition.id);
      const detail = unlocked ? euro(definition.cost) : `Level ${campaignLevelForCatalog(definition.id)}`;
      return `
        <button class="build-card ${this.activeBuild === definition.id ? "active" : ""} ${unlocked ? "" : "locked"}" data-build="${definition.id}" type="button" title="${escapeHtml(definition.description)}" ${unlocked ? "" : "disabled"}>
          <span class="icon">${definition.icon}</span><b>${escapeHtml(definition.label)}</b><small>${detail}</small>
        </button>
      `;
    }).join("");
    this.elements["build-items"].querySelectorAll("[data-build]").forEach((button) => button.addEventListener("click", () => {
      this.activeBuild = button.dataset.build;
      this.removePathActive = false;
      this.elements["remove-path-button"].classList.remove("active");
      this.elements["cancel-build"].classList.remove("hidden");
      this.renderBuildDock();
      const definition = catalogDefinition(this.activeBuild);
      this.showBuildStatus({
        tone: "neutral",
        title: `${definition.label} selected`,
        detail: definition.kind === "path"
          ? "Point at the globe to preview whether this tile joins the entrance network."
          : "Point at the globe to preview space and guest access before spending cash."
      }, `${euro(definition.cost)} · ${definition.description}`);
      this.callbacks.onBuildTool(this.activeBuild);
    }));
  }

  cancelBuild() {
    this.activeBuild = null;
    this.removePathActive = false;
    this.elements["remove-path-button"].classList.remove("active");
    this.elements["cancel-build"].classList.add("hidden");
    this.elements["build-hint"].classList.add("hidden");
    this.renderBuildDock();
    this.callbacks.onCancelBuild();
  }

  showRemoveHint(payload) {
    this.elements["build-hint"].textContent = payload.path
      ? `Remove ${payload.path.type === "queue" ? "queue" : "stone"} path · recover 40% materials`
      : "No path on this tile.";
    this.elements["build-hint"].classList.remove("hidden");
  }

  showBuildHint(payload) {
    const { preview, definition, cell, rotation } = payload;
    const meta = preview.ok
      ? `${euro(definition.cost)} · cell ${cell.x},${cell.z} · ${rotation * 90}°`
      : `${definition.label} · cell ${cell.x},${cell.z}`;
    this.showBuildStatus(preview, meta);
  }

  showBuildStatus(status, meta = "") {
    const tone = ["connected", "caution", "invalid", "neutral"].includes(status.tone) ? status.tone : "neutral";
    this.elements["build-hint"].className = `build-hint game-ui placement-${tone}`;
    this.elements["build-hint"].innerHTML = `
      <span class="placement-signal" aria-hidden="true"></span>
      <span class="placement-copy"><b>${escapeHtml(status.title)}</b><small>${escapeHtml(status.detail)}</small></span>
      ${meta ? `<span class="placement-meta">${meta}</span>` : ""}
    `;
  }

  confirmBuild(receipt) {
    if (!receipt) return;
    this.lastBuildReceipt = receipt;
    const connected = receipt.connection !== "disconnected";
    const status = {
      tone: connected ? "connected" : "caution",
      title: connected ? `${receipt.label} built` : `${receipt.label} built · access pending`,
      detail: receipt.connection === "disconnected"
        ? "The placement is saved, but guests need a continuous path beside it."
        : receipt.connection === "connected"
          ? "Confirmed on the entrance network and ready for guests."
          : "Placement confirmed in the live park."
    };
    this.showBuildStatus(status, `${euro(receipt.cost)} spent · ${euro(receipt.cashAfter)} remaining`);
  }

  openInspector(entityId) {
    if (!this.state || !entityId) {
      this.closeInspector();
      return;
    }
    const diagnosis = getEntityDiagnosis(this.state, entityId);
    if (!diagnosis) return;
    this.inspected = { type: "entity", id: entityId };
    const { entity, definition } = diagnosis;
    const isRide = definition.kind === "ride";
    const priceMax = definition.kind === "service" ? 15 : 12;
    const scoreHtml = isRide ? `
      <div class="stat-grid">
        ${Object.entries(diagnosis.segmentScores).map(([segment, value]) => `<div class="stat"><small>${segment} context</small><b>${value}</b></div>`).join("")}
      </div>
    ` : "";
    const queueHtml = definition.kind === "ride" || definition.kind === "service" ? `
      <div class="stat-grid">
        <div class="stat"><small>Queue</small><b>${entity.queue.length}/${entity.queueCapacity ?? 0}</b></div>
        <div class="stat"><small>Estimated wait</small><b>${entity.queueWaitMinutes ?? 0}m</b></div>
      </div>
    ` : "";
    this.elements["inspector-content"].innerHTML = `
      <p class="eyebrow">${escapeHtml(definition.kind)} · ${entity.open ? "open" : "closed"}</p>
      <h2>${escapeHtml(definition.label)}</h2>
      <p class="muted">${escapeHtml(diagnosis.headline)}</p>
      <small>Condition ${Math.round(entity.condition)}%</small>
      <div class="condition-bar"><span style="width:${Math.round(entity.condition)}%"></span></div>
      ${queueHtml}
      ${scoreHtml}
      <ul class="cause-list">${diagnosis.causes.map((cause) => `<li>${escapeHtml(cause)}</li>`).join("")}</ul>
      ${definition.kind === "ride" || definition.kind === "service" ? `<label class="price-row"><span>Price</span><input data-entity-price type="range" min="0" max="${priceMax}" value="${entity.price}" step="1"><output>${euro(entity.price)}</output></label>` : ""}
      <div class="inspector-actions">
        ${isRide ? `<button data-entity-action="maintain" type="button">Maintain</button><button data-entity-action="evolve" type="button">Evolve · L${entity.evolutionLevel}</button>` : ""}
        ${definition.kind === "ride" || definition.kind === "service" ? `<button data-entity-action="toggleEntity" type="button">${entity.open ? "Close" : "Open"}</button>` : ""}
        ${isRide ? `<button data-ride-experience type="button">Experience ride</button>` : ""}
        <button data-focus-entity type="button">Focus camera</button>
        <button data-entity-action="inspect" class="full" type="button">Record live inspection</button>
        <button data-entity-action="replace" class="danger full" type="button">Replace deliberately</button>
      </div>
    `;
    const priceInput = this.elements["inspector-content"].querySelector("[data-entity-price]");
    priceInput?.addEventListener("input", () => { priceInput.nextElementSibling.textContent = euro(priceInput.value); });
    priceInput?.addEventListener("change", () => this.callbacks.onAction({ type: "setEntityPrice", entityId, value: priceInput.value }));
    this.elements["inspector-content"].querySelectorAll("[data-entity-action]").forEach((button) => button.addEventListener("click", () => {
      const type = button.dataset.entityAction;
      if (type === "replace" && !confirm(`Replace ${definition.label}? This is a deliberate choice and cannot be undone except by loading a save.`)) return;
      this.callbacks.onAction({ type, entityId });
      if (type === "replace") this.closeInspector(); else this.openInspector(entityId);
    }));
    this.elements["inspector-content"].querySelector("[data-ride-experience]")?.addEventListener("click", () => this.callbacks.onRide(entityId));
    this.elements["inspector-content"].querySelector("[data-focus-entity]")?.addEventListener("click", () => this.callbacks.onFocusEntity(entityId));
    this.elements.inspector.classList.remove("hidden");
  }

  openVisitorInspector(visitorId, { refresh = false } = {}) {
    if (!this.state || !visitorId) {
      if (!refresh) this.closeInspector();
      return;
    }
    const insight = getVisitorInsight(this.state, visitorId);
    if (!insight) {
      this.closeInspector();
      return;
    }
    this.inspected = { type: "visitor", id: visitorId };
    const { visitor, thought, activity, needs } = insight;
    const needRow = (label, value, { inverse = false } = {}) => {
      const positive = inverse ? 100 - value : value;
      const tone = positive >= 68 ? "good" : positive < 38 ? "warning" : "";
      return `<div class="need-row ${tone}"><span>${escapeHtml(label)}</span><span class="need-track"><span style="width:${positive}%"></span></span><b>${value}</b></div>`;
    };
    this.elements["inspector-content"].innerHTML = `
      <p class="eyebrow">Guest · ${escapeHtml(visitor.segment)} · ${escapeHtml(visitor.origin)}</p>
      <h2>Guest ${escapeHtml(visitor.id.split("-").at(-1))}</h2>
      <p class="muted">${escapeHtml(activity)} · budget ${euro(visitor.budget)}</p>
      <div class="guest-thought">“${escapeHtml(thought)}”</div>
      <div class="need-list">
        ${needRow("Happiness", needs.happiness)}
        ${needRow("Energy", needs.energy)}
        ${needRow("Hunger", needs.hunger, { inverse: true })}
        ${needRow("Thirst", needs.thirst, { inverse: true })}
        ${needRow("Toilet", needs.toilet, { inverse: true })}
      </div>
      <small>Visited ${visitor.visited.length} attraction${visitor.visited.length === 1 ? "" : "s"} · patience ${visitor.patience} minutes</small>
    `;
    this.elements.inspector.classList.remove("hidden");
  }

  openStaffInspector(staffId, { refresh = false } = {}) {
    if (!this.state || !staffId) {
      if (!refresh) this.closeInspector();
      return;
    }
    const insight = getStaffInsight(this.state, staffId);
    if (!insight) {
      this.closeInspector();
      return;
    }
    this.inspected = { type: "staff", id: staffId };
    const { agent, activity, targetRide, targetLitter } = insight;
    const target = targetRide ? `Ride ${targetRide.id} · condition ${Math.round(targetRide.condition)}%`
      : targetLitter ? `Litter ${targetLitter.id} · ${targetLitter.amount.toFixed(1)} remaining`
        : "No urgent target";
    this.elements["inspector-content"].innerHTML = `
      <p class="eyebrow">Crew · ${escapeHtml(agent.role)}</p>
      <h2>${agent.role === "cleaner" ? "Path cleaner" : "Ride mechanic"} ${escapeHtml(agent.id.split("-").at(-1))}</h2>
      <p class="muted">${escapeHtml(activity)}</p>
      <div class="guest-thought">“${escapeHtml(agent.lastThought)}”</div>
      ${agent.lastCompletedJob ? `<p class="muted">Last completed: ${escapeHtml(agent.lastCompletedJob)}</p>` : ""}
      <div class="stat-grid">
        <div class="stat"><small>Jobs completed</small><b>${agent.jobsCompleted}</b></div>
        <div class="stat"><small>Minutes on duty</small><b>${agent.workMinutes}</b></div>
      </div>
      <p class="muted">${escapeHtml(target)}</p>
      <small>Current path cell ${agent.cell.join(", ")} · roster ${insight.rosterCount}</small>
    `;
    this.elements.inspector.classList.remove("hidden");
  }

  playOpeningSequence(signal) {
    if (this.openingTimer) clearTimeout(this.openingTimer);
    if (this.openingResolve) this.openingResolve();
    const overlay = this.elements["opening-sequence"];
    const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    const duration = reducedMotion ? 1100 : Math.max(1800, Number(signal.parameters.durationMs) || 5600);
    this.openingActive = true;
    overlay.dataset.signalId = signal.signal_id;
    overlay.dataset.sourceStateHash = signal.parameters.sourceStateHash;
    overlay.style.setProperty("--opening-duration", `${duration}ms`);
    this.elements["opening-kicker"].textContent = signal.parameters.stages[0];
    this.elements["opening-title"].textContent = signal.parameters.parkName;
    this.elements["opening-line"].textContent = signal.parameters.stages.at(-1);
    overlay.classList.remove("hidden", "leaving", "playing");
    overlay.setAttribute("aria-hidden", "false");
    void overlay.offsetWidth;
    overlay.classList.add("playing");
    return new Promise((resolve) => {
      this.openingResolve = resolve;
      this.openingTimer = setTimeout(() => this.finishOpening(), duration);
    });
  }

  finishOpening() {
    if (!this.openingActive) return;
    if (this.openingTimer) clearTimeout(this.openingTimer);
    this.openingTimer = null;
    this.openingActive = false;
    const overlay = this.elements["opening-sequence"];
    overlay.classList.add("leaving");
    const resolve = this.openingResolve;
    this.openingResolve = null;
    setTimeout(() => {
      overlay.classList.add("hidden");
      overlay.classList.remove("playing", "leaving");
      overlay.setAttribute("aria-hidden", "true");
      resolve?.();
    }, 420);
  }

  closeInspector() {
    this.inspected = null;
    this.elements.inspector.classList.add("hidden");
    this.callbacks.onCloseInspector?.();
  }

  openMenu() {
    this.callbacks.onRefreshSlots();
    this.elements["menu-dialog"].showModal();
  }

  renderSaveSlots(slots) {
    this.elements["save-slots"].innerHTML = [1, 2, 3].map((slot) => {
      const metadata = slots[slot];
      return `<div class="save-slot"><span><b>World ${slot}${metadata ? ` · ${escapeHtml(metadata.parkName)}` : " · Empty"}</b><small>${metadata ? `Day ${metadata.day} · ${euro(metadata.cash)}` : "Available save slot"}</small></span><button data-save="${slot}" type="button">Save</button><button data-load="${slot}" ${metadata ? "" : "disabled"} type="button">Load</button></div>`;
    }).join("");
    this.elements["save-slots"].querySelectorAll("[data-save]").forEach((button) => button.addEventListener("click", () => this.callbacks.onSave(Number(button.dataset.save))));
    this.elements["save-slots"].querySelectorAll("[data-load]").forEach((button) => button.addEventListener("click", () => this.callbacks.onLoad(Number(button.dataset.load))));
  }

  renderEndings() {
    this.elements["ending-options"].innerHTML = this.state.campaign.availableEndings.map((ending) => `
      <article class="ending-card"><b>${escapeHtml(ending.label)}</b><p>${escapeHtml(ending.reason)}</p><button data-ending="${ending.id}" type="button">Choose this future</button></article>
    `).join("");
    this.elements["ending-options"].querySelectorAll("[data-ending]").forEach((button) => button.addEventListener("click", () => {
      this.callbacks.onAction({ type: "selectEnding", endingId: button.dataset.ending });
      this.elements["ending-dialog"].close();
    }));
    this.elements["ending-dialog"].showModal();
  }
}
