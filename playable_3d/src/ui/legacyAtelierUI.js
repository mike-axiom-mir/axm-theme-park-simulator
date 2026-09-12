import { LEGACY_STYLE_PROJECTS, getLegacyCareerView } from "../core/legacyCareer.js";

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[char]));
const euro = (value) => `€${Math.round(Number(value) || 0).toLocaleString("en")}`;

function injectStyles() {
  if (document.getElementById("legacy-atelier-styles")) return;
  const style = document.createElement("style");
  style.id = "legacy-atelier-styles";
  style.textContent = `
    #legacy-atelier-dialog { width:min(960px,calc(100vw - 24px)); max-width:none; max-height:calc(100vh - 30px); padding:0; border:1px solid rgba(238,219,177,.2); border-radius:12px; background:#101820; color:#f2ead9; }
    #legacy-atelier-dialog::backdrop { background:rgba(3,7,11,.78); }
    .legacy-shell { position:relative; padding:20px; overflow:auto; max-height:calc(100vh - 34px); }
    .legacy-close { position:absolute; right:12px; top:12px; width:32px; height:32px; padding:0; }
    .legacy-hero { padding-right:42px; }
    .legacy-hero h2 { margin:0 0 6px; font-size:24px; }
    .legacy-hero p { margin:0; color:#aeb6ba; font-size:11px; line-height:1.5; }
    .legacy-metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin-top:16px; }
    .legacy-metric { padding:11px; border:1px solid rgba(238,219,177,.15); border-radius:8px; background:rgba(255,255,255,.025); }
    .legacy-metric.gold { border-color:rgba(240,199,102,.35); background:rgba(240,199,102,.055); }
    .legacy-metric small { display:block; color:#9ea7ad; font-size:9px; }
    .legacy-metric b { display:block; margin-top:3px; font-size:20px; }
    .legacy-section { margin-top:20px; }
    .legacy-section h3 { margin:0 0 8px; color:#f0c766; font-size:11px; text-transform:uppercase; letter-spacing:.12em; }
    .legacy-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(235px,1fr)); gap:8px; }
    .legacy-card { padding:11px; border:1px solid rgba(238,219,177,.15); border-radius:8px; background:rgba(255,255,255,.025); }
    .legacy-card.complete { border-color:rgba(117,213,173,.4); background:rgba(117,213,173,.055); }
    .legacy-card.locked { opacity:.7; }
    .legacy-card small { color:#65bed1; font-size:9px; text-transform:uppercase; letter-spacing:.08em; }
    .legacy-card h4 { margin:5px 0; font-size:13px; }
    .legacy-card p { margin:5px 0 8px; color:#aeb6ba; font-size:10px; line-height:1.45; }
    .legacy-card .unlock { color:#f0c766; font-size:9px; line-height:1.4; }
    .legacy-card button { width:100%; margin-top:9px; }
    .legacy-note { margin-top:15px; padding:10px; border-left:3px solid #65bed1; color:#aeb6ba; background:rgba(101,190,209,.05); font-size:10px; line-height:1.5; }
    @media (max-width:720px) { .legacy-metrics { grid-template-columns:1fr 1fr; } }
  `;
  document.head.appendChild(style);
}

function createDialog() {
  const dialog = document.createElement("dialog");
  dialog.id = "legacy-atelier-dialog";
  dialog.innerHTML = `<div class="legacy-shell">
    <button class="legacy-close" data-legacy-close type="button">×</button>
    <div data-legacy-content></div>
  </div>`;
  document.body.appendChild(dialog);
  return dialog;
}

function createButton() {
  const button = document.createElement("button");
  button.id = "legacy-atelier-button";
  button.type = "button";
  button.textContent = "Legacy";
  button.title = "Career fund and persistent style-only research";
  document.querySelector(".top-actions")?.prepend(button);
  return button;
}

export class LegacyAtelierUI {
  constructor({ getState, onAction, onMessage = () => {} }) {
    injectStyles();
    this.getState = getState;
    this.onAction = onAction;
    this.onMessage = onMessage;
    this.dialog = createDialog();
    this.button = createButton();
    this.content = this.dialog.querySelector("[data-legacy-content]");
    this.dialog.querySelector("[data-legacy-close]").addEventListener("click", () => this.close());
    this.dialog.addEventListener("keydown", (event) => event.stopPropagation());
    this.button.addEventListener("click", () => this.open());
  }

  open() {
    this.render();
    if (!this.dialog.open) this.dialog.showModal();
  }

  close() {
    if (this.dialog.open) this.dialog.close();
  }

  perform(action) {
    const result = this.onAction(action);
    this.onMessage(result?.message ?? result?.reason ?? "Legacy action completed.", result?.ok ? "good" : "warning");
    this.render();
    return result;
  }

  render() {
    const view = getLegacyCareerView(this.getState());
    const cards = view.projects.map((item) => {
      const prerequisites = item.prerequisites.map((id) => LEGACY_STYLE_PROJECTS[id]?.label ?? id);
      const status = item.completed ? "Permanent career unlock"
        : !item.prerequisitesMet ? `Needs ${prerequisites.join(", ")}`
          : !item.affordable ? `Need ${euro(item.cost)} Legacy Fund`
            : `Research style · ${euro(item.cost)}`;
      return `<article class="legacy-card ${item.completed ? "complete" : ""} ${item.canComplete || item.completed ? "" : "locked"}">
        <small>${escapeHtml(item.branch)}</small>
        <h4>${escapeHtml(item.label)}</h4>
        <p>${escapeHtml(item.summary)}</p>
        <div class="unlock">${escapeHtml(item.unlock)}</div>
        <button data-legacy-project="${item.id}" type="button" ${item.canComplete ? "" : "disabled"}>${escapeHtml(status)}</button>
      </article>`;
    }).join("");

    this.content.innerHTML = `
      <div class="legacy-hero">
        <p class="eyebrow">Legacy Atelier · career ${view.year}</p>
        <h2>Grow the park's identity without stealing from the park.</h2>
        <p>Legacy Fund is a separate career account. Completed goals and maps award it once; a small capped yearly dividend reflects finance and park value. It never drains the operating bank balance. Only style/presentation research lives here.</p>
      </div>
      <div class="legacy-metrics">
        <div class="legacy-metric gold"><small>Available Legacy Fund</small><b>${euro(view.fund)}</b></div>
        <div class="legacy-metric"><small>Estimated park value</small><b>${euro(view.parkValue)}</b></div>
        <div class="legacy-metric"><small>Next yearly dividend if earned now</small><b>${euro(view.nextPerformanceDividend)}</b></div>
        <div class="legacy-metric"><small>Career achievements paid</small><b>${view.rewardedGoalCount + view.rewardedMapCount}</b><small>${view.rewardedGoalCount} goals · ${view.rewardedMapCount} maps</small></div>
      </div>
      <section class="legacy-section">
        <h3>Persistent style research</h3>
        <div class="legacy-grid">${cards}</div>
      </section>
      <div class="legacy-note">Park Research remains the functional game layer for rides, attractions, services, stores, staff and operations. Legacy Research cannot improve throughput, reliability, revenue, guest stats, service speed or operating costs. Basic theme selection and normal Style Superpowers also remain free; Legacy only deepens presentation.</div>
    `;

    this.content.querySelectorAll("[data-legacy-project]").forEach((button) => button.addEventListener("click", () => {
      this.perform({ type: "completeLegacyStyleProject", projectId: button.dataset.legacyProject });
    }));
  }
}
