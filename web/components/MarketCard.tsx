import { Market } from "@/lib/types";
import BetPanel from "@/components/BetPanel";
import { pillarName, KIND_LABEL } from "@/lib/labels";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const clamp = (x: number) => Math.max(5, Math.min(95, x));
const dateShort = (s?: string) =>
  s ? new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";

const BADGE: Record<string, { label: string; cls: string }> = {
  edge: { label: "PROVEN EDGE", cls: "tag-edge" },
  signal: { label: "CALIBRATED", cls: "tag-edge" },
  abstain: { label: "ABSTAINS", cls: "tag-abstain" },
  experimental: { label: "MODELED", cls: "tag-abstain" },
};

export default function MarketCard({ m }: { m: Market }) {
  if (m.error) {
    return (
      <div className="card">
        <div className="kindrow">
          <span className="kind">{m.kind ?? "?"}</span>
        </div>
        <div className="card-note">Unavailable: {m.error}</div>
      </div>
    );
  }

  const tier = m.tier ?? "abstain";
  const claims = tier === "edge" || tier === "signal";
  const badge = BADGE[tier] ?? BADGE.abstain;

  const fw = m.framework_prob;
  const live = Boolean(m.on_chain && m.market_address);
  const crowd = live ? m.crowd_prob ?? 0.5 : null;
  const edge = crowd !== null ? (fw - crowd) * 100 : null;
  const lo = crowd !== null ? Math.min(crowd, fw) : fw;
  const hi = crowd !== null ? Math.max(crowd, fw) : fw;

  const edgeCls =
    !claims || edge === null ? "flat" : edge > 3 ? "pos" : edge < -3 ? "neg" : "flat";
  const cap = !claims
    ? tier === "abstain"
      ? "framework abstains here"
      : "modeled, not calibrated"
    : edge === null
    ? "no live crowd yet"
    : edge > 3
    ? "model: YES underpriced"
    : edge < -3
    ? "model: YES overpriced"
    : "crowd ≈ model";

  return (
    <div className={`card ${tier}${m.resolved ? " resolved" : ""}`}>
      <div className="kindrow">
        <span className="kind">{KIND_LABEL[m.kind] ?? m.kind}</span>
        {m.resolved ? (
          <span className="resolved-tag">RESOLVED</span>
        ) : (
          <span className={badge.cls}>{badge.label}</span>
        )}
      </div>

      <div className="q">{m.question}</div>

      <div className="mini">
        <div className="mini-track" />
        {crowd !== null && (
          <div
            className="mini-fill"
            style={{ left: `${clamp(lo * 100)}%`, width: `${Math.abs((hi - lo) * 100)}%` }}
          />
        )}
        {crowd !== null && (
          <div className="m crowd" style={{ left: `${clamp(crowd * 100)}%` }}>
            <span className="l">crowd {pct(crowd)}</span>
            <span className="p" />
          </div>
        )}
        <div className="m fw" style={{ left: `${clamp(fw * 100)}%` }}>
          <span className="l">model {pct(fw)}</span>
          <span className="p" />
        </div>
      </div>

      <div className="cardline">
        {claims && edge !== null ? (
          <span className={`big ${edgeCls}`}>
            {edge >= 0 ? "+" : ""}
            {edge.toFixed(1)}pp
          </span>
        ) : (
          <span className="big flat">model {pct(fw)}</span>
        )}
        <span className="cap">{cap}</span>
      </div>

      {claims ? (
        <div className="receipts">
          <span className="rcpt">{pillarName(m.pillar.index)}</span>
          <span className="rcpt">
            n <b>{m.signal_quality.n}</b>
          </span>
          <span className="rcpt good">
            IC <b>{m.signal_quality.ic >= 0 ? "+" : ""}{m.signal_quality.ic.toFixed(2)}</b>
          </span>
        </div>
      ) : (
        <div className="card-note abst">{m.tier_note}</div>
      )}

      {live ? (
        <BetPanel market={m.market_address as string} resolved={m.resolved} />
      ) : (
        <div className="nochain">No live on-chain market matched. Model quote only.</div>
      )}

      <div className="pit">
        <span>
          point-in-time <b>{m.information_state.as_of}</b>
        </span>
        {m.resolve_dt && (
          <span>
            resolves <b>{dateShort(m.resolve_dt)}</b>
          </span>
        )}
        {live && (
          <span>
            framework <b>on-chain</b>
          </span>
        )}
      </div>
    </div>
  );
}
