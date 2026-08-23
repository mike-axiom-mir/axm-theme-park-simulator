# Stewardship — 1980 Career Payments + Cash Logistics

Status: **SOURCE-INTEGRATED / AWAITING LOCAL TEST/BUILD**

This pass gives the playable park a historically evolving career beginning in **1980**, with real separation between earned revenue, spendable bank funds and physical cash waiting in the park office.

It remains additive:

```text
preserved simulation
  -> research / functional growth
    -> installed upgrades
      -> historical payments + cash logistics + career timeline
```

The preserved simulation still owns guest spending first and emits committed `economy.income` events. The historical layer classifies those real sales afterward; it never invents duplicate admission, ride or service revenue.

## Career time versus map time

The historical calendar now belongs to the **whole park career**, not to the active map/scenario's local Day counter.

`historicalTimeline.js` keeps:

- `careerOperatingDay` — continuous across the entire career;
- historical start year — 1980;
- representative operating days per year — 8;
- active map id;
- map-start career day.

The current map may independently use local `clock.day` values.

This means a future campaign transition can do:

```text
Career: 2005 · career operating day 201
Map A: Day 27
   -> begin Map B
Career: 2005 · career operating day 201
Map B: Day 1
```

The year does **not** reset when a map starts at Day 1.

The same continuity also applies to:

- PIN/card adoption;
- payment-market mix;
- weekly cash-collection rhythm;
- payment ledger history.

`beginMapCampaignTimeline(...)` is the explicit seam for a future map-campaign loader.

## Historical-year pacing

The temporary 4-days/year value was too fast once normal theme-park fast-forward was considered.

The current source contract is:

- **8 representative operating days = 1 historical year**.

The playable park operates from 09:00 to 22:00, which is 780 simulated minutes per operating day.

The simulation tempo is 620 real milliseconds per simulated minute.

A shared `timeScale.js` now defines the playable speeds:

- Pause;
- 1×;
- 2×;
- 4×.

The previous 3× / 8× controls were replaced with the more conventional 2× / 4× controls.

Approximate uninterrupted real-time pacing is therefore:

- one operating day at 1×: 8.06 minutes;
- one operating day at 2×: 4.03 minutes;
- one operating day at 4×: 2.02 minutes;
- one historical year at 1×: 64.48 minutes;
- one historical year at 2×: 32.24 minutes;
- one historical year at 4×: 16.12 minutes.

Reaching 2025 from the beginning of 1980 therefore represents roughly twelve hours of uninterrupted 4× simulation, before player pauses, building, research and management time.

Simulation speed only changes **real-time playback**. It never changes career-day counting, historical year, research requirements or economic outcomes.

## Bank balance versus office vault

`state.economy.cash` is the spendable liquid/bank balance at the final historical runtime layer.

Cash guest payments are routed as follows:

1. the preserved simulation books gross income once;
2. the historical layer observes the committed guest-payment event;
3. the cash amount is removed from immediately spendable bank funds;
4. the same amount enters `state.payments.officeVault`.

Therefore a park can be profitable but temporarily unable to spend all of that money because some is physically still in the office.

## Classified guest income

The payment layer currently classifies only real guest-payment events:

- Admission;
- Ride ticket;
- Service sale.

Recovered building material, adventure rewards and other non-guest accounting events are not arbitrarily treated as till cash.

## Cash transaction cost

Normal cash has:

**€0 per-transaction processing fee.**

There is no counting-money or driving minigame.

Cash's cost is liquidity delay and physical storage.

## Weekly collection car

The collection car arrives every **7 career operating days**.

The schedule follows `careerOperatingDay`, not the current map's local day number. Starting a new campaign map therefore does not reset or accelerate the cash-truck schedule.

On collection:

- the full office vault transfers to spendable bank funds;
- the office vault becomes zero;
- gross revenue is not booked twice;
- there is currently no pickup fee.

## Manual bank run

The player can bank the current office vault early at any time.

Current explicit rule:

