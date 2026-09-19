import type { RawBarRecord } from "../types";
import { contentHash } from "../domain/contentHash";
import { isSessionDate, isUsTradingDate, previousUsTradingDate } from "./marketCalendar";

export const MARKET_DATA_INGESTION_CONTRACT_VERSION = "stockledger-market-data-ingestion-v1" as const;
export const MARKET_DATA_INGESTION_CONTRACT_REVISION = 1 as const;
export const MARKET_DATA_RIGHTS_CONTRACT_VERSION = "stockledger-market-data-rights-v1" as const;
export const MARKET_DATA_RIGHTS_CONTRACT_REVISION = 1 as const;

export type MarketDataDatasetCategory =
  | "daily_ohlcv"
  | "reference_identity"
  | "corporate_actions"
  | "fundamentals"
  | "events_news"
  | "intraday_realtime";

export type MarketDataAdjustmentBasis = "adjusted" | "unadjusted" | "unknown";
export type MarketDataFreshnessState = "fresh" | "delayed" | "stale" | "partial" | "unavailable";
export type MarketDataCoverageState = "complete" | "partial" | "missing" | "unsupported";

export type MarketDataFailureClass =
  | "none"
  | "rights_blocked"
  | "provider_outage"
  | "timeout"
  | "rate_limit"
  | "budget_exhausted"
  | "empty_response"
  | "malformed_payload"
  | "validation_failed"
  | "missing_symbol"
  | "stale_data"
  | "unsupported_capability"
  | "insufficient_history"
  | "unknown";

export type MarketDataCapabilityState = "supported" | "deferred" | "unsupported";

export const deferredMarketDataCategories: Readonly<Record<Exclude<MarketDataDatasetCategory, "daily_ohlcv" | "reference_identity" | "corporate_actions">, MarketDataCapabilityState>> = {
  fundamentals: "deferred",
  events_news: "deferred",
  intraday_realtime: "deferred",
};

export const supportedMarketDataCategories: Readonly<Record<Extract<MarketDataDatasetCategory, "daily_ohlcv" | "reference_identity" | "corporate_actions">, MarketDataCapabilityState>> = {
  daily_ohlcv: "supported",
  reference_identity: "supported",
  corporate_actions: "supported",
};

export type RightsUseCategory =
  | "internal_computation"
  | "end_user_display"
  | "derived_metrics"
  | "notification"
  | "user_export"
  | "raw_redistribution";

export type RightsState = "allowed" | "denied" | "unknown";
export type RightsProfileKind = "commercial" | "research-only" | "local-user";

export interface MarketDataRightsPermission {
  state: RightsState;
  evidenceRef?: string;
  effectiveAtUtc?: string;
  expiresAtUtc?: string;
}

export type MarketDataRightsPermissions = Record<RightsUseCategory, MarketDataRightsPermission>;

export interface MarketDataRightsProfile {
  contractVersion: typeof MARKET_DATA_RIGHTS_CONTRACT_VERSION;
  revision: typeof MARKET_DATA_RIGHTS_CONTRACT_REVISION;
  profileId: string;
  providerIdentity: string;
  providerProductId: string;
  profileKind: RightsProfileKind;
  evidenceRef?: string;
  permissions: MarketDataRightsPermissions;
}

export interface RightsDecision {
  allowed: boolean;
  state: RightsState;
  use: RightsUseCategory;
  profileId?: string;
  reason: string;
}

export interface MarketDataValidationReport {
  valid: boolean;
  issues: string[];
  failureClass: MarketDataFailureClass;
  observedStartDate?: string;
  observedEndDate?: string;
  freshnessState: MarketDataFreshnessState;
  coverageState: MarketDataCoverageState;
  stableContentHash: string;
}

export interface NormalizedMarketDataItem {
  symbol: string;
  rows: RawBarRecord[];
  requestedStartDate: string;
  requestedEndDate: string;
  observedStartDate?: string;
  observedEndDate?: string;
  retrievalTimestampUtc: string;
  adjustmentBasis: MarketDataAdjustmentBasis;
  sourceRequestIdentity?: string;
  validation: MarketDataValidationReport;
  stableContentHash: string;
}

