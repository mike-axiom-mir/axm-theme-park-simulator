import {
  PAYMENT_TECHNOLOGY, getHistoricalEconomyView
} from "../core/historicalEconomy.js";

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[char]));
const euro = (value) => `€${Number(value || 0).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const percent = (value) => `${Math.round(Number(value || 0) * 100)}%`;

function injectStyles() {
  if (document.getElementById("cash-office-styles")) return;
  const style = document.createElement("style");
  style.id = "cash-office-styles";
  style.textContent = `
    #cash-office-dialog { width:min(900px,calc(100vw - 24px)); max-width:none; max-height:calc(100vh - 30px); padding:0; border:1px solid rgba(238,219,177,.2); border-radius:12px; background:#101820; color:#f2ead9; }
    #cash-office-dialog::backdrop { background:rgba(3,7,11,.78); }
    .cash-office-shell { position:relative; padding:20px; overflow:auto; max-height:calc(100vh - 34px); }
    .cash-office-close { position:absolute; right:12px; top:12px; width:32px; height:32px; padding:0; }
    .cash-office-hero { padding-right:42px; }
    .cash-office-hero h2 { margin:0 0 5px; font-size:24px; }
    .cash-office-hero p { margin:0; color:#aeb6ba; font-size:11px; line-height:1.5; }
    .cash-office-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin-top:16px; }
    .cash-office-card { padding:12px; border:1px solid rgba(238,219,177,.15); border-radius:8px; background:rgba(255,255,255,.025); }
    .cash-office-card small { display:block; color:#9ea7ad; font-size:9px; }
    .cash-office-card b { display:block; margin-top:3px; font-size:20px; }
    .cash-office-card.gold { border-color:rgba(240,199,102,.34); background:rgba(240,199,102,.055); }
    .cash-office-section { margin-top:20px; }
    .cash-office-section h3 { margin:0 0 8px; color:#f0c766; font-size:11px; text-transform:uppercase; letter-spacing:.12em; }
    .cash-office-tech { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:8px; }
    .cash-tech { padding:11px; border:1px solid rgba(238,219,177,.15); border-radius:8px; background:rgba(255,255,255,.025); }
    .cash-tech.complete { border-color:rgba(117,213,173,.4); background:rgba(117,213,173,.055); }
    .cash-tech.locked { opacity:.7; }
    .cash-tech h4 { margin:0 0 5px; font-size:13px; }
    .cash-tech p { margin:5px 0 8px; color:#aeb6ba; font-size:10px; line-height:1.45; }
    .cash-tech .unlock { color:#f0c766; font-size:9px; line-height:1.4; }
    .cash-tech .req { margin-top:7px; color:#9ea7ad; font-size:9px; line-height:1.45; }
    .cash-tech button { width:100%; margin-top:9px; }
    .cash-office-manual { display:grid; grid-template-columns:1fr auto; gap:12px; align-items:center; padding:12px; border:1px solid rgba(238,219,177,.15); border-radius:8px; background:rgba(255,255,255,.025); }
    .cash-office-manual p { margin:3px 0 0; color:#aeb6ba; font-size:10px; line-height:1.45; }
    .cash-office-note { margin-top:14px; padding:10px; border-left:3px solid #65bed1; color:#aeb6ba; background:rgba(101,190,209,.05); font-size:10px; line-height:1.5; }
    @media (max-width:700px) { .cash-office-grid { grid-template-columns:1fr 1fr; } .cash-office-manual { grid-template-columns:1fr; } }
  `;
  document.head.appendChild(style);
}

function createDialog() {
  const dialog = document.createElement("dialog");
  dialog.id = "cash-office-dialog";
  dialog.innerHTML = `<div class="cash-office-shell">
    <button class="cash-office-close" data-cash-office-close type="button">×</button>
    <div data-cash-office-content></div>
  </div>`;
  document.body.appendChild(dialog);
  return dialog;
}

function createButton() {
  const button = document.createElement("button");
  button.id = "cash-office-button";
  button.type = "button";
  button.textContent = "Cash Office";
  button.title = "1980→ future payment mix, office vault, weekly collection and payment technology";
  document.querySelector(".top-actions")?.prepend(button);
  return button;
}

export class CashOfficeUI {
  constructor({ getState, onAction, onMessage = () => {} }) {
    injectStyles();
    this.getState = getState;
    this.onAction = onAction;
    this.onMessage = onMessage;
    this.dialog = createDialog();
    this.button = createButton();
    this.content = this.dialog.querySelector("[data-cash-office-content]");
    this.dialog.querySelector("[data-cash-office-close]").addEventListener("click", () => this.close());
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
    this.onMessage(result?.message ?? result?.reason ?? "Cash Office action completed.", result?.ok ? "good" : "warning");
    this.render();
    return result;
  }

  render() {
    const view = getHistoricalEconomyView(this.getState());
    const cashShare = 1 - view.acceptedElectronicShare;
    const technologyHtml = view.technology.map((item) => {
      const prerequisites = item.prerequisites.map((id) => PAYMENT_TECHNOLOGY[id]?.label ?? id);
      const requirements = Object.entries(item.evidence)
        .map(([channel, value]) => `${channel} ${value.current}/${value.required}`)
        .join(" · ");
      const status = item.completed ? "Installed"
        : !item.yearMet ? `Available in ${item.minYear}`
          : !item.prerequisitesMet ? `Needs ${prerequisites.join(", ")}`
            : !item.evidenceMet ? "Gather evidence"
              : !item.affordable ? `Need ${item.cost} insight`
                : `Research · ${item.cost} insight`;
      return `<article class="cash-tech ${item.completed ? "complete" : ""} ${item.canComplete || item.completed ? "" : "locked"}">
        <small>${item.minYear} technology</small>
        <h4>${escapeHtml(item.label)}</h4>
        <p>${escapeHtml(item.summary)}</p>
        <div class="unlock">${escapeHtml(item.unlock)}</div>
        <div class="req">${escapeHtml(requirements || "No evidence requirement")}</div>
        <button data-payment-tech="${item.id}" type="button" ${item.canComplete ? "" : "disabled"}>${escapeHtml(status)}</button>
      </article>`;
    }).join("");

    this.content.innerHTML = `
      <div class="cash-office-hero">
        <p class="eyebrow">Park Cash Office · ${view.calendar.year}</p>
        <h2>The money exists. That does not mean it is in the bank yet.</h2>
        <p>Cash sales physically wait in the park office vault. The weekly collection car deposits them for free. Electronic payments settle directly to the bank but lose a tiny processing cut.</p>
      </div>
      <div class="cash-office-grid">
        <div class="cash-office-card gold"><small>Spendable bank balance</small><b>${euro(view.bankAvailable)}</b></div>
        <div class="cash-office-card"><small>Office vault · not spendable yet</small><b>${euro(view.officeVault)}</b></div>
        <div class="cash-office-card"><small>Weekly collection</small><b>${view.nextCollectionInDays} day${view.nextCollectionInDays === 1 ? "" : "s"}</b></div>
        <div class="cash-office-card"><small>Era payment mix accepted</small><b>${percent(cashShare)} cash</b><small>${percent(view.acceptedElectronicShare)} ${escapeHtml(view.electronicLabel)}</small></div>
        <div class="cash-office-card"><small>Visitor electronic preference</small><b>${percent(view.marketElectronicShare)}</b><small>Your technology can cap actual acceptance below this.</small></div>
        <div class="cash-office-card"><small>Electronic processing</small><b>${percent(view.electronicFeeRate)}</b><small>Today ${euro(view.today.electronicFees)} · lifetime ${euro(view.ledger.electronicFees)}</small></div>
      </div>

      <section class="cash-office-section">
        <h3>Cash logistics</h3>
        <div class="cash-office-manual">
          <div><b>Take the vault to the bank yourself</b><p>Available any day. Deposits the current vault immediately, but 10% is lost and ${view.manualBankRunMinutes} in-game minutes pass while you are away. Cash earned during the trip remains in the vault.</p></div>
          <button data-manual-bank-run type="button" ${view.officeVault > 0 ? "" : "disabled"}>Bank now · lose 10%</button>
        </div>
      </section>

      <section class="cash-office-section">
        <h3>Payment technology research</h3>
        <div class="cash-office-tech">${technologyHtml}</div>
      </section>

      <div class="cash-office-note">Career time is compressed for playability: ${view.calendar.representativeDaysPerYear} representative operating days = one historical year. The payment-era ordering and mix evolve by year; local playtesting can slow this constant later without changing the ledger architecture.</div>
    `;

    this.content.querySelectorAll("[data-payment-tech]").forEach((button) => button.addEventListener("click", () => {
      this.perform({ type: "completePaymentTechnology", technologyId: button.dataset.paymentTech });
    }));
    this.content.querySelector("[data-manual-bank-run]")?.addEventListener("click", () => {
      this.perform({ type: "manualBankRun" });
    });
  }
}
