# Pharos — Read This First

A plain-language brief. No crypto jargon left undefined. Diagrams included.
This is the thing to read before we build the presentation.

---

## 1. The one sentence

**Pharos is a prediction market for macro prints (CPI, jobs, GDP, the Fed)
where the Lighthouse framework posts its own fair-value odds next to the
crowd's, settled in USDC on Arc, run entirely by agents.**

Every other macro prediction market shows one number: what the crowd bet.
Ours shows two. The crowd's, and the framework's. The gap is the product.

---

## 2. The problem, and why it's ours to win

Prediction markets on macro data are growing fast (Polymarket, Kalshi). They
have a hole in the middle: **no fair value.** A contract says "will CPI be hot"
and the only signal is the crowd leaning on it. There is no model, no anchor,
no research. It is a thermometer with no zero point.

You already built the zero point. The 12-pillar framework, the composites, the
2,500-series database, the recession model. That is a macro pricing engine. It
has never been pointed at a market that needs exactly that.

The hackathon brief (RFB 03) literally asks for: short-duration binary macro
markets, auto-resolving on official data feeds, run by agents. That is a
description of the thing you can build better than anyone in the room, because
the hard part is not the plumbing. The hard part is the price. And the price is
your edge, not theirs.

```
   Polymarket / Kalshi macro market        Pharos macro market
   ┌────────────────────────────┐          ┌────────────────────────────┐
   │  "Will CPI be hot?"         │          │  "Will CPI be hot?"         │
   │                             │          │                             │
   │  crowd: 61%   ◄── one number│          │  crowd:     61%             │
   │                             │          │  framework: 83%  ◄── ours   │
   │  (no anchor, no model)      │          │  edge: +22pp, framework      │
   │                             │          │  says the crowd is low      │
   └────────────────────────────┘          └────────────────────────────┘
```

---

## 3. The whole system on one screen

Four pieces. Three of them are the "agents" the hackathon wants. Read the
arrows as "feeds".

```
   ┌──────────────────────────┐
   │  Lighthouse_Master.db    │   your live DB, 2,500 series, untouched
   │  (read-only)             │
   └────────────┬─────────────┘
                │
                ▼
   ┌──────────────────────────┐     the MOAT. turns pillars into a
   │  PRICING ENGINE (Python) │     probability for "CPI MoM >= 0.3%"
   │  point-in-time, no       │     etc. serves it over a tiny API.
   │  look-ahead              │
   └──────┬───────────────┬───┘
          │               │
          │               ▼
          │      ┌───────────────────────┐    reads the econ calendar,
          │      │  MARKET-CREATOR AGENT │    opens a market 2 weeks
          │      │  (autonomous)         │    before each release,
          │      └──────────┬────────────┘    seeds it, posts our price
          │                 │
          │                 ▼
          │      ┌───────────────────────┐    the "venue": a smart
          │      │   PHAROS MARKET       │    contract on Arc that
          │      │   (Solidity, on Arc)  │    holds USDC, runs the
          │      │   USDC escrow + AMM   │    odds, pays winners
          │      └──────────┬────────────┘
          │                 ▲
          │                 │
          │      ┌──────────┴────────────┐    after the print drops,
          │      │   ORACLE AGENT        │    pulls the official number,
          │      │   (autonomous)        │    resolves the market
          │      └───────────────────────┘
          │
          ▼
   ┌──────────────────────────┐
   │  WEB APP (Next.js)       │   the dual-price dashboard people see
   │  crowd vs framework      │
   └──────────────────────────┘
```

If you remember nothing else: **DB → price → open market → people bet →
official print → resolve → pay.** Agents do every step. No human in the loop.

---

## 4. The four pieces, in plain language

### A. The market itself (the "smart contract" on Arc)

A smart contract is just a program that lives on a blockchain and holds money.
Ours is an automated bookmaker for one yes/no question. It does three jobs:

1. **Holds the USDC.** Bettors send USDC, it escrows it.
2. **Quotes odds and moves them.** It uses an **AMM** (automated market
   maker). Think of it as a bonding curve: the more people buy YES, the more
   expensive YES gets and the cheaper NO gets. No order book, no counterparty
   matching, the curve always gives a price. This is the "crowd price."