export interface NormalizedMarketDataBatch {
  contractVersion: typeof MARKET_DATA_INGESTION_CONTRACT_VERSION;
  revision: typeof MARKET_DATA_INGESTION_CONTRACT_REVISION;
  providerIdentity: string;
  providerProductId: string;
  datasetCategory: MarketDataDatasetCategory;
  symbols: string[];
  requestedStartDate: string;
  requestedEndDate: string;
  observedStartDate?: string;
  observedEndDate?: string;
  retrievalTimestampUtc: string;
  adjustmentBasis: MarketDataAdjustmentBasis;
  sourceRequestIdentity?: string;
  freshnessState: MarketDataFreshnessState;
  coverageState: MarketDataCoverageState;
  stableContentHash: string;
  datasetIdentity: string;
  validationIssues: string[];
  failureClass: MarketDataFailureClass;
  rightsProfileId: string;
  items: NormalizedMarketDataItem[];
}

export type MarketDataArchiveMetadata = Pick<NormalizedMarketDataBatch,
  | "contractVersion" | "revision" | "providerIdentity" | "providerProductId" | "datasetCategory"
  | "requestedStartDate" | "requestedEndDate" | "observedStartDate" | "observedEndDate"
  | "retrievalTimestampUtc" | "sourceRequestIdentity" | "freshnessState" | "coverageState"
  | "stableContentHash" | "datasetIdentity" | "validationIssues" | "failureClass" | "rightsProfileId"
>;

export interface ProviderDailyBarsResponse {
  symbol: string;
  rows: RawBarRecord[];
  retrievedAtUtc: string;
  adjustmentBasis: MarketDataAdjustmentBasis;
  sourceRequestIdentity?: string;
}

export const symbolPattern = /^[A-Z0-9][A-Z0-9.-]{0,15}$/;

const rightsUses: RightsUseCategory[] = [
  "internal_computation",
  "end_user_display",
  "derived_metrics",
  "notification",
  "user_export",
  "raw_redistribution",
];

const validTimestamp = (value: string) => Number.isFinite(Date.parse(value));

export const makeRightsPermissions = (
  state: RightsState,
  overrides: Partial<MarketDataRightsPermissions> = {},
): MarketDataRightsPermissions => Object.fromEntries(
  rightsUses.map(use => [use, overrides[use] ?? { state }]),
) as MarketDataRightsPermissions;

export const createResearchOnlyRightsProfile = (providerIdentity: string, providerProductId: string): MarketDataRightsProfile => ({
  contractVersion: MARKET_DATA_RIGHTS_CONTRACT_VERSION,
  revision: MARKET_DATA_RIGHTS_CONTRACT_REVISION,
  profileId: `${providerIdentity}:${providerProductId}:research-only`,
  providerIdentity,
  providerProductId,
  profileKind: "research-only",
  permissions: makeRightsPermissions("denied", { internal_computation: { state: "allowed" } }),
});

export const createLocalUserRightsProfile = (providerIdentity = "local-user", providerProductId = "csv-import"): MarketDataRightsProfile => ({
  contractVersion: MARKET_DATA_RIGHTS_CONTRACT_VERSION,
  revision: MARKET_DATA_RIGHTS_CONTRACT_REVISION,
  profileId: `${providerIdentity}:${providerProductId}:local-user`,
  providerIdentity,
  providerProductId,
  profileKind: "local-user",
  permissions: makeRightsPermissions("allowed", { raw_redistribution: { state: "denied" } }),
});

