# Stewardship — 1980 Career Payments + Cash Logistics

Status: **SOURCE-INTEGRATED / AWAITING LOCAL TEST/BUILD**

This pass changes the playable career economy from a timeless single-money abstraction into a historically evolving payment layer beginning in **1980**.

It remains additive over the preserved simulator:

```text
preserved simulation
  -> research / functional growth
    -> installed upgrades
      -> historical payment evolution + cash logistics
```

The base simulation still owns guest spending and emits committed `economy.income` events. The historical layer classifies those already-real sales afterward. It does not invent duplicate admission, ride, or service revenue.

## Career calendar

The historical timeline begins in **1980**.

For playability, historical years use one isolated compression constant:

- 4 representative operating days = 1 career year.

This is deliberately a game-timescale abstraction, not a claim that four real park days equal a calendar year. The constant lives in `historicalTimeline.js` so local playtesting can slow or accelerate the career without rewriting payment logic.

Current milestone ordering is based on Dutch payment-history anchors:

- 1980 — cash-first starting era;
- 1988 — early PIN/debit technology can become researchable;
- 1996 — wider park PIN-network adoption project becomes available;
- 2014 — contactless checkout becomes researchable;
- around 2015 — model market preference reaches roughly half electronic;
- 2025 — model market preference reaches roughly 83% electronic / 17% cash.

The market curve between milestone points is interpolated rather than jumping instantly on January 1.

## Bank balance versus office vault

Existing `state.economy.cash` now represents **spendable bank/liquid funds** at the final historical runtime layer.

Cash guest payments are handled differently:

1. the preserved simulation books the gross income normally;
2. the historical layer recognizes the committed guest-payment event;
3. the same gross amount is removed from immediately spendable bank funds;
4. it is moved into `state.payments.officeVault`.

Therefore:

- revenue is still earned once;
- day/lifetime income remain truthful gross revenue;
- cash does not become spendable twice;
- building, maintenance, research investment and upgrades continue to use the existing spendable bank balance;
- a profitable park can temporarily have weak liquidity because physical cash is still in the office.

This separation is intentional.

## Which income is classified

Only real guest payment sources are routed through payment-method logic:

- Admission;
- Ride ticket;
- Service sale.

Non-guest accounting events such as recovered construction material or adventure rewards are not arbitrarily turned into till cash.

## Cash transaction cost

Cash currently has:

**€0 per-transaction processing fee.**

There is no fake till-counting minigame and no hidden percentage haircut on normal cash sales.

Its tradeoff is **liquidity delay and physical storage in the office vault**.

## Weekly collection car

The park has an automatic cash-collection route every **7 operating days**.

When the collection day begins:

- the final historical runtime checks the due collection before the first normal minute runs;
- the entire office vault is transferred to the spendable bank balance;
- the vault becomes zero;
- gross revenue is not booked again;
- there is currently **no collection fee**.

The first source attempt deliberately follows the existing `startNextDay` / day-report authority rather than assuming the park reaches midnight. `historicalEconomyRuntime.js` therefore checks a due pickup at the beginning of the new operating day's first tick.

## Manual bank run

The player can choose to access office-vault money early from the **Cash Office**.

Current explicit rule:

- available whenever the vault contains money;
- deposits the current vault immediately;
- **10% of that early deposit is lost**;
- **90 in-game minutes pass** while the player/manager is away;
- the park continues simulating during those 90 minutes;
- cash earned while the trip is happening remains new vault cash;
- if the operating day ends during the trip, the normal day-report stop still wins.

The 10% cut came from the requested design. The 90-minute duration is an isolated source-pass choice for later local tuning.

There is no driving minigame.

## Electronic payments

Electronic payments settle directly into spendable bank funds, but a small processing fee is booked as a real cost.

Current stylized fee rates:

- before 2000: 0.60%;
- 2000–2013: 0.45%;
- 2014 onward: 0.30%;
- minimum booked fee on an electronic transaction: €0.01.

These fee rates are gameplay approximations, not claims of exact historical Dutch merchant tariffs.

The important simulation behavior is the tradeoff:

- cash = no transaction fee, but vault delay;
- electronic = immediate bank liquidity, but tiny accumulating fee.

## Era payment mix

The visitor market has an era-based electronic preference curve.

Current anchor shares:

