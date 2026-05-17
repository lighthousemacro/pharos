"""FastAPI pricing service.

Mirrors the LHM OpenBB-backend pattern (a thin FastAPI bridge over
Lighthouse_Master.db). The market-creator agent and the web app both read
from here, so the framework price has exactly one source of truth.

    pharos-serve            # uvicorn on :6910
"""
from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException

from . import calendar as cal
from . import db
from .models import list_market_kinds, price_market

app = FastAPI(title="Pharos Pricing", version="0.1.0")

KEY_PILLARS = ["PCI", "LFI", "GCI", "MRI", "REC_PROB", "MSI", "SPI"]


@app.get("/health")
def health() -> dict:
    try:
        d, v, s = db.latest_index("MRI")
        return {"ok": True, "db": db.DEFAULT_DB, "mri_asof": d.strftime("%Y-%m-%d")}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": str(e)}


@app.get("/pillars")
def pillars() -> dict:
    out = {}
    for p in KEY_PILLARS:
        try:
            d, v, s = db.latest_index(p)
            out[p] = {"value": round(v, 4), "status": s, "asof": d.strftime("%Y-%m-%d")}
        except KeyError:
            continue
    return out


@app.get("/calendar")
def calendar(within_days: int = 60) -> dict:
    evs = cal.upcoming(within_days=within_days)
    return {
        "count": len(evs),
        "events": [
            {
                "kind": e.kind,
                "ref_label": e.ref_label,
                "market_key": e.market_key,
                "resolve_dt": e.resolve_dt.isoformat(),
            }
            for e in evs
        ],
    }


@app.get("/price")
def price(kind: str, strike: float | None = None, ref_label: str = "next") -> dict:
    try:
        return price_market(kind, strike, ref_label=ref_label)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/markets")
def markets(within_days: int = 45) -> dict:
    """Calendar joined with framework prices — what the creator agent and
    the UI consume to know which markets to open and at what fair value."""
    out = []
    for e in cal.upcoming(within_days=within_days):
        mk = cal.MARKET_KINDS[e.kind]
        try:
            p = price_market(e.kind, mk.default_strike, ref_label=e.ref_label)
            p["market_key"] = e.market_key
            p["resolve_dt"] = e.resolve_dt.isoformat()
            out.append(p)
        except Exception as exc:  # noqa: BLE001
            out.append({"market_key": e.market_key, "error": str(exc)})
    return {"count": len(out), "markets": out}


@app.get("/kinds")
def kinds() -> dict:
    return {"kinds": list_market_kinds()}


def run() -> None:
    import uvicorn

    uvicorn.run(
        app,
        host=os.environ.get("PHAROS_HOST", "127.0.0.1"),
        port=int(os.environ.get("PHAROS_PORT", "6910")),
    )


if __name__ == "__main__":
    run()
