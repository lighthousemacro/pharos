"""Pharos pricing engine.

Framework probabilities for binary macro markets, computed from the live
Lighthouse Macro database. Methodology is grounded in the Macrosynergy /
JPMaQS quantamental approach (concepts only — point-in-time information
states, consistent seasonally-adjusted annualized trends, zn-scores, and
signal-return calibration — applied to LHM's own data, not their
proprietary catalogs, datasets, or package).
"""

__version__ = "0.1.0"

from .models import price_market, list_market_kinds  # noqa: F401
