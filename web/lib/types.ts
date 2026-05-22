// Mirrors the pricing engine's /markets payload (pharos_pricing.models),
// plus a curated, OOS-grounded conviction tier added by /api/markets.
export interface SignalQuality {
  beta: number;
  resid_std: number;
  ic: number;
  bal_accuracy: number;
  hit_rate: number;
  n: number;
  shrink: number;
}

export interface InformationState {
  as_of: string;
  eop_lag_days: number;
  pub_lag_days: number;
  grading: number;
  inputs: Record<string, string | number>;
}

// Conviction tier — set server-side from the out-of-sample evidence, NOT the
// raw in-sample shrink (in-sample overstates it; that is the whole lesson).
export type Tier = "edge" | "signal" | "abstain" | "experimental";

export interface Market {
  kind: string;
  label: string;
  ref_label: string;
  question: string;
  strike: number;
  unit: string;
  framework_prob: number;
  framework_prob_bps: number;
  nowcast: number;
  sigma: number;
  pillar: { index: string; zn_score: number };
  signal_quality: SignalQuality;
  information_state: InformationState;
  reasoning: string;
  market_key?: string;
  resolve_dt?: string;

  // curated tier (added by /api/markets)
  tier?: Tier;
  conviction?: string;
  tier_note?: string;

  // crowd price + on-chain enrichment (filled client-side from the Arc factory)
  crowd_prob?: number;
  market_address?: string;
  on_chain?: boolean;
  framework_on_chain?: boolean; // the framework prob is posted on the contract
  resolved?: boolean;
  resolve_time?: number;
  error?: string;
}

export interface MarketsResponse {
  count: number;
  markets: Market[];
  source: "live" | "sample";
  as_of?: string;
}
