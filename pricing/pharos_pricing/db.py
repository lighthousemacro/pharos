"""Read-only access to Lighthouse_Master.db.

The pricing engine never writes. It opens the master database in read-only
mode so it can run alongside the live LHM pipeline without contention.
"""
from __future__ import annotations

import os
import sqlite3
from functools import lru_cache

import pandas as pd

DEFAULT_DB = os.environ.get(
    "PHAROS_DB_PATH", "/Users/bob/LHM/Data/databases/Lighthouse_Master.db"
)


def _connect(db_path: str | None = None) -> sqlite3.Connection:
    path = db_path or DEFAULT_DB
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Lighthouse_Master.db not found at {path}. Set PHAROS_DB_PATH."
        )
    # Read-only URI — safe to run concurrently with the daily pipeline.
    return sqlite3.connect(f"file:{path}?mode=ro", uri=True)


def observation_series(series_id: str, db_path: str | None = None) -> pd.Series:
    """A macro series from the `observations` table, indexed by date."""
    with _connect(db_path) as conn:
        df = pd.read_sql_query(
            "SELECT date, value FROM observations "
            "WHERE series_id = ? AND value IS NOT NULL ORDER BY date",
            conn,
            params=(series_id,),
        )
    if df.empty:
        raise KeyError(f"series '{series_id}' not in observations")
    s = pd.Series(
        df["value"].astype(float).values,
        index=pd.to_datetime(df["date"]),
        name=series_id,
    )
    return s[~s.index.duplicated(keep="last")].sort_index()


def index_series(index_id: str, db_path: str | None = None) -> pd.Series:
    """A proprietary composite from the `lighthouse_indices` table."""
    with _connect(db_path) as conn:
        df = pd.read_sql_query(
            "SELECT date, value FROM lighthouse_indices "
            "WHERE index_id = ? AND value IS NOT NULL ORDER BY date",
            conn,
            params=(index_id,),
        )
    if df.empty:
        raise KeyError(f"index '{index_id}' not in lighthouse_indices")
    s = pd.Series(
        df["value"].astype(float).values,
        index=pd.to_datetime(df["date"]),
        name=index_id,
    )
    return s[~s.index.duplicated(keep="last")].sort_index()


def latest_index(index_id: str, db_path: str | None = None) -> tuple[pd.Timestamp, float, str]:
    with _connect(db_path) as conn:
        row = conn.execute(
            "SELECT date, value, status FROM lighthouse_indices "
            "WHERE index_id = ? AND value IS NOT NULL ORDER BY date DESC LIMIT 1",
            (index_id,),
        ).fetchone()
    if not row:
        raise KeyError(f"index '{index_id}' not in lighthouse_indices")
    return pd.Timestamp(row[0]), float(row[1]), row[2]


# ----------------------------------------------------------------------
#  Publication lags (point-in-time discipline, JPMaQS-style)
# ----------------------------------------------------------------------
# The information state of a macro print at any date excludes data not yet
# released. Observations in Lighthouse_Master.db are labelled by PERIOD
# START (April CPI -> 2026-04-01), so the lag here is calendar days from
# that label to the public release. An observation is part of the
# information state on date D iff (label + lag) <= D. This is what stops
# the calibration and the framework quote from peeking at unreleased data.
FALLBACK_PUB_LAGS = {
    "CPIAUCSL": 41,   # April CPI labelled 04-01, released ~05-12
    "CPILFESL": 41,
    "PCEPILFE": 58,   # core PCE ~2 months after period-start label
    "PAYEMS": 36,     # Employment Situation: first Friday of next month
    "UNRATE": 36,
    "GDPC1": 119,     # GDP advance ~119d after quarter-start label
    "A191RL1Q225SBEA": 119,
    "FEDFUNDS": 32,
    "DFEDTARU": 0,    # policy rate is known same-day (daily series)
}


@lru_cache(maxsize=1)
def lhm_publication_lags() -> dict:
    """Prefer LHM's canonical publication lags; fall back to ours.

    Avoids look-ahead bias in backtested calibration exactly as JPMaQS
    vintages do — the lag is what makes a quote a point-in-time
    *information state* rather than a revised final value.
    """
    try:
        import sys

        if "/Users/bob/LHM" not in sys.path:
            sys.path.insert(0, "/Users/bob/LHM")
        from lighthouse_quant.config import PUBLICATION_LAGS  # type: ignore

        merged = dict(FALLBACK_PUB_LAGS)
        # LHM lags may be in business days / months; treat numeric as days.
        for k, v in dict(PUBLICATION_LAGS).items():
            try:
                merged[k] = int(v)
            except (TypeError, ValueError):
                continue
        return merged
    except Exception:
        return dict(FALLBACK_PUB_LAGS)


def pub_lag_days(series_id: str) -> int:
    # Composites in lighthouse_indices are computed same-day; default for
    # an unknown macro series is a conservative monthly release lag.
    return int(lhm_publication_lags().get(series_id, 45))
