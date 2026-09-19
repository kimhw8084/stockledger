import { contentHash } from "../../src/domain/contentHash";
import {
  checkProductionManagedRights,
  createResearchOnlyRightsProfile,
  MARKET_DATA_INGESTION_CONTRACT_REVISION,
  MARKET_DATA_INGESTION_CONTRACT_VERSION,
  normalizeProviderBatch,
  symbolPattern,
  type MarketDataDatasetCategory,
  type MarketDataFailureClass,
  type MarketDataRightsProfile,
  type NormalizedMarketDataBatch,
  type NormalizedMarketDataItem,
  type ProviderDailyBarsResponse,
} from "../../src/lib/marketDataContract";
import { isSessionDate } from "../../src/lib/marketCalendar";
import { WorkerStore, type IngestionItem, type IngestionRun } from "./store";
import { runManagedJob, type ManagedWorkerOptions, type ManagedWorkerResult } from "./managed";

export interface ProviderDailyBarsRequest {
  symbol: string;
  startDate: string;
  endDate: string;
  requestIdentity: string;
}

export interface MarketDataProviderAdapter {
  providerIdentity: string;
  providerProductId: string;
  fetchDailyBars(request: ProviderDailyBarsRequest): Promise<ProviderDailyBarsResponse>;
}

export class ProviderAcquisitionError extends Error {
  readonly failureClass: MarketDataFailureClass;
  readonly retryable: boolean;
  constructor(failureClass: MarketDataFailureClass, message: string, retryable = false) {
    super(message);
    this.name = "ProviderAcquisitionError";
    this.failureClass = failureClass;
    this.retryable = retryable;
  }
}

export interface ManagedAcquisitionRequest {
  symbols: string[];
  startDate: string;
  endDate: string;
  datasetCategory?: MarketDataDatasetCategory;
  expectedLatestSession?: string;
  minimumSessions?: number;
  rightsProfile?: MarketDataRightsProfile;
  maxConcurrency?: number;
  maxRequests?: number;
  maxAttempts?: number;
  retryBaseDelayMs?: number;
  sleep?: (delayMs: number) => Promise<void>;
  now?: Date;
}

export interface ManagedAcquisitionResult {
  status: "completed" | "partial" | "blocked-rights" | "blocked-budget" | "failed";
  run: IngestionRun;
  items: IngestionItem[];
  batch: NormalizedMarketDataBatch;
  histories: Array<{ symbol: string; rows: import("../../src/types").RawBarRecord[]; error?: string }>;
}

const defaultSleep = (delayMs: number) => new Promise<void>(resolve => setTimeout(resolve, delayMs));

const classifyError = (cause: unknown): { failureClass: MarketDataFailureClass; retryable: boolean; message: string } => {
  if (cause instanceof ProviderAcquisitionError) return { failureClass: cause.failureClass, retryable: cause.retryable, message: cause.message };
  const message = cause instanceof Error ? cause.message : "Provider request failed.";
  const normalized = message.toLowerCase();
  if (normalized.includes("429") || normalized.includes("rate")) return { failureClass: "rate_limit", retryable: true, message };
  if (normalized.includes("timeout") || normalized.includes("timed out")) return { failureClass: "timeout", retryable: true, message };
  if (normalized.includes("budget") || normalized.includes("credit")) return { failureClass: "budget_exhausted", retryable: false, message };
  if (normalized.includes("500") || normalized.includes("502") || normalized.includes("503") || normalized.includes("outage")) return { failureClass: "provider_outage", retryable: true, message };
  return { failureClass: "unknown", retryable: false, message };
};

