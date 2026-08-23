import {
  RESEARCH_CHANNELS, RESEARCH_PROJECTS,
  getEntityGrowthView, getParkGrowthView, getResearchView
} from "../core/research.js";

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[char]));
const euro = (value) => `€${Math.round(Number(value) || 0).toLocaleString("en")}`;

function injectStyles() {
  if (document.getElementById("research-lab-styles")) return;
  const style = document.createElement("style");
  style.id = "research-lab-styles";
  style.textContent = `
    #research-lab-dialog { width:min(1080px,calc(100vw - 24px)); max-width:none; max-height:calc(100vh - 30px); padding:0; border:1px solid rgba(238,219,177,.2); border-radius:12px; background:#101820; color:#f2ead9; }
    #research-lab-dialog::backdrop { background:rgba(3,7,11,.78); }
    .research-shell { position:relative; padding:20px; overflow:auto; max-height:calc(100vh - 34px); }
    .research-close { position:absolute; right:12px; top:12px; width:32px; height:32px; padding:0; }
    .research-hero { display:grid; grid-template-columns:1.1fr 1.9fr; gap:18px; align-items:start; padding-right:42px; }
    .research-hero h2 { margin:0 0 7px; font-size:24px; }
    .research-hero p { margin:0; color:#aeb6ba; font-size:11px; line-height:1.5; }
    .research-insight { padding:14px; border:1px solid rgba(240,199,102,.28); border-radius:9px; background:rgba(240,199,102,.06); }
    .research-insight b { display:block; font-size:28px; color:#f0c766; }
    .research-evidence { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:7px; }
    .research-evidence-card { padding:9px; border:1px solid rgba(238,219,177,.14); border-radius:7px; background:rgba(255,255,255,.025); }
    .research-evidence-card small { display:block; color:#9ea7ad; font-size:9px; }
    .research-evidence-card b { font-size:14px; }
    .research-section { margin-top:22px; }
    .research-section > h3 { margin:0 0 9px; font-size:12px; color:#f0c766; text-transform:uppercase; letter-spacing:.13em; }
    .research-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:8px; }
    .research-card { padding:11px; border:1px solid rgba(238,219,177,.15); border-radius:8px; background:rgba(255,255,255,.025); }
    .research-card.complete { border-color:rgba(117,213,173,.4); background:rgba(117,213,173,.055); }
    .research-card.locked { opacity:.7; }
    .research-card h4 { margin:0 0 5px; font-size:13px; }
    .research-card p { margin:5px 0 8px; color:#aeb6ba; font-size:10px; line-height:1.45; }
    .research-branch { display:inline-block; margin-bottom:6px; color:#65bed1; font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.1em; }
    .research-requirements { display:flex; flex-wrap:wrap; gap:4px; margin:8px 0; }
    .research-chip { padding:3px 6px; border:1px solid rgba(238,219,177,.14); border-radius:999px; color:#aeb6ba; font-size:9px; }
    .research-chip.met { color:#b8ecd6; border-color:rgba(117,213,173,.35); }
    .research-unlock { color:#f0c766; font-size:9px; line-height:1.4; }
    .research-card button { width:100%; margin-top:9px; }
    .growth-card { display:grid; gap:7px; }
    .growth-head { display:flex; justify-content:space-between; gap:8px; align-items:start; }
    .growth-head small { color:#9ea7ad; }
    .growth-track { display:grid; grid-template-columns:1fr auto; gap:8px; align-items:center; padding-top:7px; border-top:1px solid rgba(238,219,177,.1); }
    .growth-track b { font-size:10px; }
    .growth-track small { margin-top:2px; font-size:9px; color:#9ea7ad; }
    .growth-track button { min-width:92px; padding:6px 8px; font-size:9px; }
    .research-note { margin-top:16px; padding:10px; border-left:3px solid #65bed1; color:#aeb6ba; background:rgba(101,190,209,.05); font-size:10px; line-height:1.5; }
    @media (max-width:760px) { .research-hero { grid-template-columns:1fr; } .research-evidence { grid-template-columns:repeat(2,minmax(0,1fr)); } }
  `;
  document.head.appendChild(style);
}

function createDialog() {
  const dialog = document.createElement("dialog");
  dialog.id = "research-lab-dialog";
  dialog.innerHTML = `<div class="research-shell">
    <button class="research-close" data-research-close type="button">×</button>
    <div data-research-content></div>
  </div>`;
  document.body.appendChild(dialog);
  return dialog;
}

export class ResearchLabUI {
  constructor({ getState, onAction, onMessage = () => {} }) {
    injectStyles();
    this.getState = getState;
    this.onAction = onAction;
    this.onMessage = onMessage;
    this.dialog = createDialog();
    this.content = this.dialog.querySelector("[data-research-content]");
    this.dialog.querySelector("[data-research-close]").addEventListener("click", () => this.close());
    this.dialog.addEventListener("keydown", (event) => event.stopPropagation());
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
    this.onMessage(result?.message ?? result?.reason ?? "Research action completed.", result?.ok ? "good" : "warning");
    this.render();
  }

