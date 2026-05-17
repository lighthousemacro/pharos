import { Market } from "@/lib/types";

function pct(x: number) {
  return `${(x * 100).toFixed(1)}%`;
}

export default function MarketCard({ m }: { m: Market }) {
  if (m.error) {
    return (
      <div className="card">
        <div className="kindrow">
          <span className="kind">{m.kind ?? "?"}</span>
        </div>
        <div className="why">Unavailable: {m.error}</div>
      </div>
    );
  }

  const fw = m.framework_prob;
  const crowd = m.crowd_prob ?? 0.5;
  const edge = (fw - crowd) * 100; // percentage points, framework vs crowd
  const sq = m.signal_quality;
  const info = m.information_state;
  const resolved = false;

  const edgeCls = edge > 3 ? "pos" : edge < -3 ? "neg" : "flat";
  const edgeWord =
    edge > 3 ? "framework sees YES underpriced" :
    edge < -3 ? "framework sees YES overpriced" :
    "crowd ≈ framework";

  return (
    <div className={`card${resolved ? " resolved" : ""}`}>
      <div className="kindrow">
        <span className="kind">{m.kind}</span>
        <span className="ref">{m.ref_label}</span>
      </div>

      <div className="q">{m.question}</div>

      <div className="gauge">
        <div className="track" />
        <div className="marker m-cr" style={{ left: `${crowd * 100}%` }}>
          <div className="pin" />
          <div className="lbl">crowd {pct(crowd)}</div>
        </div>
        <div className="marker m-fw" style={{ left: `${fw * 100}%` }}>
          <div className="pin" />
          <div className="lbl">framework {pct(fw)}</div>
        </div>
      </div>

      <div className="edge">
        <span className={`big ${edgeCls}`}>
          {edge >= 0 ? "+" : ""}
          {edge.toFixed(1)}pp
        </span>
        <span className="cap">{edgeWord}</span>
      </div>

      <div className="why">{m.reasoning}</div>

      <div className="chips">
        <span className="chip">
          pillar <b>{m.pillar.index}</b> {m.pillar.zn_score >= 0 ? "+" : ""}
          {m.pillar.zn_score}σ
        </span>
        <span className={`chip ${Math.abs(sq.ic) >= 0.2 ? "good" : "warn"}`}>
          IC <b>{sq.ic >= 0 ? "+" : ""}{sq.ic}</b>
        </span>
        <span className="chip">
          bal-acc <b>{sq.bal_accuracy}</b>
        </span>
        <span className="chip">n=<b>{sq.n}</b></span>
        <span className={`chip ${sq.shrink >= 0.6 ? "good" : "warn"}`}>
          conviction <b>{(0.35 + 0.65 * sq.shrink).toFixed(2)}</b>
        </span>
      </div>

      <div className="pit">
        <span>
          point-in-time <b>{info.as_of}</b>
        </span>
        <span>
          pub-lag <b>{info.pub_lag_days}d</b>
        </span>
        <span>
          grading <b>{info.grading}</b>
        </span>
      </div>
    </div>
  );
}
