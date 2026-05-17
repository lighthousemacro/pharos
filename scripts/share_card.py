"""Render the live Arc market book as a branded share card (PNG)."""
import os, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "agents"))
sys.path.insert(0, str(ROOT / "pricing"))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager

from pharos_agents.chain import Chain

NAVY="#0A1628"; NAVY2="#0F1F33"; LINE="#1f3349"
OCEAN="#2389BB"; DUSK="#FF6723"; SEA="#00BB89"; INK="#E9EEF5"; MUTE="#9DB0C4"

c = Chain(network="arc")
rows = []
for a in c.factory().functions.allMarkets().call():
    m = c.market(a)
    q = m.functions.question().call()
    mkt, fw, coll, ry, rn, resolved, winner = m.functions.snapshot().call()
    rows.append((q, mkt/100.0, fw/100.0, (fw-mkt)/100.0, a))

fig = plt.figure(figsize=(13, 8.6), dpi=200)
fig.patch.set_facecolor(NAVY)
ax = fig.add_axes([0,0,1,1]); ax.set_facecolor(NAVY); ax.axis("off")
ax.set_xlim(0,100); ax.set_ylim(0,100)

# accent bar
ax.add_patch(plt.Rectangle((0,98.7),66,1.3,color=OCEAN,zorder=5))
ax.add_patch(plt.Rectangle((66,98.7),34,1.3,color=DUSK,zorder=5))

ax.text(5,92,"PHAROS",fontsize=34,fontweight="bold",color="#FFFFFF",family="DejaVu Sans")
ax.text(5,87.3,"MACRO, ILLUMINATED.",fontsize=11,color=OCEAN,family="DejaVu Sans Mono",
        fontweight="bold")
ax.text(95,91,"LIVE ON ARC TESTNET",fontsize=12,color=SEA,ha="right",
        family="DejaVu Sans Mono",fontweight="bold")
ax.text(95,87.3,"settled in Circle USDC · priced by the Lighthouse framework",
        fontsize=10,color=MUTE,ha="right",family="DejaVu Sans")

# header
y=78
ax.text(5,y,"MARKET",fontsize=11,color=MUTE,family="DejaVu Sans Mono")
ax.text(60,y,"CROWD",fontsize=11,color=DUSK,ha="center",family="DejaVu Sans Mono")
ax.text(74,y,"FRAMEWORK",fontsize=11,color=OCEAN,ha="center",family="DejaVu Sans Mono")
ax.text(92,y,"EDGE",fontsize=11,color=MUTE,ha="center",family="DejaVu Sans Mono")
ax.plot([5,95],[y-2,y-2],color=LINE,lw=1)

y=72
for q,mkt,fw,edge,addr in rows:
    hot = abs(edge) >= 0.15
    ax.add_patch(plt.Rectangle((4,y-3.6),92,6.6,color=NAVY2,
                 ec=(OCEAN if hot else LINE),lw=(1.4 if hot else 0.6),zorder=1))
    short = q if len(q)<58 else q[:56]+"…"
    ax.text(5.5,y,short,fontsize=11.5,color=INK,va="center",family="DejaVu Sans")
    ax.text(5.5,y-2.6,addr,fontsize=7.5,color=MUTE,va="center",family="DejaVu Sans Mono")
    ax.text(60,y,f"{mkt*100:.0f}%",fontsize=15,color=DUSK,ha="center",va="center",
            fontweight="bold",family="DejaVu Sans")
    ax.text(74,y,f"{fw*100:.0f}%",fontsize=15,color=OCEAN,ha="center",va="center",
            fontweight="bold",family="DejaVu Sans")
    ec="#00BB89" if edge>0.03 else ("#FF2389" if edge<-0.03 else MUTE)
    ax.text(92,y,f"{edge*100:+.0f}pp",fontsize=15,color=ec,ha="center",va="center",
            fontweight="bold",family="DejaVu Sans")
    y-=8.4

ax.text(5,6.5,"Two prices on every macro contract. The crowd's, and a 12-pillar "
        "point-in-time model's. The gap is the product.",
        fontsize=11,color=MUTE,family="DejaVu Sans")
ax.text(5,2.6,"Lighthouse Macro  ·  Research  ·  @LHMacro",
        fontsize=10,color=OCEAN,family="DejaVu Sans")

out = ROOT / "docs" / "pharos_share_card.png"
fig.savefig(out, facecolor=NAVY, bbox_inches="tight", pad_inches=0.15)
print(str(out))