- 1980: 0%;
- 1988: 2%;
- 1992: 4%;
- 2000: 20%;
- 2005: 32%;
- 2010: 43%;
- 2015: 50%;
- 2020: 72%;
- 2025: 83%;
- 2035: 90%.

The park does **not** automatically receive that whole share. Acceptance is capped by the payment technology the player has adopted.

## Payment-technology research

Payment modernization uses the existing Research evidence/Insight resources, but lives in the Cash Office as a dedicated historical technology lane.

### PIN / Debit Terminals

Available from **1988**.

Requires:

- Commerce evidence;
- Operations evidence;
- research Insight.

Effect:

- park can accept up to 25% electronic payments, still capped by visitor-era preference.

### Park-wide PIN Network

Available from **1996** after PIN / Debit Terminals.

Requires more:

- Commerce evidence;
- Guest-services evidence;
- Operations evidence;
- research Insight.

Effect:

- acceptance cap rises to 70%.

1996 is a gameplay adoption milestone in this source pass, not a claim that every Dutch park adopted one specific network in that exact year.

### Contactless Checkout

Available from **2014** after the park-wide PIN network.

Effect:

- the park can follow the full era-appropriate electronic share.

Technology existence and park adoption are intentionally separate. Reaching a year makes technology *available to research*; it does not silently install it.

## Deterministic method assignment

Each committed guest-payment event is assigned cash/electronic deterministically from:

- event sequence;
- event subject;
- sale label;
- sale amount;
- current career year.

No nondeterministic browser randomness is introduced.

## Cash Office UI

Added:

`playable_3d/src/ui/cashOfficeUI.js`

It exposes:

- career year;
- spendable bank balance;
- physical office-vault cash;
- days until weekly collection;
- accepted cash/electronic mix;
- wider visitor market electronic preference;
- current electronic fee rate;
- today's/lifetime processing fees;
- payment technology research;
- manual 10% / 90-minute early bank route.

Opening the Cash Office pauses the normal real-time loop, consistent with the existing Research Lab / Upgrade Bay / Coaster Studio tool-dialog pattern.

The 90-minute manual bank action intentionally runs the final historical simulation even while the dialog is open, then refreshes the view.

## Save compatibility

`save.js` now normalizes and preserves:

- historical timeline state;
- office-vault balance;
- payment technology completion;
- cash/electronic ledger totals;
- collection/manual-bank history.

`SAVE_VERSION` remains 3.

Older saves receive safe 1980/default historical-payment state during migration rather than being rejected.

## Authority boundary

The preserved `simulation.js` remains unaware of:

- historical payment mix;
- office vault;
- PIN research;
- contactless research;
- weekly collection;
- manual bank runs.

It continues to own the real guest sale first.

The historical wrapper is responsible only for:

- payment-method classification;
- liquidity location;
- payment fee cost;
- payment technology adoption;
- weekly/manual cash settlement.

## Focused proof

Added:

`playable_3d/tests/historical-economy.test.js`

Coverage includes:

- 1980 start year;
- compressed-year isolation;
- 1988 and 2025 year mapping;
- cash income moved from spendable bank funds to office vault;
- no duplicate income booking;
- free full weekly vault transfer;
- 10% manual-bank cut;
- 90-minute manual-bank time cost;
- year/evidence/Insight-gated PIN research;
- 2015 50/50 market anchor;
- 2025 card-majority market anchor;
- electronic fee accumulation;
- modern mix still retaining some cash;
- save round-trip;
- preserved simulation independence;
- final runtime layering;
- Cash Office UI presence.

## Verification truth boundary

This GitHub-connected seat can inspect and mutate source but is not the trusted local Node/WebGL/build environment.

Therefore the status remains:

**SOURCE-INTEGRATED / AWAITING LOCAL TEST/BUILD**

No full Node-suite, real browser/WebGL or production-build PASS is claimed here.

`dist/game.js` remains intentionally untouched.

Later local intake should specifically test:

- whether 4 operating days/year is too fast or too slow;
- liquidity pressure in the 1980 cash-first era;
- weekly-pickup timing immediately after `startNextDay`;
- bank balance behavior if cash reclassification meets same-minute operating costs;
- manual bank run crossing closing time;
- payment mix across milestone years;
- fee accumulation on many very small sales;
- technology research pacing;
- Cash Office readability on phone;
- save migration from pre-history saves;
- balance interaction with Research/Growth/Upgrades.
