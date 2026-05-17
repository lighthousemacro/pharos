"""Framework probabilities for binary macro markets.

For each market the engine builds a point-in-time information state, a
consistent (noise-de-emphasized) nowcast of the macro outcome, an
empirically calibrated pillar tilt, and a probability that is shrunk
toward 0.50 in proportion to the pillar's *demonstrated* predictive
value. This is the moat: the framework, not a hand-picked constant, is
the market maker's prior, and it knows how much to trust itself.
"""
from __future__ import annotations

from datetime import date, datetime

import numpy as np
import pandas as pd
from scipy.stats import norm

from . import calendar as cal
from . import db
from .transforms import (
    Calibration,
    InformationState,
    calibrate_signal,
    consistent_trend,
    diff_trend,
    point_in_time,
    zn_score,
)


def list_market_kinds() -> list[str]:
    return list(cal.MARKET_KINDS.keys())


def _logistic(x: float) -> float:
    return 1.0 / (1.0 + np.exp(-x))


def _target_trend(mk: cal.MarketKind, level_pit: pd.Series) -> pd.Series:
    """The series whose latest value is the framework nowcast."""
    if mk.transform == "cpi_trend":
        return consistent_trend(level_pit, 3, 6)
    if mk.transform == "gdp_trend":
        # A191RL1Q225SBEA is already an annualized q/q rate; the consistent
        # nowcast is a light 2-quarter smooth of recent prints.
        return (0.6 * level_pit + 0.4 * level_pit.shift(1)).dropna()
    if mk.transform == "nfp_trend":
        return diff_trend(level_pit, 3, 6)
    raise ValueError(f"no trend for transform {mk.transform}")


def _price_data_market(
    mk: cal.MarketKind, strike: float, as_of: pd.Timestamp, ref_label: str
) -> dict:
    # 1. Point-in-time information state of the resolving series.
    raw = db.observation_series(mk.series_id)
    lag = db.pub_lag_days(mk.series_id)
    level = point_in_time(raw, as_of, lag)
    if len(level) < 30:
        raise ValueError(f"insufficient point-in-time history for {mk.series_id}")

    trend = _target_trend(mk, level)
    if trend.empty:
        raise ValueError(f"could not build trend for {mk.kind}")
    mu_trend = float(trend.iloc[-1])

    # 2. Pillar signal — sequential zn-score, point-in-time.
    pillar = db.index_series(mk.pillar_index)
    pillar_pit = pillar[pillar.index <= as_of]
    # Resample the (daily) composite to the trend's monthly cadence.
    pillar_m = pillar_pit.resample("MS").last().dropna()
    zn = zn_score(pillar_m, neutral=0.0, min_obs=24)
    zn_latest = float(zn.iloc[-1]) if not zn.empty else 0.0

    # 3. Calibrate pillar -> outcome on aligned monthly history.
    calib: Calibration = calibrate_signal(zn, trend.resample("MS").last())

    # 4. Framework nowcast = blend of the consistent trend and the
    #    calibrated prediction E[outcome | pillar]. If the pillar has no
    #    demonstrated edge we fall back to a small prior tilt with the
    #    documented pillar sign.
    if calib.n >= 24 and calib.shrink > 0:
        calibrated_pred = calib.intercept + calib.beta * zn_latest
        mu_hat = 0.5 * mu_trend + 0.5 * calibrated_pred
        sigma = max(calib.resid_std, 1e-6)
    else:
        sigma = float(np.std(trend.diff().dropna(), ddof=1)) or 1.0
        mu_hat = mu_trend + mk.pillar_sign * 0.15 * sigma * zn_latest

    # 5. Probability the outcome clears the strike, then shrink toward
    #    0.50 by demonstrated signal quality (never fully agnostic — the
    #    trend still carries a floor of conviction).
    p_raw = float(norm.cdf((mu_hat - strike) / sigma))
    conviction = float(np.clip(0.35 + 0.65 * calib.shrink, 0.35, 1.0))
    p = 0.5 + (p_raw - 0.5) * conviction
    p = float(np.clip(p, 0.02, 0.98))

    eop_lag = int((as_of - level.index[-1]).days)
    info = InformationState(
        as_of=as_of.strftime("%Y-%m-%d"),
        eop_lag_days=eop_lag,
        pub_lag_days=lag,
        grading=round(float(np.clip(3.0 - eop_lag / 60.0, 1.0, 3.0)), 2),
        inputs={
            mk.series_id: round(float(level.iloc[-1]), 4),
            f"{mk.series_id}_asof": level.index[-1].strftime("%Y-%m-%d"),
            mk.pillar_index: round(float(pillar_m.iloc[-1]), 4),
        },
    )

    reasoning = (
        f"Consistent trend nowcast {mu_hat:.2f} {mk.unit} vs strike "
        f"{strike:.2f}. {mk.pillar_index} at {zn_latest:+.2f} sigma "
        f"(IC {calib.ic:+.2f}, bal-acc {calib.bal_accuracy:.2f}, "
        f"n={calib.n}). Conviction {conviction:.2f} -> framework "
        f"{p*100:.1f}% YES."
    )
    return _result(mk, ref_label, strike, p, mu_hat, sigma, zn_latest, calib, info, reasoning)


