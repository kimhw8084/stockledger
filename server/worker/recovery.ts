import { copyFileSync, mkdtempSync, rmSync, statSync, truncateSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { contentHash } from "../../src/domain/contentHash";
import { parseExport, serializeExport } from "../../src/domain/backupFormat";
import { buildNotificationIntent } from "../../src/domain/notificationDelivery";
import { seedData } from "../../src/lib/seed";
import type { AppData } from "../../src/types";
import { MARKET_DATA_INGESTION_CONTRACT_REVISION, MARKET_DATA_INGESTION_CONTRACT_VERSION } from "../../src/lib/marketDataContract";
import { jobIdentityFor } from "./contract";
import { WorkerStore, WORKER_DATABASE_SCHEMA_VERSION } from "./store";

export const RECOVERY_DRILL_CONTRACT_VERSION = "stockledger-recovery-drill-v1" as const;
export const RECOVERY_DRILL_REVISION = 1 as const;
export const RECOVERY_RTO_QUALIFICATION_BUDGET_MS = 30_000;

export interface RecoveryDrillResult {
  synthetic: true;
  contractVersion: typeof RECOVERY_DRILL_CONTRACT_VERSION;
  revision: typeof RECOVERY_DRILL_REVISION;
  source: { revision: number; schemaVersion: number; integrity: boolean; sourceUnchangedAfterDrill: boolean };
  restored: { revision: number; schemaVersion: number; integrity: boolean; exportParsed: boolean };
  elapsedMs: number;
  rpo: { committedRevisionLossAtConsistentSnapshot: 0; lossSinceLastOperatorBackup: "unknown-unbounded-without-configured-cadence" };
  rto: { engineeringQualificationBudgetMs: number; withinEngineeringQualificationBudget: boolean; evidenceOnly: true };
  retainedStateChecks: {
    authoredHistory: boolean;
    evaluations: boolean;
    decisions: boolean;
    durableJobs: boolean;
    ingestionState: boolean;
    notificationState: boolean;
    sourceNotMutated: boolean;
  };
  rejectedCandidates: { corrupted: { rejected: boolean; classification: string }; incompatible: { rejected: boolean; classification: string } };
  failureClassification: string[];
}

const authoredFingerprint = (data: AppData) => contentHash({
  stocks: data.stocks, recipes: data.recipes, eyes: data.eyes, decisions: data.decisions, outcomes: data.outcomes, evaluations: data.evaluations ?? [], reviewLogs: data.reviewLogs,
});
const operationalFingerprint = (store: WorkerStore) => contentHash({
  jobs: store.listJobs().map(job => ({ id: job.id, kind: job.kind, scheduledSession: job.scheduledSession, status: job.status, attempts: job.attempts, nextRetryAt: job.nextRetryAt, completedAt: job.completedAt })),
  ingestionRuns: store.listIngestionRuns().map(run => ({ id: run.id, status: run.status, requestBudget: run.requestBudget, budgetUsed: run.budgetUsed })),
  ingestionItems: store.listIngestionRuns().flatMap(run => store.listIngestionItems(run.id).map(item => ({ id: item.id, status: item.status, attempts: item.attempts, errorClass: item.errorClass }))),
  notificationIntents: store.listNotificationIntents().map(intent => ({ id: intent.id, status: intent.status, attemptCount: intent.attemptCount, terminalState: intent.terminalState })),
});

const createFixture = (nowMs: number) => {
  const data = structuredClone(seedData);
  data.workspaceId = "chg96-synthetic-recovery-fixture";
  data.notificationPreferences = {
    ...data.notificationPreferences,
    explicitConsent: true,
    enabled: true,
    allowedChannels: ["email"],
    destinations: { email: { address: "fixture@example.invalid" } },
    updatedAt: new Date(nowMs).toISOString(),
  };
  return data;
};

export async function runRecoveryDrill(): Promise<RecoveryDrillResult> {
  const started = performance.now();
  const directory = mkdtempSync(join(tmpdir(), "stockledger-chg96-recovery-"));
  const sourcePath = join(directory, "source.sqlite");
  const backupPath = join(directory, "consistent-backup.sqlite");
  const restoredPath = join(directory, "restored.sqlite");
  const corruptPath = join(directory, "corrupt.sqlite");
  const incompatiblePath = join(directory, "incompatible.sqlite");
  const nowMs = Date.parse("2026-09-18T16:00:00.000Z");
  const data = createFixture(nowMs);
  const sourceStore = new WorkerStore(sourcePath);
  sourceStore.import(data, 0, nowMs);
  const queued = jobIdentityFor({ kind: "evaluation-scan", scheduledSession: "2026-09-17", workflowKey: "chg96-queued", inputHash: "synthetic-input", dueAtUtc: "2026-09-18T15:00:00.000Z" });
  sourceStore.enqueue(queued, nowMs - 60_000);
  const retry = jobIdentityFor({ kind: "ingestion-readiness", scheduledSession: "2026-09-17", workflowKey: "chg96-retry", inputHash: "synthetic-retry", dueAtUtc: "2026-09-18T15:00:00.000Z" });
  sourceStore.enqueue(retry, nowMs - 60_000);
  const retryToken = sourceStore.claimJob(retry.id, "chg96-recovery", nowMs - 30_000);
  if (!retryToken) throw new Error("Recovery fixture could not claim retry job.");
  sourceStore.failJob(retry.id, retryToken, "synthetic provider timeout", nowMs - 20_000);
  const ingestion = sourceStore.createIngestionRun({
    id: "ingestion-chg96-synthetic", contractVersion: MARKET_DATA_INGESTION_CONTRACT_VERSION, contractRevision: MARKET_DATA_INGESTION_CONTRACT_REVISION,
    providerIdentity: "synthetic", providerProductId: "synthetic-daily-bars", datasetCategory: "daily_ohlcv", requestedStartDate: "2026-09-17", requestedEndDate: "2026-09-17", rightsProfileId: "synthetic-local-user", requestBudget: 3,
  }, ["SYN1", "SYN2", "SYN3"], nowMs - 15_000);
  sourceStore.finishIngestionItem({ runId: ingestion.run.id, symbol: "SYN1", status: "partial", errorClass: "provider_outage", errorMessage: "synthetic provider outage", now: nowMs - 10_000 });
  sourceStore.finishIngestionItem({ runId: ingestion.run.id, symbol: "SYN2", status: "blocked-rights", errorClass: "rights_blocked", errorMessage: "synthetic rights block", now: nowMs - 9_000 });
  sourceStore.updateIngestionRun(ingestion.run.id, { status: "partial", budgetUsed: 2, lastError: "synthetic partial run", now: nowMs - 8_000 });
  const alert = data.alerts[0];
  if (!alert) throw new Error("Recovery fixture requires a representative alert.");
  const notificationJob = jobIdentityFor({ kind: "notification-outbox-intent", scheduledSession: "2026-09-17", workflowKey: "chg96-notification", inputHash: "synthetic-notification", dueAtUtc: "2026-09-18T15:00:00.000Z" });
  sourceStore.enqueue(notificationJob, nowMs - 7_000);
  const notificationToken = sourceStore.claimJob(notificationJob.id, "chg96-recovery", nowMs - 6_000);
  if (!notificationToken) throw new Error("Recovery fixture could not claim notification job.");
  sourceStore.commitJobResult({ id: notificationJob.id, token: notificationToken, data, expectedRevision: sourceStore.load()?.revision ?? 0, status: "completed", notificationIntents: [buildNotificationIntent(alert, data.notificationPreferences, nowMs - 5_000)], now: nowMs - 5_000 });
  const sourceLoaded = sourceStore.load();
  if (!sourceLoaded) throw new Error("Recovery fixture workspace was not persisted.");
  const sourceAuthored = authoredFingerprint(sourceLoaded.data);
  const sourceOperational = operationalFingerprint(sourceStore);
  const sourceIngestionRunCount = sourceStore.listIngestionRuns().length;
  const sourceNotificationCount = sourceStore.listNotificationIntents().length;
  const sourceIntegrity = sourceStore.integrityCheck();
  await sourceStore.backup(backupPath);
  sourceStore.close();
  const sourceAfterBackupStore = new WorkerStore(sourcePath);
  const sourceAfterBackup = sourceAfterBackupStore.load();
  const sourceUnchangedAfterDrill = Boolean(sourceAfterBackup && sourceAfterBackup.revision === sourceLoaded.revision && authoredFingerprint(sourceAfterBackup.data) === sourceAuthored && operationalFingerprint(sourceAfterBackupStore) === sourceOperational && sourceAfterBackupStore.integrityCheck());
  sourceAfterBackupStore.close();
  copyFileSync(backupPath, restoredPath);
  const restoredStore = new WorkerStore(restoredPath);
  const restoredLoaded = restoredStore.load();
  if (!restoredLoaded) throw new Error("Restored workspace could not be opened.");
  const restoredExportParsed = Boolean(parseExport(serializeExport(restoredLoaded.data, restoredLoaded.revision, new Date(nowMs))));
  const restoredIntegrity = restoredStore.integrityCheck();
  const retainedStateChecks = {
    authoredHistory: authoredFingerprint(restoredLoaded.data) === sourceAuthored,
    evaluations: restoredLoaded.data.evaluations?.length === sourceLoaded.data.evaluations?.length,
    decisions: restoredLoaded.data.decisions.length === sourceLoaded.data.decisions.length,
    durableJobs: operationalFingerprint(restoredStore) === sourceOperational,
    ingestionState: restoredStore.listIngestionRuns().length === sourceIngestionRunCount,
    notificationState: restoredStore.listNotificationIntents().length === sourceNotificationCount && restoredStore.listNotificationIntents().every(intent => ["pending", "held", "retry-wait", "blocked-unconfigured"].includes(intent.status)),
    sourceNotMutated: sourceUnchangedAfterDrill,
  };
  restoredStore.close();
  copyFileSync(backupPath, corruptPath);
  truncateSync(corruptPath, Math.max(1, Math.floor(statSync(corruptPath).size / 2)));
  const corrupted = rejectCandidate(corruptPath);
  copyFileSync(backupPath, incompatiblePath);
  const incompatibleDb = new DatabaseSync(incompatiblePath);
  incompatibleDb.exec("PRAGMA user_version=999;");
  incompatibleDb.close();
  const incompatible = rejectCandidate(incompatiblePath);
  const elapsedMs = Math.round(performance.now() - started);
  const checks = Object.values(retainedStateChecks);
  const failureClassification = [
    ...(checks.every(Boolean) ? [] : ["retained_state_mismatch"]),
    ...(corrupted.rejected ? [] : ["corrupt_restore_accepted"]),
    ...(incompatible.rejected ? [] : ["incompatible_restore_accepted"]),
    ...(sourceIntegrity ? [] : ["source_integrity_failed"]),
    ...(restoredIntegrity ? [] : ["restored_integrity_failed"]),
  ];
  const result: RecoveryDrillResult = {
    synthetic: true, contractVersion: RECOVERY_DRILL_CONTRACT_VERSION, revision: RECOVERY_DRILL_REVISION,
    source: { revision: sourceLoaded.revision, schemaVersion: WORKER_DATABASE_SCHEMA_VERSION, integrity: sourceIntegrity, sourceUnchangedAfterDrill: sourceUnchangedAfterDrill },
    restored: { revision: restoredLoaded.revision, schemaVersion: WORKER_DATABASE_SCHEMA_VERSION, integrity: restoredIntegrity, exportParsed: restoredExportParsed },
    elapsedMs,
    rpo: { committedRevisionLossAtConsistentSnapshot: 0, lossSinceLastOperatorBackup: "unknown-unbounded-without-configured-cadence" },
    rto: { engineeringQualificationBudgetMs: RECOVERY_RTO_QUALIFICATION_BUDGET_MS, withinEngineeringQualificationBudget: elapsedMs <= RECOVERY_RTO_QUALIFICATION_BUDGET_MS, evidenceOnly: true },
    retainedStateChecks,
    rejectedCandidates: { corrupted, incompatible },
    failureClassification: failureClassification.length ? failureClassification : ["none"],
  };
  rmSync(directory, { recursive: true, force: true });
  return result;
}

const rejectCandidate = (path: string): { rejected: boolean; classification: string } => {
  try {
    const store = new WorkerStore(path);
    const integrity = store.integrityCheck();
    store.close();
    return integrity ? { rejected: false, classification: "candidate-opened-and-integrity-ok" } : { rejected: true, classification: "corrupt-restore-rejected" };
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "candidate-rejected";
    return { rejected: true, classification: message.includes("unsupported") ? "incompatible-schema-rejected" : "corrupt-restore-rejected" };
  }
}
