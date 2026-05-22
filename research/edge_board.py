"""Expanded board scan — candidate generation, not final validation.

Bob's point: DB depth is wasted on 4 markets. The Macrosynergy thesis is
breadth — modest signal across MANY prints, not one hero IC. So: ~18 real
bettable macro prints, each grounded in its framework pillar, scanned fast
in-sample + one light holdout. This SURFACES where the framework has signal so
we can expand the board. It is NOT the ship gate — strict OOS comes later on
the shortlist. Labelled exploratory on purpose.
"""
from __future__ import annotations
import sys, warnings
warnings.filterwarnings("ignore")
sys.path.insert(0, "/Users/bob/LHM/Projects/pharos/pricing")
import numpy as np
import pandas as pd
from pharos_pricing import db
from pharos_pricing.transforms import consistent_trend, diff_trend, zn_score, calibrate_signal

# (series_id, label, transform, pillars-to-test) — pillars grounded in the
# pillar docs: labor pillars lead jobs/claims/quits, PCI leads prices, GCI
# leads activity, CCI the consumer, BCI business, etc.
SPEC = [
    ("CPIAUCSL",  "CPI headline",        "price", ["PCI","LFI","LPI"]),
    ("CPILFESL",  "Core CPI",            "price", ["PCI","LFI"]),
    ("PCEPILFE",  "Core PCE",            "price", ["PCI","LFI"]),
    ("PPIACO",    "PPI",                 "price", ["PCI","BCI","TCI"]),
    ("AHETPI",    "Wage growth (AHE)",   "price", ["LPI","LFI","PCI"]),
    ("PAYEMS",    "Nonfarm payrolls",    "flow",  ["LFI","LPI","CLG","BCI"]),
    ("UNRATE",    "Unemployment rate",   "rate",  ["LFI","LPI","LDI","CLG"]),
    ("ICSA",      "Initial claims",      "flow",  ["LFI","CLG"]),
    ("CCSA",      "Continuing claims",   "flow",  ["LFI","CLG"]),
    ("JTSQUR",    "JOLTS quits rate",    "rate",  ["LPI","LFI"]),
    ("RSAFS",     "Retail sales",        "price", ["CCI","GCI","SPI"]),
    ("RSXFS",     "Retail ex-food",      "price", ["CCI","GCI"]),
    ("INDPRO",    "Industrial prod.",    "price", ["GCI","BCI"]),
    ("DGORDER",   "Durable goods",       "price", ["BCI","GCI"]),
    ("HOUST",     "Housing starts",      "flow",  ["GCI","BCI","FCI"]),
    ("PERMIT",    "Building permits",    "flow",  ["GCI","BCI"]),
    ("UMCSENT",   "Consumer sentiment",  "rate",  ["SPI","CCI","MSI"]),
    ("PSAVERT",   "Savings rate",        "rate",  ["CCI","LPI"]),
    ("A191RL1Q225SBEA","Real GDP saar",  "gdp",   ["GCI","BCI","CCI"]),
]


def monthly(s):
    return s.resample("MS").last().dropna()


def outcome_of(series_id, transform):
    s = db.observation_series(series_id)
    if transform == "price":
        return monthly(consistent_trend(s, 3, 6))
    if transform in ("flow", "rate"):
        return monthly(diff_trend(s, 3, 6))
    if transform == "gdp":
        return monthly(s).rolling(3, min_periods=1).mean().dropna()
    raise ValueError(transform)


def holdout_ic(z, y):
    """One 75/25 split. Fit on first 75%, IC on the last 25%. Light sanity,
    not the full OOS machinery (Bob: ease off OOS for now)."""
    d = pd.concat([z.shift(1).rename("x"), y.rename("y")], axis=1).dropna()
    if len(d) < 60:
        return float("nan"), len(d)
    k = int(len(d) * 0.75)
    tr, te = d.iloc[:k], d.iloc[k:]
    if te["x"].std() < 1e-9 or len(te) < 12:
        return float("nan"), len(d)
    b, a = np.polyfit(tr["x"], tr["y"], 1)
    pred = a + b * te["x"].to_numpy()
    if np.std(pred) < 1e-9:
        return 0.0, len(d)
    return float(np.corrcoef(pred, te["y"])[0, 1]), len(d)


rows = []
for sid, label, tf, pillars in SPEC:
    try:
        y = outcome_of(sid, tf)
    except Exception as e:
        print(f"skip {label:<20} ({sid}): {type(e).__name__}")
        continue
    best = None
    for pid in pillars:
        try:
            z = zn_score(monthly(db.index_series(pid)), neutral=0.0, min_obs=24)
        except KeyError:
            continue
        cal = calibrate_signal(z, y)            # in-sample, sign-aware
        ho, n = holdout_ic(z, y)
        score = abs(cal.ic)
        if best is None or score > best["score"]:
            best = dict(pillar=pid, ic=cal.ic, ba=cal.bal_accuracy, n=cal.n,
                        ho=ho, score=score)
    if best:
        rows.append((label, sid, best))

rows.sort(key=lambda r: -r[2]["score"])
print(f"\n{'MARKET':<22}{'best pillar':<12}{'IC(in)':>8}{'bal-acc':>9}"
      f"{'n':>6}{'holdout IC':>12}   read")
print("-" * 86)
for label, sid, b in rows:
    hostr = f"{b['ho']:+.2f}" if not np.isnan(b['ho']) else "  na"
    if abs(b["ic"]) >= 0.15 and not np.isnan(b['ho']) and (b['ho'] * b['ic'] > 0) and abs(b['ho']) >= 0.08:
        read = "CANDIDATE (in-sample edge holds sign in holdout)"
    elif abs(b["ic"]) >= 0.15:
        read = "in-sample only — holdout does not confirm"
    else:
        read = "weak"
    print(f"{label:<22}{b['pillar']:<12}{b['ic']:>+8.3f}{b['ba']:>9.3f}"
          f"{b['n']:>6}{hostr:>12}   {read}")
print("\nExploratory candidate scan. Sign-aware IC. 'CANDIDATE' = worth the "
      "strict OOS gate next. Nothing here ships until it passes that.")
