# Pharos — Architecture

## The thesis in one paragraph

Polymarket and Kalshi macro contracts have one number: the crowd's. Pharos
contracts have two — the crowd's and the framework's. An autonomous pricing
oracle reads the live Lighthouse Macro database (2,500 series, the same models
that power the research product), and posts a point-in-time fair-value
probability on every market it opens. The market maker's prior is a quant macro
model, not a guess. The visible spread between the framework price and the
crowd price is the product, and it is defensible because nobody else in the
field has the model.

## Why it fits RFB 03 (macro prediction-market verticals)

* Binary, short-duration markets on CPI, NFP, GDP, FOMC.
* Auto-resolving on official BLS / BEA / Federal Reserve data feeds.
* Fully agent-operated: the calendar drives market creation, the data feed
  drives resolution, no human in the loop.
* Arc-native: USDC settlement, USDC-denominated gas (a bettor never has to
  "go buy ETH first"), and an encrypted mempool so a seven-figure macro
  position does not leak its intent to the market maker before it fills.

## Components

```
 Lighthouse_Master.db ─► pricing engine ─► FastAPI (:6910) ─► Next.js UI
  (live, 2,500 series)    (the moat)            │                (dual-price)
                                                │
 econ calendar ─► market-creator agent ─► PharosFactory.createMarket()
  (BLS/BEA/Fed)    (opens + seeds at the      │  seeds liquidity, posts the
                    framework's fair value)    │  framework prob on-chain
                                                ▼
                                         PharosMarket (Arc, USDC)
                                         binary CPMM + complete-set escrow
                                                ▲
 official print ─► oracle agent ─► PharosMarket.resolve(outcome)
  (FRED/BLS, the     (resolves on the
   ingested data)     same transform it priced)
```

### 1. Contracts — `contracts/` (Solidity 0.8.24, Hardhat, OpenZeppelin)

* `PharosMarket` — one binary market. USDC collateral, a constant-product AMM
  over YES/NO, a separately posted `frameworkProbBps`, oracle-gated
  resolution, complete-set redemption.
* `PharosFactory` — deploys + seeds markets atomically, role-gated to the
  creator agent; wires the resolver and pricing-oracle roles at birth.
* `MockUSDC` — 6-dp testnet USDC (Arc has native USDC; the address is a
  constructor argument in production).

**Solvency is provable, not asserted.** Every USDC deposited mints exactly one
complete set (1 YES + 1 NO). Exactly one side wins, each winning share redeems
exactly 1 USDC, so total payout == collateral by construction with zero fee. No
oracle value, parameter, or trade sequence can make the contract insolvent. The
test suite checks the invariant `totalCollateral == outstandingYes ==
outstandingNo` after every trade and proves the contract drains to exactly zero
after resolution + redemption + LP withdrawal. `make test` — 6/6.

### 2. Pricing engine — `pricing/` (the moat)

Reads `Lighthouse_Master.db` read-only. For each market:

1. **Point-in-time information state.** Only data that was public on the
   market-creation date is used — observations are excluded until
   `period-start label + publication lag`. No look-ahead, no vintage leakage.
2. **Consistent trend nowcast.** A blend of seasonally-adjusted 3m/3m and
   6m/6m annualized trends instead of a single noisy print.
3. **Sequential zn-score** of the relevant pillar (Inflation Heat for CPI,
   Labor Fragility for NFP, Activity Pulse for GDP, Macro Risk Index for
   FOMC), normalized around a neutral level using only past information.
4. **Signal-return calibration.** The pillar→outcome relationship is fit on
   aligned history, not hand-picked. The engine reports the information
   coefficient and balanced accuracy, and **shrinks the probability toward
   0.50 in proportion to demonstrated skill** — a pillar with no edge does not
   get to express conviction. (Observed live: CPI/Inflation Heat earns full
   conviction at IC +0.30; GDP/Activity Pulse is shrunk to ~50% at IC +0.01.)

Each quote ships with its information state (as-of date, publication lag,
grading) so the framework price is auditable and vintage-tagged.

**Methodology credit.** The point-in-time discipline, consistent trends,
zn-scores, and signal-return calibration are grounded in the Macrosynergy /
JPMaQS quantamental approach. Those source documents are proprietary and
confidential — no text, ticker catalog, dataset, or package from them is
reproduced or depended on. The *concepts* are applied to Lighthouse Macro's
own framework and data.

### 3. Agents — `agents/`

* `market_creator` — reads the econ calendar, opens + seeds each market a lead
  window ahead of its release, posting the framework price on-chain. Can also
  re-post the framework price on open markets as new data lands (the framework
  price is a live oracle, not a one-time seed).
* `oracle` — after the release time (measured against chain time, the same
  clock the contract enforces), computes the realized outcome with the *same
  transform* used to price the market and resolves it.
* `runner` — `status / create / reprice / resolve / once / demo-market /
  trade / fastforward`.

### 4. Front-end — `web/` (Next.js 14, LHM 23/89/BB palette)

A market grid where each card shows the crowd price and the framework price on
one gauge, the edge in percentage points, the framework's reasoning, the
signal-quality chips (IC, balanced accuracy, n, conviction), and the
point-in-time stamp. `/api/markets` proxies the pricing service and falls back
to a clearly-labelled cached sample (real captured values) if the service is
down, so the UI always demos.

## Renaming

`Pharos` (the Lighthouse of Alexandria) is the working name — it ties to
Lighthouse Macro without colliding with the publication brands (The Beacon /
The Beam / The Horizon). It is centralized: the package names, the on-chain
contract names, and the UI string. A rename is a scoped find/replace, not a
refactor. Flagged for Bob's call.

## Build status

| Layer | State |
|---|---|
| Contracts | ✅ compile, 6/6 tests incl. provable solvency |
| Pricing moat | ✅ live against Lighthouse_Master.db, methodology validated |
| Agents | ✅ create / reprice / resolve, full e2e on a local chain |
| Pricing API | ✅ FastAPI on :6910, TTL-cached |
| Front-end | ✅ builds, serves, live data, brand-themed |
| End-to-end | ✅ `make demo` — 6 markets opened at framework prices, a crowd trade opens a +33pp edge, oracle resolves on real CPI data |
| Arc testnet deploy | ⬜ scripted (`deploy:arc`), needs RPC + key — local chain proven |
| Wallet trade UI | ⬜ read-side live; viem trade hook is the next slice |

## Run it

```bash
make setup     # deps + compile
make test      # solidity suite (incl. solvency invariant)
make price     # framework prices vs the live DB
make demo      # full end-to-end on a local chain
make serve     # pricing API :6910      (then) cd web && npm run dev
```

---

Lighthouse Macro · Research · @LHMacro