3. **Pays out.** When the result is known, every winning share redeems for
   exactly 1 USDC. Losing shares are worth 0.

**The part worth understanding: it cannot go bust.** This is the one piece of
contract cleverness and it is worth a sentence at a dinner.

```
   Every 1 USDC that comes in  ──►  mints exactly  1 YES  +  1 NO
                                                    └──┬──┘
                                          exactly ONE side wins
                                          each winning share pays 1 USDC
   ⇒ total paid out  ==  total collected.   ALWAYS. by construction.
```

There is no parameter, no oracle value, no sequence of trades that can make it
owe more than it holds. The test suite proves it: the contract drains to
exactly zero after everyone redeems. That is the "complete-set" design. You can
say "provably solvent" and mean it.

"On Arc" + "USDC settlement" practically means: bettors pay in dollars (USDC),
the gas to place the bet is also paid in USDC (Arc's trick, no need to go buy a
separate gas token first), and it settles instantly. For an institution, Arc
also has an encrypted mempool, which means a large bet does not broadcast its
intent before it lands. That is a real selling point Polymarket cannot make.

### B. The pricing engine (the moat — section 5 goes deep)

This is the only piece that is hard to copy and it is the reason to do this at
all. It reads your DB and answers one question per market: **what is the
probability this print clears this number?** It is your research desk, turned
into an automated line-setter.

### C. The agents (this is the "agent" the hackathon is judging)

Three small autonomous programs. No human runs them.

- **Market-creator:** reads the 2026 economic calendar, and ~2 weeks before
  each CPI / jobs / GDP / FOMC release, opens a market on-chain, seeds it with
  USDC liquidity, and posts the framework's price. It can also re-post the
  framework price as new data lands, so the framework line is *live*, not a
  one-time guess.
- **Oracle:** after the release time passes, pulls the actual government number
  and resolves the market. Resolves on the *same* calculation it priced with,
  so the question, the price, and the settlement are internally consistent.
- **Runner:** the conductor (`status`, `create`, `resolve`, `demo`, etc).

### D. The front-end

A clean dashboard in your brand palette (the 23/89/BB Ocean/Dusk colors). Each
market is a card with one gauge showing both prices, the edge, the framework's
reasoning, and the signal-quality readout. Section 6 has the picture.

---

## 5. The moat, in detail (this is the part to really get)

Here is how a market like *"US headline CPI trend ≥ 3.0%"* gets its framework
probability. Follow the pipeline. The numbers are the real ones from your DB.

```
  CPIAUCSL (your DB)
        │
        ▼
  ┌─────────────────────────┐   1. POINT-IN-TIME slice
  │ drop any data that      │      only what was public on the day the
  │ wasn't public yet       │      market opened. publication-lagged.
  └───────────┬─────────────┘      this is your backtest discipline.
              ▼
  ┌─────────────────────────┐   2. CONSISTENT TREND nowcast
  │ blend 3m/3m + 6m/6m     │      not a single noisy print. a
  │ seasonally-adj annual   │      de-noised trend.   →  μ ≈ 5.30%
  └───────────┬─────────────┘
              ▼
  ┌─────────────────────────┐   3. PILLAR SIGNAL
  │ Inflation Heat (PCI),   │      your pillar, normalized into a
  │ sequential zn-score     │      clean z-score.    →  +0.02σ
  └───────────┬─────────────┘
              ▼
  ┌─────────────────────────┐   4. CALIBRATION  (the clever bit)
  │ regress the realized    │      how well has this pillar actually
  │ outcome on the lagged   │      predicted this print, historically?
  │ pillar over history     │      → IC +0.30, balanced acc 0.57, n=241
  └───────────┬─────────────┘
              ▼
  ┌─────────────────────────┐   5. CONVICTION SHRINK
  │ trust the tilt in       │      strong demonstrated edge → full
  │ proportion to proven    │      conviction. weak edge → pull the
  │ skill                   │      probability back toward 50%.
  └───────────┬─────────────┘
              ▼
        Φ((μ − strike)/σ),  shrunk
              ▼
        framework = 83.2% YES
```

