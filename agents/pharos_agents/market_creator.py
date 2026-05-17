"""Market-creator agent.

Reads the economic-release calendar, and for every release inside the
lead window opens a binary market seeded with USDC liquidity, posting the
Lighthouse framework's point-in-time fair value on-chain at creation. It
can also re-post the framework price on existing markets as new data
lands — the framework price is a *live* oracle, not a one-time seed.
"""
from __future__ import annotations

import os
import sys
import time
from datetime import datetime
from pathlib import Path

from web3 import Web3
from web3.logs import DISCARD

# Use the pricing engine in-process (self-contained; no running service
# required for the demo).
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "pricing"))
from pharos_pricing import calendar as cal  # noqa: E402
from pharos_pricing.models import price_market  # noqa: E402

from .chain import Chain  # noqa: E402


def _key(market_key: str) -> bytes:
    return Web3.keccak(text=market_key)


def _seed_units(chain: Chain) -> int:
    return chain.usdc_units(float(os.environ.get("PHAROS_SEED_USDC", "5000")))


def create_market(
    chain: Chain,
    kind: str,
    ref_label: str,
    resolve_dt: datetime,
    strike: float | None = None,
    seed_usdc: int | None = None,
) -> str:
    factory = chain.factory()
    market_key = f"{kind}:{ref_label}"
    existing = factory.functions.marketByKey(_key(market_key)).call()
    if int(existing, 16) != 0:
        print(f"  exists  {market_key} -> {existing}")
        return existing

    quote = price_market(kind, strike, ref_label=ref_label)
    mk = cal.MARKET_KINDS[kind]
    strike_scaled = quote["strike_scaled"]
    fw_bps = quote["framework_prob_bps"]
    resolve_ts = int(resolve_dt.timestamp())
    seed = seed_usdc if seed_usdc is not None else _seed_units(chain)

    # Approve the factory to pull the seed, then create + seed atomically.
    usdc = chain.usdc()
    chain.send(usdc.functions.approve(factory.address, seed))
    rcpt = chain.send(
        factory.functions.createMarket(
            _key(market_key),
            quote["question"],
            strike_scaled,
            resolve_ts,
            kind,
            fw_bps,
            seed,
        )
    )
    ev = factory.events.MarketCreated().process_receipt(rcpt, errors=DISCARD)[0]
    addr = ev["args"]["market"]
    print(
        f"  created {market_key:<22} -> {addr}\n"
        f"          framework {fw_bps/100:.1f}% | seed {seed/1e6:.0f} USDC | "
        f"resolves {resolve_dt.isoformat()}\n"
        f"          {quote['reasoning']}"
    )
    return addr


def create_due(chain: Chain, lead_days: int = 14, within_days: int = 60) -> list[str]:
    created = []
    now = datetime.now()
    for ev in cal.upcoming(within_days=within_days):
        days = (ev.resolve_dt - now).days
        if days <= lead_days:
            created.append(
                create_market(chain, ev.kind, ev.ref_label, ev.resolve_dt)
            )
    if not created:
        print("  nothing due inside the lead window")
    return created


def reprice_existing(chain: Chain) -> None:
    """Re-post the framework probability on every open market."""
    factory = chain.factory()
    for addr in factory.functions.allMarkets().call():
        m = chain.market(addr)
        mkt_bps, fw_bps, _, _, _, resolved, _ = m.functions.snapshot().call()
        if resolved:
            continue
        kind = m.functions.resolverKind().call()
        strike = m.functions.strikeScaled().call() / cal.STRIKE_SCALE
        try:
            quote = price_market(kind, strike, ref_label="next")
        except Exception as e:  # noqa: BLE001
            print(f"  skip {addr}: {e}")
            continue
        new_bps = quote["framework_prob_bps"]
        if abs(new_bps - fw_bps) >= 25:  # only write on a real move
            chain.send(m.functions.updateFrameworkProb(new_bps))
            print(f"  repriced {kind:<9} {fw_bps/100:.1f}% -> {new_bps/100:.1f}%")
        else:
            print(f"  hold     {kind:<9} {fw_bps/100:.1f}% (mkt {mkt_bps/100:.1f}%)")