export const checkRights = (
  profile: MarketDataRightsProfile | undefined,
  use: RightsUseCategory,
  expected?: { providerIdentity: string; providerProductId: string; now?: Date },
): RightsDecision => {
  if (!profile) return { allowed: false, state: "unknown", use, reason: "missing_rights_profile" };
  if (profile.contractVersion !== MARKET_DATA_RIGHTS_CONTRACT_VERSION || profile.revision !== MARKET_DATA_RIGHTS_CONTRACT_REVISION) {
    return { allowed: false, state: "unknown", use, profileId: profile.profileId, reason: "unsupported_rights_profile_revision" };
  }
  if (expected && (profile.providerIdentity !== expected.providerIdentity || profile.providerProductId !== expected.providerProductId)) {
    return { allowed: false, state: "denied", use, profileId: profile.profileId, reason: "provider_product_mismatch" };
  }
  const permission = profile.permissions?.[use];
  if (!permission) return { allowed: false, state: "unknown", use, profileId: profile.profileId, reason: "missing_use_permission" };
  const now = expected?.now ?? new Date();
  if (permission.effectiveAtUtc && (!validTimestamp(permission.effectiveAtUtc) || now < new Date(permission.effectiveAtUtc))) {
    return { allowed: false, state: "unknown", use, profileId: profile.profileId, reason: "permission_not_yet_effective" };
  }
  if (permission.expiresAtUtc && (!validTimestamp(permission.expiresAtUtc) || now >= new Date(permission.expiresAtUtc))) {
    return { allowed: false, state: "denied", use, profileId: profile.profileId, reason: "permission_expired" };
  }
  if (permission.state !== "allowed") {
    return { allowed: false, state: permission.state, use, profileId: profile.profileId, reason: `${permission.state}_use_permission` };
  }
  if (use !== "internal_computation" && profile.profileKind !== "commercial" && profile.profileKind !== "local-user") {
    return { allowed: false, state: "denied", use, profileId: profile.profileId, reason: "research_only_profile" };
  }
  return { allowed: true, state: "allowed", use, profileId: profile.profileId, reason: "allowed" };
};

export const checkProductionManagedRights = (
  profile: MarketDataRightsProfile | undefined,
  use: RightsUseCategory = "internal_computation",
  expected?: { providerIdentity: string; providerProductId: string; now?: Date },
): RightsDecision => {
  const decision = checkRights(profile, use, expected);
  if (!profile || profile.profileKind !== "commercial") {
    return { ...decision, allowed: false, state: decision.state === "allowed" ? "denied" : decision.state, reason: "production_requires_commercial_profile" };
  }
  return decision;
};

export const rightsFailureMessage = (profile: MarketDataRightsProfile | undefined, use: RightsUseCategory, expected?: { providerIdentity: string; providerProductId: string; now?: Date }) => {
  const decision = checkProductionManagedRights(profile, use, expected);
  return `Production rights gate blocked ${use}: ${decision.reason}`;
};

export const enforceRights = (
  profile: MarketDataRightsProfile | undefined,
  use: RightsUseCategory,
  expected?: { providerIdentity: string; providerProductId: string; now?: Date },
) => {
  const decision = checkRights(profile, use, expected);
  if (!decision.allowed) throw new Error(`Rights gate blocked ${use}: ${decision.reason}`);
  return decision;
};

export const enforceProductionManagedRights = (
  profile: MarketDataRightsProfile | undefined,
  use: RightsUseCategory = "internal_computation",
  expected?: { providerIdentity: string; providerProductId: string; now?: Date },
) => {
  const decision = checkProductionManagedRights(profile, use, expected);
  if (!decision.allowed) throw new Error(`Production rights gate blocked ${use}: ${decision.reason}`);
  return decision;
};

const reportHash = (symbol: string, requestedStartDate: string, requestedEndDate: string, rows: RawBarRecord[], adjustmentBasis: MarketDataAdjustmentBasis) =>
  contentHash({ symbol, requestedStartDate, requestedEndDate, adjustmentBasis, rows });

