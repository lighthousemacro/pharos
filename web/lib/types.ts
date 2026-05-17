// Mirrors the pricing engine's /markets payload (pharos_pricing.models).
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
  // crowd price (on-chain) — optional, filled when a chain is wired
  crowd_prob?: number;
  error?: string;
}

export interface MarketsResponse {
  count: number;
  markets: Market[];
  source: "live" | "sample";
}
