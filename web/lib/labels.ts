// Reader-facing names for the framework pillars. The card never leads with a
// cold acronym — full name first, code in parens.
const NAMES: Record<string, string> = {
  PCI: "Inflation Heat (PCI)",
  LFI: "Labor Fragility (LFI)",
  LPI: "Labor Pressure (LPI)",
  GCI: "Activity Pulse (GCI)",
  BCI: "Capex Thrust (BCI)",
  CCI: "Consumer Pulse (CCI)",
  MRI: "Macro Risk Index (MRI)",
  "BCI+CCI": "Capex Thrust + Consumer Pulse",
  "GCI+BCI": "Activity Pulse + Capex Thrust",
};

export function pillarName(id: string): string {
  return NAMES[id] ?? id;
}

export const KIND_LABEL: Record<string, string> = {
  CPI_MOM: "CPI",
  NFP: "PAYROLLS",
  GDP: "GDP",
  FOMC_CUT: "FOMC",
};
