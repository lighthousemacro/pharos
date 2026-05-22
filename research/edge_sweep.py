"""Systematic edge sweep with a multiple-testing guard.

Bob's point: 4 pairs is not a search. Correct. So: every usable pillar
univariate, then every 2-way among the ones that individually clear a
PERMUTATION NOISE FLOOR. The floor = the best |OOS IC| you'd see across the
same number of pillars if the outcome were random. Beating zero is not edge.
Beating the floor is.

Why the floor matters: with ~20 pillars (hundreds of pairs) the max IC over a
finite history is large by pure chance. Reporting the winner without the floor
is the classic way a backtest lies. This does not.
"""
from __future__ import annotations
import sys, warnings
warnings.filterwarnings("ignore")
sys.path.insert(0, "/Users/bob/LHM/Projects/pharos/pricing")
sys.path.insert(0, "/Users/bob/LHM/Projects/pharos/research")
import numpy as np
import pandas as pd
from pharos_pricing import db, calendar as cal
from pharos_pricing.models import _target_trend
from edge_search import monthly, walk_forward, pillar_zn, MIN_TRAIN

import sqlite3
DBP = "file:/Users/bob/LHM/Data/databases/Lighthouse_Master.db?mode=ro"

# Pillars that are conceptually macro signals (exclude raw stages / 2-obs
# meta-indices / crypto health). We still history-gate every one below.
CANDIDATES = ["BCI","CCI","CLG","EMD","FCI","FPI","GCI","HCI","LCI","LDI",
              "LFI","LPI","MSI","PCI","REC_PROB","SBD","SPI","SSD","SVI",
              "TCI","YFS","MRI"]
MARKETS = ["CPI_MOM", "NFP", "GDP"]
N_PERM = 30
rng = np.random.default_rng(7)


def usable_pillars(outcome: pd.Series) -> dict[str, pd.Series]:
    """Pillars whose monthly zn aligns to >= MIN_TRAIN+24 outcome points."""
    out = {}
    for pid in CANDIDATES:
        try:
            z = pillar_zn(pid)
        except KeyError:
            continue
        aligned = pd.concat([z.shift(1), outcome], axis=1).dropna()
        if len(aligned) >= MIN_TRAIN + 24:
            out[pid] = z
    return out


def run_market(kind: str):
    mk = cal.MARKET_KINDS[kind]
    outcome = monthly(_target_trend(mk, db.observation_series(mk.series_id)))
    pil = usable_pillars(outcome)
    print(f"\n=== {kind}  ({len(pil)} pillars with testable history) ===")
    if not pil:
        print("  no pillar has enough aligned history"); return

    # 1. univariate OOS IC for every usable pillar
    uni = {}
    for pid, z in pil.items():
        ic, ba, n = walk_forward(pd.DataFrame({pid: z}), outcome)
        if not np.isnan(ic):
            uni[pid] = (ic, ba, n)

    # 2. permutation noise floor: best |OOS IC| over the same pillar set when
    #    the outcome is shuffled. 95th pctile of that max = the chance ceiling.
    floor_maxes = []
    for _ in range(N_PERM):
        yp = pd.Series(rng.permutation(outcome.values), index=outcome.index)
        best = 0.0
        for pid, z in pil.items():
            ic, _, _ = walk_forward(pd.DataFrame({pid: z}), yp)
            if not np.isnan(ic):
                best = max(best, abs(ic))
        floor_maxes.append(best)
    floor = float(np.quantile(floor_maxes, 0.95))
    print(f"  noise floor (95th pctile best |IC| under random outcome): {floor:.3f}")

    ranked = sorted(uni.items(), key=lambda kv: -abs(kv[1][0]))
    print("  top single pillars (OOS):")
    real_singles = []
    for pid, (ic, ba, n) in ranked[:8]:
        verdict = "REAL (clears floor)" if abs(ic) > floor else "noise"
        if abs(ic) > floor:
            real_singles.append(pid)
        print(f"    {pid:<9} ic={ic:+.3f}  bal-acc={ba:.3f}  n={n}  {verdict}")

    # 3. 2-way ONLY among pillars that individually clear the floor
    if len(real_singles) >= 2:
        best = None
        for i in range(len(real_singles)):
            for j in range(i + 1, len(real_singles)):
                a, b = real_singles[i], real_singles[j]
                ic, ba, n = walk_forward(
                    pd.DataFrame({a: pil[a], b: pil[b]}), outcome)
                if not np.isnan(ic) and (best is None or abs(ic) > abs(best[1])):
                    best = ((a, b), ic, ba, n)
        if best:
            (a, b), ic, ba, n = best
            base_ic = abs(ranked[0][1][0])
            tag = "beats best single" if abs(ic) > base_ic else "no better than best single"
            print(f"  best 2-way among real singles: {a}+{b} "
                  f"ic={ic:+.3f} bal-acc={ba:.3f} n={n}  ({tag})")
    else:
        print(f"  2-way skipped: {len(real_singles)} pillar(s) clear the floor "
              f"(need >=2 to combine honestly).")

    if not real_singles:
        print("  VERDICT: NO pillar clears the noise floor. No real edge here.")
    else:
        print(f"  VERDICT: {len(real_singles)} pillar(s) clear the floor: "
              f"{', '.join(real_singles)}.")


if __name__ == "__main__":
    for k in MARKETS:
        try:
            run_market(k)
        except Exception as e:
            print(f"\n=== {k} ===\n  ERROR: {type(e).__name__}: {e}")
    print(f"\n(Permutation floor uses {N_PERM} shuffles. A winner must beat the "
          f"floor, not zero. This is the guard against searching our way into a "
          f"fake edge.)")
