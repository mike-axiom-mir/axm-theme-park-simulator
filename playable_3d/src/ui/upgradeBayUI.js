import { RESEARCH_PROJECTS } from "../core/research.js";
import { getUpgradeView } from "../core/upgrades.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[char]));

function injectStyles() {
  if (document.getElementById("upgrade-bay-styles")) return;
  const style = document.createElement("style");
  style.id = "upgrade-bay-styles";
  style.textContent = `
    #upgrade-bay-dialog { width:min(1040px,calc(100vw - 24px)); max-width:none; max-height:calc(100vh - 30px); padding:0; border:1px solid rgba(238,219,177,.2); border-radius:12px; background:#101820; color:#f2ead9; }
    #upgrade-bay-dialog::backdrop { background:rgba(3,7,11,.8); }
    .upgrade-bay-shell { min-height:580px; padding:20px; overflow:auto; }
    .upgrade-bay-head { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; position:sticky; top:-20px; z-index:3; padding:18px 0 12px; background:linear-gradient(#101820 82%,rgba(16,24,32,0)); }
    .upgrade-bay-head h2 { margin:2px 0 4px; font-size:22px; }
    .upgrade-bay-head p { margin:0; color:#9faab0; max-width:720px; font-size:11px; line-height:1.45; }
    .upgrade-bay-close { width:34px; height:34px; padding:0; flex:none; }
    .upgrade-bay-section { margin-top:18px; }
    .upgrade-bay-section h3 { margin:0 0 8px; color:#f0c766; text-transform:uppercase; letter-spacing:.1em; font-size:12px; }
    .upgrade-slot-line { font-size:10px; color:#aab4b8; margin-bottom:8px; }
    .upgrade-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:8px; }
    .upgrade-card { border:1px solid rgba(238,219,177,.15); border-radius:8px; padding:10px; background:rgba(255,255,255,.025); }
    .upgrade-card.installed { border-color:rgba(117,213,173,.55); background:rgba(117,213,173,.055); }
    .upgrade-card.locked { opacity:.68; }
    .upgrade-card b { display:block; font-size:12px; }
    .upgrade-card p { margin:5px 0; color:#aab4b8; line-height:1.4; font-size:10px; }
    .upgrade-card small { display:block; min-height:28px; color:#7fd0df; line-height:1.35; }
    .upgrade-meta { display:flex; flex-wrap:wrap; gap:4px; margin:7px 0; }
    .upgrade-chip { border:1px solid rgba(238,219,177,.14); border-radius:999px; padding:3px 6px; color:#b8c1c5; font-size:9px; }
    .upgrade-chip.good { border-color:rgba(117,213,173,.4); color:#75d5ad; }
    .upgrade-chip.warning { border-color:rgba(240,199,102,.4); color:#f0c766; }
    .upgrade-card button { width:100%; margin-top:7px; }
    .upgrade-card button.danger { color:#f18d96; border-color:rgba(241,141,150,.35); }
    .upgrade-entity { margin:8px 0; border:1px solid rgba(238,219,177,.12); border-radius:9px; background:rgba(255,255,255,.018); }
    .upgrade-entity summary { cursor:pointer; padding:10px 12px; font-size:11px; display:flex; gap:10px; justify-content:space-between; }
    .upgrade-entity-body { padding:0 10px 10px; }
    .upgrade-bay-empty { color:#8f9a9f; padding:12px; border:1px dashed rgba(238,219,177,.15); border-radius:8px; font-size:10px; }
  `;
  document.head.appendChild(style);
}

function createDialog() {
  const dialog = document.createElement("dialog");
  dialog.id = "upgrade-bay-dialog";
  dialog.innerHTML = `
    <section class="upgrade-bay-shell">
      <header class="upgrade-bay-head">
        <div>
          <p class="eyebrow">Upgrade Bay · researched modules</p>
          <h2>Install concrete improvements.</h2>
          <p>Research discovers capabilities. Growth develops them. Upgrades are physical or operational modules installed on a specific park element or across the park. Slots are limited so different parks can stay different.</p>
        </div>
        <button class="upgrade-bay-close" data-upgrade-close type="button">×</button>
      </header>
      <div data-upgrade-content></div>
    </section>
  `;
  document.body.appendChild(dialog);
  return dialog;
}

function researchLabel(id) {
  return RESEARCH_PROJECTS[id]?.label ?? id;
}

export class UpgradeBayUI {
  constructor({ getState, onAction, onMessage = () => {} }) {
    injectStyles();
    this.getState = getState;
    this.onAction = onAction;
    this.onMessage = onMessage;
    this.dialog = createDialog();
    this.content = this.dialog.querySelector("[data-upgrade-content]");
    this.dialog.querySelector("[data-upgrade-close]").addEventListener("click", () => this.close());
    this.dialog.addEventListener("keydown", (event) => event.stopPropagation());
  }

