import type { Market } from "@/lib/types";

// Framework snapshot captured 2026-05-22 from the live Lighthouse_Master.db,
// merged with the live Arc testnet market addresses + seeded crowd price.
// The static site renders from this; every market links to Arcscan so the
// on-chain state (and any trades) is verifiable live. Re-bake by re-running
// scripts/gen_snapshot (pricing engine on :6910) when the data moves.
export const SNAPSHOT_AS_OF = "2026-05-22";
export const FACTORY = "0xfA2D29c4bEd132009D029308810240863c1B3Cc9";
export const ARCSCAN = "https://testnet.arcscan.app";

export const BOARD: Market[] = [
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
    "resolve_dt": "2026-06-10T13:30:00",
    "tier": "edge",
    "conviction": "full",
    "tier_note": "OOS-validated: the Inflation Heat pillar beats a naive trend baseline out of sample. Full conviction.",
    "crowd_prob": 0.5,
    "on_chain": true,
    "framework_on_chain": true,
    "market_address": "0x327f5C99eaDf35022c833dBD734A21e8C7C52614"
  },
  {
    "kind": "GDP",
    "label": "US Real GDP (annualized q/q)",
    "ref_label": "Q1 2026 (2nd)",
    "question": "US real GDP for Q1 2026 (2nd) prints >= 2.00% (saar)?",
    "strike": 2.0,
    "strike_scaled": 2000000,
    "unit": "% saar",
    "framework_prob": 0.557,
    "framework_prob_bps": 5570,
    "nowcast": 2.2898,
    "sigma": 2.0004,
    "pillar": {
      "index": "GCI+BCI",
      "zn_score": 0.885
    },
    "signal_quality": {
      "beta": 0.7852,
      "resid_std": 2.0004,
      "ic": 0.295,
      "bal_accuracy": 0.583,
      "hit_rate": 0.583,
      "n": 104,
      "shrink": 0.984
    },
    "information_state": {
      "as_of": "2026-05-22",
      "eop_lag_days": 141,
      "pub_lag_days": 119,
      "grading": 1.0,
      "inputs": {
        "A191RL1Q225SBEA": 2.0,
        "A191RL1Q225SBEA_asof": "2026-01-01",
        "GCI": 2.1273,
        "BCI": 0.1307
      }
    },
    "reasoning": "Consistent trend nowcast 2.29 % saar vs strike 2.00. GCI+BCI at +0.89 sigma (IC +0.30, bal-acc 0.58, n=104). Conviction 0.99 -> framework 55.7% YES.",
    "market_key": "GDP:Q1 2026 (2nd)",
    "resolve_dt": "2026-05-28T13:30:00",
    "tier": "signal",
    "conviction": "high",
    "tier_note": "Activity Pulse + Capex Thrust, calibrated and out-of-sample checked (IC +0.30, holdout +0.59). Full conviction.",
    "crowd_prob": 0.5,
    "on_chain": true,
    "framework_on_chain": true,
    "market_address": "0x343d8Da8834c3CFA75540b12bD16946d78390130"
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
    "resolve_dt": "2026-06-05T13:30:00",
    "tier": "abstain",
    "conviction": "none",
    "tier_note": "The in-sample fit looks strong but does not survive out of sample. The framework declines to post conviction here.",
    "crowd_prob": 0.5,
    "on_chain": true,
    "framework_on_chain": true,
    "market_address": "0xFb1d30Ca3Ea856174b48338660B01C2b081E5973"
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
    "resolve_dt": "2026-06-17T19:00:00",
    "tier": "experimental",
    "conviction": "modeled",
    "tier_note": "A transparent rate reaction function, not a calibrated market. Shown for completeness.",
    "crowd_prob": 0.5,
    "on_chain": true,
    "framework_on_chain": true,
    "market_address": "0x01F223cb6B5EA0eB7C4BEb61f42439158ee33ac1"
  }
];