Three things in here are the whole pitch. Each maps to something you already
believe.

**1. Point-in-time = your look-ahead discipline, enforced.**
You already refuse to backtest with data you wouldn't have had. The engine does
the same for every quote: a market that opened on May 2 is priced only with
prints that were public on May 2. No vintage leakage. This is exactly the
JPMaQS / Macrosynergy "information state" idea, and it is the difference
between a real macro signal and a curve-fit.

**2. The conviction shrink = your own position sizing.**
Your strategy sizes positions `Base × Conviction × Regime`. The pricing engine
does the identical thing to itself. It measures how well a pillar has actually
predicted a print (the information coefficient), and it only expresses a strong
view when the history earns it. When it doesn't, it shrinks toward 50% and
says so.

You can watch this work, live, right now:

```
  CPI  / Inflation Heat   IC +0.30  →  conviction 1.00  →  83.2%  (committed)
  GDP  / Activity Pulse   IC +0.01  →  conviction 0.04  →  50.5%  (abstains)
```

The GDP market is the proof the thing is honest. The pillar has no demonstrated
edge on that print, so the model refuses to fake a view. A model that knows
when it doesn't know is the credible one. That single behavior is the answer to
"is this real or hand-waved."

**3. The Macrosynergy lineage, and the line I did not cross.**
You pointed me at the Macrosynergy / JPMaQS material. I read the cheat sheet
and the package intro and built the methodology in: point-in-time information
states, consistent annualized trends, zn-scores, signal-return calibration. But
those documents are stamped proprietary and confidential. So I used the
*concepts* (which are also public in their free Academy) applied to *your* data
and *your* framework. **No Macrosynergy text, ticker list, dataset, or code is
in the repo, and we do not depend on their package or their JPMaQS feed.** That
matters for IP and for what you can say publicly: we can say "methodology in
the quantamental tradition," we cannot say "powered by JPMaQS," and we are not.

---

## 6. The dual price — the actual product

This is the screen. One gauge, two pins.

```
  US headline CPI trend for May 2026  ≥  3.00%  (3m/6m saar)

  0%                                                          100%
   ├──────────────●──────────────────────────────●─────────────┤
                  ▲ crowd 61%                     ▲ framework 83%

        ┌─────────────────────────────────────────────┐
        │  EDGE  +22pp   "framework sees YES underpriced"│
        └─────────────────────────────────────────────┘

  why: consistent trend nowcast 5.30% vs 3.00% strike. Inflation
       Heat +0.02σ, IC +0.30, n=241. conviction 1.00.
  point-in-time 2026-05-16 · pub-lag 41d · grading 2.25
```

That edge number is the reason a trader opens the app instead of Polymarket. It
is your research, priced, on every contract, with the receipts attached.

---

## 7. What's real vs. what's scaffolded (no spin)

| Piece | State | Honest read |
|---|---|---|
| Smart contracts | ✅ done | compile, 6/6 tests, solvency proven |
| Pricing engine | ✅ done | runs on the live DB, methodology validated |
| Agents (create/price/resolve) | ✅ done | full end-to-end on a local chain |
| Pricing API + web UI | ✅ done | builds, serves live data, brand-themed |
| End-to-end demo | ✅ done | `make demo` runs the whole story |
| Deploy to Arc testnet | ⬜ scripted, not run | needs the Arc RPC URL + a key. local chain fully proven, so this is config not building |
| Wallet "place a bet" UI | ⬜ next slice | the dashboard reads on-chain; the click-to-bet flow is the next build |
| 2026 calendar dates | ⚠ encoded, flagged | from public BLS/BEA/Fed schedules, tagged "verify before mainnet" |

Nothing here is faked. The one thing that is sample-not-live is the UI's
fallback if the Python service is off, and it is labelled as such and uses real
captured numbers.

---

## 8. The demo, as a story

`make demo` tells this in about 90 seconds, on a throwaway local chain, with
real prices from your live DB:

