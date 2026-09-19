import { statSync, existsSync } from "node:fs";
import { NOTIFICATION_DELIVERY_CONTRACT_REVISION, NOTIFICATION_DELIVERY_CONTRACT_VERSION, NOTIFICATION_DIGEST_CONTRACT_REVISION, NOTIFICATION_DIGEST_CONTRACT_VERSION, NOTIFICATION_POLICY_VERSION } from "../../src/domain/notificationDelivery";
import { serializeExport, type StorageEnvelope } from "../../src/domain/backupFormat";
import { WORKER_JOB_CONTRACT_REVISION, WORKER_JOB_CONTRACT_VERSION } from "./contract";
import { WORKER_DATABASE_SCHEMA_VERSION, type IngestionItem, type IngestionRun, type WorkerJob, type WorkerStore } from "./store";
import { CALENDAR_VERSION } from "../../src/lib/marketCalendar";
import { FINANCIAL_TRUTH_ENGINE_VERSION, PRODUCTION_METRIC_CONTRACT_VERSION } from "../../src/lib/metricCatalog";
import { MARKET_DATA_INGESTION_CONTRACT_REVISION, MARKET_DATA_INGESTION_CONTRACT_VERSION, MARKET_DATA_RIGHTS_AUTHORITY_MODEL_VERSION, MARKET_DATA_RIGHTS_CONTRACT_REVISION, MARKET_DATA_RIGHTS_CONTRACT_VERSION } from "../../src/lib/marketDataContract";
import { syncContractVersion } from "../../src/features/sync/syncPlan";
import { NOTIFICATION_PREFERENCES_CONTRACT_VERSION } from "../../src/domain/notificationPreferences";

export const OPERATIONS_STATUS_CONTRACT_VERSION = "stockledger-operations-status-v1" as const;
export const OPERATIONS_STATUS_CONTRACT_REVISION = 1 as const;
export const OPERATIONS_ENGINE_VERSION = "1" as const;
export type OperationsOverallState = "healthy" | "degraded" | "blocked" | "unconfigured" | "unknown";

const jobStatuses = ["queued", "running", "retry-wait", "completed", "partial", "blocked", "terminal-failed", "superseded"] as const;
const ingestionRunStatuses = ["queued", "running", "completed", "partial", "blocked-rights", "blocked-budget", "failed"] as const;
const ingestionItemStatuses = ["queued", "running", "completed", "partial", "retry-wait", "failed", "blocked-rights", "blocked-budget"] as const;
const notificationStatuses = ["pending", "held", "claimed", "delivered", "failed", "retry-wait", "canceled", "blocked-unconfigured", "ambiguous"] as const;

type CountMap<T extends string> = Record<T, number>;
type SafeTimestamp = string | null;

export interface OperationsStatusOptions {
  observedAt?: Date;
  sourceIdentity?: { commit: string | null; tree: string | null; state?: "known" | "unavailable" | "mismatched" };
  appVersion?: string;
  nodeRequirement?: string;
}

