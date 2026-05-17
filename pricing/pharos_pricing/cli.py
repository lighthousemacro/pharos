"""Pretty-print framework prices. Used by `make price` and the demo.

    python -m pharos_pricing.cli            # price every demo market
    python -m pharos_pricing.cli CPI_MOM 3.0
"""
from __future__ import annotations

import json
import sys

from .calendar import MARKET_KINDS
from .models import price_market


def _line(p: dict) -> str:
    sq = p["signal_quality"]
    return (
        f"  {p['kind']:<9} {p['ref_label']:<14} "
        f"strike {p['strike']:>7.2f} {p['unit']:<14} "
        f"-> framework {p['framework_prob']*100:5.1f}% "
        f"({p['framework_prob_bps']:>4}bps)  "
        f"nowcast {p['nowcast']:>7.2f}  "
        f"IC {sq['ic']:+.2f} shrink {sq['shrink']:.2f}"
    )


def main() -> int:
    args = sys.argv[1:]
    if args:
        kind = args[0]
        strike = float(args[1]) if len(args) > 1 else None
        print(json.dumps(price_market(kind, strike), indent=2))
        return 0

    print("Pharos framework prices (live Lighthouse_Master.db):\n")
    ok = True
    for kind in MARKET_KINDS:
        try:
            print(_line(price_market(kind)))
        except Exception as e:  # noqa: BLE001
            ok = False
            print(f"  {kind:<9} ERROR: {e}")
    print(
        "\nEvery quote is a point-in-time information state — no look-ahead. "
        "Methodology: Macrosynergy/JPMaQS-style consistent trends, zn-scores,\n"
        "signal-return calibration. Applied to LHM's own framework + data."
    )
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
