import { Market } from "@/lib/types";
import ChainCTA from "@/components/ChainCTA";
import { pillarName } from "@/lib/labels";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const clamp = (x: number) => Math.max(4, Math.min(96, x));
const dateShort = (s?: string) =>
  s ? new Date(s).toLocaleDateString(undefined, { month: "long", day: "numeric" }) : "";

// The hero: one market, big, with the crowd price and the framework price on a
// single axis and the spread between them called out. This is the whole pitch
// in one picture — two numbers, and the gap is the product.
export default function FlagshipSpread({ m }: { m: Market }) {
  const fw = m.framework_prob;
  const live = Boolean(m.on_chain && m.market_address);
  const crowd = m.crowd_prob ?? 0.5; // seed price until the crowd trades
  const edge = (fw - crowd) * 100;
  const lo = Math.min(crowd, fw);
  const hi = Math.max(crowd, fw);

  const edgeCls = edge > 3 ? "pos" : edge < -3 ? "neg" : "flat";
  const say =
    edge > 3
      ? "the framework reads YES as underpriced"
      : edge < -3
      ? "the framework reads YES as overpriced"
      : "the crowd and the framework agree";

  return (
    <div className="flagship">
      <div className="flagship-top">
        <span className="flagship-tag">
          ◆ Flagship market · {live ? "live on Arc testnet" : "framework quote"}
        </span>
        <span className="livepill">
          <span className="dot" />
          {live ? "on-chain" : "framework"}
        </span>
      </div>

      <h3>{m.question}</h3>
      <div className="resolves">
        Settles on the official BLS print · <b>{dateShort(m.resolve_dt)}</b>
      </div>

      <div className="spread">
        <div className="spread-track">
          <div
            className="spread-fill"
            style={{ left: `${clamp(lo * 100)}%`, width: `${Math.abs((hi - lo) * 100)}%` }}
          />
        </div>
        <div className="spread-scale">
          {[0, 25, 50, 75, 100].map((t) => (
            <span key={t} className="t" style={{ left: `${t}%` }}>
              {t}
            </span>
          ))}
        </div>
        <div className="pin crowd" style={{ left: `${clamp(crowd * 100)}%` }}>
          <div className="flag">
            <div className="who">the crowd</div>
            <div className="val">{pct(crowd)}</div>
          </div>
          <div className="dot" />
        </div>
        <div className="pin fw" style={{ left: `${clamp(fw * 100)}%` }}>
          <div className="dot" />
          <div className="flag">
            <div className="who">the framework</div>
            <div className="val">{pct(fw)}</div>
          </div>
        </div>
      </div>

      <div className="edge-readout">
        <span className={`edge-num ${edgeCls}`}>
          {edge >= 0 ? "+" : ""}
          {edge.toFixed(1)}
          <span style={{ fontSize: "0.42em", marginLeft: "2px" }}>pp</span>
        </span>
        <span className="edge-say">
          <b>{say}.</b> A whale can shove the crowd price. It cannot move the
          framework number. That one is computed from official data,
          point-in-time, and posted on-chain before anyone shows up.
        </span>
      </div>

      <div className="receipts">
        <span className="rcpt good">{pillarName(m.pillar.index)}</span>
        <span className="rcpt">
          calibrated on <b>{m.signal_quality.n}</b> prints
        </span>
        <span className="rcpt good">
          IC <b>{m.signal_quality.ic >= 0 ? "+" : ""}{m.signal_quality.ic.toFixed(2)}</b>
        </span>
        <span className="rcpt">
          point-in-time <b>{m.information_state.as_of}</b>
        </span>
        {live && (
          <span className="rcpt chain">
            framework price <b>on-chain</b>
          </span>
        )}
      </div>

      {live ? (
        <ChainCTA market={m.market_address as string} resolved={m.resolved} />
      ) : (
        <div className="nochain">
          Live on Arc testnet. Market matching…
        </div>
      )}
    </div>
  );
}