export const validateDailyBars = (input: {
  symbol: string;
  rows: RawBarRecord[];
  requestedStartDate: string;
  requestedEndDate: string;
  expectedLatestSession?: string;
  adjustmentBasis?: MarketDataAdjustmentBasis;
  minimumSessions?: number;
}): MarketDataValidationReport => {
  const { symbol, rows, requestedStartDate, requestedEndDate } = input;
  const adjustmentBasis = input.adjustmentBasis ?? "unknown";
  const issues: string[] = [];
  if (!symbolPattern.test(symbol)) issues.push(`invalid_symbol:${symbol}`);
  if (!isSessionDate(requestedStartDate) || !isSessionDate(requestedEndDate) || requestedStartDate > requestedEndDate) issues.push("invalid_requested_date_range");
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      valid: false, issues: [...issues, "missing_symbol_history"], failureClass: "empty_response",
      freshnessState: "unavailable", coverageState: "missing", stableContentHash: reportHash(symbol, requestedStartDate, requestedEndDate, [], adjustmentBasis),
    };
  }
  let previousDate = "";
  const seen = new Set<string>();
  for (const bar of rows) {
    if (bar.symbol !== symbol) issues.push(`symbol_mismatch:${bar.symbol}`);
    if (!isSessionDate(bar.date)) issues.push(`invalid_date:${bar.date}`);
    else {
      try {
        if (!isUsTradingDate(bar.date)) issues.push(`non_trading_date:${bar.date}`);
        else if (previousDate && previousDate !== previousUsTradingDate(bar.date)) issues.push(`session_gap_before:${bar.date}`);
      } catch { issues.push(`calendar_coverage_unavailable:${bar.date}`); }
    }
    if (bar.date < requestedStartDate || bar.date > requestedEndDate) issues.push(`date_out_of_requested_range:${bar.date}`);
    if (previousDate && bar.date < previousDate) issues.push(`unsorted_date:${bar.date}`);
    if (seen.has(bar.date)) issues.push(`duplicate_date:${bar.date}`);
    seen.add(bar.date);
    previousDate = bar.date;
    if (![bar.open, bar.high, bar.low, bar.close, bar.volume].every(Number.isFinite)) issues.push(`non_finite_value:${bar.date}`);
    if (![bar.open, bar.high, bar.low, bar.close].every(value => value > 0)) issues.push(`invalid_value:${bar.date}`);
    if (bar.volume < 0) issues.push(`negative_volume:${bar.date}`);
    if (bar.high < Math.max(bar.open, bar.close, bar.low) || bar.low > Math.min(bar.open, bar.close, bar.high)) issues.push(`ohlc_inconsistent:${bar.date}`);
  }
  const observedStartDate = rows[0]?.date;
  const observedEndDate = rows.at(-1)?.date;
  if (input.expectedLatestSession && observedEndDate !== input.expectedLatestSession) {
    issues.push(`latest_bar_date_mismatch:${observedEndDate}`);
    if (observedEndDate && observedEndDate < input.expectedLatestSession) issues.push(`stale_latest_session:${observedEndDate}`);
  }
  if (input.minimumSessions !== undefined && rows.length < input.minimumSessions) issues.push(`insufficient_history:${rows.length}<${input.minimumSessions}`);
  const valid = issues.length === 0;
  const failureClass: MarketDataFailureClass = valid
    ? "none"
    : issues.some(issue => issue.startsWith("stale_latest_session")) ? "stale_data"
      : issues.some(issue => issue.startsWith("insufficient_history")) ? "insufficient_history"
        : issues.some(issue => issue.startsWith("symbol_mismatch") || issue.startsWith("invalid_symbol")) ? "malformed_payload"
          : "validation_failed";
  return {
    valid,
    issues,
    failureClass,
    observedStartDate,
    observedEndDate,
    freshnessState: !valid ? (failureClass === "stale_data" ? "stale" : "partial") : input.expectedLatestSession && observedEndDate === input.expectedLatestSession ? "fresh" : "delayed",
    coverageState: valid ? "complete" : "partial",
    stableContentHash: reportHash(symbol, requestedStartDate, requestedEndDate, rows, adjustmentBasis),
  };
};

