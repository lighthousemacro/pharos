"""Pharos agent runner / orchestrator.

    python -m pharos_agents.runner status
    python -m pharos_agents.runner create   [--lead 14]
    python -m pharos_agents.runner reprice
    python -m pharos_agents.runner resolve  [--force]
    python -m pharos_agents.runner once                # create + reprice + resolve
    python -m pharos_agents.runner demo-market --kind CPI_MOM --ref "May 2026" --resolve-in 5
    python -m pharos_agents.runner trade --market 0x.. --side YES --usdc 1500
"""
from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime, timedelta

from .chain import Chain
from .market_creator import create_due, create_market, reprice_existing
from .oracle import resolve_due

NO, YES = 0, 1


def cmd_status(chain: Chain, _: argparse.Namespace) -> None:
    factory = chain.factory()
    addrs = factory.functions.allMarkets().call()
    if not addrs:
        print("no markets yet")
        return
    print(f"{len(addrs)} market(s):\n")
    for a in addrs:
        m = chain.market(a)
        q = m.functions.question().call()
        mkt, fw, coll, ry, rn, resolved, winner = m.functions.snapshot().call()
        edge = fw - mkt
        state = (
            f"RESOLVED {'YES' if winner == YES else 'NO'}"
            if resolved
            else "open"
        )
        print(f"• {q}")
        print(
            f"    crowd {mkt/100:5.1f}%  |  framework {fw/100:5.1f}%  |  "
            f"edge {edge/100:+5.1f}pp  |  TVL {coll/1e6:,.0f} USDC  |  {state}\n"
            f"    {a}"
        )


def cmd_create(chain: Chain, a: argparse.Namespace) -> None:
    create_due(chain, lead_days=a.lead)


def cmd_reprice(chain: Chain, _: argparse.Namespace) -> None:
    reprice_existing(chain)


def cmd_resolve(chain: Chain, a: argparse.Namespace) -> None:
    resolve_due(chain, force=a.force)


def cmd_once(chain: Chain, a: argparse.Namespace) -> None:
    print("[create]")
    create_due(chain, lead_days=getattr(a, "lead", 14))
    print("[reprice]")
    reprice_existing(chain)
    print("[resolve]")
    resolve_due(chain, force=False)


def cmd_demo_market(chain: Chain, a: argparse.Namespace) -> None:
    # Schedule against the CHAIN clock, not the wall clock — robust to
    # any local-node block-time drift.
    resolve_dt = datetime.fromtimestamp(chain.block_time() + a.resolve_in)
    create_market(chain, a.kind, a.ref, resolve_dt, strike=a.strike)


def cmd_fastforward(chain: Chain, a: argparse.Namespace) -> None:
    """Advance EVM time deterministically (hardhat/anvil) so a demo
    market reaches its resolve time without a wall-clock wait."""
    chain.w3.provider.make_request("evm_increaseTime", [a.seconds])
    chain.w3.provider.make_request("evm_mine", [])
    print(f"  fast-forwarded chain by {a.seconds}s")


def cmd_trade(chain: Chain, a: argparse.Namespace) -> None:
    m = chain.market(a.market)
    usdc = chain.usdc()
    units = chain.usdc_units(a.usdc)
    side = YES if a.side.upper() == "YES" else NO
    # Demo trader self-funds from the open testnet faucet.
    chain.send(usdc.functions.mint(chain.address, units))
    chain.send(usdc.functions.approve(a.market, units))
    before = m.functions.marketProbBps().call()
    chain.send(m.functions.buy(side, units, 0))
    after = m.functions.marketProbBps().call()
    print(
        f"traded {a.usdc:.0f} USDC {a.side.upper()} on {a.market}\n"
        f"  crowd price {before/100:.1f}% -> {after/100:.1f}%"
    )


def main() -> int:
    p = argparse.ArgumentParser(prog="pharos_agents.runner")
    p.add_argument("--network", default=None)
    sub = p.add_subparsers(dest="cmd", required=True)

    sp = sub.add_parser("status")
    sp.set_defaults(fn=cmd_status)

    sp = sub.add_parser("create")
    sp.add_argument("--lead", type=int, default=14)
    sp.set_defaults(fn=cmd_create)

    sp = sub.add_parser("reprice")
    sp.set_defaults(fn=cmd_reprice)

    sp = sub.add_parser("resolve")
    sp.add_argument("--force", action="store_true")
    sp.set_defaults(fn=cmd_resolve)

    sp = sub.add_parser("once")
    sp.add_argument("--lead", type=int, default=14)
    sp.set_defaults(fn=cmd_once)

    sp = sub.add_parser("demo-market")
    sp.add_argument("--kind", required=True)
    sp.add_argument("--ref", required=True)
    sp.add_argument("--resolve-in", type=int, default=5, dest="resolve_in")
    sp.add_argument("--strike", type=float, default=None)
    sp.set_defaults(fn=cmd_demo_market)

    sp = sub.add_parser("fastforward")
    sp.add_argument("--seconds", type=int, default=120)
    sp.set_defaults(fn=cmd_fastforward)

    sp = sub.add_parser("trade")
    sp.add_argument("--market", required=True)
    sp.add_argument("--side", required=True, choices=["YES", "NO", "yes", "no"])
    sp.add_argument("--usdc", type=float, required=True)
    sp.set_defaults(fn=cmd_trade)

    args = p.parse_args()
    chain = Chain(network=args.network)
    args.fn(chain, args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
