# Pharos — Pitch

**Agora Agents Hackathon · Canteen × Circle × Arc · RFB 03**

## The 90-second version

Every macro prediction market today shows one number: the crowd's guess. There
is no anchor, no fair value, no model. Pharos changes that.

Pharos opens binary markets on the prints that move the world — CPI, payrolls,
GDP, the Fed — and on every single one it posts a second number: the Lighthouse
Macro framework's probability. Not a vibe. A point-in-time quantamental nowcast
from a 2,500-series model, the same engine behind a live institutional research
product. The crowd trades against the framework. The spread between them is the
signal, and it is on-chain, in USDC, on Arc.

Three agents run it. One reads the economic calendar and opens markets two
weeks ahead, seeded with liquidity at the framework's fair value. One re-posts
the framework price as new data lands. One resolves every market on the
official government print. No human touches it.

## Why this wins, and why it is hard to copy

It is not a better AMM. The AMM is a forked, provably-solvent CPMM. The moat is
the **pricing oracle**: a macro model with a decade-plus of methodology behind
it, run point-in-time so there is no look-ahead, and honest enough to *shrink
its own confidence* when a signal has no demonstrated edge. A team can fork our
contracts in an afternoon. They cannot fork the framework.

## The Arc angle (three slides)

1. **USDC-native gas.** A bettor pays for the bet and the gas in USDC. No
   "acquire the chain's gas token first." For a macro punter that friction is
   the whole funnel.
2. **Encrypted mempool.** A seven-figure position on a CPI print does not leak
   its intent to the market maker before it fills. Polymarket cannot claim
   that. It is the institutional wedge.
3. **Instant USDC settlement.** Markets resolve on the print and pay the same
   block. No bridge, no wait.

## The demo (it runs today)

`make demo` on a local chain, with real framework prices from the live
Lighthouse database:

1. The creator agent opens six 2026 markets, each seeded at the framework's
   point-in-time fair value (CPI 83%, NFP 46%, GDP 50%, FOMC 30%).
2. A simulated crowd trades NFP toward NO — the crowd price drops to 13%, the
   framework holds 46%, a **+33pp edge** opens and is visible on-chain and in
   the UI.
3. A market reaches its release, and the oracle resolves it on the real CPI
   print (realized 6.2% vs a 3.0% strike → YES) and pays the winners in USDC.

## Traction plan (judging weighs active users / volume)

* Day 1–2: deploy to Arc testnet, the four verticals live, faucet USDC.
* Seed liquidity from a treasury wallet so every market has depth at open.
* Distribution is the unfair advantage: Lighthouse Macro already publishes to
  a macro audience that argues about exactly these prints every week. The
  markets are the call to action under the research.
* Each resolved market is a content unit — "the framework said 83%, the crowd
  said 50%, here is what happened" — which feeds the next cohort.

## Ask

Judge it on the moat. Anyone can list a CPI market. Pricing it with a real
macro framework, point-in-time, with calibrated and self-aware confidence, is
the thing that is rare.

---

Lighthouse Macro · Research · @LHMacro
