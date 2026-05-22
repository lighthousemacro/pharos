import { NextResponse } from "next/server";
import type { Tier } from "@/lib/types";

export const dynamic = "force-dynamic";

const PRICING = process.env.PHAROS_PRICING_URL || "http://127.0.0.1:6910";

// Curated conviction tiers — set from OUT-OF-SAMPLE evidence, never the raw
// in-sample shrink (the in-sample fit overstates skill; that is the lesson
// behind the whole board). See research/EDGE_FINDINGS.md.
const TIERS: Record<string, { tier: Tier; conviction: string; note: string }> = {
  CPI_MOM: {
    tier: "edge",
    conviction: "full",
    note: "OOS-validated: the Inflation Heat pillar beats a naive trend baseline out of sample. Full conviction.",
  },
  GDP: {
    tier: "signal",
    conviction: "moderate",
    note: "Capex Thrust + Consumer Pulse, calibrated and out-of-sample checked (IC +0.20, holds OOS). Moderate conviction.",
  },
  NFP: {
    tier: "abstain",
    conviction: "none",
    note: "The in-sample fit looks strong but does not survive out of sample. The framework declines to post conviction here.",
  },
  FOMC_CUT: {
    tier: "experimental",
    conviction: "modeled",
    note: "A transparent rate reaction function, not a calibrated market. Shown for completeness.",
  },
};
const ORDER: Tier[] = ["edge", "signal", "abstain", "experimental"];

