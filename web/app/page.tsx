"use client";

import { useEffect, useState } from "react";
import MarketCard from "@/components/MarketCard";
import { MarketsResponse } from "@/lib/types";

export default function Home() {
  const [data, setData] = useState<MarketsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/markets")
        .then((r) => r.json())
        .then((d) => alive && setData(d))
        .catch((e) => alive && setErr(String(e)));
    load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <main className="wrap">
      <div className="masthead">
        <h1>PHAROS</h1>
        <span className="tag">MACRO, ILLUMINATED.</span>
      </div>
      <p className="sub">
        Binary macro markets on Arc, settled in USDC. Every contract shows{" "}
        <strong>two prices</strong>: what the crowd thinks, and what the
        Lighthouse Macro framework thinks. The framework posts a point-in-time
        fair value from a 2,500-series quantamental model. <strong>The spread
        is the product.</strong>
      </p>

      {data && (
        <div className={`banner ${data.source}`}>
          <span className="dot" />
          {data.source === "live"
            ? "live — pricing engine connected to Lighthouse_Master.db"
            : "cached sample — start the pricing service (make serve) for live quotes"}
        </div>
      )}

      {err && <p className="sub">Error: {err}</p>}

      <div className="grid">
        {data?.markets.map((m, i) => (
          <MarketCard key={m.market_key ?? `${m.kind}-${i}`} m={m} />
        ))}
      </div>

      <footer>
        Framework probabilities are point-in-time information states — no
        look-ahead. Methodology grounded in the Macrosynergy/JPMaQS
        quantamental approach (consistent annualized trends, zn-scores,
        signal-return calibration), applied to Lighthouse Macro&apos;s own
        12-pillar framework and database.
        <br />
        Lighthouse Macro · Research · @LHMacro
      </footer>
    </main>
  );
}
