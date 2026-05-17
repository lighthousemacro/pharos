import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PRICING = process.env.PHAROS_PRICING_URL || "http://127.0.0.1:6910";

// Real output from the pricing engine against the live Lighthouse_Master.db
// (captured 2026-05-16). Used only if the live service is unreachable, and
// flagged as such in the UI — never fabricated, just cached.
const SAMPLE = {
  count: 4,
  source: "sample" as const,
  markets: [
    {
      kind: "CPI_MOM", label: "US Headline CPI — consistent trend",
      ref_label: "May 2026",
      question: "US headline CPI trend for May 2026 prints >= 3.00% (3m/6m saar)?",
      strike: 3.0, unit: "% 3m/6m saar",
      framework_prob: 0.832, framework_prob_bps: 8316, nowcast: 5.3, sigma: 1.27,
      pillar: { index: "PCI", zn_score: 0.02 },
      signal_quality: { beta: 0.41, resid_std: 1.27, ic: 0.30, bal_accuracy: 0.57, hit_rate: 0.58, n: 241, shrink: 1.0 },
      information_state: { as_of: "2026-05-16", eop_lag_days: 45, pub_lag_days: 41, grading: 2.25, inputs: { CPIAUCSL: 332.407, PCI: 0.41 } },
      reasoning: "Consistent trend nowcast 5.30% 3m/6m saar vs strike 3.00. PCI at +0.02 sigma (IC +0.30, bal-acc 0.57, n=241). Conviction 1.00 -> framework 83.2% YES.",
      crowd_prob: 0.50,
    },
    {
      kind: "NFP", label: "US Nonfarm Payrolls", ref_label: "May 2026",
      question: "US nonfarm payroll trend for May 2026 >= 125k?",
      strike: 125, unit: "k jobs",
      framework_prob: 0.460, framework_prob_bps: 4605, nowcast: 97.62, sigma: 64.1,
      pillar: { index: "LFI", zn_score: 0.31 },
      signal_quality: { beta: -18.3, resid_std: 64.1, ic: -0.24, bal_accuracy: 0.55, hit_rate: 0.56, n: 241, shrink: 0.79 },
      information_state: { as_of: "2026-05-16", eop_lag_days: 45, pub_lag_days: 36, grading: 2.25, inputs: { PAYEMS: 158736, LFI: 0.62 } },
      reasoning: "Consistent trend nowcast 97.62k vs strike 125. LFI at +0.31 sigma (IC -0.24, bal-acc 0.55, n=241). Conviction 0.86 -> framework 46.0% YES.",
      crowd_prob: 0.129,
    },
    {
      kind: "GDP", label: "US Real GDP (annualized q/q)", ref_label: "Q1 2026 (2nd)",
      question: "US real GDP for Q1 2026 (2nd) prints >= 2.00% (saar)?",
      strike: 2.0, unit: "% saar",
      framework_prob: 0.505, framework_prob_bps: 5053, nowcast: 2.08, sigma: 1.9,
      pillar: { index: "GCI", zn_score: -0.12 },
      signal_quality: { beta: 0.04, resid_std: 1.9, ic: 0.01, bal_accuracy: 0.51, hit_rate: 0.5, n: 78, shrink: 0.04 },
      information_state: { as_of: "2026-05-16", eop_lag_days: 119, pub_lag_days: 119, grading: 1.0, inputs: { A191RL1Q225SBEA: 2.1, GCI: -0.2 } },
      reasoning: "Consistent trend nowcast 2.08% saar vs strike 2.00. GCI shows no demonstrated edge (IC +0.01) -> shrunk to ~50%.",
      crowd_prob: 0.50,
    },
    {
      kind: "FOMC_CUT", label: "FOMC — 25bps+ cut at next meeting", ref_label: "Jun 2026",
      question: "Does the FOMC cut the target by >= 25bps at the Jun 2026 meeting?",
      strike: 25, unit: "bps cut",
      framework_prob: 0.301, framework_prob_bps: 3010, nowcast: 0.30, sigma: 0,
      pillar: { index: "MRI", zn_score: 0.45 },
      signal_quality: { beta: 0, resid_std: 1, ic: 0, bal_accuracy: 0.5, hit_rate: 0.5, n: 0, shrink: 0.6 },
      information_state: { as_of: "2026-05-16", eop_lag_days: 0, pub_lag_days: 0, grading: 2.0, inputs: { MRI: 0.04, REC_PROB: 0.29, core_trend: 4.1 } },
      reasoning: "Reaction function: REC_PROB 0.29, MRI +0.45 sigma, core trend 4.10% (gap +2.10). P(>=25bps cut) 30.1%.",
      crowd_prob: 0.50,
    },
  ],
};

export async function GET() {
  try {
    const r = await fetch(`${PRICING}/markets?within_days=60`, {
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
    });
    if (!r.ok) throw new Error(`pricing ${r.status}`);
    const data = await r.json();
    return NextResponse.json({ ...data, source: "live" });
  } catch {
    return NextResponse.json(SAMPLE);
  }
}