1. The creator agent opens **6 markets** for the 2026 calendar (CPI, jobs,
   GDP, FOMC), each seeded at the framework's point-in-time fair value.
2. A simulated crowd piles into NFP on the NO side. The crowd price craters
   from 50% to 13%. The framework holds at 46%. **A +33pp edge opens, on
   chain.**
3. A market hits its release time. The oracle agent pulls the real CPI figure,
   sees the realized trend was 6.2% against a 3.0% strike, resolves it YES, and
   pays the winners in USDC.
4. The final book shows it RESOLVED, everyone settled, contract at zero.

That is the entire thesis, demonstrated, not described.

---

## 9. Decisions that need you

- **The name.** I'm using **"Pharos"** (the Lighthouse of Alexandria — the
  original lighthouse). It ties to Lighthouse Macro and does not collide with
  The Beacon / The Beam / The Horizon. It is centralized in the code, so a
  rename is a find/replace, not surgery. Your call to keep or change.
- **How much to tie it to the LHM brand.** Right now it wears your palette and
  the "MACRO, ILLUMINATED." mark. It can be a sub-brand of Lighthouse or a
  standalone. Branding question, not a code question.
- **Whether we deploy to the real Arc testnet now** or keep proving it locally
  until closer to submission. Needs the Arc RPC + a burner key.

---

## 10. The hard questions you'll get, and the answers

**"Isn't this just Polymarket / Kalshi?"**
No. Those are venues with no price. We are a venue with a *model*. The contract
layer is a commodity we forked in an afternoon. The price is the product, and
the price is a 2,500-series macro framework run point-in-time.

**"Can't a team just fork your contracts?"**
Yes, in an afternoon, and it gets them nothing. The moat is not the AMM. It is
the framework and the data behind the quote. That is years of work, not a
weekend.

**"Is the model real or is it hand-waved?"**
Real, and it tells you when it isn't sure. Show them the GDP market: the engine
shrinks itself to 50% because that pillar has no demonstrated edge on that
print. A model that abstains when it lacks an edge is the credible one.

**"Who resolves it? What stops a bad resolution?"**
An agent pulls the official BLS/BEA/Fed number and resolves on the same
calculation used to price it. The settlement source is government data, not a
human's opinion.

**"What's the Arc-specific reason, not just any chain?"**
USDC-denominated gas (no friction of buying a gas token), instant USDC
settlement, and an encrypted mempool so a large macro bet doesn't leak intent.
The last one is the institutional wedge.

**"Can it rug or go insolvent?"**
No. Complete-set design: every dollar in mints one YES and one NO, exactly one
side wins, payout equals collateral by construction. Proven in tests.

**"Where do users come from?"**
Distribution is the unfair advantage. Lighthouse already publishes to an
audience that argues about these exact prints weekly. The market is the call to
action under the research, and every resolved market is a content unit.

---

## 11. Run it yourself (cheat sheet)

```bash
cd /Users/bob/LHM/Projects/pharos

make test     # the contract suite, incl. the solvency proof  (~10s)
make price    # framework prices vs your live DB, in the terminal
make demo     # the whole story end-to-end on a local chain  (~2 min)

make serve    # start the pricing API…
cd web && npm run dev   # …and the dashboard at localhost:3001
```

`make price` is the fastest way to feel the moat. It prints the framework's
probability and conviction for every market, straight off
Lighthouse_Master.db, in about ten seconds.

---

## 12. Risks and the opportunity-cost reality

Two honest flags, no editorializing.

- **It is a hackathon.** Judging weighs traction (users, volume). The build is
  strong and the moat is unique, but a testnet app with no users on submission
  day competes on promise, not metrics. The distribution story (your existing
  audience) is the answer, and it is real, but it is a story until it isn't.
- **Opportunity cost is what it is.** This is days against Tim Pierotti, Theo,
  paid-tier conversion, the two Mercor contracts. You weighed that in the
  desktop thread and said go. Noting it, not relitigating it.

What is not at risk: this is its own git repo, isolated, and the LHM
15-minute pipeline auto-sync cannot touch it. Nothing here destabilizes the
research stack.

---

Lighthouse Macro · Research · @LHMacro