  render() {
    const state = this.getState();
    const research = getResearchView(state);
    const parkGrowth = getParkGrowthView(state);
    const projectGroups = new Map();
    for (const item of research.projects) {
      if (!projectGroups.has(item.branch)) projectGroups.set(item.branch, []);
      projectGroups.get(item.branch).push(item);
    }

    const projectHtml = [...projectGroups.entries()].map(([branch, projects]) => `
      <section class="research-section">
        <h3>${escapeHtml(branch)}</h3>
        <div class="research-grid">
          ${projects.map((item) => {
            const prereqNames = item.prerequisites.map((id) => RESEARCH_PROJECTS[id]?.label ?? id);
            const requirements = Object.entries(item.evidence).map(([channel, evidence]) => `
              <span class="research-chip ${evidence.current >= evidence.required ? "met" : ""}">${escapeHtml(RESEARCH_CHANNELS[channel].label)} ${evidence.current}/${evidence.required}</span>
            `).join("");
            const status = item.completed ? "Complete"
              : !item.prerequisitesMet ? `Needs ${prereqNames.join(", ")}`
                : !item.evidenceMet ? "Gather evidence"
                  : !item.affordable ? `Need ${item.cost} insight` : `Research · ${item.cost} insight`;
            return `<article class="research-card ${item.completed ? "complete" : ""} ${item.canComplete || item.completed ? "" : "locked"}">
              <span class="research-branch">${escapeHtml(item.branch)}</span>
              <h4>${escapeHtml(item.label)}</h4>
              <p>${escapeHtml(item.summary)}</p>
              <div class="research-requirements">${requirements}</div>
              <div class="research-unlock">Unlocks: ${escapeHtml(item.unlock)}</div>
              <button data-research-project="${item.id}" type="button" ${item.canComplete ? "" : "disabled"}>${escapeHtml(status)}</button>
            </article>`;
          }).join("")}
        </div>
      </section>
    `).join("");

    const parkHtml = `<section class="research-section">
      <h3>Grow the park itself · ${parkGrowth.total}/${parkGrowth.cap} growth steps</h3>
      <div class="research-grid">
        ${parkGrowth.tracks.map((track) => {
          const capped = track.level >= track.max || parkGrowth.total >= parkGrowth.cap;
          const text = !track.unlocked ? `Research ${RESEARCH_PROJECTS[track.project].label}`
            : track.level >= track.max ? "Fully developed"
              : parkGrowth.total >= parkGrowth.cap ? "Current park growth cap reached"
                : `Grow · ${euro(track.cost)}`;
          return `<article class="research-card growth-card ${track.level ? "complete" : ""}">
            <div class="growth-head"><div><h4>${escapeHtml(track.label)}</h4><small>L${track.level}/${track.max}</small></div></div>
            <p>${escapeHtml(track.effect)}</p>
            <button data-grow-park="${track.id}" type="button" ${!track.unlocked || capped ? "disabled" : ""}>${escapeHtml(text)}</button>
          </article>`;
        }).join("")}
      </div>
    </section>`;

    const entities = (state.world?.entities ?? [])
      .map((entity) => getEntityGrowthView(state, entity.id))
      .filter((view) => view?.tracks?.length);
    const entityHtml = `<section class="research-section">
      <h3>Grow individual park elements</h3>
      <div class="research-grid">
        ${entities.map((view) => `<article class="research-card growth-card">
          <div class="growth-head"><div><h4>${escapeHtml(view.label)}</h4><small>${escapeHtml(view.entityId)} · ${view.total}/${view.cap} steps</small></div></div>
          ${view.tracks.map((track) => {
            const capped = track.level >= track.max || view.total >= view.cap;
            const lockedProject = RESEARCH_PROJECTS[track.projectId]?.label ?? "required research";
            const text = !track.unlocked ? `Research ${lockedProject}`
              : track.level >= track.max ? "Max"
                : view.total >= view.cap ? "Growth cap"
                  : `${euro(track.cost)} · grow`;
            return `<div class="growth-track">
              <div><b>${escapeHtml(track.label)} · L${track.level}/${track.max}</b><small>${track.unlocked ? "Functional investment" : `Locked by ${escapeHtml(lockedProject)}`}</small></div>
              <button data-grow-entity="${view.entityId}" data-growth-track="${track.id}" type="button" ${!track.unlocked || capped ? "disabled" : ""}>${escapeHtml(text)}</button>
            </div>`;
          }).join("")}
        </article>`).join("")}
      </div>
    </section>`;

    const evidenceHtml = Object.entries(RESEARCH_CHANNELS).map(([id, channel]) => `
      <div class="research-evidence-card"><small>${escapeHtml(channel.icon)} ${escapeHtml(channel.label)}</small><b>${research.evidence[id]}</b></div>
    `).join("");

    this.content.innerHTML = `
      <div class="research-hero">
        <div>
          <p class="eyebrow">Research & Growth</p>
          <h2>Learn from the park you actually run.</h2>
          <p>Normal play creates evidence. Evidence turns into insight automatically. Research unlocks capabilities; you still choose where park money is invested. Nothing upgrades itself behind your back.</p>
        </div>
        <div>
          <div class="research-insight"><small>Available research insight</small><b>${research.insight}</b><small>Next insight: ${research.insightProgress.toFixed(1)} / ${research.insightUnit} evidence units · lifetime ${research.lifetimeInsight}</small></div>
          <div class="research-evidence">${evidenceHtml}</div>
        </div>
      </div>
      ${projectHtml}
      ${parkHtml}
      ${entityHtml}
      <div class="research-note">Research is functional, not cosmetic: throughput changes cycle/service rhythm, reliability protects ride condition, experience/quality changes guest outcomes, efficiency lowers real operating burden, and park growth changes hospitality/operations/identity. Style upgrades can remain a separate layer later.</div>
    `;

    this.content.querySelectorAll("[data-research-project]").forEach((button) => button.addEventListener("click", () => {
      this.perform({ type: "completeResearch", projectId: button.dataset.researchProject });
    }));
    this.content.querySelectorAll("[data-grow-park]").forEach((button) => button.addEventListener("click", () => {
      this.perform({ type: "growPark", track: button.dataset.growPark });
    }));
    this.content.querySelectorAll("[data-grow-entity]").forEach((button) => button.addEventListener("click", () => {
      this.perform({ type: "growEntity", entityId: button.dataset.growEntity, track: button.dataset.growthTrack });
    }));
  }
}
