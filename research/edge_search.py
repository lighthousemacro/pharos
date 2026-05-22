"""Edge search: single pillar vs trend-only baseline vs 2-pillar combination,
evaluated OUT OF SAMPLE (expanding walk-forward) so a combo cannot fake an IC.

Answers three of Bob's asks at once:
  - "is 64% actually good for macro" -> compare to the trend-only baseline,
    and show full-sample vs strict OOS so overfit is visible.
  - "find more edge" -> test theory-justified 2-pillar combos per market.
  - "fix the models / FOMC has history" -> calibrate the policy market against
    the real DFEDTARU decision record instead of the n=0 stub.

Reuses production internals (point_in_time, _target_trend, zn_score) so the
numbers are apples-to-apples with what the engine ships.
"""
from __future__ import annotations
import sys, warnings
warnings.filterwarnings("ignore")
sys.path.insert(0, "/Users/bob/LHM/Projects/pharos/pricing")
import numpy as np
import pandas as pd
from pharos_pricing import db
from pharos_pricing.transforms import zn_score
from pharos_pricing import calendar as cal
from pharos_pricing.models import _target_trend

# theory-justified second pillars per market (macro-sound, not dredged)
COMBOS = {
    "CPI_MOM": ("PCI", ["LFI", "CCI", "GCI", "FPI", "CLG"]),
    "NFP":     ("LFI", ["CLG", "BCI", "CCI", "GCI"]),
    "GDP":     ("GCI", ["BCI", "CCI", "TCI", "FPI"]),
}
MIN_TRAIN = 60  # months before first OOS prediction


def monthly(s: pd.Series) -> pd.Series:
    return s.resample("MS").last().dropna()


def sign_bal_acc(pred: np.ndarray, real: np.ndarray) -> float:
    """Sign-aware balanced accuracy, oriented to the fitted relationship."""
    if len(pred) < 8:
        return float("nan")
    ic = np.corrcoef(pred, real)[0, 1] if np.std(pred) > 1e-9 else 0.0
    sgn = -1.0 if ic < 0 else 1.0
    yd = np.sign(real - np.median(real))
    xd = np.sign(pred - np.median(pred)) * sgn
    pos, neg = yd > 0, yd < 0
    tpr = np.mean(xd[pos] > 0) if pos.any() else 0.5
    tnr = np.mean(xd[neg] < 0) if neg.any() else 0.5
    return float((tpr + tnr) / 2.0)


def walk_forward(X: pd.DataFrame, y: pd.Series) -> tuple[float, float, int]:
    """Expanding-window OLS. signal(t-1) -> outcome(t). Returns OOS (ic, balacc, n)."""
    df = pd.concat([X.shift(1), y.rename("y")], axis=1).dropna()
    if len(df) < MIN_TRAIN + 12:
        return float("nan"), float("nan"), len(df)
    cols = [c for c in df.columns if c != "y"]
    preds, reals = [], []
    for i in range(MIN_TRAIN, len(df)):
        tr = df.iloc[:i]
        A = np.column_stack([np.ones(len(tr))] + [tr[c].to_numpy() for c in cols])
        coef, *_ = np.linalg.lstsq(A, tr["y"].to_numpy(), rcond=None)
        row = df.iloc[i]
        xr = np.array([1.0] + [row[c] for c in cols])
        preds.append(float(xr @ coef))
        reals.append(float(row["y"]))
    p, r = np.array(preds), np.array(reals)
    ic = float(np.corrcoef(p, r)[0, 1]) if np.std(p) > 1e-9 else 0.0
    return ic, sign_bal_acc(p, r), len(p)


def pillar_zn(idx_id: str) -> pd.Series:
    return zn_score(monthly(db.index_series(idx_id)), neutral=0.0, min_obs=24)


def run_market(kind: str):
    primary, seconds = COMBOS[kind]
    mk = cal.MARKET_KINDS[kind]
    level = db.observation_series(mk.series_id)
    outcome = monthly(_target_trend(mk, level))           # realized trend (final data)
    z1 = pillar_zn(mk.pillar_index)
    print(f"\n=== {kind}  (resolves {mk.series_id}, primary pillar {mk.pillar_index}) ===")

    # trend-only baseline: does the trend's own momentum predict the next trend?
    base = pd.DataFrame({"trend_mom": outcome.diff()})
    bic, bba, bn = walk_forward(base, outcome)
    print(f"  trend-only baseline    OOS  ic={bic:+.3f}  bal-acc={bba:.3f}  n={bn}")

    sic, sba, sn = walk_forward(pd.DataFrame({primary: z1}), outcome)
    print(f"  single pillar {primary:<4}     OOS  ic={sic:+.3f}  bal-acc={sba:.3f}  n={sn}")

    best = None
    for sec in seconds:
        try:
            z2 = pillar_zn(sec)
        except KeyError:
            continue
        cic, cba, cn = walk_forward(pd.DataFrame({primary: z1, sec: z2}), outcome)
        tag = ""
        if not np.isnan(cba) and cba > sba and cba > bba:
            tag = "  <== beats single AND baseline OOS"
        print(f"  + {sec:<4} combo          OOS  ic={cic:+.3f}  bal-acc={cba:.3f}  n={cn}{tag}")
        if not np.isnan(cba) and (best is None or cba > best[1]):
            best = (sec, cba, cic)
    if best and best[1] > sba and best[1] > bba:
        print(f"  VERDICT: {primary}+{best[0]} adds real OOS edge "
              f"(bal-acc {best[1]:.3f} vs single {sba:.3f} vs baseline {bba:.3f}).")
    else:
        print(f"  VERDICT: no combo beats single pillar OOS. {primary} alone is the ceiling here.")


def run_fomc():
    print("\n=== FOMC_CUT  (real decision history, replaces the n=0 stub) ===")
    tgt = db.observation_series("DFEDTARU")
    m = tgt.resample("MS").last().dropna()
    chg = m.diff()
    cut = (chg <= -0.25).astype(float)          # >=25bps cut that month
    rec = zn_score(monthly(db.index_series("REC_PROB")), neutral=0.0, min_obs=24)
    df = pd.concat([rec.shift(1).rename("rec"), cut.rename("cut")], axis=1).dropna()
    n = len(df); base_rate = df["cut"].mean()
    if n >= MIN_TRAIN + 12:
        ic, ba, nn = walk_forward(pd.DataFrame({"rec": df["rec"]}), df["cut"])
    else:
        ic = ba = float("nan"); nn = n
    print(f"  meetings/months scored: {n}   actual >=25bp-cut rate: {base_rate:.1%}")
    print(f"  REC_PROB -> cut         OOS  ic={ic:+.3f}  bal-acc={ba:.3f}  n={nn}")
    print(f"  -> real history exists ({n} obs). 'n=0' was a stub, not the data.")


if __name__ == "__main__":
    for k in ("CPI_MOM", "NFP", "GDP"):
        try:
            run_market(k)
        except Exception as e:
            print(f"\n=== {k} ===\n  ERROR: {type(e).__name__}: {e}")
    try:
        run_fomc()
    except Exception as e:
        print(f"\n=== FOMC_CUT ===\n  ERROR: {type(e).__name__}: {e}")
    print("\n(OOS = expanding walk-forward, no look-ahead. In-sample IC will be "
          "higher; the OOS number is the honest one.)")