const validateRequest = (adapter: MarketDataProviderAdapter, request: ManagedAcquisitionRequest) => {
  const symbols = [...new Set(request.symbols.map(symbol => symbol.trim().toUpperCase()))];
  if (symbols.length === 0 || symbols.length > 600 || symbols.some(symbol => !symbolPattern.test(symbol))) throw new Error("Managed ingestion accepts 1–600 symbols with validated US ticker syntax.");
  if (!isSessionDate(request.startDate) || !isSessionDate(request.endDate) || request.startDate > request.endDate) throw new Error("Managed ingestion requires a valid completed-daily-bar date range.");
  const maxConcurrency = Math.min(16, Math.max(1, Math.floor(request.maxConcurrency ?? 3)));
  const maxRequests = Math.min(6000, Math.max(1, Math.floor(request.maxRequests ?? symbols.length * Math.max(1, Math.floor(request.maxAttempts ?? 3)))));
  const maxAttempts = Math.min(5, Math.max(1, Math.floor(request.maxAttempts ?? 3)));
  if (request.datasetCategory && request.datasetCategory !== "daily_ohlcv") throw new ProviderAcquisitionError("unsupported_capability", `Dataset category ${request.datasetCategory} is deferred or unsupported.`, false);
  return { symbols, maxConcurrency, maxRequests, maxAttempts, datasetCategory: request.datasetCategory ?? "daily_ohlcv" as const, providerIdentity: adapter.providerIdentity, providerProductId: adapter.providerProductId };
};

const itemToResponse = (item: NormalizedMarketDataItem): ProviderDailyBarsResponse => ({
  symbol: item.symbol,
  rows: item.rows,
  retrievedAtUtc: item.retrievalTimestampUtc,
  adjustmentBasis: item.adjustmentBasis,
  sourceRequestIdentity: item.sourceRequestIdentity,
});

const itemError = (item: IngestionItem) => item.errorMessage ?? item.errorClass ?? "No valid observations.";

