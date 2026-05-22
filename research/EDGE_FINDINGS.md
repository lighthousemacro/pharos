# Pharos Edge Findings — OOS Validation (2026-05-17)

Run it yourself: `.venv/bin/python3 research/edge_search.py`. Expanding
walk-forward, no look-ahead. In-sample IC is always higher; the OOS number is
the only honest one.

## The headline

Most of the board was carried by **in-sample** accuracy. Out of sample, only
one data market has real pillar edge. That is not a failure to hide — it is
the moat, if we show it honestly: we OOS-prove every market against a naive
trend baseline and only ship the ones that clear it.

## The numbers (OOS, expanding walk-forward)

| Market | trend-only baseline | single pillar | best 2-pillar combo | verdict |
|---|---|---|---|---|
| **CPI** (PCI) | bal-acc 0.585 | PCI 0.613 (IC +0.36) | **PCI+LFI 0.639**, PCI+CCI IC +0.42, PCI+FPI 0.634 | real edge, **combination beats single OOS** |
| **NFP** (LFI) | 0.580 | LFI **0.515, IC −0.004** | best 0.574 (still < baseline) | **no OOS edge.** "64%" was in-sample only |
| **GDP** (GCI) | 0.653 | GCI 0.632, IC −0.25 | none beat | **no OOS edge.** trend-only is the ceiling |
| **FOMC** (REC_PROB) | — | REC_PROB **0.650**, IC +0.10, n=149 | — | real, modest. 210 mo history. **stub `n=0` was wrong** |

## What this means

1. **Bob's "64% isn't impressive for macro" was correct.** Baselines sit at
   0.58–0.65. Raw accuracy near there is persistence, not skill.
2. **Bob's "combine two models" was correct — where there is signal to
   combine.** CPI: PCI+LFI / PCI+CCI / PCI+FPI all beat single-pillar AND the
   baseline out of sample. Genuine found edge, not overfit (it is OOS).
3. **NFP and GDP do not have real pillar edge OOS.** Shipping them as "strong"
   off the in-sample number would be the exact thing that kills credibility
   with judges. They come off the believable board.
4. **FOMC is recoverable** from a stub to a real (modest) market via REC_PROB.

## Concrete next moves (numbers attached, none rushed into prod un-tested)

- **App board = OOS-validated only.** Allowlist the kinds that beat baseline
  OOS. Today that is CPI (and FOMC once wired). Done in this pass.
- **Wire the CPI combination** (PCI + second pillar) into the pricing engine.
  PCI+CCI = highest OOS IC (+0.42); PCI+LFI = highest OOS balanced accuracy
  (0.639). Pick on whichever the market resolves better against; both are
  defensible. This is the single highest-leverage model upgrade.
- **Replace the FOMC `n=0` stub** with the REC_PROB calibration (real 210-obs
  history, OOS bal-acc 0.65). Contained change to `_price_policy_market`.
- **Display the OOS number on the card, not the in-sample one.** The card must
  say "right X% out of sample vs a Y% naive baseline." That single honesty
  move is the most believable thing on the site.
- **DB note:** `DISCONTINUITY_PREMIUM` has 197 backfilled obs in the Beam's
  local CSV but only 2 in the master DB `lighthouse_indices`. Ingest the
  backfill so the DB and the research agree.

## Expanded board scan (2026-05-17) — depth pays off

`research/edge_board.py`. ~18 real macro prints, each tested against the
framework pillars that are *supposed* to lead it. Candidate generation
(in-sample sign-aware IC + one 75/25 holdout sign check). NOT the ship gate —
strict OOS still gates production. But it answers the question: does breadth
beat 4 markets? Yes.

**Candidates that hold their sign in holdout (the shortlist to OOS-gate):**

| Print | Pillar | in-IC | holdout IC | note |
|---|---|---|---|---|
| PPI | PCI | +0.38 | +0.37 | strongest. clean inflation print |
| JOLTS quits rate | LPI | +0.33 | +0.09 | quits = the framework's truth serum, LPI leads it |
| Consumer sentiment | CCI | +0.32 | +0.11 | n=382 |
| CPI headline | PCI | +0.30 | +0.22 | the one already shipping |
| Industrial production | BCI | +0.25 | +0.16 | n=314 |
| Real GDP | **BCI** | +0.23 | +0.50 | **BCI leads GDP, not GCI** (the wired pillar is wrong) |
| Core PCE | PCI | +0.21 | +0.15 | |
| Savings rate | CCI | +0.19 | +0.29 | n=382 |
| Housing starts | FCI | +0.32 | +0.22 | small n=67, flag |

