// Arc testnet wiring for the live Pharos markets.
// Public reads go through a viem public client over the Arc RPC.
// Writes (approve + buy + redeem) go through the user's injected wallet.
//
// NOTE: the Arc testnet RPC carries a per-deployment swarm token. This is a
// TESTNET endpoint and is safe to ship for testnet usage. Rotate before any
// mainnet deploy. Override with NEXT_PUBLIC_PHAROS_RPC.
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  parseUnits,
  formatUnits,
  type Address,
} from "viem";

export const ARC_RPC =
  process.env.NEXT_PUBLIC_PHAROS_RPC ||
  "https://rpc.testnet.arc-node.thecanteenapp.com/v1/swrm_dd08e7eb85888bfba093913d2cd9c3f89b5d9a0e7b93b31cb718d51bdd9f4486";

export const ARC_CHAIN_ID = 5042002;

export const FACTORY: Address =
  (process.env.NEXT_PUBLIC_PHAROS_FACTORY as Address) ||
  "0xfA2D29c4bEd132009D029308810240863c1B3Cc9";

export const arc = defineChain({
  id: ARC_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [ARC_RPC] } },
  blockExplorers: {
    default: { name: "Arcscan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

export const publicClient = createPublicClient({
  chain: arc,
  transport: http(ARC_RPC),
});

// ---- Minimal ABIs (only what the app calls) -----------------------------
export const FACTORY_ABI = [
  { type: "function", name: "allMarkets", stateMutability: "view", inputs: [], outputs: [{ type: "address[]" }] },
] as const;

export const MARKET_ABI = [
  { type: "function", name: "question", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "resolveTime", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { type: "function", name: "usdc", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "YES", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "NO", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  {
    type: "function", name: "snapshot", stateMutability: "view", inputs: [],
    outputs: [
      { name: "mktBps", type: "uint16" },
      { name: "fwBps", type: "uint16" },
      { name: "collateral", type: "uint256" },
      { name: "reserveYes", type: "uint256" },
      { name: "reserveNo", type: "uint256" },
      { name: "isResolved", type: "bool" },
      { name: "winner", type: "uint8" },
    ],
  },
  {
    type: "function", name: "calcBuyAmount", stateMutability: "view",
    inputs: [{ name: "outcome", type: "uint8" }, { name: "usdcIn", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function", name: "buy", stateMutability: "nonpayable",
    inputs: [
      { name: "outcome", type: "uint8" },
      { name: "usdcIn", type: "uint256" },
      { name: "minSharesOut", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  { type: "function", name: "yesBalance", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "noBalance", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "redeem", stateMutability: "nonpayable", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

export const ERC20_ABI = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

// ---- Reads --------------------------------------------------------------
export interface OnchainMarket {
  address: Address;
  question: string;
  crowdProb: number; // 0..1 from mktBps (the AMM-implied price)
  frameworkProb: number; // 0..1 from fwBps (the framework price, posted ON-CHAIN)
  collateral: number; // USDC liquidity in the market
  resolved: boolean;
  winner: number;
  resolveTime: number; // unix seconds
}

let outcomeCache: { yes: number; no: number } | null = null;

export async function getOutcomes(market: Address): Promise<{ yes: number; no: number }> {
  if (outcomeCache) return outcomeCache;
  const [yes, no] = await Promise.all([
    publicClient.readContract({ address: market, abi: MARKET_ABI, functionName: "YES" }),
    publicClient.readContract({ address: market, abi: MARKET_ABI, functionName: "NO" }),
  ]);
  outcomeCache = { yes: Number(yes), no: Number(no) };
  return outcomeCache;
}

export async function fetchOnchainMarkets(): Promise<OnchainMarket[]> {
  const addrs = (await publicClient.readContract({
    address: FACTORY,
    abi: FACTORY_ABI,
    functionName: "allMarkets",
  })) as Address[];

  const rows = await Promise.all(
    addrs.map(async (address) => {
      try {
        const [question, snap, rt] = await Promise.all([
          publicClient.readContract({ address, abi: MARKET_ABI, functionName: "question" }) as Promise<string>,
          publicClient.readContract({ address, abi: MARKET_ABI, functionName: "snapshot" }) as Promise<readonly [number, number, bigint, bigint, bigint, boolean, number]>,
          publicClient.readContract({ address, abi: MARKET_ABI, functionName: "resolveTime" }) as Promise<bigint>,
        ]);
        return {
          address,
          question,
          crowdProb: Number(snap[0]) / 10000,
          frameworkProb: Number(snap[1]) / 10000,
          collateral: Number(snap[2]) / 1e6,
          resolved: Boolean(snap[5]),
          winner: Number(snap[6]),
          resolveTime: Number(rt),
        } as OnchainMarket;
      } catch {
        return null;
      }
    })
  );
  return rows.filter((r): r is OnchainMarket => r !== null);
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function indexByQuestion(rows: OnchainMarket[]): Map<string, OnchainMarket> {
  const m = new Map<string, OnchainMarket>();
  for (const r of rows) m.set(norm(r.question), r);
  return m;
}
export { norm as normQuestion };

// ---- Wallet + write path -----------------------------------------------
type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
export function getEthereum(): Eth | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ethereum?: Eth }).ethereum ?? null;
}

export async function connectWallet(): Promise<Address> {
  const eth = getEthereum();
  if (!eth) throw new Error("No wallet found. Install MetaMask (or any EVM wallet) and reload.");
  const accts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  if (!accts?.length) throw new Error("Wallet returned no account.");
  return accts[0] as Address;
}

export async function ensureArc(): Promise<void> {
  const eth = getEthereum();
  if (!eth) throw new Error("No wallet found.");
  const hexId = "0x" + ARC_CHAIN_ID.toString(16);
  const current = (await eth.request({ method: "eth_chainId" })) as string;
  if (current?.toLowerCase() === hexId.toLowerCase()) return;
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
  } catch {
    // Not added yet — add it, then it becomes the active chain.
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hexId,
          chainName: "Arc Testnet",
          nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
          rpcUrls: [ARC_RPC],
          blockExplorerUrls: ["https://testnet.arcscan.app"],
        },
      ],
    });
  }
}

function walletClient(account: Address) {
  const eth = getEthereum();
  if (!eth) throw new Error("No wallet found.");
  return createWalletClient({ account, chain: arc, transport: custom(eth as never) });
}

export interface BuyArgs {
  market: Address;
  outcomeYes: boolean;
  usdcHuman: string; // e.g. "5"
}

export async function placeBet({ market, outcomeYes, usdcHuman }: BuyArgs): Promise<{ approveHash?: string; buyHash: string }> {
  const account = await connectWallet();
  await ensureArc();
  const wc = walletClient(account);

  const usdcAddr = (await publicClient.readContract({ address: market, abi: MARKET_ABI, functionName: "usdc" })) as Address;
  const decimals = Number(await publicClient.readContract({ address: usdcAddr, abi: ERC20_ABI, functionName: "decimals" }).catch(() => 6));
  const amount = parseUnits(usdcHuman, decimals);
  if (amount <= 0n) throw new Error("Enter a USDC amount greater than 0.");

  const bal = (await publicClient.readContract({ address: usdcAddr, abi: ERC20_ABI, functionName: "balanceOf", args: [account] })) as bigint;
  if (bal < amount) throw new Error(`Not enough USDC. Wallet holds ${formatUnits(bal, decimals)}, bet is ${usdcHuman}. Use the Arc faucet for testnet USDC.`);

  const { yes, no } = await getOutcomes(market);
  const outcome = outcomeYes ? yes : no;

  let approveHash: string | undefined;
  const allowance = (await publicClient.readContract({ address: usdcAddr, abi: ERC20_ABI, functionName: "allowance", args: [account, market] })) as bigint;
  if (allowance < amount) {
    approveHash = await wc.writeContract({ address: usdcAddr, abi: ERC20_ABI, functionName: "approve", args: [market, amount] });
    await publicClient.waitForTransactionReceipt({ hash: approveHash as `0x${string}` });
  }

  const expected = (await publicClient.readContract({
    address: market, abi: MARKET_ABI, functionName: "calcBuyAmount", args: [outcome, amount],
  })) as bigint;
  const minOut = (expected * 95n) / 100n; // 5% slippage tolerance (thin testnet books)

  const buyHash = await wc.writeContract({
    address: market, abi: MARKET_ABI, functionName: "buy", args: [outcome, amount, minOut],
  });
  await publicClient.waitForTransactionReceipt({ hash: buyHash as `0x${string}` });
  return { approveHash, buyHash };
}

export async function getPosition(market: Address, account: Address): Promise<{ yes: string; no: string }> {
  const [y, n] = await Promise.all([
    publicClient.readContract({ address: market, abi: MARKET_ABI, functionName: "yesBalance", args: [account] }) as Promise<bigint>,
    publicClient.readContract({ address: market, abi: MARKET_ABI, functionName: "noBalance", args: [account] }) as Promise<bigint>,
  ]);
  return { yes: formatUnits(y, 18), no: formatUnits(n, 18) };
}

export const explorerTx = (h: string) => `https://testnet.arcscan.app/tx/${h}`;
export const explorerAddr = (a: string) => `https://testnet.arcscan.app/address/${a}`;
