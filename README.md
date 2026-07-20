# hackathon 

**Macro prediction markets on Arc, priced by the Lighthouse Macro framework.**

> Working name. `Pharos` = the Lighthouse of Alexandria. Ties to Lighthouse Macro
> without colliding with the publication brands (The Beacon / The Beam / The
> Horizon). The name lives in exactly one place per layer — see
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#renaming) — rename is a find/replace.

Built for the **Agora Agents Hackathon** (Canteen × Circle × Arc), RFB 03 —
macro prediction-market verticals.

---

## The one-liner

Every Polymarket / Kalshi macro contract has one price: what the crowd thinks.
Pharos contracts have **two** — the crowd price *and* the framework price. The
Lighthouse Macro 12-pillar model (2,500 series, real database) posts a
fair-value probability on every market it creates. The spread between the two
**is the product.**

Binary outcomes on CPI, NFP, GDP, FOMC. Short duration. Auto-resolving on
official BLS / BEA / Federal Reserve data. Settled in USDC on Arc, with
USDC-denominated gas (no "go buy ETH first" friction) and an encrypted mempool
so a 7-figure macro bet does not leak intent to the market maker.

## Why this is defensible

It is not a better AMM. The AMM is a forked, well-trodden CPMM. The moat is the
**pricing oracle**: an autonomous agent that reads `Lighthouse_Master.db`, runs
the same pillar models that power the Lighthouse Macro research product, and
opens every market *at the framework's fair value*. The framework is the market
maker's prior. Nobody else in the field has a quant macro model behind the quote.

## Architecture (one screen)

```
  Lighthouse_Master.db ──► pricing engine ──► /price  (FastAPI, :6910)
   (2,500 real series)      (pillar models)      │
                                                 ▼
  econ calendar ──► market-creator agent ──► PharosFactory.createMarket()
   (BLS/BEA/Fed)     (deploys 14d ahead,        │   seeds liquidity AT
                       seeds at framework p)     │   framework probability
                                                 ▼
                                          PharosMarket  (Arc, USDC)
                                          binary CPMM + complete-set escrow
                                                 ▲
  official print ──► oracle agent ──► PharosMarket.resolve(outcome)
   (FRED/BLS at        (auto-resolve on
    release time)       the data feed)
                                                 ▼
                                       Next.js front-end — dual-price card
```

Four layers, three of them agents:

| Layer | Path | Stack |
|---|---|---|
| Smart contracts | `contracts/` | Solidity 0.8.24, Hardhat, OpenZeppelin |
| Pricing engine (the moat) | `pricing/` | Python, FastAPI, reads the real LHM DB |
| Agents | `agents/` | Python + web3 (creator + oracle + runner) |
| Front-end | `web/` | Next.js 14, wagmi/viem, LHM 23/89/BB palette |

Full design: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Pitch outline:
[`docs/PITCH.md`](docs/PITCH.md).

## Quick start

```bash
make setup            # installs hardhat deps, python venv, web3, web deps
make test             # solidity test suite (market lifecycle, solvency)
make price            # sanity-check the pricing engine against the live DB
make demo             # full end-to-end on a local chain (see below)
```

`make demo` runs the whole thing with **real framework prices from the live
database**: spins a local chain, deploys, the market-creator agent reads the
2026 econ calendar and opens markets seeded at the LHM fair value, simulates
trades that move the crowd price away from fair value, then the oracle agent
resolves a market on a real historical print and pays the winners in USDC.

## Status

See [`docs/ARCHITECTURE.md#build-status`](docs/ARCHITECTURE.md#build-status)
for the day-by-day sprint board and exactly what is wired vs. stubbed.

---

Lighthouse Macro · MACRO, ILLUMINATED.