def _price_policy_market(
    mk: cal.MarketKind, strike: float, as_of: pd.Timestamp, ref_label: str
) -> dict:
    """Stylized FOMC reaction function — P(>=25bps cut at next meeting).

    Not a forecast of the committee. A transparent reaction function:
    cuts get more likely as recession risk and macro risk rise and as the
    core-inflation trend falls back toward target.
    """
    _, mri, _ = db.latest_index("MRI")
    try:
        _, rec_prob, _ = db.latest_index("REC_PROB")
    except KeyError:
        rec_prob = 0.25
    mri_series = db.index_series("MRI")
    mri_pit = mri_series[mri_series.index <= as_of].resample("MS").last().dropna()
    mri_zn = zn_score(mri_pit, neutral=0.0, min_obs=24)
    mri_z = float(mri_zn.iloc[-1]) if not mri_zn.empty else 0.0

    core = db.observation_series("CPILFESL")
    core_pit = point_in_time(core, as_of, db.pub_lag_days("CPILFESL"))
    core_trend = consistent_trend(core_pit, 3, 6)
    core_now = float(core_trend.iloc[-1]) if not core_trend.empty else 3.0
    infl_gap = core_now - 2.0  # distance above the 2% goal

    # Transparent, documented coefficients (a stylized Taylor-ish rule).
    score = (
        -0.4
        + 1.6 * (rec_prob - 0.25)
        + 0.55 * mri_z
        - 0.45 * infl_gap
    )
    p_cut = float(np.clip(_logistic(score), 0.02, 0.98))

    cal_stub = Calibration(ic=0.0, bal_accuracy=0.5, n=0, shrink=0.6)
    info = InformationState(
        as_of=as_of.strftime("%Y-%m-%d"),
        eop_lag_days=0,
        pub_lag_days=0,
        grading=2.0,  # modeled reaction function, not a vintage print
        inputs={
            "MRI": round(mri, 4),
            "REC_PROB": round(rec_prob, 4),
            "core_trend": round(core_now, 4),
            "infl_gap": round(infl_gap, 4),
        },
    )
    reasoning = (
        f"Reaction function: REC_PROB {rec_prob:.2f}, MRI {mri_z:+.2f} sigma, "
        f"core trend {core_now:.2f}% (gap {infl_gap:+.2f}). "
        f"P(>=25bps cut) {p_cut*100:.1f}%."
    )
    return _result(mk, ref_label, strike, p_cut, p_cut, 0.0, mri_z, cal_stub, info, reasoning)


def _result(mk, ref_label, strike, p, mu, sigma, zn, cal_obj, info, reasoning) -> dict:
    return {
        "kind": mk.kind,
        "label": mk.label,
        "ref_label": ref_label,
        "question": mk.question_tmpl.format(ref=ref_label, strike=strike),
        "strike": strike,
        "strike_scaled": cal.scale_strike(strike),
        "unit": mk.unit,
        "framework_prob": round(float(p), 4),
        "framework_prob_bps": int(round(float(p) * 10_000)),
        "nowcast": round(float(mu), 4),
        "sigma": round(float(sigma), 4),
        "pillar": {
            "index": mk.pillar_index,
            "zn_score": round(float(zn), 3),
        },
        "signal_quality": cal_obj.as_dict(),
        "information_state": info.as_dict(),
        "reasoning": reasoning,
    }


def price_market(
    kind: str,
    strike: float | None = None,
    as_of: date | datetime | str | None = None,
    ref_label: str = "next",
) -> dict:
    """Price one binary macro market with the Lighthouse framework.

    Returns a JSON-serializable dict including the framework probability,
    the point-in-time information state, and the pillar signal quality.
    """
    if kind not in cal.MARKET_KINDS:
        raise KeyError(f"unknown market kind '{kind}'. Known: {list_market_kinds()}")
    mk = cal.MARKET_KINDS[kind]
    if strike is None:
        strike = mk.default_strike
    if as_of is None:
        as_of_ts = pd.Timestamp(date.today())
    else:
        as_of_ts = pd.Timestamp(as_of)

    if mk.transform == "policy":
        return _price_policy_market(mk, float(strike), as_of_ts, ref_label)
    return _price_data_market(mk, float(strike), as_of_ts, ref_label)
