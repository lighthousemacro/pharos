"""Oracle / resolver agent.

After a release time passes, the oracle computes the realized outcome
from official government data and resolves the market. It uses the SAME
transform the pricing engine used to quote the market, so the question,
the framework price, and the resolution are internally consistent. By
default it reads the data the Lighthouse pipeline has already ingested
from FRED/BLS/BEA (real government data); it never fabricates a print.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "pricing"))
from pharos_pricing import calendar as cal  # noqa: E402
from pharos_pricing import db  # noqa: E402
from pharos_pricing.transforms import consistent_trend, diff_trend  # noqa: E402

from .chain import Chain  # noqa: E402

NO, YES = 0, 1


def realized_value(kind: str) -> tuple[float, str]:
    """Realized metric for `kind` from ingested government data."""
    mk = cal.MARKET_KINDS[kind]
    if kind == "CPI_MOM":
        s = consistent_trend(db.observation_series("CPIAUCSL"), 3, 6)
        return float(s.iloc[-1]), s.index[-1].strftime("%Y-%m-%d")
    if kind == "NFP":
        s = diff_trend(db.observation_series("PAYEMS"), 3, 6)
        return float(s.iloc[-1]), s.index[-1].strftime("%Y-%m-%d")
    if kind == "GDP":
        s = db.observation_series("A191RL1Q225SBEA")
        val = 0.6 * float(s.iloc[-1]) + 0.4 * float(s.iloc[-2])
        return val, s.index[-1].strftime("%Y-%m-%d")
    if kind == "FOMC_CUT":
        s = db.observation_series("DFEDTARU")
        now_rate = float(s.iloc[-1])
        prior = float(s.iloc[-22]) if len(s) > 22 else float(s.iloc[0])
        cut_bps = (prior - now_rate) * 100.0
        return cut_bps, s.index[-1].strftime("%Y-%m-%d")
    raise ValueError(f"no resolver for {kind}")


def resolve_due(chain: Chain, force: bool = False) -> int:
    factory = chain.factory()
    n = 0
    # Gate on CHAIN time — the contract enforces resolution against
    # block.timestamp, so the oracle must use the same clock.
    now = chain.block_time()
    for addr in factory.functions.allMarkets().call():
        m = chain.market(addr)
        _, _, _, _, _, resolved, _ = m.functions.snapshot().call()
        if resolved:
            continue
        resolve_time = m.functions.resolveTime().call()
        if not force and now < resolve_time:
            remaining = resolve_time - now
            print(f"  pending {addr} ({remaining}s to resolve time)")
            continue

        kind = m.functions.resolverKind().call()
        strike = m.functions.strikeScaled().call() / cal.STRIKE_SCALE
        try:
            value, asof = realized_value(kind)
        except Exception as e:  # noqa: BLE001
            print(f"  skip {addr}: {e}")
            continue

        outcome = YES if value >= strike else NO
        chain.send(m.functions.resolve(outcome))
        print(
            f"  resolved {kind:<9} {addr}\n"
            f"           realized {value:.2f} vs strike {strike:.2f} "
            f"(data asof {asof}) -> {'YES' if outcome else 'NO'}"
        )
        n += 1
    if n == 0:
        print("  no markets resolved this pass")
    return n