// Real engine output captured 2026-05-22 against the live Lighthouse_Master.db.
// Served as the framework snapshot when the local pricing engine is
// unreachable (e.g. the public deploy). Crowd prices and the on-chain
// framework price are read LIVE from Arc regardless — see /api/chain.
const SAMPLE_MARKETS = [
  {
    "kind": "CPI_MOM",
    "label": "US Headline CPI \u2014 consistent trend",
    "ref_label": "May 2026",
    "question": "US headline CPI trend for May 2026 prints >= 3.00% (3m/6m saar)?",
    "strike": 3.0,
    "strike_scaled": 3000000,
    "unit": "% 3m/6m saar",
    "framework_prob": 0.8318,
    "framework_prob_bps": 8318,
    "nowcast": 5.3024,
    "sigma": 2.3947,
    "pillar": {
      "index": "PCI",
      "zn_score": 0.02
    },
    "signal_quality": {
      "beta": 2.0146,
      "resid_std": 2.3947,
      "ic": 0.3,
      "bal_accuracy": 0.575,
      "hit_rate": 0.577,
      "n": 241,
      "shrink": 1.0
    },
    "information_state": {
      "as_of": "2026-05-22",
      "eop_lag_days": 51,
      "pub_lag_days": 41,
      "grading": 2.15,
      "inputs": {
        "CPIAUCSL": 332.407,
        "CPIAUCSL_asof": "2026-04-01",
        "PCI": 0.0161
      }
    },
    "reasoning": "Consistent trend nowcast 5.30 % 3m/6m saar vs strike 3.00. PCI at +0.02 sigma (IC +0.30, bal-acc 0.57, n=241). Conviction 1.00 -> framework 83.2% YES.",
    "market_key": "CPI_MOM:May 2026",
    "resolve_dt": "2026-06-10T13:30:00"
  },
  {
    "kind": "GDP",
    "label": "US Real GDP (annualized q/q)",
    "ref_label": "Q1 2026 (2nd)",
    "question": "US real GDP for Q1 2026 (2nd) prints >= 2.00% (saar)?",
    "strike": 2.0,
    "strike_scaled": 2000000,
    "unit": "% saar",
    "framework_prob": 0.4799,
    "framework_prob_bps": 4799,
    "nowcast": 1.8663,
    "sigma": 2.0597,
    "pillar": {
      "index": "BCI+CCI",
      "zn_score": -0.276
    },
    "signal_quality": {
      "beta": 0.5955,
      "resid_std": 2.0597,
      "ic": 0.197,
      "bal_accuracy": 0.608,
      "hit_rate": 0.614,
      "n": 103,
      "shrink": 0.655
    },
    "information_state": {
      "as_of": "2026-05-22",
      "eop_lag_days": 141,
      "pub_lag_days": 119,
      "grading": 1.0,
      "inputs": {
        "A191RL1Q225SBEA": 2.0,
        "A191RL1Q225SBEA_asof": "2026-01-01",
        "BCI": 0.1307,
        "CCI": -0.7098
      }
    },
    "reasoning": "Consistent trend nowcast 1.87 % saar vs strike 2.00. BCI+CCI at -0.28 sigma (IC +0.20, bal-acc 0.61, n=103). Conviction 0.78 -> framework 48.0% YES.",
    "market_key": "GDP:Q1 2026 (2nd)",
    "resolve_dt": "2026-05-28T13:30:00"
  },
  {
    "kind": "NFP",
    "label": "US Nonfarm Payrolls",
    "ref_label": "May 2026",
    "question": "US nonfarm payrolls for May 2026 print >= 125k?",
    "strike": 125.0,
    "strike_scaled": 125000000,
    "unit": "k jobs",
    "framework_prob": 0.4605,
    "framework_prob_bps": 4605,
    "nowcast": 97.6158,
    "sigma": 238.27,
    "pillar": {
      "index": "LFI",
      "zn_score": 0.083
    },
    "signal_quality": {
      "beta": -55.6693,
      "resid_std": 238.27,
      "ic": -0.237,
      "bal_accuracy": 0.637,
      "hit_rate": 0.637,
      "n": 248,
      "shrink": 0.79
    },
    "information_state": {
      "as_of": "2026-05-22",
      "eop_lag_days": 51,
      "pub_lag_days": 36,
      "grading": 2.15,
      "inputs": {
        "PAYEMS": 158736.0,
        "PAYEMS_asof": "2026-04-01",
        "LFI": 0.0352
      }
    },
    "reasoning": "Consistent trend nowcast 97.62 k jobs vs strike 125.00. LFI at +0.08 sigma (IC -0.24, bal-acc 0.64, n=248). Conviction 0.86 -> framework 46.1% YES.",
    "market_key": "NFP:May 2026",
    "resolve_dt": "2026-06-05T13:30:00"
  },
  {
    "kind": "FOMC_CUT",
    "label": "FOMC \u2014 25bps+ cut at next meeting",
    "ref_label": "Jun 2026",
    "question": "Does the FOMC cut the target by >= 25bps at the Jun 2026 meeting?",
    "strike": 25.0,
    "strike_scaled": 25000000,
    "unit": "bps cut",
    "framework_prob": 0.2661,
    "framework_prob_bps": 2661,
    "nowcast": 0.2661,
    "sigma": 0.0,
    "pillar": {
      "index": "MRI",
      "zn_score": 0.0
    },
    "signal_quality": {
      "beta": 0.0,
      "resid_std": 1.0,
      "ic": 0.0,
      "bal_accuracy": 0.5,
      "hit_rate": 0.5,
      "n": 0,
      "shrink": 0.6
    },
    "information_state": {
      "as_of": "2026-05-22",
      "eop_lag_days": 0,
      "pub_lag_days": 0,
      "grading": 2.0,
      "inputs": {
        "MRI": 0.1087,
        "REC_PROB": 0.1824,
        "core_trend": 3.1256,
        "infl_gap": 1.1256
      }
    },
    "reasoning": "Reaction function: REC_PROB 0.18, MRI +0.00 sigma, core trend 3.13% (gap +1.13). P(>=25bps cut) 26.6%.",
    "market_key": "FOMC_CUT:Jun 2026",
    "resolve_dt": "2026-06-17T19:00:00"
  }
];

type Mkt = {
  kind: string;
  resolve_dt?: string;
  information_state?: { as_of?: string };
  [k: string]: unknown;
};

function board<T extends Mkt>(markets: T[]) {
  const byKind = new Map<string, T>();
  for (const m of markets) {
    if (!TIERS[m.kind]) continue;
    const cur = byKind.get(m.kind);
    if (!cur || (m.resolve_dt ?? "") < (cur.resolve_dt ?? "")) byKind.set(m.kind, m);
  }
  const out = [...byKind.values()].map((m) => ({ ...m, ...TIERS[m.kind] }));
  out.sort(
    (a, b) =>
      ORDER.indexOf(a.tier) - ORDER.indexOf(b.tier) ||
      (a.resolve_dt ?? "").localeCompare(b.resolve_dt ?? "")
  );
  return out;
}

export async function GET() {
  try {
    const r = await fetch(`${PRICING}/markets?within_days=60`, {
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
    });
    if (!r.ok) throw new Error(`pricing ${r.status}`);
    const data = await r.json();
    const markets = board(data.markets ?? []);
    const as_of = markets[0]?.information_state?.as_of;
    return NextResponse.json({ markets, count: markets.length, source: "live", as_of });
  } catch {
    const markets = board(SAMPLE_MARKETS);
    return NextResponse.json({ markets, count: markets.length, source: "sample", as_of: "2026-05-22" });
  }
}
