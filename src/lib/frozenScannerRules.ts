export type ScannerFamily = "DeepDiscount" | "FailedBreakdown";
export type ScannerSector = "XLY" | "XLI" | "XLK";
export type ScannerToken =
  | "DEEP_DISCOUNT"
  | "MA20"
  | "MA10"
  | "MA20_RECLAIM"
  | "NO_VOL_REJECT"
  | "RS_IMP"
  | "RS_SPY_POS"
  | "RS_SEC_POS"
  | "SEC_M50"
  | "FAILED_BREAK"
  | "RECLAIM_LOW";

export interface FrozenScannerRule {
  ruleId: string;
  ruleSignatureHash: string;
  classification: string;
  sector: ScannerSector;
  family: ScannerFamily;
  parameters: {
    ddThresh?: number;
    window: number;
    reclaimDays?: number;
  };
  activeConditions: ScannerToken[];
  proofSummary: {
    discoveryMedian30: number;
    holdoutMedian30: number;
    lockboxMedian30: number;
    latestEraStatus: "pass";
  };
  riskWarnings: string[];
  appPriority: "primary" | "high" | "medium_high" | "medium" | "low_fragile";
}

export const scannerTokenFeatureMap: Record<ScannerToken, string[]> = {
  DEEP_DISCOUNT: ["DD_126"],
  MA20: ["MA20"],
  MA10: ["MA10"],
  MA20_RECLAIM: ["MA20"],
  NO_VOL_REJECT: ["VOL_SPIKE_20"],
  RS_IMP: ["RS_IMPROVE_5"],
  RS_SPY_POS: ["EXRET_20_SPY"],
  RS_SEC_POS: ["EXRET_20_SECTOR"],
  SEC_M50: ["SECTOR_ABOVE_MA50"],
  FAILED_BREAK: ["failed_break_N_R"],
  RECLAIM_LOW: ["reclaim_low_N"],
};

export const scannerTokenRawDataMap: Record<ScannerToken, string[]> = {
  DEEP_DISCOUNT: ["priceHistorySeries"],
  MA20: ["priceHistorySeries"],
  MA10: ["priceHistorySeries"],
  MA20_RECLAIM: ["priceHistorySeries"],
  NO_VOL_REJECT: ["volumeHistorySeries"],
  RS_IMP: ["priceHistorySeries", "benchmarkHistorySeries"],
  RS_SPY_POS: ["priceHistorySeries", "benchmarkHistorySeries"],
  RS_SEC_POS: ["priceHistorySeries", "sectorBenchmarkSeries"],
  SEC_M50: ["sectorBenchmarkSeries"],
  FAILED_BREAK: ["ohlcBarSeries"],
  RECLAIM_LOW: ["ohlcBarSeries"],
};