export const normalizeProviderBatch = (input: {
  providerIdentity: string;
  providerProductId: string;
  datasetCategory: MarketDataDatasetCategory;
  symbols: string[];
  requestedStartDate: string;
  requestedEndDate: string;
  responses: ProviderDailyBarsResponse[];
  rightsProfile: MarketDataRightsProfile;
  expectedLatestSession?: string;
  minimumSessions?: number;
}): NormalizedMarketDataBatch => {
  const symbols = [...new Set(input.symbols)];
  const responseBySymbol = new Map(input.responses.map(response => [response.symbol, response]));
  const items = symbols.map(symbol => {
    const response = responseBySymbol.get(symbol);
    const rows = response?.rows ?? [];
    const adjustmentBasis = response?.adjustmentBasis ?? "unknown";
    let validation = response
      ? validateDailyBars({ symbol, rows, requestedStartDate: input.requestedStartDate, requestedEndDate: input.requestedEndDate, expectedLatestSession: input.expectedLatestSession, adjustmentBasis, minimumSessions: input.minimumSessions })
      : {
        valid: false, issues: [`${symbol}:missing_symbol_history`], failureClass: "missing_symbol" as const, freshnessState: "unavailable" as const, coverageState: "missing" as const,
        stableContentHash: reportHash(symbol, input.requestedStartDate, input.requestedEndDate, [], adjustmentBasis),
      };
    if (response && (!validTimestamp(response.retrievedAtUtc) || !response.retrievedAtUtc.endsWith("Z"))) {
      validation = { ...validation, valid: false, failureClass: "malformed_payload", freshnessState: "unavailable", coverageState: "partial", issues: [...validation.issues, "invalid_retrieval_timestamp"] };
    }
    if (response && !["adjusted", "unadjusted", "unknown"].includes(response.adjustmentBasis)) {
      validation = { ...validation, valid: false, failureClass: "malformed_payload", freshnessState: "unavailable", coverageState: "partial", issues: [...validation.issues, "invalid_adjustment_basis"] };
    }
    return {
      symbol, rows, requestedStartDate: input.requestedStartDate, requestedEndDate: input.requestedEndDate,
      observedStartDate: validation.observedStartDate, observedEndDate: validation.observedEndDate,
      retrievalTimestampUtc: response?.retrievedAtUtc ?? new Date(0).toISOString(), adjustmentBasis,
      sourceRequestIdentity: response?.sourceRequestIdentity, validation, stableContentHash: validation.stableContentHash,
    } satisfies NormalizedMarketDataItem;
  });
  const validItems = items.filter(item => item.validation.valid);
  const adjustmentBases = [...new Set(validItems.map(item => item.adjustmentBasis))];
  if (adjustmentBases.length > 1) {
    for (const item of items) item.validation = { ...item.validation, valid: false, failureClass: "validation_failed", freshnessState: "partial", coverageState: "partial", issues: [...item.validation.issues, "mixed_adjustment_basis"] };
  }
  const acceptedItems = items.filter(item => item.validation.valid);
  const retrievalTimestampUtc = items.map(item => item.retrievalTimestampUtc).sort().at(-1) ?? new Date(0).toISOString();
  const allRows = acceptedItems.flatMap(item => item.rows);
  const coverageState = acceptedItems.length === 0 ? "missing" : acceptedItems.length === items.length ? "complete" : "partial";
  const freshnessState = acceptedItems.length === 0 ? "unavailable" : acceptedItems.some(item => item.validation.freshnessState === "stale") ? "stale" : acceptedItems.length === items.length && acceptedItems.every(item => item.validation.freshnessState === "fresh") ? "fresh" : "partial";
  const failureClass: MarketDataFailureClass = acceptedItems.length === items.length ? "none" : items.some(item => item.validation.failureClass === "missing_symbol") ? "missing_symbol" : items.some(item => item.validation.failureClass === "stale_data") ? "stale_data" : "validation_failed";
  const validationIssues = items.flatMap(item => item.validation.issues.map(issue => `${item.symbol}:${issue}`));
  const stableContentHash = contentHash({ providerIdentity: input.providerIdentity, providerProductId: input.providerProductId, datasetCategory: input.datasetCategory, requestedStartDate: input.requestedStartDate, requestedEndDate: input.requestedEndDate, adjustmentBasis: items.map(item => [item.symbol, item.adjustmentBasis]), items: items.map(item => item.stableContentHash) });
  return {
    contractVersion: MARKET_DATA_INGESTION_CONTRACT_VERSION, revision: MARKET_DATA_INGESTION_CONTRACT_REVISION,
    providerIdentity: input.providerIdentity, providerProductId: input.providerProductId, datasetCategory: input.datasetCategory,
    symbols, requestedStartDate: input.requestedStartDate, requestedEndDate: input.requestedEndDate,
    observedStartDate: allRows.map(row => row.date).sort().at(0), observedEndDate: allRows.map(row => row.date).sort().at(-1),
    retrievalTimestampUtc, adjustmentBasis: acceptedItems[0]?.adjustmentBasis ?? "unknown", sourceRequestIdentity: items.map(item => item.sourceRequestIdentity).filter(Boolean).join(",") || undefined,
    freshnessState, coverageState, stableContentHash, datasetIdentity: `dataset-${stableContentHash}`,
    validationIssues, failureClass, rightsProfileId: input.rightsProfile.profileId, items,
  };
};

export const isDeferredMarketDataCategory = (category: MarketDataDatasetCategory) => category in deferredMarketDataCategories;
