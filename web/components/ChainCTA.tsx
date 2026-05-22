import BetPanel from "@/components/BetPanel";

// On the static deploy the Arc RPC can't be read from the browser (no CORS),
// so the wallet flow is replaced by a link to the live contract on Arcscan,
// where the real on-chain state (both prices, any trades) is verifiable. The
// full wallet/bet flow stays available behind a server-proxied deploy.
const STATIC = process.env.NEXT_PUBLIC_STATIC === "1";
const arcAddr = (a: string) => `https://testnet.arcscan.app/address/${a}`;

export default function ChainCTA({
  market,
  resolved,
}: {
  market: string;
  resolved?: boolean;
}) {
  if (STATIC) {
    return (
      <div className="bet">
        <a
          className="bet-link"
          href={arcAddr(market)}
          target="_blank"
          rel="noopener noreferrer"
        >
          View this market on Arcscan ↗
        </a>
        <div className="bet-hint">
          Live on Arc testnet. The framework price and the crowd price are both
          written on the contract.
        </div>
      </div>
    );
  }
  return <BetPanel market={market} resolved={resolved} />;
}
