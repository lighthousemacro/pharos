"""Pharos agents — autonomous market creator, pricing oracle, and resolver.

  * market_creator : reads the econ calendar, opens + seeds markets ahead
                     of each release at the Lighthouse framework's price
  * (re)pricing    : re-posts the framework probability on-chain as new
                     data lands — the framework price is a live oracle
  * oracle         : resolves markets on the official government print
"""
__version__ = "0.1.0"