export async function acquireManagedDailyBars(
  store: WorkerStore,
  adapter: MarketDataProviderAdapter,
  request: ManagedAcquisitionRequest,
): Promise<ManagedAcquisitionResult> {
  const validated = validateRequest(adapter, request);
  const now = request.now ?? new Date();
  const rightsProfile = request.rightsProfile;
  const rights = checkProductionManagedRights(rightsProfile, "internal_computation", { providerIdentity: adapter.providerIdentity, providerProductId: adapter.providerProductId, now });
  const rightsProfileId = rightsProfile?.profileId ?? "missing-rights-profile";
  const runId = `ingestion-${contentHash({ contract: MARKET_DATA_INGESTION_CONTRACT_VERSION, revision: MARKET_DATA_INGESTION_CONTRACT_REVISION, providerIdentity: adapter.providerIdentity, providerProductId: adapter.providerProductId, datasetCategory: validated.datasetCategory, symbols: validated.symbols, startDate: request.startDate, endDate: request.endDate, expectedLatestSession: request.expectedLatestSession, rightsProfileId })}`;
  const prepared = store.createIngestionRun({
    id: runId, contractVersion: MARKET_DATA_INGESTION_CONTRACT_VERSION, contractRevision: MARKET_DATA_INGESTION_CONTRACT_REVISION,
    providerIdentity: adapter.providerIdentity, providerProductId: adapter.providerProductId, datasetCategory: validated.datasetCategory,
    requestedStartDate: request.startDate, requestedEndDate: request.endDate, rightsProfileId, requestBudget: validated.maxRequests,
  }, validated.symbols, now.getTime());
  if (!rights.allowed || !rightsProfile) {
    for (const item of prepared.items) store.finishIngestionItem({ runId, symbol: item.symbol, status: "blocked-rights", errorClass: "rights_blocked", errorMessage: rights.reason, now: now.getTime() });
    const run = store.updateIngestionRun(runId, { status: "blocked-rights", lastError: rights.reason, now: now.getTime() });
    const items = store.listIngestionItems(runId);
    const batch = normalizeProviderBatch({ providerIdentity: adapter.providerIdentity, providerProductId: adapter.providerProductId, datasetCategory: validated.datasetCategory, symbols: validated.symbols, requestedStartDate: request.startDate, requestedEndDate: request.endDate, responses: [], rightsProfile: rightsProfile ?? createResearchOnlyRightsProfile(adapter.providerIdentity, adapter.providerProductId), expectedLatestSession: request.expectedLatestSession, minimumSessions: request.minimumSessions });
    return { status: "blocked-rights", run, items, batch: { ...batch, failureClass: "rights_blocked", validationIssues: [rights.reason], coverageState: "unsupported", freshnessState: "unavailable" }, histories: validated.symbols.map(symbol => ({ symbol, rows: [], error: `rights_blocked:${rights.reason}` })) };
  }

  let run = prepared.run;
  if (validated.maxRequests > run.requestBudget) run = store.updateIngestionRun(runId, { requestBudget: validated.maxRequests, now: now.getTime() });
  if (run.status === "completed" || run.status === "blocked-rights") {
    const items = store.listIngestionItems(runId);
    const completedResponses = items.flatMap(item => item.result && item.result.validation.valid ? [itemToResponse(item.result)] : []);
    const batch = normalizeProviderBatch({ providerIdentity: adapter.providerIdentity, providerProductId: adapter.providerProductId, datasetCategory: validated.datasetCategory, symbols: validated.symbols, requestedStartDate: request.startDate, requestedEndDate: request.endDate, responses: completedResponses, rightsProfile: rightsProfile!, expectedLatestSession: request.expectedLatestSession, minimumSessions: request.minimumSessions });
    return { status: run.status, run, items, batch, histories: items.map(item => ({ symbol: item.symbol, rows: item.result?.validation.valid ? item.result.rows : [], ...(item.status === "completed" ? {} : { error: itemError(item) }) })) };
  }

  run = store.updateIngestionRun(runId, { status: "running", now: now.getTime() });
  let budgetUsed = run.budgetUsed;
  const sleep = request.sleep ?? defaultSleep;
  const retryBaseDelayMs = Math.max(0, Math.floor(request.retryBaseDelayMs ?? 1000));
  const processSymbol = async (symbol: string) => {
    for (;;) {
      const item = store.claimIngestionItem(runId, symbol, Date.now(), validated.maxAttempts);
      if (!item || ["completed", "partial", "failed", "blocked-rights"].includes(item.status)) return;
      if (budgetUsed >= run.requestBudget) {
        store.finishIngestionItem({ runId, symbol, status: "blocked-budget", errorClass: "budget_exhausted", errorMessage: "Invocation request budget exhausted before this symbol was fetched.", now: Date.now() });
        return;
      }
      budgetUsed += 1;
      store.updateIngestionRun(runId, { budgetUsed, now: Date.now() });
      const requestIdentity = `${runId}:${symbol}:${item.attempts}`;
      try {
        const response = await adapter.fetchDailyBars({ symbol, startDate: request.startDate, endDate: request.endDate, requestIdentity });
        if (!response || response.symbol !== symbol || !Array.isArray(response.rows) || !response.retrievedAtUtc || !response.adjustmentBasis || !["adjusted", "unadjusted", "unknown"].includes(response.adjustmentBasis) || response.rows.some(row => !row || typeof row !== "object")) throw new ProviderAcquisitionError("malformed_payload", "Provider response did not match the normalized daily-bars shape.");
        const batch = normalizeProviderBatch({ providerIdentity: adapter.providerIdentity, providerProductId: adapter.providerProductId, datasetCategory: validated.datasetCategory, symbols: [symbol], requestedStartDate: request.startDate, requestedEndDate: request.endDate, responses: [response], rightsProfile: rightsProfile!, expectedLatestSession: request.expectedLatestSession, minimumSessions: request.minimumSessions });
        const normalized = batch.items[0];
        if (normalized.validation.valid) store.finishIngestionItem({ runId, symbol, status: "completed", result: normalized, now: Date.now() });
        else store.finishIngestionItem({ runId, symbol, status: "partial", result: normalized, contentHash: normalized.stableContentHash, errorClass: normalized.validation.failureClass, errorMessage: normalized.validation.issues.join(", "), now: Date.now() });
        return;
      } catch (cause) {
        const classified = classifyError(cause);
        if (classified.retryable && item.attempts < validated.maxAttempts && budgetUsed < run.requestBudget) {
          const delay = Math.min(15 * 60_000, retryBaseDelayMs * (2 ** Math.max(0, item.attempts - 1)));
          store.finishIngestionItem({ runId, symbol, status: "retry-wait", errorClass: classified.failureClass, errorMessage: classified.message, nextRetryAt: Date.now() + delay, now: Date.now() });
          await sleep(delay);
          continue;
        }
        store.finishIngestionItem({ runId, symbol, status: classified.failureClass === "budget_exhausted" ? "blocked-budget" : "failed", errorClass: classified.failureClass, errorMessage: classified.message, now: Date.now() });
        return;
      }
    }
  };

  const pendingSymbols = store.listIngestionItems(runId).filter(item => !["completed", "partial", "failed", "blocked-rights"].includes(item.status)).map(item => item.symbol);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(validated.maxConcurrency, pendingSymbols.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= pendingSymbols.length) return;
      await processSymbol(pendingSymbols[index]);
    }
  });
  await Promise.all(workers);

  let items = store.listIngestionItems(runId);
  const hasBudgetBlock = items.some(item => item.status === "blocked-budget");
  const hasFailure = items.some(item => ["failed", "partial", "retry-wait", "running"].includes(item.status));
  const complete = items.every(item => item.status === "completed");
  const status = hasBudgetBlock ? "blocked-budget" : complete ? "completed" : hasFailure ? "partial" : "failed";
  run = store.updateIngestionRun(runId, { status, budgetUsed, lastError: status === "completed" ? null : "One or more symbols did not produce a complete validated observation.", now: Date.now() });
  items = store.listIngestionItems(runId);
  const responses = items.flatMap(item => item.result && item.result.validation.valid ? [itemToResponse(item.result)] : []);
  const batch = normalizeProviderBatch({ providerIdentity: adapter.providerIdentity, providerProductId: adapter.providerProductId, datasetCategory: validated.datasetCategory, symbols: validated.symbols, requestedStartDate: request.startDate, requestedEndDate: request.endDate, responses, rightsProfile: rightsProfile!, expectedLatestSession: request.expectedLatestSession, minimumSessions: request.minimumSessions });
  const histories = items.map(item => ({ symbol: item.symbol, rows: item.result?.validation.valid ? item.result.rows : [], ...(item.status === "completed" ? {} : { error: itemError(item) }) }));
  return { status, run, items, batch, histories };
}

export async function runManagedProviderJob(
  store: WorkerStore,
  adapter: MarketDataProviderAdapter,
  request: ManagedAcquisitionRequest,
  workerOptions: Partial<Omit<ManagedWorkerOptions, "sourceKind" | "rightsProfile" | "ingestionMetadata" | "adjustment">> & { adjustment?: ManagedWorkerOptions["adjustment"]; source?: string } = {},
): Promise<{ acquisition: ManagedAcquisitionResult; worker?: ManagedWorkerResult }> {
  const acquisition = await acquireManagedDailyBars(store, adapter, request);
  if (acquisition.status === "blocked-rights" || acquisition.status === "blocked-budget" || acquisition.status === "failed") return { acquisition };
  const worker = await runManagedJob(store, acquisition.histories, {
    ...workerOptions,
    source: workerOptions.source ?? `${adapter.providerIdentity}/${adapter.providerProductId}`,
    adjustment: workerOptions.adjustment ?? acquisition.batch.adjustmentBasis,
    sourceKind: "provider",
    rightsProfile: request.rightsProfile,
    ingestionMetadata: acquisition.batch,
  });
  return { acquisition, worker };
}
