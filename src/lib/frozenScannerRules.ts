import { getMetricContract, PRODUCTION_METRIC_CONTRACT_VERSION } from "./metricCatalog";

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
  researchVersion: "V12.3 frozen";
  classification: string;
  sector: ScannerSector;
  family: ScannerFamily;
  parameters: {
    ddThresh?: number;
    window: number;
    reclaimDays?: number;
  };
  activeConditions: ScannerToken[];
  blockers: ScannerToken[];
  proofSummary: {
    discoveryMedian30: number;
    holdoutMedian30: number;
    lockboxMedian30: number;
    latestEraStatus: "pass";
  };
  survivorshipBiasLabel: string;
  forwardProofRequired: true;
  riskWarnings: string[];
  appPriority: "primary" | "high" | "medium_high" | "medium" | "low_fragile";
}

export const FROZEN_RESEARCH_VERSION = "V12.3 frozen" as const;
export const FROZEN_RESEARCH_PARITY_STATUS = "blocked_unverified" as const;
export const FROZEN_RESEARCH_LIMITATIONS = [
  "research_numeric_golden_outputs_not_included_in_repository",
  "current_constituents_survivorship_biased",
  "point_in_time_membership_unavailable",
  "forward_proof_required",
] as const;

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
    researchVersion: FROZEN_RESEARCH_VERSION,
    classification: "Champion Candidate, Current-Constituent Biased",
    sector: "XLY",
    family: "DeepDiscount",
    parameters: { ddThresh: -0.3, window: 126 },
    activeConditions: ["DEEP_DISCOUNT", "MA20", "NO_VOL_REJECT", "RS_IMP", "RS_SPY_POS"],
    blockers: ["NO_VOL_REJECT", "RS_IMP", "RS_SPY_POS"],
    proofSummary: {
      discoveryMedian30: 0.0938884212216308,
      holdoutMedian30: 0.0119749926544994,
      lockboxMedian30: 0.0759097350564368,
      latestEraStatus: "pass",
    },
    survivorshipBiasLabel: "current_constituents_survivorship_biased",
    forwardProofRequired: true,
    riskWarnings: ["point_in_time_membership_unavailable", "forward_proof_required"],
    appPriority: "primary",
  },
  {
    ruleId: "DeepDiscount_dd_tn03-wind126_NO_VOL_REJECT-RS_IMP-RS_SPY_POS_SectorXLI_V1",
    ruleSignatureHash: "0e5c9be1b206b470f6de95d9991a60273cbbea160301f49373f245fe0d92fea3",
    researchVersion: FROZEN_RESEARCH_VERSION,
    classification: "Production Candidate, Needs Forward Proof",
    sector: "XLI",
    family: "DeepDiscount",
    parameters: { ddThresh: -0.3, window: 126 },
    activeConditions: ["DEEP_DISCOUNT", "MA20", "NO_VOL_REJECT", "RS_IMP", "RS_SPY_POS"],
    blockers: ["NO_VOL_REJECT", "RS_IMP", "RS_SPY_POS"],
    proofSummary: {
      discoveryMedian30: 0.0759792761089479,
      holdoutMedian30: 0.0343483342605148,
      lockboxMedian30: 0.05452493726082826,
      latestEraStatus: "pass",
    },
    survivorshipBiasLabel: "current_constituents_survivorship_biased",
    forwardProofRequired: true,
    riskWarnings: ["point_in_time_membership_unavailable", "forward_proof_required"],
    appPriority: "high",
  },
  {
    ruleId: "FailedBreakdown_recl3-wind45_NO_VOL_REJECT-RS_SEC_POS-RS_SPY_POS_SectorXLK_V1",
    ruleSignatureHash: "d16097902148cc652f545473bd007eef925dc8213efbb4ef15f117b19799dc12",
    researchVersion: FROZEN_RESEARCH_VERSION,
    classification: "Production Candidate, Needs Forward Proof",
    sector: "XLK",
    family: "FailedBreakdown",
    parameters: { reclaimDays: 3, window: 45 },
    activeConditions: ["FAILED_BREAK", "RECLAIM_LOW", "MA10", "NO_VOL_REJECT", "RS_SEC_POS", "RS_SPY_POS"],
    blockers: ["NO_VOL_REJECT", "RS_SEC_POS", "RS_SPY_POS"],
    proofSummary: {
      discoveryMedian30: 0.06229804374358655,
      holdoutMedian30: 0.0089645743979691,
      lockboxMedian30: 0.0681637910633976,
      latestEraStatus: "pass",
    },
    survivorshipBiasLabel: "current_constituents_survivorship_biased",
    forwardProofRequired: true,
    riskWarnings: ["point_in_time_membership_unavailable", "forward_proof_required"],
    appPriority: "high",
  },
  {
    ruleId: "FailedBreakdown_recl3-wind63_MA20_RECLAIM-NO_VOL_REJECT-RS_SPY_POS_SectorXLK_V1",
    ruleSignatureHash: "f7450d1cab899b10721468b168f76217aa0af3ed3ae0cdf7e556165c802d8528",
    researchVersion: FROZEN_RESEARCH_VERSION,
    classification: "Production Candidate, Needs Forward Proof",
    sector: "XLK",
    family: "FailedBreakdown",
    parameters: { reclaimDays: 3, window: 63 },
    activeConditions: ["FAILED_BREAK", "RECLAIM_LOW", "MA10", "MA20_RECLAIM", "NO_VOL_REJECT", "RS_SPY_POS"],
    blockers: ["MA20_RECLAIM", "NO_VOL_REJECT", "RS_SPY_POS"],
    proofSummary: {
      discoveryMedian30: 0.0566547149552335,
      holdoutMedian30: 0.0027457732990239995,
      lockboxMedian30: 0.0684355336513994,
      latestEraStatus: "pass",
    },
    survivorshipBiasLabel: "current_constituents_survivorship_biased",
    forwardProofRequired: true,
    riskWarnings: ["point_in_time_membership_unavailable", "forward_proof_required"],
    appPriority: "medium_high",
  },
  {
    ruleId: "FailedBreakdown_recl5-wind90_NO_VOL_REJECT-RS_SPY_POS-SEC_M50_SectorXLI_V1",
    ruleSignatureHash: "1179b2ea1dda5e4c01fbd6767e913ce8b096ad08fffb0acdd90cf9d2908b607a",
    researchVersion: FROZEN_RESEARCH_VERSION,
    classification: "Production Candidate, Needs Forward Proof",
    sector: "XLI",
    family: "FailedBreakdown",
    parameters: { reclaimDays: 5, window: 90 },
    activeConditions: ["FAILED_BREAK", "RECLAIM_LOW", "MA10", "NO_VOL_REJECT", "RS_SPY_POS", "SEC_M50"],
    blockers: ["NO_VOL_REJECT", "RS_SPY_POS", "SEC_M50"],
    proofSummary: {
      discoveryMedian30: 0.0335426034144414,
      holdoutMedian30: 0.0067286922111668,
      lockboxMedian30: 0.0245722374705046,
      latestEraStatus: "pass",
    },
    survivorshipBiasLabel: "current_constituents_survivorship_biased",
    forwardProofRequired: true,
    riskWarnings: ["point_in_time_membership_unavailable", "forward_proof_required"],
    appPriority: "low_fragile",
  },
  {
    ruleId: "FailedBreakdown_recl7-wind126_NO_VOL_REJECT-RS_SPY_POS-SEC_M50_SectorXLI_V1",
    ruleSignatureHash: "4ec535be515f5343396b3541e1993931e82016895ac267e81f953dfb5a6f04ac",
    researchVersion: FROZEN_RESEARCH_VERSION,
    classification: "Production Candidate, Needs Forward Proof",
    sector: "XLI",
    family: "FailedBreakdown",
    parameters: { reclaimDays: 7, window: 126 },
    activeConditions: ["FAILED_BREAK", "RECLAIM_LOW", "MA10", "NO_VOL_REJECT", "RS_SPY_POS", "SEC_M50"],
    blockers: ["NO_VOL_REJECT", "RS_SPY_POS", "SEC_M50"],
    proofSummary: {
      discoveryMedian30: 0.05375942234063075,
      holdoutMedian30: 0.01447866248196345,
      lockboxMedian30: 0.0302097220343513,
      latestEraStatus: "pass",
    },
    survivorshipBiasLabel: "current_constituents_survivorship_biased",
    forwardProofRequired: true,
    riskWarnings: ["point_in_time_membership_unavailable", "forward_proof_required"],
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
  "broke_prior_low_N",
  "failed_break_N_R",
  "reclaim_low_N",
] as const;