  open() {
    this.render();
    if (!this.dialog.open) this.dialog.showModal();
  }

  close() {
    if (this.dialog.open) this.dialog.close();
  }

  action(action) {
    const result = this.onAction(action);
    if (result?.ok) this.onMessage(result.message ?? "Upgrade change applied.", "good");
    else this.onMessage(result?.reason ?? "That upgrade change could not be applied.", "warning");
    this.render();
  }

  moduleCard(module, { scope, subjectId = null, slotsFull = false } = {}) {
    const locked = !module.unlocked;
    const installed = module.installed;
    const research = researchLabel(module.research);
    const price = scope === "park" ? module.cost : module.cost;
    const installType = scope === "park" ? "installParkUpgrade" : "installEntityUpgrade";
    const removeType = scope === "park" ? "removeParkUpgrade" : "removeEntityUpgrade";
    const disabled = !installed && (locked || slotsFull);
    const button = installed
      ? `<button class="danger" data-upgrade-remove="${escapeHtml(module.id)}" type="button">Remove · 25% parts recovery</button>`
      : `<button data-upgrade-install="${escapeHtml(module.id)}" type="button" ${disabled ? "disabled" : ""}>Install · €${price}</button>`;
    return `
      <article class="upgrade-card ${installed ? "installed" : ""} ${locked ? "locked" : ""}" data-upgrade-scope="${scope}" ${subjectId ? `data-upgrade-subject="${escapeHtml(subjectId)}"` : ""}>
        <b>${escapeHtml(module.label)}</b>
        <p>${escapeHtml(module.summary)}</p>
        <small>${escapeHtml(module.effect)}</small>
        <div class="upgrade-meta">
          <span class="upgrade-chip ${module.unlocked ? "good" : "warning"}">${module.unlocked ? "Researched" : `Needs ${escapeHtml(research)}`}</span>
          ${installed ? `<span class="upgrade-chip good">Installed</span>` : ""}
        </div>
        ${button}
      </article>
    `;
  }

  render() {
    const state = this.getState();
    const view = getUpgradeView(state);
    const park = view.park;
    const parkModules = park.modules.map((module) => this.moduleCard(module, {
      scope: "park", slotsFull: park.slotsUsed >= park.slots
    })).join("");

    const entities = view.entities.map((entity) => {
      const modules = entity.modules.map((module) => this.moduleCard(module, {
        scope: "entity", subjectId: entity.entityId, slotsFull: entity.slotsUsed >= entity.slots
      })).join("");
      return `
        <details class="upgrade-entity">
          <summary><b>${escapeHtml(entity.label)}</b><span>${entity.slotsUsed}/${entity.slots} slots · ${escapeHtml(entity.families.join(" / "))}</span></summary>
          <div class="upgrade-entity-body"><div class="upgrade-grid">${modules}</div></div>
        </details>
      `;
    }).join("");

    this.content.innerHTML = `
      <section class="upgrade-bay-section">
        <h3>Park infrastructure</h3>
        <div class="upgrade-slot-line">€${Math.round(state.economy?.cash ?? 0)} cash · ${park.slotsUsed}/${park.slots} park upgrade slots used</div>
        <div class="upgrade-grid">${parkModules}</div>
      </section>
      <section class="upgrade-bay-section">
        <h3>Specific park elements</h3>
        <div class="upgrade-slot-line">Each compatible attraction/store/service currently has two module slots. Installed modules can be removed with 25% parts recovery.</div>
        ${entities || `<div class="upgrade-bay-empty">Build a compatible ride, active service, store or care facility to install specific modules.</div>`}
      </section>
    `;

    this.content.querySelectorAll("[data-upgrade-install]").forEach((button) => button.addEventListener("click", () => {
      const card = button.closest("[data-upgrade-scope]");
      const upgradeId = button.dataset.upgradeInstall;
      if (card.dataset.upgradeScope === "park") this.action({ type: "installParkUpgrade", upgradeId });
      else this.action({ type: "installEntityUpgrade", entityId: card.dataset.upgradeSubject, upgradeId });
    }));
    this.content.querySelectorAll("[data-upgrade-remove]").forEach((button) => button.addEventListener("click", () => {
      const card = button.closest("[data-upgrade-scope]");
      const upgradeId = button.dataset.upgradeRemove;
      if (card.dataset.upgradeScope === "park") this.action({ type: "removeParkUpgrade", upgradeId });
      else this.action({ type: "removeEntityUpgrade", entityId: card.dataset.upgradeSubject, upgradeId });
    }));
  }
}