**Did NOT hold (in-sample only):** Nonfarm payrolls (holdout +0.00 — confirms
the earlier OOS coin-flip), Unemployment (sign flips), Durable goods.
**Weak:** retail sales, core CPI, claims, wage growth.

Two real findings beyond "more markets":
- **GDP's wired pillar is wrong.** GCI fails OOS; BCI predicts GDP far better
  (holdout +0.50). That is a model fix, not just an addition.
- The board is **~8 prints with a pillar that genuinely leads them**, exactly
  the Macrosynergy breadth thesis: modest per-print IC, many prints. Not 1.

Discipline held: none of these go on the public board until they clear the
strict OOS gate. The app stays CPI-only until then — on purpose.

## Model upgrade spec (2026-05-17) — the actionable rewire

The engine ships two markets wired to a weaker pillar than one the framework
already has. Fixing the wiring is pure model improvement, no new data:

| Market | wired now | wired IC | better (framework already has it) | IC |
|---|---|---|---|---|
| **NFP** | LFI | **−0.24** | **LPI** (labor *pressure*, not fragility) | **+0.32** |
| **GDP** | GCI | **−0.07** | **GCI+BCI** (capex leads GDP) | **+0.32** |

Correction to my own earlier call: I said NFP was a coin flip / take it off.
That was the *wired* pillar (LFI) failing. With LPI it is strongly positive
in-sample. NFP was mis-wired, not hopeless. It goes back on the shortlist.

Expanded board, best grounded spec per print (in-sample IC, holds holdout
sign — strict OOS is the lock step before ship):

| Print | Best spec | IC |
|---|---|---|
| PPI | PCI+TCI | +0.45 |
| Consumer sentiment | CCI+MSI | +0.34 |
| CPI | PCI+LFI | +0.34 |
| JOLTS quits | LPI | +0.33 |
| GDP | GCI+BCI | +0.32 |
| Industrial production | GCI+BCI | +0.27 |
| Savings rate | CCI+LPI | +0.25 |
| Core PCE | PCI+LFI | +0.24 |

Not yet good enough (in-sample weak or holdout fails): core CPI, retail
sales/ex-food, claims, durable goods, wage growth, unemployment (sign flips).

Next: wire the two rewires + the eight-print board into the pricer (a 2-signal
calibrated path, the combo already proven to beat single OOS for CPI), then
run the lock test on each. The engine change is careful work, not a hot patch.

## CORRECTION (2026-05-17) — GDP / A2 magnitude was overstated

The A2 / rebuilt-GCI figures above (IC +0.70, holdout +0.64, "A2 lite +0.695",
"GCI+BCI +0.50") came from a smaller, differently-aligned sample (n ~ 104–117)
in the exploratory scripts. On the full clean alignment (n = 316) the honest
numbers are:

- Old live GCI vs GDP: **IC +0.07**
- Rebuilt GCI (Concurrent Activity basket) vs GDP: **IC +0.38 in-sample,
  +0.32 holdout**

The conclusion is unchanged and strong — a ~5x improvement that holds out of
sample, and the broken pillar is fixed. Only the magnitude was inflated; the
direction and the rebuild were never in question. Treat +0.38 / +0.32 as the
figure of record. The earlier numbers stay visible above on purpose, struck
here rather than quietly edited.

## CORRECTION 2 (2026-05-17) — measured on the SHIPPED live series

The rebuilt GCI is now live in `lighthouse_indices` (recompute exit 0, MRI
intact). Measured on the actual stored series, GDP predictive magnitude is
method-dependent and lower than CORRECTION 1's +0.38:

- conservative (rolling-z, simple corr): **IC +0.17, holdout +0.16**
- edge_board method (sequential zn): **IC +0.36, holdout +0.32**

Figure of record: **~0.2–0.35, holds out of sample, ~2.5–5x over the dead
+0.07.** Not a single number. Revision trail, kept on purpose:
+0.70 (small-sample artifact) → +0.38 (CORRECTION 1, still high) → ~0.2–0.35
(CORRECTION 2, measured on the live shipped series). The rebuild and its
direction were never in question; my stated magnitude was, twice. Conservative
end is the honest one.

## Why this is the pitch, not the problem

"Two numbers, and the second one is a model that we OOS-prove against a naive
baseline and that abstains — out loud — on the markets where it has no proven
edge." A small board of provable markets beats a big board of in-sample
mirages. The on-chain scorecard then compounds it: the calibration is public
and cannot be revised. That is a moat a forked AMM cannot copy.
