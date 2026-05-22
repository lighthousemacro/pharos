"use client";

import { useEffect, useState } from "react";
import {
  connectWallet,
  ensureArc,
  placeBet,
  getPosition,
  getEthereum,
  explorerTx,
  explorerAddr,
} from "@/lib/chain";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function BetPanel({
  market,
  resolved,
}: {
  market: string;
  resolved?: boolean;
}) {
  const [account, setAccount] = useState<string | null>(null);
  const [amount, setAmount] = useState("5");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pos, setPos] = useState<{ yes: string; no: string } | null>(null);

  const refreshPos = async (acct: string) => {
    try {
      setPos(await getPosition(market as `0x${string}`, acct as `0x${string}`));
    } catch {
      /* position read is best-effort */
    }
  };

  useEffect(() => {
    const eth = getEthereum();
    if (!eth) return;
    eth
      .request({ method: "eth_accounts" })
      .then((a) => {
        const acct = (a as string[])?.[0];
        if (acct) {
          setAccount(acct);
          refreshPos(acct);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market]);

  const connect = async () => {
    setErr(null);
    try {
      const a = await connectWallet();
      await ensureArc();
      setAccount(a);
      refreshPos(a);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const bet = async (outcomeYes: boolean) => {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      setMsg("Confirm in your wallet…");
      const { approveHash, buyHash } = await placeBet({
        market: market as `0x${string}`,
        outcomeYes,
        usdcHuman: amount,
      });
      setMsg(
        `Filled ${outcomeYes ? "YES" : "NO"} for ${amount} USDC.` +
          (approveHash ? " (USDC approved first.)" : "")
      );
      const a = account ?? (await connectWallet());
      setAccount(a);
      refreshPos(a);
      (bet as unknown as { _tx?: string })._tx = buyHash;
      setLastTx(buyHash);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setMsg(null);
    } finally {
      setBusy(false);
    }
  };

  const [lastTx, setLastTx] = useState<string | null>(null);

  if (resolved) {
    return (
      <div className="bet">
        <div className="bet-resolved">
          Market resolved. Winners redeem from the contract.{" "}
          <a href={explorerAddr(market)} target="_blank" rel="noopener noreferrer">
            view on Arcscan ↗
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bet">
      {!account ? (
        <button className="bet-connect" onClick={connect} disabled={busy}>
          Connect wallet to take the other side
        </button>
      ) : (
        <>
          <div className="bet-row">
            <input
              className="bet-amt"
              type="number"
              min="0"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-label="USDC amount"
            />
            <span className="bet-unit">USDC</span>
            <button
              className="bet-yes"
              onClick={() => bet(true)}
              disabled={busy}
            >
              Buy YES
            </button>
            <button className="bet-no" onClick={() => bet(false)} disabled={busy}>
              Buy NO
            </button>
          </div>
          <div className="bet-meta">
            <span>
              {short(account)} ·{" "}
              <a href={explorerAddr(account)} target="_blank" rel="noopener noreferrer">
                Arcscan
              </a>
            </span>
            {pos && (Number(pos.yes) > 0 || Number(pos.no) > 0) && (
              <span>
                position: {Number(pos.yes).toFixed(2)} YES /{" "}
                {Number(pos.no).toFixed(2)} NO
              </span>
            )}
          </div>
        </>
      )}
      {msg && <div className="bet-ok">{msg}</div>}
      {lastTx && (
        <div className="bet-ok">
          <a href={explorerTx(lastTx)} target="_blank" rel="noopener noreferrer">
            transaction on Arcscan ↗
          </a>
        </div>
      )}
      {err && <div className="bet-err">{err}</div>}
      <div className="bet-hint">
        Needs Arc testnet USDC. Get it from the Canteen/Arc faucet, then the
        buttons go live. Gas is paid in USDC, no separate gas token.
      </div>
    </div>
  );
}