- full current vault is taken to the bank;
- 10% is lost and booked as a real cost;
- the remaining 90% becomes spendable bank money;
- 90 in-game minutes pass;
- the park continues operating during those 90 minutes;
- new cash earned during the trip remains as new vault cash;
- closing/day-report authority can still stop the elapsed-time simulation.

No travel minigame is introduced.

## Electronic payments

Electronic payments settle directly into spendable bank funds, with a small visible processing cost.

Current stylized gameplay rates:

- before 2000: 0.60%;
- 2000–2013: 0.45%;
- 2014 onward: 0.30%;
- minimum electronic fee: €0.01.

These are gameplay approximations rather than exact historical merchant tariffs.

The intended tradeoff is:

```text
cash        -> zero transaction fee -> delayed liquidity
PIN / card  -> immediate liquidity   -> tiny accumulating fee
```

## Era payment mix

Current market electronic-preference anchors:

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

The park can accept only the portion supported by technology it has actually researched.

## Payment research

### PIN / Debit Terminals

Available from 1988.

Requires Commerce + Operations evidence and Research Insight.

Acceptance cap: 25%.

### Park-wide PIN Network

Available from 1996 after early PIN terminals.

Requires additional Commerce + Services + Operations evidence and Insight.

Acceptance cap: 70%.

### Contactless Checkout

Available from 2014 after the park-wide PIN network.

Allows the park to follow the full era-appropriate electronic preference.

Historical availability and park adoption are deliberately separate: reaching a year makes technology researchable; it does not silently install it.

## Cash Office UI

The Cash Office shows:

- historical year;
- career operating day;
- current map-local day;
- spendable bank balance;
- physical office vault;
- next career-based weekly collection;
- accepted cash/electronic mix;
- broader market preference;
- electronic processing rate and accumulated fees;
- payment-technology research;
- manual 10% / 90-minute bank route;
- current 8-days/year pacing and its approximate duration at 4×.

## Save compatibility

Current save version remains 3.

Migration normalizes and preserves:

- historical career day;
- start year and year-compression constant;
- active map timeline metadata;
- office vault;
- payment technology;
- cash/electronic ledgers;
- collection/manual-bank history.

Legacy saves without `careerOperatingDay` infer it once from their existing local day, then use the separated career counter from that point forward.

## Authority boundary

`simulation.js` remains unaware of:

- historical years;
- career operating days;
- map-campaign continuity;
- payment mix;
- office vault;
- payment technology;
- cash collection;
- manual bank runs.

Historical logic observes committed simulation outcomes from outside the preserved core.

## Focused proof

`playable_3d/tests/historical-economy.test.js` now covers:

- 1980 start;
- 8 career operating days/year;
- 1988 and 2025 career-day mapping;
- map Day 1 reset without career-year reset;
- Pause / 1× / 2× / 4× contract;
- real-minute pacing at all active speeds;
- cash-to-vault routing without duplicate revenue;
- weekly pickup following career days rather than map days;
- manual 10% / 90-minute banking;
- payment year/research gates;
- modern card-majority mix and fees;
- save persistence of local map day + continuous career day;
- preserved-simulation independence.

## Verification truth boundary

This GitHub-connected seat can inspect and mutate source but is not the trusted local Node/WebGL/build environment.

Therefore:

**SOURCE-INTEGRATED / AWAITING LOCAL TEST/BUILD**

No full Node-suite, browser/WebGL or production-build PASS is claimed here.

`dist/game.js` remains intentionally untouched.

Later local intake should specifically test:

- whether ~16.1 real minutes/year at 4× feels right;
- whether 8 representative days/year gives enough time to use each era's technology;
- map-campaign transitions preserving year, cash truck and payment research;
- vault liquidity pressure in early cash-heavy years;
- manual-bank trips near closing time;
- 1× / 2× / 4× CPU/render stability;
- Cash Office readability on phone;
- save migration from pre-history saves;
- interaction with Research/Growth/Upgrades.