const FROZEN_REQUIRED_FEATURE_COLUMNS = [
  "Date",
  "Open",
  "High",
  "Low",
  "Close",
  "Volume",
  "MA10",
  "MA20",
  "MA50",
  "EXRET_20_SPY",
  "EXRET_20_SECTOR",
  "RS_IMPROVE_5",
  "VOL_SPIKE_20",
  "SECTOR_ABOVE_MA50",
] as const;
const FROZEN_DEEP_DISCOUNT_FEATURE_COLUMNS = [
  "Close", "DD_126", "Date", "EXRET_20_SECTOR", "EXRET_20_SPY", "High", "Low", "MA10", "MA20", "MA50", "Open", "RS_IMPROVE_5", "SECTOR_ABOVE_MA50", "VOL_SPIKE_20", "Volume",
] as const;
const FROZEN_FAILED_BREAKDOWN_FEATURE_COLUMNS = [
  "Close", "Date", "EXRET_20_SECTOR", "EXRET_20_SPY", "High", "Low", "MA10", "MA20", "MA50", "Open", "RS_IMPROVE_5", "SECTOR_ABOVE_MA50", "VOL_SPIKE_20", "Volume",
] as const;

const FROZEN_COLUMN_SEMANTICS: Record<string, string> = {
  DD_126: "Drawdown from rolling 126D high as a raw decimal.",
  MA10: "10-day moving average of Close.",
  MA20: "20-day moving average of Close.",
  MA50: "50-day moving average of Close.",
  EXRET_20_SPY: "20D stock return minus 20D SPY return.",
  EXRET_20_SECTOR: "20D stock return minus 20D sector ETF return.",
  RS_IMPROVE_5: "5D change in relative-strength series used by the research engine.",
  VOL_SPIKE_20: "Current volume divided by 20D average volume or equivalent engine-consistent spike metric.",
  SECTOR_ABOVE_MA50: "Boolean: sector ETF close > sector ETF MA50 on the same completed bar.",
};