export interface OperationsStatus {
  contractVersion: typeof OPERATIONS_STATUS_CONTRACT_VERSION;
  revision: typeof OPERATIONS_STATUS_CONTRACT_REVISION;
  observedAtUtc: string;
  overall: { state: OperationsOverallState; reasons: string[] };
  scheduler: {
    state: "healthy" | "missed" | "stopped" | "blocked";
    schedulerInstalled: false;
    lastInvocationAtUtc: SafeTimestamp;
    expectedSession: string;
    successfulSession: string | null;
    nextDueAtUtc: SafeTimestamp;
    deadlineAtUtc: SafeTimestamp;
    deadlineHeadroomMs: number | null;
    missedSessions: number;
    partialSessions: number;
    blockedSessions: number;
    retryingSessions: number;
    terminalFailedSessions: number;
    scheduledSessions: number;
    completedSessions: number;
    jobsByStatus: CountMap<(typeof jobStatuses)[number]>;
    lastErrorClass: string | null;
  };
  workerQueues: {
    countsByState: CountMap<(typeof jobStatuses)[number]>;
    activeCount: number;
    retryCount: number;
    terminalCount: number;
    oldestActionableDueAtUtc: SafeTimestamp;
    oldestActionableAgeMs: number | null;
    oldestActionableDelayMs: number | null;
  };
  ingestion: {
    runsByState: CountMap<(typeof ingestionRunStatuses)[number]>;
    itemsByState: CountMap<(typeof ingestionItemStatuses)[number]>;
    failureClasses: { partial: number; missing: number; rateLimited: number; budgetBlocked: number; rightsBlocked: number; providerFailure: number; staleOrIncomplete: number };
    oldestUnfinishedAtUtc: SafeTimestamp;
    oldestUnfinishedAgeMs: number | null;
    requestBudget: { used: number; configured: number; state: "known" | "unknown" };
    contractVersion: typeof MARKET_DATA_INGESTION_CONTRACT_VERSION;
    contractRevision: typeof MARKET_DATA_INGESTION_CONTRACT_REVISION;
    rightsContractVersion: typeof MARKET_DATA_RIGHTS_CONTRACT_VERSION;
    rightsContractRevision: typeof MARKET_DATA_RIGHTS_CONTRACT_REVISION;
  };
  notificationDelivery: {
    countsByState: CountMap<(typeof notificationStatuses)[number]>;
    actionableCount: number;
    oldestActionableAtUtc: SafeTimestamp;
    oldestActionableAgeMs: number | null;
    oldestActionableDelayMs: number | null;
    deliveryContractVersion: typeof NOTIFICATION_DELIVERY_CONTRACT_VERSION;
    deliveryContractRevision: typeof NOTIFICATION_DELIVERY_CONTRACT_REVISION;
    digestContractVersion: typeof NOTIFICATION_DIGEST_CONTRACT_VERSION;
    digestContractRevision: typeof NOTIFICATION_DIGEST_CONTRACT_REVISION;
    policyVersion: typeof NOTIFICATION_POLICY_VERSION;
  };
  workspaceStorage: {
    present: boolean;
    workspaceRevision: number | null;
    exportSchemaVersion: StorageEnvelope["schemaVersion"];
    workerDatabaseSchemaVersion: number;
    supportedWorkerDatabaseSchemaVersion: typeof WORKER_DATABASE_SCHEMA_VERSION;
    integrity: "ok" | "failed" | "unknown";
    consistentBackup: "supported" | "unavailable";
    lastOperatorBackup: "unknown";
    databaseBytes: number | null;
    walBytes: number | null;
    shmBytes: number | null;
    workspaceBytes: number | null;
    marketCoverage: { scanRunsByState: Record<string, number>; archivesByValidation: Record<string, number>; staleOrPartial: number };
  };
  sync: { contractVersion: typeof syncContractVersion; state: "unavailable" | "known" | "degraded"; reason: string };
  releaseIdentity: {
    state: "known" | "unavailable" | "mismatched";
    appVersion: string;
    nodeRequirement: string;
    nodeRuntime: string;
    financialTruthEngineVersion: string;
    financialTruthContractVersion: string;
    calendarVersion: string;
    workspaceExportSchemaVersion: number;
    workerDatabaseSchemaVersion: number;
    workerJobContract: { version: string; revision: number };
    notificationContracts: { delivery: string; deliveryRevision: number; digest: string; digestRevision: number; preferences: string };
    ingestionContract: { version: string; revision: number };
    rightsContract: { version: string; revision: number; authorityModelVersion: string };
    syncContractVersion: string;
    sourceCommit: string | null;
    sourceTree: string | null;
  };
  externalDependencies: {
    hostedScheduler: "not-configured";
    providerQuotaCostRunway: "unavailable";
    commercialMarketDataProvider: "external-gate";
    billingLifecycle: "not-configured";
    externalNotificationService: "not-configured";
    productionCloudBackup: "external-gate";
    externalIncidentPager: "not-configured";
  };
}

const emptyCounts = <T extends readonly string[]>(values: T) => Object.fromEntries(values.map(value => [value, 0])) as CountMap<T[number]>;
const parseTime = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
const ageMs = (observedAt: number, value: string | null) => value ? Math.max(0, observedAt - (parseTime(value) ?? observedAt)) : null;
const delayMs = (observedAt: number, value: number | null) => value === null ? null : Math.max(0, observedAt - value);
const safeErrorClass = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized.includes("rights")) return "rights_blocked";
  if (normalized.includes("admission") || normalized.includes("queue")) return "admission_blocked";
  if (normalized.includes("lease")) return "lease_failure";
  if (normalized.includes("revision") || normalized.includes("conflict")) return "revision_conflict";
  if (normalized.includes("timeout")) return "timeout";
  if (normalized.includes("rate") || normalized.includes("429")) return "rate_limit";
  if (normalized.includes("budget")) return "budget_exhausted";
  if (normalized.includes("integrity") || normalized.includes("corrupt")) return "integrity_failure";
  if (normalized.includes("provider")) return "provider_failure";
  return "worker_failure";
};

