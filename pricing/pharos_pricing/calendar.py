"""Economic release calendar and market registry.

Release dates are public, deterministic facts published a year ahead by
the BLS, BEA, and Federal Reserve. They are encoded here and should be
reconciled against the official calendars before any mainnet deployment:

  * BLS CPI / Employment Situation : https://www.bls.gov/schedule/
  * BEA GDP                        : https://www.bea.gov/news/schedule
  * FOMC meetings                  : https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm

`STRIKE_SCALE` is the single source of truth for on-chain strike scaling.
The pricing engine, the market-creator agent, and the oracle agent all
import it so a strike means the same integer everywhere.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

# Strike, and any human macro value, is stored on-chain as int(value * 1e6).
STRIKE_SCALE = 1_000_000


@dataclass(frozen=True)
class MarketKind:
    kind: str
    label: str
    series_id: str          # observations series the outcome resolves on
    pillar_index: str       # display label for the tilt (single id or "A+B")
    pillar_sign: float      # +1 if high pillar -> higher outcome, else -1
    transform: str          # "cpi_trend" | "nfp_trend" | "gdp_trend" | "policy"
    unit: str               # human unit for the strike
    default_strike: float   # sensible demo strike in human units
    question_tmpl: str
    pillar_combo: tuple[str, ...] = ()  # >1 lighthouse_indices id -> equal-weight zn composite


# The four demo verticals. CPI / NFP / GDP resolve on official BLS/BEA
# prints; FOMC on the published target rate.
MARKET_KINDS: dict[str, MarketKind] = {
    "CPI_MOM": MarketKind(
        kind="CPI_MOM",
        label="US Headline CPI — consistent trend",
        series_id="CPIAUCSL",
        pillar_index="PCI",          # Inflation Heat
        pillar_sign=+1.0,
        transform="cpi_trend",
        unit="% 3m/6m saar",
        default_strike=3.0,
        question_tmpl="US headline CPI trend for {ref} prints >= {strike:.2f}% (3m/6m saar)?",
    ),
    "NFP": MarketKind(
        kind="NFP",
        label="US Nonfarm Payrolls",
        series_id="PAYEMS",
        pillar_index="LFI",          # Labor Fragility (higher -> weaker jobs)
        pillar_sign=-1.0,
        transform="nfp_trend",
        unit="k jobs",
        default_strike=125.0,
        question_tmpl="US nonfarm payrolls for {ref} print >= {strike:.0f}k?",
    ),
    "GDP": MarketKind(
        kind="GDP",
        label="US Real GDP (annualized q/q)",
        series_id="A191RL1Q225SBEA",
        # Capex Thrust + Consumer Pulse both lead GDP. The original single
        # Activity Pulse (GCI) wiring had ~no demonstrated edge (IC +0.07);
        # the BCI+CCI composite holds out of sample (IC +0.20, holdout +0.44,
        # bal-acc 0.61). Equal-weight zn composite — see research/EDGE_FINDINGS.md.
        pillar_index="BCI+CCI",      # Capex Thrust + Consumer Pulse
        pillar_combo=("BCI", "CCI"),
        pillar_sign=+1.0,
        transform="gdp_trend",
        unit="% saar",
        default_strike=2.0,
        question_tmpl="US real GDP for {ref} prints >= {strike:.2f}% (saar)?",
    ),
    "FOMC_CUT": MarketKind(
        kind="FOMC_CUT",
        label="FOMC — 25bps+ cut at next meeting",
        series_id="DFEDTARU",
        pillar_index="MRI",          # Macro Risk Index (regime)
        pillar_sign=+1.0,            # higher risk -> more likely to cut
        transform="policy",
        unit="bps cut",
        default_strike=25.0,
        question_tmpl="Does the FOMC cut the target by >= 25bps at the {ref} meeting?",
    ),
}


def scale_strike(value: float) -> int:
    return int(round(value * STRIKE_SCALE))


def unscale_strike(scaled: int) -> float:
    return scaled / STRIKE_SCALE


# ----------------------------------------------------------------------
#  2026 release schedule (reference month/period -> public release date)
# ----------------------------------------------------------------------
# Encoded from the official BLS/BEA/Fed 2026 calendars. Verify before
# mainnet. Each entry: (kind, reference label, resolve datetime UTC-ish).
_SCHEDULE_2026 = [
    # CPI — Consumer Price Index (reference month -> release)
    ("CPI_MOM", "Apr 2026", datetime(2026, 5, 12, 13, 30)),
    ("CPI_MOM", "May 2026", datetime(2026, 6, 10, 13, 30)),
    ("CPI_MOM", "Jun 2026", datetime(2026, 7, 14, 13, 30)),
    ("CPI_MOM", "Jul 2026", datetime(2026, 8, 12, 13, 30)),
    # Employment Situation — Nonfarm Payrolls
    ("NFP", "May 2026", datetime(2026, 6, 5, 13, 30)),
    ("NFP", "Jun 2026", datetime(2026, 7, 2, 13, 30)),
    ("NFP", "Jul 2026", datetime(2026, 8, 7, 13, 30)),
    # GDP — BEA estimates
    ("GDP", "Q1 2026 (2nd)", datetime(2026, 5, 28, 13, 30)),
    ("GDP", "Q2 2026 (adv)", datetime(2026, 7, 30, 13, 30)),
    # FOMC meeting decisions (2026 schedule)
    ("FOMC_CUT", "Jun 2026", datetime(2026, 6, 17, 19, 0)),
    ("FOMC_CUT", "Jul 2026", datetime(2026, 7, 29, 19, 0)),
    ("FOMC_CUT", "Sep 2026", datetime(2026, 9, 16, 19, 0)),
]


@dataclass(frozen=True)
class ReleaseEvent:
    kind: str
    ref_label: str
    resolve_dt: datetime

    @property
    def market_key(self) -> str:
        return f"{self.kind}:{self.ref_label}"


def all_events() -> list[ReleaseEvent]:
    return [ReleaseEvent(k, r, d) for (k, r, d) in _SCHEDULE_2026]


def upcoming(as_of: date | None = None, within_days: int = 60) -> list[ReleaseEvent]:
    """Releases that resolve between `as_of` and `as_of + within_days`."""
    today = as_of or date.today()
    out = []
    for ev in all_events():
        days = (ev.resolve_dt.date() - today).days
        if 0 <= days <= within_days:
            out.append(ev)
    return sorted(out, key=lambda e: e.resolve_dt)