const conditionDefinition = (token: ScannerToken, rule: FrozenScannerRule) => {
  switch (token) {
    case "DEEP_DISCOUNT": return { token, description: "Stock is at a deep drawdown versus its rolling high window.", formula: `DD_126 <= ${rule.parameters.ddThresh}` };
    case "MA20": return { token, description: "Close is above MA20.", formula: "Close > MA20" };
    case "MA20_RECLAIM": return { token, description: "Close is above MA20 reclaim filter.", formula: "Close > MA20" };
    case "MA10": return { token, description: "Close is above MA10.", formula: "Close > MA10" };
    case "NO_VOL_REJECT": return { token, description: "Recent volume spike rejection is not extreme.", formula: `VOL_SPIKE_20 <= ${getMetricContract("VOL_SPIKE_20")?.thresholds?.noRejectMax}` };
    case "RS_IMP": return { token, description: "Relative strength improvement over 5D is positive.", formula: "RS_IMPROVE_5 > 0.0" };
    case "RS_SPY_POS": return { token, description: "20D excess return versus SPY is positive.", formula: "EXRET_20_SPY > 0" };
    case "RS_SEC_POS": return { token, description: "20D excess return versus sector ETF is positive.", formula: "EXRET_20_SECTOR > 0" };
    case "SEC_M50": return { token, description: "Sector ETF is above its MA50 trend filter.", formula: "SECTOR_ABOVE_MA50 == true" };
    case "FAILED_BREAK": return { token, description: "A recent low-break occurred within the reclaim window.", formula: `rolling_max(Low < rolling_min(Low.shift(1), ${rule.parameters.window}), ${rule.parameters.reclaimDays}) == true` };
    case "RECLAIM_LOW": return { token, description: "Close reclaimed the prior rolling low reference level.", formula: `Close > rolling_min(Low.shift(1), ${rule.parameters.window})` };
    default: throw new Error(`Unsupported frozen scanner token: ${token}`);
  }
};