const fileBytes = (path: string) => existsSync(path) ? statSync(path).size : 0;
const safeJobDue = (job: WorkerJob) => job.nextRetryAt ?? parseTime(job.dueAtUtc) ?? 0;
const actionableJob = (job: WorkerJob) => ["queued", "running", "retry-wait"].includes(job.status);
const actionableIngestionItem = (item: IngestionItem) => ["queued", "running", "retry-wait"].includes(item.status);
const actionableNotification = (status: string) => ["pending", "held", "retry-wait", "blocked-unconfigured"].includes(status);

export function createOperationsStatus(store: WorkerStore, options: OperationsStatusOptions = {}): OperationsStatus {
  const observedAt = options.observedAt ?? new Date();
  const observedMs = observedAt.getTime();
  const saved = store.load();
  const scheduler = store.schedulerStatus(observedAt, saved?.data.scannerSettings.providerDelayMinutesAfterClose ?? 45);
  const jobs = store.listJobs();
  const countsByState = emptyCounts(jobStatuses);
  for (const job of jobs) countsByState[job.status] += 1;
  const actionableJobs = jobs.filter(actionableJob);
  const oldestJob = actionableJobs.sort((a, b) => safeJobDue(a) - safeJobDue(b) || a.id.localeCompare(b.id))[0];
  const runs = store.listIngestionRuns();
  const runsByState = emptyCounts(ingestionRunStatuses);
  for (const run of runs) runsByState[run.status] += 1;
  const items = runs.flatMap(run => store.listIngestionItems(run.id));
  const itemsByState = emptyCounts(ingestionItemStatuses);
  for (const item of items) itemsByState[item.status] += 1;
  const unfinished = items.filter(actionableIngestionItem).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))[0];
  const failureClasses = {
    partial: items.filter(item => item.status === "partial" || item.errorClass === "validation_failed").length + runs.filter(run => run.status === "partial").length,
    missing: items.filter(item => ["missing_symbol", "empty_response"].includes(item.errorClass ?? "") || item.status === "blocked-budget").length,
    rateLimited: items.filter(item => item.errorClass === "rate_limit").length,
    budgetBlocked: items.filter(item => item.status === "blocked-budget").length + runs.filter(run => run.status === "blocked-budget").length,
    rightsBlocked: items.filter(item => item.status === "blocked-rights" || item.errorClass === "rights_blocked").length + runs.filter(run => run.status === "blocked-rights").length,
    providerFailure: items.filter(item => ["provider_outage", "timeout", "malformed_payload", "unknown"].includes(item.errorClass ?? "") || item.status === "failed").length + runs.filter(run => run.status === "failed").length,
    staleOrIncomplete: items.filter(item => ["partial", "retry-wait", "queued", "running"].includes(item.status) || ["stale_data", "insufficient_history"].includes(item.errorClass ?? "")).length,
  };
  const notificationIntents = store.listNotificationIntents();
  const notificationCounts = emptyCounts(notificationStatuses);
  for (const intent of notificationIntents) notificationCounts[intent.status] += 1;
  const actionableNotifications = notificationIntents.filter(intent => actionableNotification(intent.status)).sort((a, b) => a.scheduledAt - b.scheduledAt || a.id.localeCompare(b.id));
  const oldestNotification = actionableNotifications[0];
  const oldestNotificationAt = oldestNotification ? new Date(oldestNotification.scheduledAt).toISOString() : null;
  const integrity = (() => { try { return store.integrityCheck() ? "ok" as const : "failed" as const; } catch { return "unknown" as const; } })();
  const dbBytes = fileBytes(store.path);
  const workspaceBytes = saved ? Buffer.byteLength(serializeExport(saved.data, saved.revision, observedAt)) : null;
  const scanRunsByState = Object.fromEntries([...new Set(saved?.data.scanRuns.map(run => run.status) ?? [])].sort().map(state => [state, saved?.data.scanRuns.filter(run => run.status === state).length ?? 0]));
  const archivesByValidation = Object.fromEntries([...new Set(saved?.data.rawBarArchives.map(archive => archive.validationStatus) ?? [])].sort().map(state => [state, saved?.data.rawBarArchives.filter(archive => archive.validationStatus === state).length ?? 0]));
  const staleOrPartialCoverage = (saved?.data.scanRuns.filter(run => run.status !== "completed").length ?? 0) + (saved?.data.rawBarArchives.filter(archive => archive.validationStatus !== "valid").length ?? 0);
  const source = options.sourceIdentity ?? { commit: process.env.GITHUB_SHA ?? process.env.STOCKLEDGER_SOURCE_COMMIT ?? null, tree: null, state: "unavailable" as const };
  const sourceState = source.state ?? (source.commit ? "known" : "unavailable");
  const reasons = new Set<string>();
  if (!saved) reasons.add("workspace_missing");
  if (integrity === "failed") reasons.add("storage_integrity_failed");
  if (integrity === "unknown") reasons.add("storage_integrity_unknown");
  if (scheduler.state === "blocked") reasons.add("scheduler_blocked");
  if (scheduler.state === "missed") reasons.add("missed_scan_or_catch_up");
  if (scheduler.state === "stopped") reasons.add("scheduler_stopped");
  if (countsByState["retry-wait"] > 0) reasons.add("worker_retry_backlog");
  if (countsByState["terminal-failed"] > 0) reasons.add("terminal_worker_failure");
  if (failureClasses.partial > 0 || failureClasses.providerFailure > 0) reasons.add("provider_or_ingestion_partial_failure");
  if (failureClasses.rightsBlocked > 0) reasons.add("market_data_rights_blocked");
  if (failureClasses.budgetBlocked > 0) reasons.add("ingestion_budget_blocked");
  if (notificationCounts.failed > 0 || notificationCounts.ambiguous > 0 || notificationCounts["blocked-unconfigured"] > 0) reasons.add("notification_delivery_actionable_or_ambiguous");
  if (staleOrPartialCoverage > 0) reasons.add("stale_or_partial_market_coverage");
  const state: OperationsOverallState = !saved
    ? "unconfigured"
    : integrity === "failed" || scheduler.state === "blocked" || countsByState["terminal-failed"] > 0 || failureClasses.rightsBlocked > 0
      ? "blocked"
      : reasons.size > 0
        ? "degraded"
        : integrity === "unknown" || sourceState === "mismatched"
          ? "unknown"
          : "healthy";
  return {
    contractVersion: OPERATIONS_STATUS_CONTRACT_VERSION,
    revision: OPERATIONS_STATUS_CONTRACT_REVISION,
    observedAtUtc: observedAt.toISOString(),
    overall: { state, reasons: [...reasons].sort() },
    scheduler: {
      state: scheduler.state, schedulerInstalled: false, lastInvocationAtUtc: scheduler.lastInvocationAtUtc,
      expectedSession: scheduler.latestExpectedCompletedSession, successfulSession: scheduler.latestSuccessfulSession,
      nextDueAtUtc: scheduler.nextDueAtUtc, deadlineAtUtc: scheduler.deadlineAtUtc,
      deadlineHeadroomMs: scheduler.deadlineAtUtc ? Math.max(0, Date.parse(scheduler.deadlineAtUtc) - observedMs) : null,
      missedSessions: scheduler.missedSessions.length, partialSessions: scheduler.coverage.partialSessions.length,
      blockedSessions: scheduler.coverage.blockedSessions.length, retryingSessions: scheduler.coverage.retryingSessions.length,
      terminalFailedSessions: scheduler.coverage.terminalFailedSessions.length, scheduledSessions: scheduler.coverage.scheduledSessions.length,
      completedSessions: scheduler.coverage.completedSessions.length, jobsByStatus: scheduler.jobsByStatus,
      lastErrorClass: safeErrorClass(scheduler.lastSafeError),
    },
    workerQueues: {
      countsByState, activeCount: actionableJobs.length, retryCount: countsByState["retry-wait"], terminalCount: countsByState["terminal-failed"],
      oldestActionableDueAtUtc: oldestJob ? new Date(safeJobDue(oldestJob)).toISOString() : null,
      oldestActionableAgeMs: oldestJob ? Math.max(0, observedMs - safeJobDue(oldestJob)) : null,
      oldestActionableDelayMs: oldestJob ? delayMs(observedMs, oldestJob.nextRetryAt) : null,
    },
    ingestion: {
      runsByState, itemsByState, failureClasses,
      oldestUnfinishedAtUtc: unfinished?.createdAt ?? null, oldestUnfinishedAgeMs: unfinished ? ageMs(observedMs, unfinished.createdAt) : null,
      requestBudget: { used: runs.reduce((total, run) => total + run.budgetUsed, 0), configured: runs.reduce((total, run) => total + run.requestBudget, 0), state: runs.length ? "known" : "unknown" },
      contractVersion: MARKET_DATA_INGESTION_CONTRACT_VERSION, contractRevision: MARKET_DATA_INGESTION_CONTRACT_REVISION,
      rightsContractVersion: MARKET_DATA_RIGHTS_CONTRACT_VERSION, rightsContractRevision: MARKET_DATA_RIGHTS_CONTRACT_REVISION,
    },
    notificationDelivery: {
      countsByState: notificationCounts, actionableCount: actionableNotifications.length,
      oldestActionableAtUtc: oldestNotificationAt, oldestActionableAgeMs: oldestNotification ? Math.max(0, observedMs - oldestNotification.scheduledAt) : null,
      oldestActionableDelayMs: oldestNotification ? delayMs(observedMs, oldestNotification.nextRetryAt) : null,
      deliveryContractVersion: NOTIFICATION_DELIVERY_CONTRACT_VERSION, deliveryContractRevision: NOTIFICATION_DELIVERY_CONTRACT_REVISION,
      digestContractVersion: NOTIFICATION_DIGEST_CONTRACT_VERSION, digestContractRevision: NOTIFICATION_DIGEST_CONTRACT_REVISION, policyVersion: NOTIFICATION_POLICY_VERSION,
    },
    workspaceStorage: {
      present: Boolean(saved), workspaceRevision: saved?.revision ?? null, exportSchemaVersion: 2,
      workerDatabaseSchemaVersion: store.databaseSchemaVersion(), supportedWorkerDatabaseSchemaVersion: WORKER_DATABASE_SCHEMA_VERSION,
      integrity, consistentBackup: "supported", lastOperatorBackup: "unknown", databaseBytes: dbBytes,
      walBytes: fileBytes(`${store.path}-wal`), shmBytes: fileBytes(`${store.path}-shm`), workspaceBytes,
      marketCoverage: { scanRunsByState, archivesByValidation, staleOrPartial: staleOrPartialCoverage },
    },
    sync: { contractVersion: syncContractVersion, state: "unavailable", reason: "live cloud account and service health are not available in the worker process" },
    releaseIdentity: {
      state: sourceState, appVersion: options.appVersion ?? "unknown", nodeRequirement: options.nodeRequirement ?? ">=22.23.2", nodeRuntime: process.version,
      financialTruthEngineVersion: FINANCIAL_TRUTH_ENGINE_VERSION, financialTruthContractVersion: PRODUCTION_METRIC_CONTRACT_VERSION,
      calendarVersion: CALENDAR_VERSION, workspaceExportSchemaVersion: 2, workerDatabaseSchemaVersion: store.databaseSchemaVersion(),
      workerJobContract: { version: WORKER_JOB_CONTRACT_VERSION, revision: WORKER_JOB_CONTRACT_REVISION },
      notificationContracts: { delivery: NOTIFICATION_DELIVERY_CONTRACT_VERSION, deliveryRevision: NOTIFICATION_DELIVERY_CONTRACT_REVISION, digest: NOTIFICATION_DIGEST_CONTRACT_VERSION, digestRevision: NOTIFICATION_DIGEST_CONTRACT_REVISION, preferences: NOTIFICATION_PREFERENCES_CONTRACT_VERSION },
      ingestionContract: { version: MARKET_DATA_INGESTION_CONTRACT_VERSION, revision: MARKET_DATA_INGESTION_CONTRACT_REVISION },
      rightsContract: { version: MARKET_DATA_RIGHTS_CONTRACT_VERSION, revision: MARKET_DATA_RIGHTS_CONTRACT_REVISION, authorityModelVersion: MARKET_DATA_RIGHTS_AUTHORITY_MODEL_VERSION },
      syncContractVersion: syncContractVersion, sourceCommit: source.commit, sourceTree: source.tree,
    },
    externalDependencies: {
      hostedScheduler: "not-configured", providerQuotaCostRunway: "unavailable", commercialMarketDataProvider: "external-gate",
      billingLifecycle: "not-configured", externalNotificationService: "not-configured", productionCloudBackup: "external-gate", externalIncidentPager: "not-configured",
    },
  };
}

export const operationsJson = (store: WorkerStore, options: OperationsStatusOptions = {}) => JSON.stringify(createOperationsStatus(store, options));
