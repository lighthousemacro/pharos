"""Render the Pharos social unfurl card (og:image).

Static 1200x630 brand hero — no chain/RPC dependency, never goes stale in a
thumbnail. This is the card Discord/X renders when the deployed URL is shared.
Output: web/public/og.png
"""
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]

NAVY = "#0A1628"
NAVY2 = "#0F1F33"
LINE = "#1f3349"
OCEAN = "#2389BB"
DUSK = "#FF6723"
SEA = "#00BB89"
INK = "#E9EEF5"
MUTE = "#9DB0C4"

# 1200x630 is the canonical OG/Twitter-card size. dpi=100 -> 12x6.3 in.
fig = plt.figure(figsize=(12, 6.3), dpi=100)
fig.patch.set_facecolor(NAVY)
ax = fig.add_axes([0, 0, 1, 1])
ax.set_facecolor(NAVY)
ax.axis("off")
ax.set_xlim(0, 100)
ax.set_ylim(0, 100)

# Brand accent bar (Ocean 2/3, Dusk 1/3) — top and mirrored bottom
ax.add_patch(plt.Rectangle((0, 97.5), 66, 2.5, color=OCEAN, zorder=5))
ax.add_patch(plt.Rectangle((66, 97.5), 34, 2.5, color=DUSK, zorder=5))
ax.add_patch(plt.Rectangle((0, 0), 66, 2.0, color=OCEAN, zorder=5))
ax.add_patch(plt.Rectangle((66, 0), 34, 2.0, color=DUSK, zorder=5))

# Status chip
ax.add_patch(plt.Rectangle((7, 80), 33, 7, color=NAVY2, ec=SEA, lw=1.2, zorder=2))
ax.text(8.6, 83.4, "● LIVE ON ARC TESTNET", fontsize=12.5, color=SEA,
        va="center", family="DejaVu Sans Mono", fontweight="bold")

# Wordmark + tagline
ax.text(7, 64, "PHAROS", fontsize=68, fontweight="bold", color="#FFFFFF",
        family="DejaVu Sans", va="center")
ax.text(7.6, 52, "MACRO, ILLUMINATED.", fontsize=14, color=OCEAN,
        family="DejaVu Sans Mono", fontweight="bold", va="center")

# The hook — the one line that explains it
ax.text(7, 39, "Macro prediction markets, priced by the framework.",
        fontsize=22, color=INK, family="DejaVu Sans", va="center")

# The differentiator
ax.text(7, 28,
        "Every contract shows two prices: what the crowd thinks, and what a",
        fontsize=13, color=MUTE, family="DejaVu Sans", va="center")
ax.text(7, 22.5,
        "12-pillar point-in-time model thinks. The spread is the product.",
        fontsize=13, color=MUTE, family="DejaVu Sans", va="center")

# Footer line
ax.plot([7, 93], [13, 13], color=LINE, lw=1)
ax.text(7, 8.5, "Settled in Circle USDC  ·  Built on Arc",
        fontsize=12, color=MUTE, family="DejaVu Sans", va="center")
ax.text(93, 8.5, "Lighthouse Macro  ·  @LHMacro", fontsize=12, color=OCEAN,
        ha="right", family="DejaVu Sans", va="center")

out_dir = ROOT / "web" / "public"
out_dir.mkdir(parents=True, exist_ok=True)
out = out_dir / "og.png"
fig.savefig(out, facecolor=NAVY, dpi=100)
print(str(out))