const isRecord = (value: unknown): value is Record<string, any> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const sameArray = (left: unknown, right: unknown) => Array.isArray(left) && Array.isArray(right) && JSON.stringify(left) === JSON.stringify(right);
const sameObject = (left: unknown, right: unknown) => isRecord(left) && isRecord(right) && JSON.stringify(left) === JSON.stringify(right);

export interface FrozenResearchBundleValidation {
  valid: boolean;
  status: typeof FROZEN_RESEARCH_PARITY_STATUS;
  releaseBlocked: true;
  errors: string[];
  limitations: readonly string[];
  checkedRuleCount: number;
}

/**
 * Validate the checked-in frozen research artifact against the typed registry.
 * Structural parity is machine-checkable here; numerical parity remains
 * explicitly blocked because the source golden outputs are not present.
 */
export const validateFrozenResearchBundle = (bundle: unknown): FrozenResearchBundleValidation => {
  const errors: string[] = [];
  if (!isRecord(bundle)) {
    return { valid: false, status: FROZEN_RESEARCH_PARITY_STATUS, releaseBlocked: true, errors: ["bundle_not_an_object"], limitations: FROZEN_RESEARCH_LIMITATIONS, checkedRuleCount: 0 };
  }
  if (bundle.source_version !== FROZEN_RESEARCH_VERSION) errors.push(`source_version_mismatch:${String(bundle.source_version)}`);
  if (bundle.research_status !== "frozen_app_export") errors.push(`research_status_mismatch:${String(bundle.research_status)}`);
  if (bundle.financial_truth_contract_version !== PRODUCTION_METRIC_CONTRACT_VERSION) errors.push(`financial_truth_contract_version_mismatch:${String(bundle.financial_truth_contract_version)}`);
  const machineValidation = bundle.machine_validation;
  if (!isRecord(machineValidation) || machineValidation.validator !== "validateFrozenResearchBundle" || machineValidation.status !== FROZEN_RESEARCH_PARITY_STATUS || machineValidation.structural_parity !== "required" || machineValidation.independent_numeric_parity !== "blocked" || !sameArray(machineValidation.limitations, FROZEN_RESEARCH_LIMITATIONS)) errors.push("machine_validation_status_mismatch");
  const universePolicy = bundle.universe_policy;
  if (!isRecord(universePolicy) || universePolicy.scanner_universe !== "current S&P 500 constituents filtered by each rule's sector scope" || universePolicy.constituent_source !== "data/sp500_current_constituents.csv" || universePolicy.current_constituents_survivorship_biased !== true || universePolicy.point_in_time_membership_available !== false) {
    errors.push("universe_policy_mismatch");
  }
  const dailyPolicy = bundle.daily_scan_policy;
  if (!isRecord(dailyPolicy) || dailyPolicy.frequency !== "daily" || dailyPolicy.evaluation_time !== "after market close using completed daily bar" || dailyPolicy.pending_live_intraday_signals_allowed !== false || dailyPolicy.entry_semantics_note !== "This export is for research-condition scanning only. It does not prescribe execution.") {
    errors.push("daily_scan_policy_mismatch");
  }
  const featureRequirements = bundle.feature_engine_requirements;
  if (!isRecord(featureRequirements) || !sameArray(featureRequirements.global_required_columns, FROZEN_REQUIRED_FEATURE_COLUMNS) || !sameObject(featureRequirements.column_semantics, FROZEN_COLUMN_SEMANTICS)) {
    errors.push("feature_engine_requirements_mismatch");
  }

  const bundleRules = Array.isArray(bundle.rules) ? bundle.rules : [];
  const actualById = new Map(frozenScannerRules.map((rule) => [rule.ruleId, rule]));
  if (bundleRules.length !== frozenScannerRules.length) errors.push(`rule_count_mismatch:${bundleRules.length}`);
  for (const entry of bundleRules) {
    if (!isRecord(entry) || typeof entry.rule_id !== "string") {
      errors.push("malformed_rule");
      continue;
    }
    const rule = actualById.get(entry.rule_id);
    if (!rule) {
      errors.push(`unexpected_rule:${entry.rule_id}`);
      continue;
    }
    if (entry.rule_signature_hash !== rule.ruleSignatureHash) errors.push(`${rule.ruleId}:signature_hash_mismatch`);
    if (entry.family !== rule.family || entry.classification !== rule.classification || entry.sector !== rule.sector || entry.scope_label !== `Sector${rule.sector}`) errors.push(`${rule.ruleId}:identity_mismatch`);
    const expectedParameters = rule.parameters.reclaimDays === undefined
      ? { dd_thresh: rule.parameters.ddThresh, window: rule.parameters.window }
      : { reclaim_days: rule.parameters.reclaimDays, window: rule.parameters.window };
    if (!sameObject(entry.parameters, expectedParameters)) errors.push(`${rule.ruleId}:parameters_mismatch`);
    if (!sameArray(entry.active_conditions, rule.activeConditions)) errors.push(`${rule.ruleId}:conditions_mismatch`);
    if (!sameArray(entry.blockers, rule.blockers)) errors.push(`${rule.ruleId}:blockers_mismatch`);
    if (entry.survivorship_bias_label !== rule.survivorshipBiasLabel || entry.forward_proof_required !== true || !sameArray(entry.risk_warnings, rule.riskWarnings)) errors.push(`${rule.ruleId}:limitations_mismatch`);
    const proof = entry.proof_summary;
    if (!isRecord(proof) || proof.discovery_median30 !== rule.proofSummary.discoveryMedian30 || proof.holdout_median30 !== rule.proofSummary.holdoutMedian30 || proof.lockbox_median30 !== rule.proofSummary.lockboxMedian30 || proof.latest_era_status !== rule.proofSummary.latestEraStatus || proof.current_constituents_survivorship_biased !== true) {
      errors.push(`${rule.ruleId}:proof_summary_mismatch`);
    }
    const appLogic = isRecord(entry.app_logic) ? entry.app_logic : undefined;
    const expectedConditions = rule.activeConditions.map((token) => conditionDefinition(token, rule));
    const expectedFeatureColumns = rule.family === "DeepDiscount" ? FROZEN_DEEP_DISCOUNT_FEATURE_COLUMNS : FROZEN_FAILED_BREAKDOWN_FEATURE_COLUMNS;
    if (!appLogic || appLogic.signal_definition !== "Signal is true on a completed daily bar only when every active condition and blocker formula evaluates true on that bar." || !sameArray(appLogic.active_condition_logic, expectedConditions) || !sameArray(appLogic.required_feature_columns, expectedFeatureColumns) || !sameObject(appLogic.bar_timing, { evaluation_point: "after_daily_close", uses_completed_bar_only: true, intraday_not_supported: true })) {
      errors.push(`${rule.ruleId}:app_logic_mismatch`);
    }
  }
  for (const rule of frozenScannerRules) if (!bundleRules.some((entry) => isRecord(entry) && entry.rule_id === rule.ruleId)) errors.push(`${rule.ruleId}:missing_from_bundle`);
  return {
    valid: errors.length === 0,
    status: FROZEN_RESEARCH_PARITY_STATUS,
    releaseBlocked: true,
    errors,
    limitations: FROZEN_RESEARCH_LIMITATIONS,
    checkedRuleCount: bundleRules.length,
  };
};
