import MarketCard from "@/components/MarketCard";
import FlagshipSpread from "@/components/FlagshipSpread";
import { BOARD, SNAPSHOT_AS_OF, FACTORY, ARCSCAN } from "@/lib/snapshot";

const GITHUB = "https://github.com/lighthousemacro/pharos";

export default function Home() {
  const flagship = BOARD.find((m) => m.tier === "edge") ?? BOARD[0];
  const board = BOARD.filter((m) => m !== flagship);

  return (
    <main>
      {/* nav */}
      <nav className="nav">
        <div className="brand">
          <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M16 9 L2 4 L2 13 Z" fill="#23bbff" opacity="0.55" />
            <path d="M16 9 L30 4 L30 13 Z" fill="#ff6723" opacity="0.6" />
            <rect x="12.6" y="7.5" width="6.8" height="5.5" rx="1.2" fill="#23bbff" />
            <path d="M12 13 L20 13 L18.4 28 L13.6 28 Z" fill="#2389bb" />
            <rect x="11" y="27.6" width="10" height="2.2" rx="1" fill="#2389bb" />
          </svg>
          <div>
            <div className="name">PHAROS</div>
            <div className="by">by Lighthouse Macro</div>
          </div>
        </div>
        <div className="nav-links">
          <a href="#how">How it works</a>
          <a href="#arc">On Arc</a>
          <a className="nav-cta" href={GITHUB} target="_blank" rel="noopener noreferrer">
            GitHub ↗
          </a>
        </div>
      </nav>

      <div className="wrap">
        {/* hero */}
        <section className="hero">
          <div className="eyebrow">Macro prediction markets · priced by the framework</div>
          <h1>
            Two prices on every macro market. The crowd&apos;s, and{" "}
            <span className="accent">the framework&apos;s.</span>
          </h1>
          <p className="lede">
            Polymarket and Kalshi show one number, what bettors are paying.
            Pharos opens binary markets on CPI, payrolls, GDP and the Fed, and
            posts a <b>second number</b> beside it: an independent 12-pillar macro
            model&apos;s fair value, computed from official data, point-in-time,
            and written on-chain before anyone trades. The gap between the two is
            the product.
          </p>
          <div className="metrics">
            <div className="metric">
              <div className="k">2 <span className="u">prices</span></div>
              <div className="v">on every market</div>
            </div>
            <div className="metric">
              <div className="k">12 <span className="u">pillars</span></div>
              <div className="v">2,500-series macro model</div>
            </div>
            <div className="metric">
              <div className="k">100% <span className="u">on-chain</span></div>
              <div className="v">settles on official data</div>
            </div>
            <div className="metric">
              <div className="k">Arc <span className="u">testnet</span></div>
              <div className="v">USDC in, USDC out</div>
            </div>
          </div>
        </section>

        {/* flagship */}
        <section className="band">
          <div className="kicker">The spread, live</div>
          <FlagshipSpread m={flagship} />
        </section>

        {/* value props */}
        <section className="band">
          <div className="props">
            <div className="prop">
              <h4>A price nobody can buy</h4>
              <p>
                The crowd price moves with money. The framework price moves with
                data. A seven-figure bet can push the first one. It cannot push
                the second. A $500 account and a $500M book read the same number.
              </p>
            </div>
            <div className="prop">
              <h4>It shows its receipts</h4>
              <p>
                Every market names the exact pillar pricing it, how many prints it
                was calibrated on, and how strong the edge is. No demonstrated
                edge, no faked conviction. It shrinks to fifty and says so.
              </p>
            </div>
            <div className="prop">
              <h4>The scoreboard is on-chain</h4>
              <p>
                Every market resolves on the official BLS, BEA or Fed print,
                written to chain by an agent, permanently, with no hand on the
                scale. Trust me becomes check it yourself.
              </p>
            </div>
          </div>
        </section>

        {/* the board */}
        <section className="band">
          <div className="sec-head">
            <div>
              <div className="kicker">The board</div>
              <h2>Graded by how much it trusts itself</h2>
            </div>
            <p className="note">
              We only claim conviction where the model beats a naive baseline out
              of sample. Everywhere else it says so, on the card.
            </p>
          </div>
          <div className="grid">
            {board.map((m, i) => (
              <MarketCard key={m.market_address ?? `${m.kind}-${i}`} m={m} />
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <span className="banner">
              <span className="dot" />
              framework <b>snapshot {SNAPSHOT_AS_OF}</b>&nbsp;· 6 markets live on{" "}
              <a href={`${ARCSCAN}/address/${FACTORY}`} target="_blank" rel="noopener noreferrer">
                Arc testnet
              </a>
            </span>
          </div>
        </section>

        {/* how it works */}
        <section className="band" id="how">
          <div className="sec-head">
            <div>
              <div className="kicker">The moat</div>
              <h2>How the second number is made</h2>
            </div>
            <p className="note">
              Anyone can list a CPI market. Pricing it with a real macro model,
              honestly, is the part that is hard to copy.
            </p>
          </div>
          <div className="steps">
            <div className="step">
              <div className="n">01 / point-in-time</div>
              <h4>No peeking</h4>
              <p>
                Only data the world had already seen on the day the market opened.
                The quote is an information state, not a revised final value.
              </p>
            </div>
            <div className="step">
              <div className="n">02 / consistent trend</div>
              <h4>Signal, not noise</h4>
              <p>
                We read annualized trends across months, not one jumpy print, so a
                single noisy release does not whipsaw the fair value.
              </p>
            </div>
            <div className="step">
              <div className="n">03 / calibrate</div>
              <h4>History sets the tilt</h4>
              <p>
                The pillar-to-outcome relationship is fit on aligned history, and
                we report how well it has actually predicted this print.
              </p>
            </div>
            <div className="step">
              <div className="n">04 / shrink</div>
              <h4>It can say I don&apos;t know</h4>
              <p>
                When a pillar has no proven out-of-sample edge, the model pulls
                toward 50% and tells you. Honesty is the feature.
              </p>
            </div>
          </div>
        </section>

        {/* on arc */}
        <section className="band" id="arc">
          <div className="sec-head">
            <div>
              <div className="kicker">Why Arc</div>
              <h2>Built for the way macro money actually moves</h2>
            </div>
          </div>
          <div className="arc">
            <div className="cell">
              <h4>USDC in, USDC out</h4>
              <p>
                You bet in USDC and pay the gas in USDC too. No &ldquo;go buy a gas
                token first&rdquo; detour. Arc settles in stablecoins natively.
              </p>
            </div>
            <div className="cell">
              <h4>Your size stays private</h4>
              <p>
                Arc&apos;s encrypted mempool means a large macro position does not
                broadcast its intent before it fills. The institutional wedge.
              </p>
            </div>
            <div className="cell">
              <h4>Settles on the print</h4>
              <p>
                When the number lands, an agent resolves the market on the official
                figure and pays winners on-chain. No bridge, no wait.
              </p>
            </div>
          </div>
        </section>

        {/* why built */}
        <section className="band">
          <div className="callout">
            <p>
              <b>Why we built it.</b> Every market is a live, adversarial,
              out-of-sample test of our framework, funded by other people&apos;s
              conviction. The crowd is the red team. Every miss feeds the next
              version. This is not a casino. It is a research process, graded in
              public, in real time, by the economy itself.
            </p>
          </div>
        </section>

        <footer>
          <div className="f-top">
            <span className="f-brand">PHAROS</span>
            <span>
              <a href={GITHUB} target="_blank" rel="noopener noreferrer">GitHub</a>
              {" · "}
              <a href="https://x.com/LHMacro" target="_blank" rel="noopener noreferrer">@LHMacro</a>
            </span>
          </div>
          <p className="meth">
            Framework probabilities are point-in-time information states, no
            look-ahead. Methodology in the quantamental tradition (consistent
            annualized trends, sequential zn-scores, signal-return calibration),
            applied to Lighthouse Macro&apos;s own 12-pillar framework and
            database. Markets settle on official government data, on-chain, on Arc
            testnet. Built for the Agora Agents Hackathon (Canteen × Circle × Arc).
            A Lighthouse Macro project · MACRO, ILLUMINATED.
          </p>
        </footer>
      </div>
    </main>
  );
}
