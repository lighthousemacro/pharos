"""Quantamental transforms — the methodological core of the moat.

Grounded in the Macrosynergy / JPMaQS quantamental approach (concepts
applied to LHM data; no proprietary material reproduced):

  * point-in-time slicing      -> no look-ahead / vintage discipline
  * consistent annualized trend -> de-emphasize single-print noise
                                    (JPMaQS-style P3M3ML3AR / P6M6ML6AR)
  * sequential zn-score        -> normalize a signal around a neutral
                                    level using only past information
  * signal-return calibration  -> let history, not a hand-picked beta,
                                    set the pillar tilt; report IC /
                                    balanced accuracy as signal quality
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

# Periods the macro panel is known to be distorted — excluded from
# calibration so a once-in-a-generation shock doesn't set the slope.
# (Macrosynergy `make_blacklist` analog.)
DEFAULT_BLACKLIST = [("2020-03-01", "2020-08-31")]


def point_in_time(series: pd.Series, as_of: pd.Timestamp, lag_days: int) -> pd.Series:
    """Information state of `series` as observed on `as_of`.

    Drops any observation whose period end + publication lag falls after
    `as_of` — i.e. data the market could not have seen when the contract
    was created. This is what makes a framework quote a point-in-time
    information state rather than a revised final value.
    """
    cutoff = as_of - pd.Timedelta(days=lag_days)
    return series[series.index <= cutoff]


def annualized_trend(level: pd.Series, m: int) -> pd.Series:
    """JPMaQS-style P{m}M{m}ML{m}AR on a (seasonally adjusted) index level.

    The annualized rate of the latest m-month block vs. the prior m-month
    block. For an SA price index this is the standard "%6m/6m saar"
    inflation-trend construction.
    """
    lvl = level.dropna()
    ratio = lvl / lvl.shift(m)
    return (ratio ** (12.0 / m) - 1.0) * 100.0


def consistent_trend(level: pd.Series, fast: int = 3, slow: int = 6) -> pd.Series:
    """A consistent core trend: blend of fast and slow annualized trends.

    Captures the fundamental development while de-emphasizing the volatility
    and distortions of any single monthly print (the "consistent core CPI
    trends" idea, generalized).
    """
    t_fast = annualized_trend(level, fast)
    t_slow = annualized_trend(level, slow)
    return (0.5 * t_fast + 0.5 * t_slow).dropna()


def diff_trend(level: pd.Series, fast: int = 3, slow: int = 6) -> pd.Series:
    """Consistent trend for a stock series measured in changes (e.g. NFP).

    Blend of the mean monthly change over the last `fast` and `slow`
    months — the level-change analog of `consistent_trend`.
    """
    d = level.diff().dropna()
    return (0.5 * d.rolling(fast).mean() + 0.5 * d.rolling(slow).mean()).dropna()


def zn_score(
    series: pd.Series,
    neutral: float = 0.0,
    min_obs: int = 24,
    winsor: float = 3.0,
) -> pd.Series:
    """Sequential (point-in-time) zn-score around a neutral level.

    The standard deviation is estimated on an expanding window using only
    information available up to each date — no full-sample leakage — and
    the result is winsorized at +/- `winsor`. `neutral` is the theoretical
    equilibrium the signal is measured against (0 for a trend-vs-target,
    an expanding mean for a level).
    """
    s = series.dropna()
    if len(s) < min_obs:
        return pd.Series(dtype=float)
    dev = s - neutral
    # expanding std of absolute deviations from neutral (sequential)
    denom = dev.abs().expanding(min_periods=min_obs).mean() * np.sqrt(np.pi / 2.0)
    zn = (dev / denom).clip(-winsor, winsor)
    return zn.dropna()


@dataclass
class Calibration:
    """Empirical pillar -> macro-surprise relationship + signal quality."""

    beta: float = 0.0          # surprise per 1 unit of lagged signal
    intercept: float = 0.0
    resid_std: float = 1.0     # dispersion of the surprise (the sigma)
    ic: float = 0.0            # Pearson information coefficient
    bal_accuracy: float = 0.5  # balanced directional accuracy
    hit_rate: float = 0.5
    n: int = 0
    shrink: float = 0.0        # 0..1 — how much to trust the tilt

    def as_dict(self) -> dict:
        return {
            "beta": round(self.beta, 4),
            "resid_std": round(self.resid_std, 4),
            "ic": round(self.ic, 3),
            "bal_accuracy": round(self.bal_accuracy, 3),
            "hit_rate": round(self.hit_rate, 3),
            "n": self.n,
            "shrink": round(self.shrink, 3),
        }


def _apply_blacklist(idx: pd.DatetimeIndex, blacklist) -> pd.Series:
    keep = pd.Series(True, index=idx)
    for lo, hi in blacklist or []:
        keep &= ~((idx >= pd.Timestamp(lo)) & (idx <= pd.Timestamp(hi)))
    return keep


def calibrate_signal(
    signal: pd.Series,
    target: pd.Series,
    blacklist=DEFAULT_BLACKLIST,
) -> Calibration:
    """Regress the realized macro outcome on the lagged pillar signal.

    This is the SignalReturnRelations discipline: a signal is only worth
    posting if it has demonstrated predictive value, and the size of the
    tilt should scale with that value. We report the information
    coefficient and balanced accuracy, and derive a `shrink` factor that
    pulls the framework probability toward 0.50 when the signal is weak.
    """
    sig = signal.dropna()
    tgt = target.dropna()
    if sig.empty or tgt.empty:
        return Calibration()

    # Align: signal known at t-1 explains the outcome realized at t.
    pairs = pd.concat(
        {"sig": sig.shift(1), "tgt": tgt}, axis=1
    ).dropna()
    if len(pairs) >= 3:
        keep = _apply_blacklist(pairs.index, blacklist)
        pairs = pairs[keep]
    n = len(pairs)
    if n < 24:
        return Calibration(n=n)

    x = pairs["sig"].to_numpy()
    y = pairs["tgt"].to_numpy()
    if np.std(x) < 1e-9 or np.std(y) < 1e-9:
        return Calibration(n=n)

    beta, intercept = np.polyfit(x, y, 1)
    resid = y - (beta * x + intercept)
    resid_std = float(np.std(resid, ddof=1)) or float(np.std(y, ddof=1))
    ic = float(np.corrcoef(x, y)[0, 1])

    # Directional / balanced accuracy of sign(signal) vs sign(demeaned y).
    y_dir = np.sign(y - np.median(y))
    x_dir = np.sign(x - np.median(x))
    mask = (y_dir != 0) & (x_dir != 0)
    hit_rate = float(np.mean(x_dir[mask] == y_dir[mask])) if mask.any() else 0.5
    pos = y_dir > 0
    neg = y_dir < 0
    tpr = np.mean(x_dir[pos] > 0) if pos.any() else 0.5
    tnr = np.mean(x_dir[neg] < 0) if neg.any() else 0.5
    bal_accuracy = float((tpr + tnr) / 2.0)

    # Shrink: trust the tilt in proportion to demonstrated edge. |IC|
    # scaled (an IC of ~0.3 is strong for macro) and floored by how far
    # balanced accuracy clears a coin toss.
    shrink = float(
        np.clip(max(abs(ic) / 0.30, (bal_accuracy - 0.5) / 0.20), 0.0, 1.0)
    )
    return Calibration(
        beta=float(beta),
        intercept=float(intercept),
        resid_std=resid_std,
        ic=ic,
        bal_accuracy=bal_accuracy,
        hit_rate=hit_rate,
        n=n,
        shrink=shrink,
    )


@dataclass
class InformationState:
    """JPMaQS-style audit stamp for a framework quote."""

    as_of: str
    eop_lag_days: int          # days since end of latest input's period
    pub_lag_days: int          # modeled release lag applied
    grading: float = 2.0       # 3 = real-time vintage, lower = more modeled
    inputs: dict = field(default_factory=dict)

    def as_dict(self) -> dict:
        return {
            "as_of": self.as_of,
            "eop_lag_days": self.eop_lag_days,
            "pub_lag_days": self.pub_lag_days,
            "grading": self.grading,
            "inputs": self.inputs,
        }