export const frozenScannerRules: FrozenScannerRule[] = [
  {
    ruleId: "DeepDiscount_dd_tn03-wind126_NO_VOL_REJECT-RS_IMP-RS_SPY_POS_SectorXLY_V1",
    ruleSignatureHash: "b940f218276673a48c17578722d72130cc0555ba8895b481c80ef0da4d4b105a",
    classification: "Champion Candidate, Current-Constituent Biased",
    sector: "XLY",
    family: "DeepDiscount",
    parameters: { ddThresh: -0.3, window: 126 },
    activeConditions: ["DEEP_DISCOUNT", "MA20", "NO_VOL_REJECT", "RS_IMP", "RS_SPY_POS"],
    proofSummary: {
      discoveryMedian30: 0.0938884212216308,
      holdoutMedian30: 0.0119749926544994,
      lockboxMedian30: 0.0759097350564368,
      latestEraStatus: "pass",
    },
    riskWarnings: [
      "current_constituents_survivorship_biased",
      "point_in_time_membership_unavailable",
      "forward_proof_required",
    ],
    appPriority: "primary",
  },
  {
    ruleId: "DeepDiscount_dd_tn03-wind126_NO_VOL_REJECT-RS_IMP-RS_SPY_POS_SectorXLI_V1",
    ruleSignatureHash: "0e5c9be1b206b470f6de95d9991a60273cbbea160301f49373f245fe0d92fea3",
    classification: "Production Candidate, Needs Forward Proof",
    sector: "XLI",
    family: "DeepDiscount",
    parameters: { ddThresh: -0.3, window: 126 },
    activeConditions: ["DEEP_DISCOUNT", "MA20", "NO_VOL_REJECT", "RS_IMP", "RS_SPY_POS"],
    proofSummary: {
      discoveryMedian30: 0.0759792761089479,
      holdoutMedian30: 0.0343483342605148,
      lockboxMedian30: 0.05452493726082826,
      latestEraStatus: "pass",
    },
    riskWarnings: [
      "current_constituents_survivorship_biased",
      "point_in_time_membership_unavailable",
      "forward_proof_required",
    ],
    appPriority: "high",
  },
  {
    ruleId: "FailedBreakdown_recl3-wind45_NO_VOL_REJECT-RS_SEC_POS-RS_SPY_POS_SectorXLK_V1",
    ruleSignatureHash: "d16097902148cc652f545473bd007eef925dc8213efbb4ef15f117b19799dc12",
    classification: "Production Candidate, Needs Forward Proof",
    sector: "XLK",
    family: "FailedBreakdown",
    parameters: { reclaimDays: 3, window: 45 },
    activeConditions: ["FAILED_BREAK", "RECLAIM_LOW", "MA10", "NO_VOL_REJECT", "RS_SEC_POS", "RS_SPY_POS"],
    proofSummary: {
      discoveryMedian30: 0.06229804374358655,
      holdoutMedian30: 0.0089645743979691,
      lockboxMedian30: 0.0681637910633976,
      latestEraStatus: "pass",
    },
    riskWarnings: [
      "current_constituents_survivorship_biased",
      "point_in_time_membership_unavailable",
      "forward_proof_required",
    ],
    appPriority: "high",
  },
  {
    ruleId: "FailedBreakdown_recl3-wind63_MA20_RECLAIM-NO_VOL_REJECT-RS_SPY_POS_SectorXLK_V1",
    ruleSignatureHash: "f7450d1cab899b10721468b168f76217aa0af3ed3ae0cdf7e556165c802d8528",
    classification: "Production Candidate, Needs Forward Proof",
    sector: "XLK",
    family: "FailedBreakdown",
    parameters: { reclaimDays: 3, window: 63 },
    activeConditions: ["FAILED_BREAK", "RECLAIM_LOW", "MA10", "MA20_RECLAIM", "NO_VOL_REJECT", "RS_SPY_POS"],
    proofSummary: {
      discoveryMedian30: 0.0566547149552335,
      holdoutMedian30: 0.0027457732990239995,
      lockboxMedian30: 0.0684355336513994,
      latestEraStatus: "pass",
    },
    riskWarnings: [
      "current_constituents_survivorship_biased",
      "point_in_time_membership_unavailable",
      "forward_proof_required",
    ],
    appPriority: "medium_high",
  },
  {
    ruleId: "FailedBreakdown_recl5-wind90_NO_VOL_REJECT-RS_SPY_POS-SEC_M50_SectorXLI_V1",
    ruleSignatureHash: "1179b2ea1dda5e4c01fbd6767e913ce8b096ad08fffb0acdd90cf9d2908b607a",
    classification: "Production Candidate, Needs Forward Proof",
    sector: "XLI",
    family: "FailedBreakdown",
    parameters: { reclaimDays: 5, window: 90 },
    activeConditions: ["FAILED_BREAK", "RECLAIM_LOW", "MA10", "NO_VOL_REJECT", "RS_SPY_POS", "SEC_M50"],
    proofSummary: {
      discoveryMedian30: 0.0335426034144414,
      holdoutMedian30: 0.0067286922111668,
      lockboxMedian30: 0.0245722374705046,
      latestEraStatus: "pass",
    },
    riskWarnings: [
      "current_constituents_survivorship_biased",
      "point_in_time_membership_unavailable",
      "forward_proof_required",
    ],
    appPriority: "low_fragile",
  },
  {
    ruleId: "FailedBreakdown_recl7-wind126_NO_VOL_REJECT-RS_SPY_POS-SEC_M50_SectorXLI_V1",
    ruleSignatureHash: "4ec535be515f5343396b3541e1993931e82016895ac267e81f953dfb5a6f04ac",
    classification: "Production Candidate, Needs Forward Proof",
    sector: "XLI",
    family: "FailedBreakdown",
    parameters: { reclaimDays: 7, window: 126 },
    activeConditions: ["FAILED_BREAK", "RECLAIM_LOW", "MA10", "NO_VOL_REJECT", "RS_SPY_POS", "SEC_M50"],
    proofSummary: {
      discoveryMedian30: 0.05375942234063075,
      holdoutMedian30: 0.01447866248196345,
      lockboxMedian30: 0.0302097220343513,
      latestEraStatus: "pass",
    },
    riskWarnings: [
      "current_constituents_survivorship_biased",
      "point_in_time_membership_unavailable",
      "forward_proof_required",
    ],
    appPriority: "medium",
  },
];

export const scannerSectorEtfMap: Record<ScannerSector, ScannerSector> = {
  XLY: "XLY",
  XLI: "XLI",
  XLK: "XLK",
};

export const scannerFeatureRegistry = [
  "MA10",
  "MA20",
  "MA50",
  "DD_126",
  "RET_20_STOCK",
  "RET_20_SPY",
  "RET_20_SECTOR",
  "EXRET_20_SPY",
  "EXRET_20_SECTOR",
  "VOL_SPIKE_20",
  "SECTOR_ABOVE_MA50",
  "RS_SERIES_SPY",
  "RS_IMPROVE_5",
  "prior_low_N",
  "broke_prior_low_N",
  "failed_break_N_R",
  "reclaim_low_N",
] as const;
