import { DatabaseSync, backup } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { validateAppData } from "../../src/domain/appDataSchema";
import { contentHash } from "../../src/domain/contentHash";
import { notificationDigestIdentity, notificationDigestGrouping, notificationEligibility, notificationPreferencesFingerprint, notificationRetryDelayMs, NOTIFICATION_DIGEST_CONTRACT_REVISION, NOTIFICATION_DIGEST_CONTRACT_VERSION, NOTIFICATION_MAX_ATTEMPTS, type NotificationAttemptOutcome, type NotificationDeliveryState, type NotificationDigestGrouping, type NotificationIntentInput } from "../../src/domain/notificationDelivery";
import { normalizeNotificationPreferences } from "../../src/domain/notificationPreferences";
import { latestCompletedTradingDate, marketSessionDueAtUtc, nextUsTradingDate } from "../../src/lib/marketCalendar";
import type { AppData, LastKnownNotificationDeliveryStatus, NotificationPreferences } from "../../src/types";
import type { MarketDataFailureClass, MarketDataDatasetCategory, NormalizedMarketDataItem } from "../../src/lib/marketDataContract";
import {
  jobIdFor,
  retryDelayMs,
  WORKER_DEFAULT_DEADLINE_BUDGET_MS,
  WORKER_DEFAULT_LEASE_MS,
  WORKER_JOB_CONTRACT_REVISION,
  WORKER_JOB_CONTRACT_VERSION,
  WORKER_MAX_ATTEMPTS,
  WORKER_MAX_QUEUED_JOBS,
  type ProductionJobContract,
  type WorkerJobKind,
  type WorkerJobStatus,
} from "./contract";
import { WORKER_DATABASE_SCHEMA_VERSION } from "../../src/operations/releaseContracts";
export { WORKER_DATABASE_SCHEMA_VERSION } from "../../src/operations/releaseContracts";

export interface WorkerJob {
  id: string;
  contractVersion: string;
  contractRevision: number;
  kind: WorkerJobKind;
  scheduledSession: string;
  dueAtUtc: string;
  status: WorkerJobStatus;
  semanticIdempotencyKey: string;
  workflowKey: string;
  inputHash: string;
  leaseOwner: string | null;
  leaseToken: string | null;
  leaseUntil: number;
  attempts: number;
  nextRetryAt: number | null;
  startedAt: string | null;
  completedAt: string | null;
  lastSafeError: string | null;
  outputRef: string | null;
  createdAt: string;
  updatedAt: string;
  reconciliationReplacementJobId: string | null;
  reconciliationReplacementWorkflowKey: string | null;
  reconciliationReplacementInputHash: string | null;
  reconciliationReason: string | null;
  reconciledAt: string | null;
}

export type IngestionRunStatus = "queued" | "running" | "completed" | "partial" | "blocked-rights" | "blocked-budget" | "failed";
export type IngestionItemStatus = "queued" | "running" | "completed" | "partial" | "retry-wait" | "failed" | "blocked-rights" | "blocked-budget";

export interface IngestionRun {
  id: string;
  contractVersion: string;
  contractRevision: number;
  providerIdentity: string;
  providerProductId: string;
  datasetCategory: MarketDataDatasetCategory;
  requestedStartDate: string;
  requestedEndDate: string;
  rightsProfileId: string;
  status: IngestionRunStatus;
  requestBudget: number;
  budgetUsed: number;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
}

export interface IngestionItem {
  id: string;
  runId: string;
  symbol: string;
  status: IngestionItemStatus;
  attempts: number;
  nextRetryAt: number | null;
  contentHash: string | null;
  result: NormalizedMarketDataItem | null;
  errorClass: MarketDataFailureClass | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface IngestionRunInput {
  id: string;
  contractVersion: string;
  contractRevision: number;
  providerIdentity: string;
  providerProductId: string;
  datasetCategory: MarketDataDatasetCategory;
  requestedStartDate: string;
  requestedEndDate: string;
  rightsProfileId: string;
  requestBudget: number;
}

export interface WorkerJobReconciliation {
  sourceJobId: string;
  sourceWorkflowKey: string;
  sourceInputHash: string;
  replacementJobId: string;
  replacementWorkflowKey: string;
  replacementInputHash: string;
  replacementSemanticIdempotencyKey: string;
  reason: string;
  reconciledAt: string;
}

export interface SchedulerStatus {
  contractVersion: typeof WORKER_JOB_CONTRACT_VERSION;
  contractRevision: typeof WORKER_JOB_CONTRACT_REVISION;
  generatedAtUtc: string;
  state: "healthy" | "missed" | "stopped" | "blocked";
  schedulerInstalled: false;
  lastInvocationAtUtc: string | null;
  lastSuccessfulRunAtUtc: string | null;
  latestExpectedCompletedSession: string;
  latestSuccessfulSession: string | null;
  nextDueAtUtc: string | null;
  deadlineAtUtc: string | null;
  deadlineBudgetMs: number;
  missedSessions: string[];
  coverage: {
    scheduledSessions: string[];
    completedSessions: string[];
    partialSessions: string[];
    blockedSessions: string[];
    retryingSessions: string[];
    terminalFailedSessions: string[];
  };
  jobsByStatus: Record<WorkerJobStatus, number>;
  pendingOutboxIntents: number;
  localDependency: {
    mode: "local-first";
    requiresAwakeMachine: true;
    requiresAuthorizedDataPath: true;
    appParticipationRequired: false;
  };
  lastSafeError: string | null;
}

export interface NotificationIntent {
  id: string;
  contractVersion: string;
  contractRevision: number;
  semanticIdempotencyKey: string;
  alertId: string;
  channel: "email";
  policyKey: string;
  privacyMode: "minimal" | "rich";
  deliveryMode: "immediate" | "digest";
  digestBucket: string | null;
  digestTimezone: string;
  destination: string | null;
  status: NotificationDeliveryState;
  scheduledAt: number;
  notBefore: number;
  cancellationReason: string | null;
  leaseOwner: string | null;
  leaseToken: string | null;
  leaseUntil: number;
  attemptCount: number;
  nextRetryAt: number | null;
  providerMessageId: string | null;
  terminalErrorClass: string | null;
  terminalState: Extract<NotificationDeliveryState, "delivered" | "failed" | "canceled" | "ambiguous"> | null;
  accountScope: "device-local" | "account-owned";
  accountId: string | null;
  preferenceUpdatedAt: string;
  preferenceHash: string;
  digestId: string | null;
  claimedPreferenceUpdatedAt: string | null;
  claimedPreferenceHash: string | null;
  cancellationRequested: boolean;
  cancellationRequestedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationAttempt {
  id: string;
  intentId: string;
  attemptNumber: number;
  startedAt: string;
  completedAt: string;
  outcome: NotificationAttemptOutcome;
  errorClass: string | null;
  providerMessageId: string | null;
  requestIdentity: string;
}

export interface NotificationReceipt {
  id: string;
  intentId: string;
  attemptId: string;
  receiptType: "confirmed" | "provider-accepted";
  providerMessageId: string | null;
  recordedAt: string;
}

export type NotificationDigestState = "pending" | "claimed" | "delivered" | "failed" | "retry-wait" | "canceled" | "ambiguous";

export interface NotificationDigest {
  id: string;
  digestKey: string;
  contractVersion: typeof NOTIFICATION_DIGEST_CONTRACT_VERSION;
  contractRevision: typeof NOTIFICATION_DIGEST_CONTRACT_REVISION;
  channel: "email";
  destination: string;
  privacyMode: "minimal" | "rich";
  policyKey: string;
  digestBucket: string;
  digestTimezone: string;
  status: NotificationDigestState;
  leaseOwner: string | null;
  leaseToken: string | null;
  leaseUntil: number;
  attemptCount: number;
  nextRetryAt: number | null;
  providerMessageId: string | null;
  terminalErrorClass: string | null;
  terminalState: Extract<NotificationDigestState, "delivered" | "failed" | "canceled" | "ambiguous"> | null;
  preferenceUpdatedAt: string;
  preferenceHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationDigestMember {
  digestId: string;
  intentId: string;
  memberSemanticKey: string;
  memberOrder: number;
}

export type NotificationPreflight =
  | { kind: "send" }
  | { kind: "canceled"; reason: string }
  | { kind: "replan"; reason: string };

export type NotificationDigestClaim =
  | { kind: "claimed"; digest: NotificationDigest; token: string; memberIds: string[] }
  | { kind: "already-final"; digest: NotificationDigest; memberIds: string[] };

export type NotificationOutcome =
  | { kind: "confirmed"; providerMessageId?: string }
  | { kind: "provider-accepted"; providerMessageId?: string }
  | { kind: "definitive-failure"; errorClass: string }
  | { kind: "ambiguous"; errorClass: string; providerMessageId?: string };

type SchedulerState = {
  lastInvocationAtUtc: string | null;
  lastExpectedSession: string | null;
  lastSuccessfulSession: string | null;
  lastSuccessfulRunAtUtc: string | null;
  lastRunStatus: string | null;
  lastSafeError: string | null;
  nextDueAtUtc: string | null;
  deadlineAtUtc: string | null;
};

export type WorkerJobContractWithId = ProductionJobContract & { id: string };
export type RelatedClaim = { id: string; token: string; status: Extract<WorkerJobStatus, "completed" | "partial" | "blocked"> };

export class WorkerAdmissionError extends Error {
  readonly code = "WORKER_ADMISSION_GUARD" as const;
  constructor(message: string) { super(message); this.name = "WorkerAdmissionError"; }
}

const FINAL_STATUSES = new Set<WorkerJobStatus>(["completed", "partial", "blocked", "terminal-failed", "superseded"]);
const ACTIVE_STATUSES = new Set<WorkerJobStatus>(["queued", "running", "retry-wait"]);
const RECONCILABLE_STATUSES = new Set<WorkerJobStatus>(["queued", "running", "retry-wait"]);
const iso = (value: unknown) => value === null || value === undefined ? null : String(value);
const numberOrNull = (value: unknown) => value === null || value === undefined ? null : Number(value);

export class WorkerStore {
  private db: DatabaseSync;
  readonly path: string;

  constructor(path: string) {
    this.path = path;
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    if (path !== ":memory:") chmodSync(path, 0o600);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
    const version = Number(this.db.prepare("PRAGMA user_version").get()?.user_version ?? 0);
    if (version !== 0 && version !== 1 && version !== 2 && version !== 3 && version !== 4 && version !== 5 && version !== 6 && version !== 7) throw new Error("Unsupported worker database version.");
    this.createSchema();
    if (version === 1) this.migrateV1ToV2();
    if (version === 1 || version === 2) this.migrateV2ToV3();
    if (version <= 3) this.migrateV3ToV4();
    if (version <= 4) this.migrateV4ToV5();
    if (version <= 5) this.migrateV5ToV6();
    if (version <= 6) this.migrateV6ToV7();
    this.createIndexes();
    this.db.exec(`PRAGMA user_version=${WORKER_DATABASE_SCHEMA_VERSION};`);
  }

  close() { this.db.close(); }

  private createSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS recovery (revision INTEGER PRIMARY KEY, payload TEXT NOT NULL, saved_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        contract_version TEXT NOT NULL,
        contract_revision INTEGER NOT NULL,
        kind TEXT NOT NULL,
        scheduled_session TEXT NOT NULL,
        due_at INTEGER NOT NULL,
        status TEXT NOT NULL,
        semantic_key TEXT NOT NULL,
        workflow_key TEXT NOT NULL,
        input_hash TEXT NOT NULL,
        lease_owner TEXT,
        token TEXT,
        lease_until INTEGER NOT NULL DEFAULT 0,
        attempts INTEGER NOT NULL DEFAULT 0,
        next_retry_at INTEGER,
        started_at TEXT,
        completed_at TEXT,
        error TEXT,
        last_safe_error TEXT,
        output_ref TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id), payload TEXT NOT NULL, created_at TEXT NOT NULL, delivered_at TEXT);
      CREATE TABLE IF NOT EXISTS job_reconciliation (
        source_job_id TEXT PRIMARY KEY REFERENCES jobs(id),
        source_workflow_key TEXT NOT NULL,
        source_input_hash TEXT NOT NULL,
        replacement_job_id TEXT NOT NULL REFERENCES jobs(id),
        replacement_workflow_key TEXT NOT NULL,
        replacement_input_hash TEXT NOT NULL,
        replacement_semantic_key TEXT NOT NULL,
        reason TEXT NOT NULL,
        reconciled_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ingestion_runs (
        id TEXT PRIMARY KEY,
        contract_version TEXT NOT NULL,
        contract_revision INTEGER NOT NULL,
        provider_identity TEXT NOT NULL,
        provider_product_id TEXT NOT NULL,
        dataset_category TEXT NOT NULL,
        requested_start_date TEXT NOT NULL,
        requested_end_date TEXT NOT NULL,
        rights_profile_id TEXT NOT NULL,
        status TEXT NOT NULL,
        request_budget INTEGER NOT NULL,
        budget_used INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ingestion_items (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES ingestion_runs(id),
        symbol TEXT NOT NULL,
        status TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        next_retry_at INTEGER,
        content_hash TEXT,
        result_json TEXT,
        error_class TEXT,
        error_message TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(run_id, symbol)
      );
      CREATE TABLE IF NOT EXISTS scheduler_state (
        id INTEGER PRIMARY KEY CHECK(id=1),
        contract_version TEXT NOT NULL,
        contract_revision INTEGER NOT NULL,
        last_invocation_at TEXT,
        last_expected_session TEXT,
        last_successful_session TEXT,
        last_successful_run_at TEXT,
        last_run_status TEXT,
        last_safe_error TEXT,
        next_due_at TEXT,
        deadline_at TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS notification_intents (
        id TEXT PRIMARY KEY,
        contract_version TEXT NOT NULL,
        contract_revision INTEGER NOT NULL,
        semantic_key TEXT NOT NULL,
        alert_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        policy_key TEXT NOT NULL,
        privacy_mode TEXT NOT NULL,
        delivery_mode TEXT NOT NULL DEFAULT 'immediate',
        digest_bucket TEXT,
        digest_timezone TEXT NOT NULL DEFAULT 'UTC',
        destination TEXT,
        status TEXT NOT NULL,
        scheduled_at INTEGER NOT NULL,
        not_before INTEGER NOT NULL,
        cancellation_reason TEXT,
        lease_owner TEXT,
        token TEXT,
        lease_until INTEGER NOT NULL DEFAULT 0,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        next_retry_at INTEGER,
        provider_message_id TEXT,
        terminal_error_class TEXT,
        terminal_state TEXT,
        account_scope TEXT NOT NULL DEFAULT 'device-local',
        account_id TEXT,
        preference_updated_at TEXT NOT NULL,
        preference_hash TEXT NOT NULL DEFAULT '',
        digest_id TEXT,
        claimed_preference_updated_at TEXT,
        claimed_preference_hash TEXT,
        cancellation_requested INTEGER NOT NULL DEFAULT 0,
        cancellation_requested_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS notification_attempts (
        id TEXT PRIMARY KEY,
        intent_id TEXT NOT NULL REFERENCES notification_intents(id),
        attempt_number INTEGER NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        outcome TEXT NOT NULL,
        error_class TEXT,
        provider_message_id TEXT,
        request_identity TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS notification_receipts (
        id TEXT PRIMARY KEY,
        intent_id TEXT NOT NULL REFERENCES notification_intents(id),
        attempt_id TEXT NOT NULL REFERENCES notification_attempts(id),
        receipt_type TEXT NOT NULL,
        provider_message_id TEXT,
        recorded_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS notification_digests (
        id TEXT PRIMARY KEY,
        digest_key TEXT NOT NULL UNIQUE,
        contract_version TEXT NOT NULL,
        contract_revision INTEGER NOT NULL,
        channel TEXT NOT NULL,
        destination TEXT NOT NULL,
        privacy_mode TEXT NOT NULL,
        policy_key TEXT NOT NULL,
        digest_bucket TEXT NOT NULL,
        digest_timezone TEXT NOT NULL,
        status TEXT NOT NULL,
        lease_owner TEXT,
        token TEXT,
        lease_until INTEGER NOT NULL DEFAULT 0,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        next_retry_at INTEGER,
        provider_message_id TEXT,
        terminal_error_class TEXT,
        terminal_state TEXT,
        preference_updated_at TEXT NOT NULL,
        preference_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS notification_digest_members (
        digest_id TEXT NOT NULL REFERENCES notification_digests(id),
        intent_id TEXT NOT NULL REFERENCES notification_intents(id),
        member_semantic_key TEXT NOT NULL,
        member_order INTEGER NOT NULL,
        PRIMARY KEY (digest_id, intent_id),
        UNIQUE (digest_id, member_semantic_key)
      );
    `);
  }

  private createIndexes() {
    this.db.exec("CREATE INDEX IF NOT EXISTS jobs_due_idx ON jobs(status, next_retry_at, due_at); CREATE INDEX IF NOT EXISTS jobs_session_idx ON jobs(scheduled_session, kind); CREATE UNIQUE INDEX IF NOT EXISTS jobs_semantic_key_idx ON jobs(semantic_key); CREATE INDEX IF NOT EXISTS job_reconciliation_replacement_idx ON job_reconciliation(replacement_workflow_key, replacement_job_id); CREATE INDEX IF NOT EXISTS ingestion_items_run_idx ON ingestion_items(run_id, status, next_retry_at); CREATE INDEX IF NOT EXISTS ingestion_runs_status_idx ON ingestion_runs(status, updated_at); CREATE UNIQUE INDEX IF NOT EXISTS notification_semantic_channel_policy_idx ON notification_intents(semantic_key, channel, policy_key); CREATE INDEX IF NOT EXISTS notification_due_idx ON notification_intents(status, not_before, next_retry_at); CREATE INDEX IF NOT EXISTS notification_alert_idx ON notification_intents(alert_id, channel, policy_key); CREATE INDEX IF NOT EXISTS notification_attempt_intent_idx ON notification_attempts(intent_id, attempt_number); CREATE INDEX IF NOT EXISTS notification_receipt_intent_idx ON notification_receipts(intent_id, recorded_at); CREATE INDEX IF NOT EXISTS notification_digest_due_idx ON notification_digests(status, next_retry_at, digest_bucket); CREATE INDEX IF NOT EXISTS notification_digest_member_intent_idx ON notification_digest_members(intent_id, digest_id);");
  }

  private migrateV1ToV2() {
    const columns = new Set((this.db.prepare("PRAGMA table_info(jobs)").all() as Array<{ name: string }>).map(column => column.name));
    const additions: Array<[string, string]> = [
      ["contract_version", `TEXT NOT NULL DEFAULT '${WORKER_JOB_CONTRACT_VERSION}'`],
      ["contract_revision", "INTEGER NOT NULL DEFAULT 1"],
      ["kind", "TEXT NOT NULL DEFAULT 'evaluation-scan'"],
      ["scheduled_session", "TEXT NOT NULL DEFAULT 'legacy'"],
      ["due_at", "INTEGER NOT NULL DEFAULT 0"],
      ["semantic_key", "TEXT"],
      ["workflow_key", "TEXT NOT NULL DEFAULT 'legacy'"],
      ["input_hash", "TEXT"],
      ["lease_owner", "TEXT"],
      ["next_retry_at", "INTEGER"],
      ["started_at", "TEXT"],
      ["last_safe_error", "TEXT"],
      ["output_ref", "TEXT"],
      ["created_at", "TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'"],
      ["updated_at", "TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'"],
    ];
    for (const [name, definition] of additions) if (!columns.has(name)) this.db.exec(`ALTER TABLE jobs ADD COLUMN ${name} ${definition}`);
    this.db.exec(`
      UPDATE jobs SET semantic_key=id WHERE semantic_key IS NULL;
      UPDATE jobs SET input_hash=id WHERE input_hash IS NULL;
      UPDATE jobs SET last_safe_error=error WHERE last_safe_error IS NULL AND error IS NOT NULL;
      UPDATE jobs SET status='retry-wait', next_retry_at=lease_until WHERE status='failed';
    `);
    this.db.exec("CREATE UNIQUE INDEX IF NOT EXISTS jobs_semantic_key_idx ON jobs(semantic_key);");
  }

  private migrateV2ToV3() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS job_reconciliation (
        source_job_id TEXT PRIMARY KEY REFERENCES jobs(id),
        source_workflow_key TEXT NOT NULL,
        source_input_hash TEXT NOT NULL,
        replacement_job_id TEXT NOT NULL REFERENCES jobs(id),
        replacement_workflow_key TEXT NOT NULL,
        replacement_input_hash TEXT NOT NULL,
        replacement_semantic_key TEXT NOT NULL,
        reason TEXT NOT NULL,
        reconciled_at TEXT NOT NULL
      );
    `);
  }

  private migrateV3ToV4() {
    // The delivery tables are additive. Existing workspace, job and outbox rows
    // remain untouched and therefore remain recoverable during upgrade.
    this.db.exec("CREATE TABLE IF NOT EXISTS notification_intents (id TEXT PRIMARY KEY, contract_version TEXT NOT NULL, contract_revision INTEGER NOT NULL, semantic_key TEXT NOT NULL, alert_id TEXT NOT NULL, channel TEXT NOT NULL, policy_key TEXT NOT NULL, privacy_mode TEXT NOT NULL, destination TEXT, status TEXT NOT NULL, scheduled_at INTEGER NOT NULL, not_before INTEGER NOT NULL, cancellation_reason TEXT, lease_owner TEXT, token TEXT, lease_until INTEGER NOT NULL DEFAULT 0, attempt_count INTEGER NOT NULL DEFAULT 0, next_retry_at INTEGER, provider_message_id TEXT, terminal_error_class TEXT, account_scope TEXT NOT NULL DEFAULT 'device-local', account_id TEXT, preference_updated_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS notification_attempts (id TEXT PRIMARY KEY, intent_id TEXT NOT NULL REFERENCES notification_intents(id), attempt_number INTEGER NOT NULL, started_at TEXT NOT NULL, completed_at TEXT NOT NULL, outcome TEXT NOT NULL, error_class TEXT, provider_message_id TEXT, request_identity TEXT NOT NULL); CREATE TABLE IF NOT EXISTS notification_receipts (id TEXT PRIMARY KEY, intent_id TEXT NOT NULL REFERENCES notification_intents(id), attempt_id TEXT NOT NULL REFERENCES notification_attempts(id), receipt_type TEXT NOT NULL, provider_message_id TEXT, recorded_at TEXT NOT NULL);");
  }

  private migrateV4ToV5() {
    const columns = new Set((this.db.prepare("PRAGMA table_info(notification_intents)").all() as Array<{ name: string }>).map(column => column.name));
    if (!columns.has("terminal_state")) this.db.exec("ALTER TABLE notification_intents ADD COLUMN terminal_state TEXT");
  }

  private migrateV5ToV6() {
    const columns = new Set((this.db.prepare("PRAGMA table_info(notification_intents)").all() as Array<{ name: string }>).map(column => column.name));
    const additions: Array<[string, string]> = [
      ["delivery_mode", "TEXT NOT NULL DEFAULT 'immediate'"],
      ["digest_bucket", "TEXT"],
      ["digest_timezone", "TEXT NOT NULL DEFAULT 'UTC'"],
      ["preference_hash", "TEXT NOT NULL DEFAULT ''"],
      ["digest_id", "TEXT"],
      ["claimed_preference_updated_at", "TEXT"],
      ["claimed_preference_hash", "TEXT"],
      ["cancellation_requested", "INTEGER NOT NULL DEFAULT 0"],
      ["cancellation_requested_reason", "TEXT"],
    ];
    for (const [name, definition] of additions) if (!columns.has(name)) this.db.exec(`ALTER TABLE notification_intents ADD COLUMN ${name} ${definition}`);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notification_digests (
        id TEXT PRIMARY KEY, digest_key TEXT NOT NULL UNIQUE, contract_version TEXT NOT NULL, contract_revision INTEGER NOT NULL,
        channel TEXT NOT NULL, destination TEXT NOT NULL, privacy_mode TEXT NOT NULL, policy_key TEXT NOT NULL,
        digest_bucket TEXT NOT NULL, digest_timezone TEXT NOT NULL, status TEXT NOT NULL, lease_owner TEXT, token TEXT,
        lease_until INTEGER NOT NULL DEFAULT 0, attempt_count INTEGER NOT NULL DEFAULT 0, next_retry_at INTEGER,
        provider_message_id TEXT, terminal_error_class TEXT, terminal_state TEXT, preference_updated_at TEXT NOT NULL,
        preference_hash TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS notification_digest_members (
        digest_id TEXT NOT NULL REFERENCES notification_digests(id), intent_id TEXT NOT NULL REFERENCES notification_intents(id),
        member_semantic_key TEXT NOT NULL, member_order INTEGER NOT NULL, PRIMARY KEY (digest_id, intent_id), UNIQUE (digest_id, member_semantic_key)
      );
    `);
  }

  private migrateV6ToV7() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ingestion_runs (
        id TEXT PRIMARY KEY, contract_version TEXT NOT NULL, contract_revision INTEGER NOT NULL,
        provider_identity TEXT NOT NULL, provider_product_id TEXT NOT NULL, dataset_category TEXT NOT NULL,
        requested_start_date TEXT NOT NULL, requested_end_date TEXT NOT NULL, rights_profile_id TEXT NOT NULL,
        status TEXT NOT NULL, request_budget INTEGER NOT NULL, budget_used INTEGER NOT NULL DEFAULT 0,
        last_error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ingestion_items (
        id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES ingestion_runs(id), symbol TEXT NOT NULL,
        status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_retry_at INTEGER, content_hash TEXT,
        result_json TEXT, error_class TEXT, error_message TEXT, completed_at TEXT, created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL, UNIQUE(run_id, symbol)
      );
    `);
  }

  private workerProjectionInside(data: AppData, now: number): LastKnownNotificationDeliveryStatus {
    const preferences = normalizeNotificationPreferences(data.notificationPreferences, new Date(now));
    const row = this.db.prepare("SELECT id,status,attempt_count,terminal_error_class,updated_at FROM notification_intents ORDER BY updated_at DESC,id DESC LIMIT 1").get() as Record<string, unknown> | undefined;
    const confirmed = this.db.prepare("SELECT MAX(recorded_at) AS value FROM notification_receipts WHERE receipt_type='confirmed'").get() as { value?: unknown };
    const accepted = this.db.prepare("SELECT MAX(recorded_at) AS value FROM notification_receipts WHERE receipt_type='provider-accepted'").get() as { value?: unknown };
    const failure = this.db.prepare("SELECT MAX(completed_at) AS value FROM notification_attempts WHERE outcome='definitive-failure'").get() as { value?: unknown };
    const latestFailure = this.db.prepare("SELECT error_class FROM notification_attempts WHERE outcome='definitive-failure' ORDER BY completed_at DESC,id DESC LIMIT 1").get() as { error_class?: unknown } | undefined;
    return {
      contractVersion: "stockledger-notification-status-v1",
      revision: 1,
      generatedAt: new Date(now).toISOString(),
      channel: "email",
      lastIntentId: row ? String(row.id) : null,
      lastState: row ? String(row.status) as LastKnownNotificationDeliveryStatus["lastState"] : null,
      attemptCount: Math.min(5, Number(row?.attempt_count ?? 0)),
      ...(iso(confirmed.value) ? { lastConfirmedAt: String(confirmed.value) } : {}),
      ...(iso(accepted.value) ? { lastProviderAcceptedAt: String(accepted.value) } : {}),
      ...(iso(failure.value) ? { lastFailureAt: String(failure.value) } : {}),
      ...((iso(row?.terminal_error_class) ?? iso(latestFailure?.error_class)) ? { errorClass: String(iso(row?.terminal_error_class) ?? iso(latestFailure?.error_class)).slice(0, 120) } : {}),
      preferenceUpdatedAt: preferences.updatedAt,
      preferenceHash: notificationPreferencesFingerprint(preferences),
    };
  }

  private withWorkerProjectionInside(data: AppData, now: number): AppData {
    return { ...data, lastKnownNotificationDeliveryStatus: this.workerProjectionInside(data, now) };
  }

  private persistWorkerProjectionInside(now: number) {
    const saved = this.load();
    if (saved) this.db.prepare("UPDATE workspace SET payload=? WHERE id=1").run(JSON.stringify(validateAppData(this.withWorkerProjectionInside(saved.data, now))));
  }

  load(): { revision: number; data: AppData } | null {
    const row = this.db.prepare("SELECT revision,payload FROM workspace WHERE id=1").get();
    return row ? { revision: Number(row.revision), data: validateAppData(JSON.parse(String(row.payload))) } : null;
  }

  private transaction<T>(run: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result = run(); this.db.exec("COMMIT"); return result; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }

  private writeInside(data: AppData, expectedRevision: number) {
    const current = this.load();
    if ((current?.revision ?? 0) !== expectedRevision) throw new Error("Workspace revision conflict; export and reconcile before retrying.");
    if (current) this.db.prepare("INSERT OR REPLACE INTO recovery VALUES (?,?,?)").run(current.revision, JSON.stringify(current.data), new Date().toISOString());
    this.db.prepare("INSERT INTO workspace VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload").run(expectedRevision + 1, JSON.stringify(validateAppData(data)));
    this.db.exec("DELETE FROM recovery WHERE revision NOT IN (SELECT revision FROM recovery ORDER BY revision DESC LIMIT 5)");
  }

  import(data: AppData, expectedRevision: number, now = Date.now()) {
    this.transaction(() => {
      const imported = validateAppData(data);
      // Reconcile against the imported policy before replacing the workspace
      // payload. This keeps opt-out fencing and backup replacement atomic.
      this.refreshNotificationPolicyInside(imported, now);
      this.writeInside(this.withWorkerProjectionInside(imported, now), expectedRevision);
    });
  }

  private rowToJob(row: Record<string, unknown>): WorkerJob {
    return {
      id: String(row.id), contractVersion: String(row.contract_version), contractRevision: Number(row.contract_revision ?? 1),
      kind: String(row.kind) as WorkerJobKind, scheduledSession: String(row.scheduled_session), dueAtUtc: new Date(Number(row.due_at)).toISOString(),
      status: String(row.status) as WorkerJobStatus, semanticIdempotencyKey: String(row.semantic_key), workflowKey: String(row.workflow_key), inputHash: String(row.input_hash),
      leaseOwner: iso(row.lease_owner), leaseToken: iso(row.token), leaseUntil: Number(row.lease_until ?? 0), attempts: Number(row.attempts ?? 0),
      nextRetryAt: numberOrNull(row.next_retry_at), startedAt: iso(row.started_at), completedAt: iso(row.completed_at), lastSafeError: iso(row.last_safe_error ?? row.error),
      outputRef: iso(row.output_ref), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
      reconciliationReplacementJobId: iso(row.reconciliation_replacement_job_id),
      reconciliationReplacementWorkflowKey: iso(row.reconciliation_replacement_workflow_key),
      reconciliationReplacementInputHash: iso(row.reconciliation_replacement_input_hash),
      reconciliationReason: iso(row.reconciliation_reason), reconciledAt: iso(row.reconciled_at),
    };
  }

  private rowToNotificationIntent(row: Record<string, unknown>): NotificationIntent {
    return {
      id: String(row.id), contractVersion: String(row.contract_version), contractRevision: Number(row.contract_revision),
      semanticIdempotencyKey: String(row.semantic_key), alertId: String(row.alert_id), channel: String(row.channel) as "email",
      policyKey: String(row.policy_key), privacyMode: String(row.privacy_mode) as "minimal" | "rich", deliveryMode: String(row.delivery_mode ?? "immediate") as "immediate" | "digest",
      digestBucket: iso(row.digest_bucket), digestTimezone: String(row.digest_timezone ?? "UTC"), destination: iso(row.destination),
      status: String(row.status) as NotificationDeliveryState, scheduledAt: Number(row.scheduled_at), notBefore: Number(row.not_before),
      cancellationReason: iso(row.cancellation_reason), leaseOwner: iso(row.lease_owner), leaseToken: iso(row.token), leaseUntil: Number(row.lease_until ?? 0),
      attemptCount: Number(row.attempt_count ?? 0), nextRetryAt: numberOrNull(row.next_retry_at), providerMessageId: iso(row.provider_message_id),
      terminalErrorClass: iso(row.terminal_error_class), terminalState: (iso(row.terminal_state) as NotificationIntent["terminalState"]) ?? null, accountScope: String(row.account_scope) as "device-local" | "account-owned", accountId: iso(row.account_id),
      preferenceUpdatedAt: String(row.preference_updated_at), preferenceHash: String(row.preference_hash ?? ""), digestId: iso(row.digest_id),
      claimedPreferenceUpdatedAt: iso(row.claimed_preference_updated_at), claimedPreferenceHash: iso(row.claimed_preference_hash),
      cancellationRequested: Number(row.cancellation_requested ?? 0) === 1, cancellationRequestedReason: iso(row.cancellation_requested_reason),
      createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    };
  }

  private rowToNotificationDigest(row: Record<string, unknown>): NotificationDigest {
    return {
      id: String(row.id), digestKey: String(row.digest_key), contractVersion: String(row.contract_version) as typeof NOTIFICATION_DIGEST_CONTRACT_VERSION,
      contractRevision: Number(row.contract_revision) as typeof NOTIFICATION_DIGEST_CONTRACT_REVISION, channel: String(row.channel) as "email",
      destination: String(row.destination), privacyMode: String(row.privacy_mode) as "minimal" | "rich", policyKey: String(row.policy_key),
      digestBucket: String(row.digest_bucket), digestTimezone: String(row.digest_timezone), status: String(row.status) as NotificationDigestState,
      leaseOwner: iso(row.lease_owner), leaseToken: iso(row.token), leaseUntil: Number(row.lease_until ?? 0), attemptCount: Number(row.attempt_count ?? 0),
      nextRetryAt: numberOrNull(row.next_retry_at), providerMessageId: iso(row.provider_message_id), terminalErrorClass: iso(row.terminal_error_class),
      terminalState: (iso(row.terminal_state) as NotificationDigest["terminalState"]) ?? null, preferenceUpdatedAt: String(row.preference_updated_at),
      preferenceHash: String(row.preference_hash), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    };
  }

  private rowToNotificationAttempt(row: Record<string, unknown>): NotificationAttempt {
    return {
      id: String(row.id), intentId: String(row.intent_id), attemptNumber: Number(row.attempt_number), startedAt: String(row.started_at), completedAt: String(row.completed_at),
      outcome: String(row.outcome) as NotificationAttemptOutcome, errorClass: iso(row.error_class), providerMessageId: iso(row.provider_message_id), requestIdentity: String(row.request_identity),
    };
  }

  private rowToNotificationReceipt(row: Record<string, unknown>): NotificationReceipt {
    return { id: String(row.id), intentId: String(row.intent_id), attemptId: String(row.attempt_id), receiptType: String(row.receipt_type) as NotificationReceipt["receiptType"], providerMessageId: iso(row.provider_message_id), recordedAt: String(row.recorded_at) };
  }

  private jobSelect() {
    return `SELECT jobs.*, reconciliation.replacement_job_id AS reconciliation_replacement_job_id,
      reconciliation.replacement_workflow_key AS reconciliation_replacement_workflow_key,
      reconciliation.replacement_input_hash AS reconciliation_replacement_input_hash,
      reconciliation.reason AS reconciliation_reason, reconciliation.reconciled_at AS reconciled_at
      FROM jobs LEFT JOIN job_reconciliation AS reconciliation ON reconciliation.source_job_id=jobs.id`;
  }

  private getJobInside(id: string): WorkerJob | null {
    const row = this.db.prepare(`${this.jobSelect()} WHERE jobs.id=?`).get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToJob(row) : null;
  }

  getJob(id: string) { return this.getJobInside(id); }

  listJobs(options: { scheduledSession?: string; kind?: WorkerJobKind } = {}): WorkerJob[] {
    const clauses: string[] = [];
    const values: string[] = [];
    if (options.scheduledSession) { clauses.push("scheduled_session=?"); values.push(options.scheduledSession); }
    if (options.kind) { clauses.push("kind=?"); values.push(options.kind); }
    const query = `${this.jobSelect()}${clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""} ORDER BY due_at, kind, id`;
    return (this.db.prepare(query).all(...values) as Array<Record<string, unknown>>).map(row => this.rowToJob(row));
  }

  listReconciliations(): WorkerJobReconciliation[] {
    return this.db.prepare(`
      SELECT source_job_id AS sourceJobId, source_workflow_key AS sourceWorkflowKey, source_input_hash AS sourceInputHash,
        replacement_job_id AS replacementJobId, replacement_workflow_key AS replacementWorkflowKey,
        replacement_input_hash AS replacementInputHash, replacement_semantic_key AS replacementSemanticIdempotencyKey,
        reason, reconciled_at AS reconciledAt
      FROM job_reconciliation ORDER BY reconciled_at, source_job_id
    `).all() as unknown as WorkerJobReconciliation[];
  }

  private rowToIngestionRun(row: Record<string, unknown>): IngestionRun {
    return {
      id: String(row.id), contractVersion: String(row.contract_version), contractRevision: Number(row.contract_revision),
      providerIdentity: String(row.provider_identity), providerProductId: String(row.provider_product_id), datasetCategory: String(row.dataset_category) as MarketDataDatasetCategory,
      requestedStartDate: String(row.requested_start_date), requestedEndDate: String(row.requested_end_date), rightsProfileId: String(row.rights_profile_id),
      status: String(row.status) as IngestionRunStatus, requestBudget: Number(row.request_budget), budgetUsed: Number(row.budget_used),
      createdAt: String(row.created_at), updatedAt: String(row.updated_at), lastError: iso(row.last_error),
    };
  }

  private rowToIngestionItem(row: Record<string, unknown>): IngestionItem {
    return {
      id: String(row.id), runId: String(row.run_id), symbol: String(row.symbol), status: String(row.status) as IngestionItemStatus,
      attempts: Number(row.attempts), nextRetryAt: numberOrNull(row.next_retry_at), contentHash: iso(row.content_hash),
      result: row.result_json ? JSON.parse(String(row.result_json)) as NormalizedMarketDataItem : null,
      errorClass: iso(row.error_class) as MarketDataFailureClass | null, errorMessage: iso(row.error_message),
      createdAt: String(row.created_at), updatedAt: String(row.updated_at), completedAt: iso(row.completed_at),
    };
  }

  createIngestionRun(input: IngestionRunInput, symbols: string[], now = Date.now()): { run: IngestionRun; items: IngestionItem[] } {
    return this.transaction(() => {
      const timestamp = new Date(now).toISOString();
      this.db.prepare(`
        INSERT OR IGNORE INTO ingestion_runs(
          id,contract_version,contract_revision,provider_identity,provider_product_id,dataset_category,
          requested_start_date,requested_end_date,rights_profile_id,status,request_budget,budget_used,last_error,created_at,updated_at
        ) VALUES(?,?,?,?,?,?,?,?,?,'queued',?,0,NULL,?,?)
      `).run(input.id, input.contractVersion, input.contractRevision, input.providerIdentity, input.providerProductId, input.datasetCategory, input.requestedStartDate, input.requestedEndDate, input.rightsProfileId, input.requestBudget, timestamp, timestamp);
      const itemStatement = this.db.prepare(`
        INSERT OR IGNORE INTO ingestion_items(id,run_id,symbol,status,attempts,next_retry_at,content_hash,result_json,error_class,error_message,completed_at,created_at,updated_at)
        VALUES(?,?,?,'queued',0,NULL,NULL,NULL,NULL,NULL,NULL,?,?)
      `);
      for (const symbol of [...new Set(symbols)]) itemStatement.run(`ingestion-item-${contentHash({ runId: input.id, symbol })}`, input.id, symbol, timestamp, timestamp);
      return { run: this.getIngestionRunInside(input.id)!, items: this.listIngestionItemsInside(input.id) };
    });
  }

  private getIngestionRunInside(id: string): IngestionRun | null {
    const row = this.db.prepare("SELECT * FROM ingestion_runs WHERE id=?").get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToIngestionRun(row) : null;
  }

  getIngestionRun(id: string) { return this.getIngestionRunInside(id); }

  private listIngestionItemsInside(runId: string): IngestionItem[] {
    return (this.db.prepare("SELECT * FROM ingestion_items WHERE run_id=? ORDER BY symbol").all(runId) as Array<Record<string, unknown>>).map(row => this.rowToIngestionItem(row));
  }

  listIngestionItems(runId: string) { return this.listIngestionItemsInside(runId); }

  listIngestionRuns(): IngestionRun[] {
    return (this.db.prepare("SELECT * FROM ingestion_runs ORDER BY created_at,id").all() as Array<Record<string, unknown>>).map(row => this.rowToIngestionRun(row));
  }

  claimIngestionItem(runId: string, symbol: string, now = Date.now(), maxAttempts = 3): IngestionItem | null {
    return this.transaction(() => {
      const row = this.db.prepare("SELECT * FROM ingestion_items WHERE run_id=? AND symbol=?").get(runId, symbol) as Record<string, unknown> | undefined;
      if (!row) return null;
      const item = this.rowToIngestionItem(row);
      if (item.status === "completed" || item.status === "partial" || item.status === "blocked-rights" || item.status === "failed") return item;
      if (item.nextRetryAt !== null && item.nextRetryAt > now) return null;
      if (item.attempts >= maxAttempts) return item;
      const timestamp = new Date(now).toISOString();
      this.db.prepare("UPDATE ingestion_items SET status='running',attempts=attempts+1,next_retry_at=NULL,updated_at=? WHERE run_id=? AND symbol=?").run(timestamp, runId, symbol);
      return this.rowToIngestionItem(this.db.prepare("SELECT * FROM ingestion_items WHERE run_id=? AND symbol=?").get(runId, symbol) as Record<string, unknown>);
    });
  }

  finishIngestionItem(input: {
    runId: string;
    symbol: string;
    status: Extract<IngestionItemStatus, "completed" | "partial" | "retry-wait" | "failed" | "blocked-rights" | "blocked-budget">;
    result?: NormalizedMarketDataItem;
    contentHash?: string;
    errorClass?: MarketDataFailureClass;
    errorMessage?: string;
    nextRetryAt?: number | null;
    now?: number;
  }): IngestionItem {
    return this.transaction(() => {
      const timestamp = new Date(input.now ?? Date.now()).toISOString();
      this.db.prepare(`
        UPDATE ingestion_items SET status=?,next_retry_at=?,content_hash=?,result_json=?,error_class=?,error_message=?,completed_at=?,updated_at=?
        WHERE run_id=? AND symbol=?
      `).run(input.status, input.nextRetryAt ?? null, input.contentHash ?? input.result?.stableContentHash ?? null, input.result ? JSON.stringify(input.result) : null, input.errorClass ?? null, input.errorMessage?.slice(0, 240) ?? null, ["completed", "partial", "failed", "blocked-rights", "blocked-budget"].includes(input.status) ? timestamp : null, timestamp, input.runId, input.symbol);
      const row = this.db.prepare("SELECT * FROM ingestion_items WHERE run_id=? AND symbol=?").get(input.runId, input.symbol) as Record<string, unknown> | undefined;
      if (!row) throw new Error(`Unknown ingestion item ${input.runId}/${input.symbol}.`);
      return this.rowToIngestionItem(row);
    });
  }

  updateIngestionRun(id: string, patch: { status?: IngestionRunStatus; requestBudget?: number; budgetUsed?: number; lastError?: string | null; now?: number }): IngestionRun {
    return this.transaction(() => {
      const current = this.getIngestionRunInside(id);
      if (!current) throw new Error(`Unknown ingestion run ${id}.`);
      const timestamp = new Date(patch.now ?? Date.now()).toISOString();
      this.db.prepare("UPDATE ingestion_runs SET status=?,request_budget=?,budget_used=?,last_error=?,updated_at=? WHERE id=?").run(patch.status ?? current.status, patch.requestBudget ?? current.requestBudget, patch.budgetUsed ?? current.budgetUsed, patch.lastError === undefined ? current.lastError : patch.lastError, timestamp, id);
      return this.getIngestionRunInside(id)!;
    });
  }

  private insertJobInside(job: WorkerJobContractWithId, now: number) {
    const timestamp = new Date(now).toISOString();
    this.db.prepare(`
      INSERT OR IGNORE INTO jobs(
        id,contract_version,contract_revision,kind,scheduled_session,due_at,status,semantic_key,workflow_key,input_hash,
        lease_owner,token,lease_until,attempts,next_retry_at,started_at,completed_at,error,last_safe_error,output_ref,created_at,updated_at
      ) VALUES(?,?,?,?,?,?,'queued',?,?,?,NULL,NULL,0,0,NULL,NULL,NULL,NULL,NULL,NULL,?,?)
    `).run(
      job.id, job.contractVersion, job.revision, job.kind, job.scheduledSession, Date.parse(job.dueAtUtc), job.semanticIdempotencyKey,
      job.workflowKey, job.inputHash, timestamp, timestamp,
    );
  }

  enqueue(job: WorkerJobContractWithId, now = Date.now()): WorkerJob {
    return this.transaction(() => {
      const existing = this.getJobInside(job.id);
      if (existing) return existing;
      const active = (this.db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE status IN ('queued','running','retry-wait')").get() as { count: number }).count;
      if (Number(active) >= WORKER_MAX_QUEUED_JOBS) throw new WorkerAdmissionError(`Queued work exceeds the ${WORKER_MAX_QUEUED_JOBS}-job admission guard; no jobs were discarded.`);
      this.insertJobInside(job, now);
      return this.getJobInside(job.id)!;
    });
  }

  enqueueMany(jobs: WorkerJobContractWithId[], now = Date.now()): WorkerJob[] {
    return this.transaction(() => {
      const unique = [...new Map(jobs.map(job => [job.id, job])).values()];
      const newCount = unique.filter(job => !this.getJobInside(job.id)).length;
      const active = (this.db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE status IN ('queued','running','retry-wait')").get() as { count: number }).count;
      if (Number(active) + newCount > WORKER_MAX_QUEUED_JOBS) throw new WorkerAdmissionError(`Queued work would exceed the ${WORKER_MAX_QUEUED_JOBS}-job admission guard; no jobs were discarded.`);
      for (const job of unique) this.insertJobInside(job, now);
      return unique.map(job => this.getJobInside(job.id)!);
    });
  }

  reconcileAndEnqueue(jobs: WorkerJobContractWithId[], now = Date.now()): { jobs: WorkerJob[]; deferredSessions: string[] } {
    return this.transaction(() => {
      const unique = [...new Map(jobs.map(job => [job.id, job])).values()];
      const currentWorkflows = new Map<string, { workflowKey: string; jobsByKind: Map<WorkerJobKind, WorkerJobContractWithId> }>();
      for (const job of unique) {
        const current = currentWorkflows.get(job.scheduledSession) ?? { workflowKey: job.workflowKey, jobsByKind: new Map() };
        current.jobsByKind.set(job.kind, job);
        currentWorkflows.set(job.scheduledSession, current);
      }

      // Insert replacement rows in this transaction before linking them. The admission
      // check happens after supersession so reconciled work does not consume capacity.
      for (const job of unique) this.insertJobInside(job, now);

      const deferredSessions = new Set<string>();
      for (const current of currentWorkflows.entries()) {
        const [session, workflow] = current;
        const replaced = this.db.prepare(`
          SELECT 1 FROM job_reconciliation AS reconciliation
          JOIN jobs AS source ON source.id=reconciliation.source_job_id
          WHERE source.scheduled_session=? AND reconciliation.source_workflow_key=?
            AND reconciliation.replacement_workflow_key<>?
          LIMIT 1
        `).get(session, workflow.workflowKey, workflow.workflowKey);
        if (replaced) deferredSessions.add(session);
      }
      const persisted = this.listJobs().filter(job => job.scheduledSession !== "legacy");
      for (const source of persisted) {
        const current = currentWorkflows.get(source.scheduledSession);
        if (!current || deferredSessions.has(source.scheduledSession) || source.workflowKey === current.workflowKey) continue;
        const replacement = current.jobsByKind.get(source.kind);
        if (!replacement) continue;

        const replacementJob = this.getJobInside(replacement.id)!;
        const timestamp = new Date(now).toISOString();
        const reason = source.status === "running" && source.leaseUntil > now
          ? `active-input-drift: ${source.inputHash} was replaced by ${replacement.inputHash}; unexpired lease preserved and corrected workflow deferred.`
          : `active-input-drift: ${source.inputHash} was replaced by ${replacement.inputHash}; exact replay input is not durably available, so this workflow was reconciled to the replacement.`;
        if (!source.reconciledAt) {
          this.db.prepare(`
            INSERT INTO job_reconciliation(
              source_job_id,source_workflow_key,source_input_hash,replacement_job_id,replacement_workflow_key,
              replacement_input_hash,replacement_semantic_key,reason,reconciled_at
            ) VALUES(?,?,?,?,?,?,?,?,?)
          `).run(
            source.id, source.workflowKey, source.inputHash, replacementJob.id, replacementJob.workflowKey,
            replacementJob.inputHash, replacementJob.semanticIdempotencyKey, reason, timestamp,
          );
        }

        if (!RECONCILABLE_STATUSES.has(source.status)) continue;
        if (source.status === "running" && source.leaseUntil > now) {
          deferredSessions.add(source.scheduledSession);
          continue;
        }
        this.db.prepare(`
          UPDATE jobs SET status='superseded',completed_at=?,lease_owner=NULL,token=NULL,updated_at=?
          WHERE id=? AND status IN ('queued','running','retry-wait')
        `).run(timestamp, timestamp, source.id);
      }

      const active = (this.db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE status IN ('queued','running','retry-wait')").get() as { count: number }).count;
      if (Number(active) > WORKER_MAX_QUEUED_JOBS) throw new WorkerAdmissionError(`Queued work would exceed the ${WORKER_MAX_QUEUED_JOBS}-job admission guard; no jobs were discarded.`);
      return { jobs: unique.map(job => this.getJobInside(job.id)!), deferredSessions: [...deferredSessions].sort() };
    });
  }

  private ensureLegacyJob(id: string, now: number) {
    if (this.getJobInside(id)) return;
    const job = {
      id, contractVersion: WORKER_JOB_CONTRACT_VERSION, revision: WORKER_JOB_CONTRACT_REVISION, kind: "evaluation-scan" as const,
      scheduledSession: "legacy", dueAtUtc: new Date(now).toISOString(), semanticIdempotencyKey: `${WORKER_JOB_CONTRACT_VERSION}:legacy:${id}`,
      workflowKey: id, inputHash: id,
    };
    this.insertJobInside(job, now);
  }

  private claimJobInside(id: string, owner: string, now: number, leaseMs: number) {
    const job = this.getJobInside(id);
    if (!job) return null;
    if (FINAL_STATUSES.has(job.status) || (job.status === "running" && job.leaseUntil > now) || (job.status === "retry-wait" && (job.nextRetryAt ?? 0) > now)) return null;
    if (job.attempts >= WORKER_MAX_ATTEMPTS) {
      this.db.prepare("UPDATE jobs SET status='terminal-failed',completed_at=?,lease_until=0,updated_at=? WHERE id=?").run(new Date(now).toISOString(), new Date(now).toISOString(), id);
      return null;
    }
    const token = randomUUID();
    const timestamp = new Date(now).toISOString();
    this.db.prepare(`UPDATE jobs SET status='running',lease_owner=?,token=?,lease_until=?,attempts=attempts+1,next_retry_at=NULL,started_at=COALESCE(started_at,?),updated_at=?,error=NULL,last_safe_error=NULL WHERE id=?`).run(owner, token, now + leaseMs, timestamp, timestamp, id);
    return token;
  }

  claimJob(id: string, owner: string, now = Date.now(), leaseMs = WORKER_DEFAULT_LEASE_MS): string | null {
    return this.transaction(() => this.claimJobInside(id, owner, now, leaseMs));
  }

  claim(id: string, now = Date.now(), leaseMs = WORKER_DEFAULT_LEASE_MS): string | null {
    return this.transaction(() => { this.ensureLegacyJob(id, now); return this.claimJobInside(id, "legacy-worker", now, leaseMs); });
  }

  renewLease(id: string, token: string, now = Date.now(), leaseMs = WORKER_DEFAULT_LEASE_MS) {
    return this.transaction(() => {
      const job = this.getJobInside(id);
      if (!job || job.status !== "running" || job.leaseToken !== token || job.leaseUntil < now) return false;
      this.db.prepare("UPDATE jobs SET lease_until=?,updated_at=? WHERE id=? AND token=? AND status='running'").run(now + leaseMs, new Date(now).toISOString(), id, token);
      return true;
    });
  }

  private assertLeaseInside(id: string, token: string, now: number) {
    const job = this.getJobInside(id);
    if (!job || job.leaseToken !== token || job.status !== "running" || job.leaseUntil < now) throw new Error("Worker lease expired or replaced.");
    return job;
  }

  finishJob(id: string, token: string, status: Extract<WorkerJobStatus, "completed" | "partial" | "blocked">, now = Date.now(), outputRef?: string) {
    this.transaction(() => {
      this.assertLeaseInside(id, token, now);
      const timestamp = new Date(now).toISOString();
      this.db.prepare("UPDATE jobs SET status=?,completed_at=?,lease_owner=NULL,token=NULL,lease_until=0,next_retry_at=NULL,output_ref=?,updated_at=? WHERE id=? AND token=?").run(status, timestamp, outputRef ?? null, timestamp, id, token);
    });
  }

  commitJobResult(input: {
    id: string;
    token: string;
    data: AppData;
    expectedRevision: number;
    status?: Extract<WorkerJobStatus, "completed" | "partial" | "blocked">;
    relatedClaims?: RelatedClaim[];
    outbox?: { id: string; jobId?: string; payload: unknown };
    notificationIntents?: NotificationIntentInput[];
    accountInvalidated?: boolean;
    now?: number;
  }) {
    const now = input.now ?? Date.now();
    this.transaction(() => {
      this.assertLeaseInside(input.id, input.token, now);
      for (const related of input.relatedClaims ?? []) this.assertLeaseInside(related.id, related.token, now);
      this.refreshNotificationPolicyInside(input.data, now, input.accountInvalidated ?? false);
      for (const intent of input.notificationIntents ?? []) this.insertNotificationIntentInside(intent);
      this.writeInside(this.withWorkerProjectionInside(input.data, now), input.expectedRevision);
      const timestamp = new Date(now).toISOString();
      const status = input.status ?? "completed";
      this.db.prepare("UPDATE jobs SET status=?,completed_at=?,lease_owner=NULL,token=NULL,lease_until=0,next_retry_at=NULL,updated_at=? WHERE id=? AND token=?").run(status, timestamp, timestamp, input.id, input.token);
      for (const related of input.relatedClaims ?? []) this.db.prepare("UPDATE jobs SET status=?,completed_at=?,lease_owner=NULL,token=NULL,lease_until=0,next_retry_at=NULL,updated_at=? WHERE id=? AND token=?").run(related.status, timestamp, timestamp, related.id, related.token);
      if (input.outbox) this.db.prepare("INSERT OR IGNORE INTO outbox(id,job_id,payload,created_at) VALUES(?,?,?,?)").run(input.outbox.id, input.outbox.jobId ?? input.id, JSON.stringify(input.outbox.payload), timestamp);
    });
  }

  complete(id: string, token: string, data: AppData, expectedRevision: number, now = Date.now()) {
    this.commitJobResult({
      id,
      token,
      data,
      expectedRevision,
      now,
      outbox: {
        id: `summary-${id}`,
        payload: {
          type: "scan.completed",
          semanticIdempotencyKey: `legacy:${id}`,
          scanRunId: data.scanRuns[0]?.id,
          newAlerts: data.alerts.filter(alert => !alert.reviewed).length,
        },
      },
    });
  }

  failJob(id: string, token: string, message: string, now = Date.now()) {
    this.transaction(() => {
      const job = this.getJobInside(id);
      if (!job || job.status !== "running" || job.leaseToken !== token || job.leaseUntil < now) return;
      const terminal = job.attempts >= WORKER_MAX_ATTEMPTS;
      const timestamp = new Date(now).toISOString();
      this.db.prepare("UPDATE jobs SET status=?,error=?,last_safe_error=?,lease_owner=NULL,token=NULL,lease_until=0,next_retry_at=?,completed_at=?,updated_at=? WHERE id=? AND token=?").run(
        terminal ? "terminal-failed" : "retry-wait", message.slice(0, 1000), message.slice(0, 1000), terminal ? null : now + retryDelayMs(job.attempts), terminal ? timestamp : null, timestamp, id, token,
      );
    });
  }

  fail(id: string, token: string, message: string, now = Date.now()) { this.failJob(id, token, message, now); }

  pendingOutbox() { return this.db.prepare("SELECT id,payload FROM outbox WHERE delivered_at IS NULL ORDER BY created_at,id").all() as Array<{ id: string; payload: string }>; }
  acknowledge(id: string) { this.db.prepare("UPDATE outbox SET delivered_at=? WHERE id=?").run(new Date().toISOString(), id); }

  private insertNotificationIntentInside(intent: NotificationIntentInput) {
    this.db.prepare(`
      INSERT OR IGNORE INTO notification_intents(
        id,contract_version,contract_revision,semantic_key,alert_id,channel,policy_key,privacy_mode,destination,status,
        scheduled_at,not_before,cancellation_reason,lease_owner,token,lease_until,attempt_count,next_retry_at,provider_message_id,
        terminal_error_class,terminal_state,account_scope,account_id,preference_updated_at,preference_hash,digest_id,claimed_preference_updated_at,claimed_preference_hash,cancellation_requested,cancellation_requested_reason,created_at,updated_at,
        delivery_mode,digest_bucket,digest_timezone
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      intent.id, intent.contractVersion, intent.contractRevision, intent.semanticIdempotencyKey, intent.alertId, intent.channel, intent.policyKey,
      intent.privacyMode, intent.destination, intent.status, intent.scheduledAt, intent.notBefore, intent.cancellationReason,
      null, null, 0, 0, null, null, null, null, intent.accountScope, intent.accountId, intent.preferenceUpdatedAt, intent.preferenceHash,
      null, null, null, 0, null, intent.createdAt, intent.updatedAt,
      intent.deliveryMode, intent.digestBucket, intent.digestTimezone,
    );
  }

  private notificationIntentInside(id: string) {
    const row = this.db.prepare("SELECT * FROM notification_intents WHERE id=?").get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToNotificationIntent(row) : null;
  }

  getNotificationIntent(id: string) { return this.notificationIntentInside(id); }

  listNotificationIntents(options: { status?: NotificationDeliveryState; alertId?: string } = {}): NotificationIntent[] {
    const clauses: string[] = [];
    const values: string[] = [];
    if (options.status) { clauses.push("status=?"); values.push(options.status); }
    if (options.alertId) { clauses.push("alert_id=?"); values.push(options.alertId); }
    const rows = this.db.prepare(`SELECT * FROM notification_intents${clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""} ORDER BY scheduled_at,id`).all(...values) as Array<Record<string, unknown>>;
    return rows.map(row => this.rowToNotificationIntent(row));
  }

  listNotificationDigests(options: { status?: NotificationDigestState } = {}): NotificationDigest[] {
    const rows = this.db.prepare(`SELECT * FROM notification_digests${options.status ? " WHERE status=?" : ""} ORDER BY digest_bucket,id`).all(...(options.status ? [options.status] : [])) as Array<Record<string, unknown>>;
    return rows.map(row => this.rowToNotificationDigest(row));
  }

  getNotificationDigest(id: string) {
    const row = this.db.prepare("SELECT * FROM notification_digests WHERE id=?").get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToNotificationDigest(row) : null;
  }

  listNotificationDigestMembers(digestId: string): NotificationDigestMember[] {
    return this.db.prepare("SELECT digest_id AS digestId,intent_id AS intentId,member_semantic_key AS memberSemanticKey,member_order AS memberOrder FROM notification_digest_members WHERE digest_id=? ORDER BY member_order").all(digestId) as unknown as NotificationDigestMember[];
  }

  listNotificationAttempts(intentId?: string): NotificationAttempt[] {
    const rows = this.db.prepare(`SELECT * FROM notification_attempts${intentId ? " WHERE intent_id=?" : ""} ORDER BY started_at,id`).all(...(intentId ? [intentId] : [])) as Array<Record<string, unknown>>;
    return rows.map(row => this.rowToNotificationAttempt(row));
  }

  listNotificationReceipts(intentId?: string): NotificationReceipt[] {
    const rows = this.db.prepare(`SELECT * FROM notification_receipts${intentId ? " WHERE intent_id=?" : ""} ORDER BY recorded_at,id`).all(...(intentId ? [intentId] : [])) as Array<Record<string, unknown>>;
    return rows.map(row => this.rowToNotificationReceipt(row));
  }

  private refreshNotificationPolicyInside(data: AppData, now: number, accountInvalidated = false) {
    const preferences = normalizeNotificationPreferences(data.notificationPreferences, new Date(now));
    const preferenceHash = notificationPreferencesFingerprint(preferences);
    const alerts = new Map(data.alerts.map(alert => [alert.id, alert]));
    const intents = this.listNotificationIntents();
    for (const intent of intents) {
      if (!["pending", "held", "retry-wait", "blocked-unconfigured", "claimed"].includes(intent.status)) continue;
      const alert = alerts.get(intent.alertId);
      if (!alert) {
        if (intent.status === "claimed") this.db.prepare("UPDATE notification_intents SET cancellation_requested=1,cancellation_requested_reason=?,updated_at=? WHERE id=? AND status='claimed'").run("alert-not-found", new Date(now).toISOString(), intent.id);
        else this.db.prepare("UPDATE notification_intents SET status='canceled',terminal_state='canceled',cancellation_reason=?,lease_owner=NULL,token=NULL,lease_until=0,next_retry_at=NULL,updated_at=? WHERE id=?").run("alert-not-found", new Date(now).toISOString(), intent.id);
        continue;
      }
      const eligibility = notificationEligibility(alert, preferences, now, intent.channel, accountInvalidated && intent.accountScope === "account-owned");
      const policyChanged = intent.preferenceHash !== preferenceHash || intent.preferenceUpdatedAt !== preferences.updatedAt;
      if (intent.status === "claimed") {
        if (intent.cancellationRequested || eligibility.status === "canceled") {
          this.db.prepare("UPDATE notification_intents SET cancellation_requested=1,cancellation_requested_reason=?,updated_at=? WHERE id=? AND status='claimed'").run(
            intent.cancellationRequestedReason ?? (eligibility.status === "canceled" ? eligibility.cancellationReason : "preference-changed-before-submit"), new Date(now).toISOString(), intent.id,
          );
        }
        continue;
      }
      const nextStatus = eligibility.status === "canceled"
        ? "canceled"
        : intent.status === "retry-wait" && (intent.nextRetryAt ?? 0) > now
          ? "retry-wait"
          : eligibility.status;
      this.db.prepare("UPDATE notification_intents SET destination=?,privacy_mode=?,delivery_mode=?,digest_bucket=?,digest_timezone=?,status=?,terminal_state=?,not_before=?,cancellation_reason=?,preference_updated_at=?,preference_hash=?,digest_id=CASE WHEN ? THEN NULL ELSE digest_id END,cancellation_requested=0,cancellation_requested_reason=NULL,updated_at=? WHERE id=?").run(
        eligibility.destination, preferences.privacyMode, preferences.deliveryMode, preferences.deliveryMode === "digest" ? new Date(eligibility.notBefore).toISOString() : null, preferences.timezone,
        nextStatus, eligibility.status === "canceled" ? "canceled" : null, eligibility.notBefore, eligibility.cancellationReason,
        preferences.updatedAt, preferenceHash, policyChanged ? 1 : 0, new Date(now).toISOString(), intent.id,
      );
    }
  }

  syncNotificationPolicy(data: AppData, now = Date.now(), accountInvalidated = false) {
    this.transaction(() => { this.refreshNotificationPolicyInside(data, now, accountInvalidated); this.persistWorkerProjectionInside(now); });
  }

  commitNotificationPreferences(preferences: NotificationPreferences, expectedRevision: number, now = Date.now(), accountInvalidated = false) {
    return this.transaction(() => {
      const saved = this.load();
      if (!saved) throw new Error("Import a StockLedger backup before changing notification preferences.");
      const next = { ...saved.data, notificationPreferences: normalizeNotificationPreferences(preferences, new Date(now)) };
      this.refreshNotificationPolicyInside(next, now, accountInvalidated);
      const projected = this.withWorkerProjectionInside(next, now);
      this.writeInside(projected, expectedRevision);
      return { revision: expectedRevision + 1, data: projected };
    });
  }

  private assertNotificationLeaseInside(id: string, token: string, now: number) {
    const intent = this.notificationIntentInside(id);
    if (!intent || intent.status !== "claimed" || intent.leaseToken !== token || intent.leaseUntil < now) throw new Error("Notification lease expired or replaced.");
    return intent;
  }

  private claimNotificationIntentInside(id: string, owner: string, now: number, leaseMs: number) {
    const intent = this.notificationIntentInside(id);
    if (!intent) return null;
    if (intent.status === "claimed" && intent.leaseUntil <= now) {
      const timestamp = new Date(now).toISOString();
      const attemptId = `${intent.id}-attempt-${intent.attemptCount}`;
      this.db.prepare("INSERT OR IGNORE INTO notification_attempts(id,intent_id,attempt_number,started_at,completed_at,outcome,error_class,provider_message_id,request_identity) VALUES(?,?,?,?,?,?,?,?,?)").run(
        attemptId, intent.id, intent.attemptCount, timestamp, timestamp, "ambiguous", "lease-expired-unknown-delivery", null, intent.semanticIdempotencyKey,
      );
      this.db.prepare("UPDATE notification_intents SET status='ambiguous',terminal_state='ambiguous',terminal_error_class='lease-expired-unknown-delivery',lease_owner=NULL,token=NULL,lease_until=0,updated_at=? WHERE id=? AND status='claimed' AND lease_until<=?").run(new Date(now).toISOString(), id, now);
      return null;
    }
    if (!["pending", "held", "retry-wait", "blocked-unconfigured"].includes(intent.status)) return null;
    const saved = this.load();
    if (saved) this.refreshNotificationPolicyInside(saved.data, now);
    const current = this.notificationIntentInside(id);
    if (!current || !["pending", "held", "retry-wait", "blocked-unconfigured"].includes(current.status)) return null;
    if (current.status === "held" && current.notBefore > now) return null;
    if (current.status === "retry-wait" && (current.nextRetryAt ?? 0) > now) return null;
    if (current.status === "blocked-unconfigured" && !current.destination) return null;
    const preferences = saved ? normalizeNotificationPreferences(saved.data.notificationPreferences, new Date(now)) : null;
    if (!preferences) return null;
    const preferenceHash = notificationPreferencesFingerprint(preferences);
    const token = randomUUID();
    const timestamp = new Date(now).toISOString();
    this.db.prepare("UPDATE notification_intents SET status='claimed',lease_owner=?,token=?,lease_until=?,attempt_count=attempt_count+1,next_retry_at=NULL,claimed_preference_updated_at=?,claimed_preference_hash=?,cancellation_requested=0,cancellation_requested_reason=NULL,updated_at=? WHERE id=? AND status IN ('pending','held','retry-wait','blocked-unconfigured')").run(owner, token, now + leaseMs, preferences.updatedAt, preferenceHash, timestamp, id);
    return token;
  }

  claimNotificationIntent(id: string, owner: string, now = Date.now(), leaseMs = WORKER_DEFAULT_LEASE_MS) {
    return this.transaction(() => this.claimNotificationIntentInside(id, owner, now, leaseMs));
  }

  renewNotificationLease(id: string, token: string, now = Date.now(), leaseMs = WORKER_DEFAULT_LEASE_MS) {
    return this.transaction(() => {
      const intent = this.notificationIntentInside(id);
      if (!intent || intent.status !== "claimed" || intent.leaseToken !== token || intent.leaseUntil < now) return false;
      this.db.prepare("UPDATE notification_intents SET lease_until=?,updated_at=? WHERE id=? AND token=? AND status='claimed'").run(now + leaseMs, new Date(now).toISOString(), id, token);
      return true;
    });
  }

  private digestMatches(intent: NotificationIntent, grouping: NotificationDigestGrouping) {
    const current = notificationDigestGrouping(intent);
    return Boolean(current && JSON.stringify(current) === JSON.stringify(grouping));
  }

  private claimNotificationDigestInside(grouping: NotificationDigestGrouping, owner: string, now: number, leaseMs: number): NotificationDigestClaim | null {
    const timestamp = new Date(now).toISOString();
    const due = this.listNotificationIntents().filter(intent =>
      intent.deliveryMode === "digest"
      && ["pending", "held", "retry-wait", "blocked-unconfigured"].includes(intent.status)
      && intent.notBefore <= now
      && (intent.nextRetryAt ?? 0) <= now
      && !intent.cancellationRequested
      && this.digestMatches(intent, grouping),
    );
    if (!due.length) return null;
    const identity = notificationDigestIdentity(grouping, due.map(intent => intent.semanticIdempotencyKey));
    const existingRow = this.db.prepare("SELECT * FROM notification_digests WHERE digest_key=?").get(identity.digestKey) as Record<string, unknown> | undefined;
    let digest: NotificationDigest;
    let memberIds: string[];
    if (existingRow) {
      digest = this.rowToNotificationDigest(existingRow);
      memberIds = this.listNotificationDigestMembers(digest.id).map(member => member.intentId);
      if (["delivered", "ambiguous", "failed", "canceled"].includes(digest.status)) return { kind: "already-final", digest, memberIds };
      if (digest.status === "claimed") {
        if (digest.leaseUntil > now) return null;
        this.expireNotificationDigestInside(digest, now);
        return null;
      }
      if (digest.status === "retry-wait" && (digest.nextRetryAt ?? 0) > now) return null;
    } else {
      const preference = this.load()?.data.notificationPreferences;
      if (!preference) return null;
      const normalized = normalizeNotificationPreferences(preference, new Date(now));
      this.db.prepare(`INSERT INTO notification_digests(
        id,digest_key,contract_version,contract_revision,channel,destination,privacy_mode,policy_key,digest_bucket,digest_timezone,status,
        lease_owner,token,lease_until,attempt_count,next_retry_at,provider_message_id,terminal_error_class,terminal_state,preference_updated_at,preference_hash,created_at,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,'pending',NULL,NULL,0,0,NULL,NULL,NULL,NULL,?,?,?,?)`).run(
        identity.id, identity.digestKey, NOTIFICATION_DIGEST_CONTRACT_VERSION, NOTIFICATION_DIGEST_CONTRACT_REVISION,
        grouping.channel, grouping.destination, grouping.privacyMode, grouping.policyKey, grouping.digestBucket, grouping.digestTimezone,
        normalized.updatedAt, notificationPreferencesFingerprint(normalized), timestamp, timestamp,
      );
      for (const [index, intent] of due.map(intent => intent).sort((left, right) => left.semanticIdempotencyKey.localeCompare(right.semanticIdempotencyKey)).entries()) {
        this.db.prepare("INSERT INTO notification_digest_members(digest_id,intent_id,member_semantic_key,member_order) VALUES(?,?,?,?)").run(identity.id, intent.id, intent.semanticIdempotencyKey, index);
      }
      digest = this.rowToNotificationDigest(this.db.prepare("SELECT * FROM notification_digests WHERE id=?").get(identity.id) as Record<string, unknown>);
      memberIds = due.map(intent => intent.id).sort((left, right) => left.localeCompare(right));
    }
    const memberIntents = memberIds.map(id => this.notificationIntentInside(id)).filter((intent): intent is NotificationIntent => Boolean(intent));
    const claimable = memberIntents.filter(intent => ["pending", "held", "retry-wait", "blocked-unconfigured"].includes(intent.status) && intent.notBefore <= now && (intent.nextRetryAt ?? 0) <= now && this.digestMatches(intent, grouping));
    if (!claimable.length) return null;
    const token = randomUUID();
    const preference = this.load()?.data.notificationPreferences;
    if (!preference) return null;
    const normalized = normalizeNotificationPreferences(preference, new Date(now));
    const preferenceHash = notificationPreferencesFingerprint(normalized);
    for (const intent of claimable) {
      this.db.prepare("UPDATE notification_intents SET status='claimed',digest_id=?,lease_owner=?,token=?,lease_until=?,attempt_count=attempt_count+1,next_retry_at=NULL,claimed_preference_updated_at=?,claimed_preference_hash=?,cancellation_requested=0,cancellation_requested_reason=NULL,updated_at=? WHERE id=? AND status IN ('pending','held','retry-wait','blocked-unconfigured')").run(
        digest.id, owner, token, now + leaseMs, normalized.updatedAt, preferenceHash, timestamp, intent.id,
      );
    }
    this.db.prepare("UPDATE notification_digests SET status='claimed',lease_owner=?,token=?,lease_until=?,attempt_count=attempt_count+1,next_retry_at=NULL,preference_updated_at=?,preference_hash=?,updated_at=? WHERE id=? AND status IN ('pending','retry-wait')").run(owner, token, now + leaseMs, normalized.updatedAt, preferenceHash, timestamp, digest.id);
    return { kind: "claimed", digest: this.rowToNotificationDigest(this.db.prepare("SELECT * FROM notification_digests WHERE id=?").get(digest.id) as Record<string, unknown>), token, memberIds: claimable.map(intent => intent.id).sort((left, right) => left.localeCompare(right)) };
  }

  private expireNotificationDigestInside(digest: NotificationDigest, now: number) {
    const timestamp = new Date(now).toISOString();
    const members = this.listNotificationDigestMembers(digest.id);
    for (const member of members) {
      const intent = this.notificationIntentInside(member.intentId);
      if (!intent || intent.status !== "claimed" || intent.leaseUntil > now) continue;
      const attemptId = `${digest.id}-attempt-${digest.attemptCount}-${contentHash(member.intentId).slice(0, 12)}`;
      this.db.prepare("INSERT OR IGNORE INTO notification_attempts(id,intent_id,attempt_number,started_at,completed_at,outcome,error_class,provider_message_id,request_identity) VALUES(?,?,?,?,?,?,?,?,?)").run(
        attemptId, intent.id, intent.attemptCount, timestamp, timestamp, "ambiguous", "lease-expired-unknown-delivery", null, digest.digestKey,
      );
      this.db.prepare("UPDATE notification_intents SET status='ambiguous',terminal_state='ambiguous',terminal_error_class='lease-expired-unknown-delivery',lease_owner=NULL,token=NULL,lease_until=0,updated_at=? WHERE id=? AND status='claimed' AND lease_until<=?").run(timestamp, intent.id, now);
    }
    this.db.prepare("UPDATE notification_digests SET status='ambiguous',terminal_state='ambiguous',terminal_error_class='lease-expired-unknown-delivery',lease_owner=NULL,token=NULL,lease_until=0,updated_at=? WHERE id=? AND status='claimed' AND lease_until<=?").run(timestamp, digest.id, now);
  }

  claimNotificationDigest(grouping: NotificationDigestGrouping, owner: string, now = Date.now(), leaseMs = WORKER_DEFAULT_LEASE_MS) {
    return this.transaction(() => this.claimNotificationDigestInside(grouping, owner, now, leaseMs));
  }

  reclaimExpiredNotificationDigest(id: string, now = Date.now()) {
    return this.transaction(() => {
      const digest = this.getNotificationDigest(id);
      if (!digest || digest.status !== "claimed" || digest.leaseUntil > now) return [] as string[];
      const members = this.listNotificationDigestMembers(id).map(member => member.intentId);
      this.expireNotificationDigestInside(digest, now);
      this.persistWorkerProjectionInside(now);
      return members;
    });
  }

  preflightNotificationIntent(id: string, token: string, now = Date.now()): NotificationPreflight {
    return this.transaction(() => {
      const intent = this.assertNotificationLeaseInside(id, token, now);
      const saved = this.load();
      const alert = saved?.data.alerts.find(item => item.id === intent.alertId);
      const preferences = saved ? normalizeNotificationPreferences(saved.data.notificationPreferences, new Date(now)) : null;
      const preferenceHash = preferences ? notificationPreferencesFingerprint(preferences) : "";
      const eligibility = alert && preferences ? notificationEligibility(alert, preferences, now, intent.channel, false) : { status: "canceled" as const, notBefore: now, cancellationReason: "workspace-unavailable" as const, destination: null };
      const digestBucket = preferences?.deliveryMode === "digest" ? new Date(eligibility.notBefore).toISOString() : null;
      const timingChanged = alert && preferences && intent.notBefore !== eligibility.notBefore && (
        intent.deliveryMode === "digest"
        || preferences.deliveryMode === "digest"
        || intent.notBefore !== intent.scheduledAt
        || eligibility.notBefore > now
      );
      const effectivePolicyChanged = Boolean(
        intent.destination !== eligibility.destination
        || intent.privacyMode !== preferences?.privacyMode
        || intent.deliveryMode !== preferences?.deliveryMode
        || intent.digestBucket !== digestBucket
        || intent.digestTimezone !== preferences?.timezone
        || timingChanged
        || eligibility.status === "blocked-unconfigured"
        || intent.cancellationReason !== eligibility.cancellationReason,
      );
      if (intent.cancellationRequested || eligibility.status === "canceled") {
        this.db.prepare("UPDATE notification_intents SET status='canceled',terminal_state='canceled',cancellation_reason=?,terminal_error_class=NULL,lease_owner=NULL,token=NULL,lease_until=0,next_retry_at=NULL,attempt_count=MAX(0,attempt_count-1),cancellation_requested=0,cancellation_requested_reason=NULL,updated_at=? WHERE id=? AND status='claimed' AND token=?").run(intent.cancellationRequestedReason ?? eligibility.cancellationReason ?? "preference-opted-out", new Date(now).toISOString(), id, token);
        this.persistWorkerProjectionInside(now);
        return { kind: "canceled", reason: intent.cancellationRequestedReason ?? eligibility.cancellationReason ?? "preference-opted-out" };
      }
      if (effectivePolicyChanged) {
        this.db.prepare("UPDATE notification_intents SET status=?,terminal_state=NULL,destination=?,privacy_mode=?,delivery_mode=?,digest_bucket=?,digest_timezone=?,preference_updated_at=?,preference_hash=?,not_before=?,cancellation_reason=?,terminal_error_class=NULL,digest_id=NULL,lease_owner=NULL,token=NULL,lease_until=0,next_retry_at=NULL,attempt_count=MAX(0,attempt_count-1),cancellation_requested=0,cancellation_requested_reason=NULL,updated_at=? WHERE id=? AND status='claimed' AND token=?").run(
          eligibility.status, eligibility.destination, preferences!.privacyMode, preferences!.deliveryMode, digestBucket, preferences!.timezone,
          preferences!.updatedAt, preferenceHash, eligibility.notBefore, eligibility.cancellationReason, new Date(now).toISOString(), id, token,
        );
        this.persistWorkerProjectionInside(now);
        return { kind: "replan", reason: eligibility.status === "blocked-unconfigured" ? "channel-unconfigured" : "preference-changed-before-submit" };
      }
      this.db.prepare("UPDATE notification_intents SET destination=?,privacy_mode=?,delivery_mode=?,digest_bucket=?,digest_timezone=?,preference_updated_at=?,preference_hash=?,claimed_preference_updated_at=?,claimed_preference_hash=?,not_before=?,cancellation_requested=0,cancellation_requested_reason=NULL,updated_at=? WHERE id=? AND status='claimed' AND token=?").run(
        eligibility.destination, preferences!.privacyMode, preferences!.deliveryMode, digestBucket, preferences!.timezone,
        preferences!.updatedAt, preferenceHash, preferences!.updatedAt, preferenceHash, eligibility.notBefore, new Date(now).toISOString(), id, token,
      );
      return { kind: "send" };
    });
  }

  preflightNotificationDigest(id: string, token: string, now = Date.now()): NotificationPreflight {
    return this.transaction(() => {
      const digest = this.getNotificationDigest(id);
      if (!digest || digest.status !== "claimed" || digest.leaseToken !== token || digest.leaseUntil < now) throw new Error("Notification digest lease expired or replaced.");
      const saved = this.load();
      const preferences = saved ? normalizeNotificationPreferences(saved.data.notificationPreferences, new Date(now)) : null;
      const alerts = new Map(saved?.data.alerts.map(alert => [alert.id, alert]) ?? []);
      const preferenceHash = preferences ? notificationPreferencesFingerprint(preferences) : "";
      let changed = false;
      for (const member of this.listNotificationDigestMembers(id)) {
        const intent = this.notificationIntentInside(member.intentId);
        if (!intent || intent.status !== "claimed" || intent.leaseToken !== token) continue;
        const alert = alerts.get(intent.alertId);
        const eligibility = alert && preferences ? notificationEligibility(alert, preferences, now, intent.channel, false) : { status: "canceled" as const, notBefore: now, cancellationReason: "workspace-unavailable" as const, destination: null };
        const currentGrouping = alert && preferences && eligibility.status !== "canceled" && preferences.deliveryMode === "digest"
          ? notificationDigestGrouping({ ...intent, destination: eligibility.destination, privacyMode: preferences.privacyMode, digestBucket: intent.preferenceHash === preferenceHash && intent.digestBucket ? intent.digestBucket : new Date(eligibility.notBefore).toISOString(), digestTimezone: preferences.timezone })
          : null;
        if (intent.cancellationRequested || eligibility.status === "canceled") {
          this.db.prepare("UPDATE notification_intents SET status='canceled',terminal_state='canceled',cancellation_reason=?,lease_owner=NULL,token=NULL,lease_until=0,next_retry_at=NULL,attempt_count=MAX(0,attempt_count-1),updated_at=? WHERE id=? AND status='claimed' AND token=?").run(intent.cancellationRequestedReason ?? eligibility.cancellationReason ?? "preference-opted-out", new Date(now).toISOString(), intent.id, token);
          changed = true;
        } else if (!currentGrouping || JSON.stringify(currentGrouping) !== JSON.stringify({ channel: digest.channel, destination: digest.destination, privacyMode: digest.privacyMode, policyKey: digest.policyKey, digestBucket: digest.digestBucket, digestTimezone: digest.digestTimezone })) {
          this.db.prepare("UPDATE notification_intents SET status=?,terminal_state=NULL,destination=?,privacy_mode=?,delivery_mode=?,digest_bucket=?,digest_timezone=?,not_before=?,next_retry_at=NULL,preference_updated_at=?,preference_hash=?,digest_id=NULL,lease_owner=NULL,token=NULL,lease_until=0,attempt_count=MAX(0,attempt_count-1),cancellation_requested=0,cancellation_requested_reason=NULL,updated_at=? WHERE id=? AND status='claimed' AND token=?").run(
            eligibility.status, eligibility.destination, preferences?.privacyMode ?? intent.privacyMode, preferences?.deliveryMode ?? intent.deliveryMode, preferences?.deliveryMode === "digest" ? new Date(eligibility.notBefore).toISOString() : null, preferences?.timezone ?? intent.digestTimezone, eligibility.notBefore, preferences?.updatedAt ?? intent.preferenceUpdatedAt, preferenceHash, new Date(now).toISOString(), intent.id, token,
          );
          changed = true;
        }
      }
      if (changed) {
        for (const member of this.listNotificationDigestMembers(id)) {
          const remaining = this.notificationIntentInside(member.intentId);
          if (!remaining || remaining.status !== "claimed" || remaining.leaseToken !== token) continue;
          const alert = alerts.get(remaining.alertId);
          const eligibility = alert && preferences ? notificationEligibility(alert, preferences, now, remaining.channel, false) : { status: "canceled" as const, notBefore: now, cancellationReason: "workspace-unavailable" as const, destination: null };
          if (eligibility.status === "canceled") {
            this.db.prepare("UPDATE notification_intents SET status='canceled',terminal_state='canceled',cancellation_reason=?,lease_owner=NULL,token=NULL,lease_until=0,next_retry_at=NULL,attempt_count=MAX(0,attempt_count-1),updated_at=? WHERE id=? AND status='claimed' AND token=?").run(eligibility.cancellationReason ?? "preference-opted-out", new Date(now).toISOString(), remaining.id, token);
          } else {
            this.db.prepare("UPDATE notification_intents SET status=?,terminal_state=NULL,not_before=?,next_retry_at=NULL,digest_id=NULL,lease_owner=NULL,token=NULL,lease_until=0,attempt_count=MAX(0,attempt_count-1),updated_at=? WHERE id=? AND status='claimed' AND token=?").run(eligibility.status, eligibility.notBefore, new Date(now).toISOString(), remaining.id, token);
          }
        }
        this.db.prepare("UPDATE notification_digests SET status='canceled',terminal_state='canceled',terminal_error_class='member-policy-changed-before-submit',lease_owner=NULL,token=NULL,lease_until=0,updated_at=? WHERE id=? AND status='claimed' AND token=?").run(new Date(now).toISOString(), id, token);
        return { kind: "canceled", reason: "member-policy-changed-before-submit" };
      }
      return { kind: "send" };
    });
  }

  renewNotificationDigestLease(id: string, token: string, now = Date.now(), leaseMs = WORKER_DEFAULT_LEASE_MS) {
    return this.transaction(() => {
      const digest = this.getNotificationDigest(id);
      if (!digest || digest.status !== "claimed" || digest.leaseToken !== token || digest.leaseUntil < now) return false;
      this.db.prepare("UPDATE notification_digests SET lease_until=?,updated_at=? WHERE id=? AND token=? AND status='claimed'").run(now + leaseMs, new Date(now).toISOString(), id, token);
      this.db.prepare("UPDATE notification_intents SET lease_until=?,updated_at=? WHERE digest_id=? AND token=? AND status='claimed'").run(now + leaseMs, new Date(now).toISOString(), id, token);
      return true;
    });
  }

  recordNotificationDigestOutcome(id: string, token: string, outcome: NotificationOutcome, now = Date.now()) {
    return this.transaction(() => {
      const digest = this.getNotificationDigest(id);
      if (!digest || digest.status !== "claimed" || digest.leaseToken !== token || digest.leaseUntil < now) throw new Error("Notification digest lease expired or replaced.");
      const timestamp = new Date(now).toISOString();
      const members = this.listNotificationDigestMembers(id).map(member => this.notificationIntentInside(member.intentId)).filter((intent): intent is NotificationIntent => Boolean(intent));
      for (const intent of members) {
        const attemptId = `${id}-attempt-${digest.attemptCount}-${contentHash(intent.id).slice(0, 12)}`;
        this.db.prepare("INSERT INTO notification_attempts(id,intent_id,attempt_number,started_at,completed_at,outcome,error_class,provider_message_id,request_identity) VALUES(?,?,?,?,?,?,?,?,?)").run(
          attemptId, intent.id, digest.attemptCount, timestamp, timestamp, outcome.kind, "errorClass" in outcome ? outcome.errorClass : null, "providerMessageId" in outcome ? outcome.providerMessageId ?? null : null, digest.digestKey,
        );
        if (outcome.kind === "confirmed" || outcome.kind === "provider-accepted") {
          this.db.prepare("INSERT INTO notification_receipts(id,intent_id,attempt_id,receipt_type,provider_message_id,recorded_at) VALUES(?,?,?,?,?,?)").run(
            `${attemptId}-receipt`, intent.id, attemptId, outcome.kind, outcome.providerMessageId ?? null, timestamp,
          );
        }
      }
      if (outcome.kind === "confirmed") {
        this.db.prepare("UPDATE notification_intents SET status='delivered',terminal_state='delivered',provider_message_id=?,terminal_error_class=NULL,lease_owner=NULL,token=NULL,lease_until=0,next_retry_at=NULL,digest_id=?,updated_at=? WHERE digest_id=? AND status='claimed' AND token=?").run(outcome.providerMessageId ?? null, id, timestamp, id, token);
        this.db.prepare("UPDATE notification_digests SET status='delivered',terminal_state='delivered',provider_message_id=?,terminal_error_class=NULL,lease_owner=NULL,token=NULL,lease_until=0,next_retry_at=NULL,updated_at=? WHERE id=? AND token=?").run(outcome.providerMessageId ?? null, timestamp, id, token);
      } else if (outcome.kind === "provider-accepted") {
        this.db.prepare("UPDATE notification_intents SET status='ambiguous',terminal_state='ambiguous',provider_message_id=?,terminal_error_class='provider-accepted-without-confirmation',lease_owner=NULL,token=NULL,lease_until=0,next_retry_at=NULL,digest_id=?,updated_at=? WHERE digest_id=? AND status='claimed' AND token=?").run(outcome.providerMessageId ?? null, id, timestamp, id, token);
        this.db.prepare("UPDATE notification_digests SET status='ambiguous',terminal_state='ambiguous',provider_message_id=?,terminal_error_class='provider-accepted-without-confirmation',lease_owner=NULL,token=NULL,lease_until=0,next_retry_at=NULL,updated_at=? WHERE id=? AND token=?").run(outcome.providerMessageId ?? null, timestamp, id, token);
      } else if (outcome.kind === "ambiguous") {
        this.db.prepare("UPDATE notification_intents SET status='ambiguous',terminal_state='ambiguous',provider_message_id=?,terminal_error_class=?,lease_owner=NULL,token=NULL,lease_until=0,next_retry_at=NULL,digest_id=?,updated_at=? WHERE digest_id=? AND status='claimed' AND token=?").run(outcome.providerMessageId ?? null, outcome.errorClass.slice(0, 120), id, timestamp, id, token);
        this.db.prepare("UPDATE notification_digests SET status='ambiguous',terminal_state='ambiguous',provider_message_id=?,terminal_error_class=?,lease_owner=NULL,token=NULL,lease_until=0,next_retry_at=NULL,updated_at=? WHERE id=? AND token=?").run(outcome.providerMessageId ?? null, outcome.errorClass.slice(0, 120), timestamp, id, token);
      } else {
        const terminal = digest.attemptCount >= NOTIFICATION_MAX_ATTEMPTS;
        const nextRetryAt = terminal ? null : now + notificationRetryDelayMs(digest.attemptCount);
        this.db.prepare("UPDATE notification_intents SET status=?,terminal_state=?,terminal_error_class=?,lease_owner=NULL,token=NULL,lease_until=0,next_retry_at=?,updated_at=? WHERE digest_id=? AND status='claimed' AND token=?").run(
          terminal ? "failed" : "retry-wait", terminal ? "failed" : null, outcome.errorClass.slice(0, 120), nextRetryAt, timestamp, id, token,
        );
        this.db.prepare("UPDATE notification_digests SET status=?,terminal_state=?,terminal_error_class=?,lease_owner=NULL,token=NULL,lease_until=0,next_retry_at=?,updated_at=? WHERE id=? AND token=?").run(
          terminal ? "failed" : "retry-wait", terminal ? "failed" : null, outcome.errorClass.slice(0, 120), nextRetryAt, timestamp, id, token,
        );
      }
      const saved = this.load();
      if (saved) {
        const projected = this.withWorkerProjectionInside(saved.data, now);
        this.db.prepare("UPDATE workspace SET payload=? WHERE id=1").run(JSON.stringify(validateAppData(projected)));
      }
      return this.getNotificationDigest(id);
    });
  }

  reconcileAmbiguousNotificationDigest(id: string, providerMessageId: string, now = Date.now()) {
    return this.transaction(() => {
      const digest = this.getNotificationDigest(id);
      if (!digest || digest.status !== "ambiguous") return false;
      const timestamp = new Date(now).toISOString();
      for (const member of this.listNotificationDigestMembers(id)) {
        const attempt = this.db.prepare("SELECT * FROM notification_attempts WHERE intent_id=? AND request_identity=? ORDER BY attempt_number DESC LIMIT 1").get(member.intentId, digest.digestKey) as Record<string, unknown> | undefined;
        if (!attempt) continue;
        this.db.prepare("INSERT OR IGNORE INTO notification_receipts(id,intent_id,attempt_id,receipt_type,provider_message_id,recorded_at) VALUES(?,?,?,?,?,?)").run(`${String(attempt.id)}-reconciled-receipt`, member.intentId, String(attempt.id), "confirmed", providerMessageId, timestamp);
        this.db.prepare("UPDATE notification_intents SET status='delivered',terminal_state='delivered',provider_message_id=?,terminal_error_class=NULL,updated_at=? WHERE id=? AND status='ambiguous'").run(providerMessageId, timestamp, member.intentId);
      }
      this.db.prepare("UPDATE notification_digests SET status='delivered',terminal_state='delivered',provider_message_id=?,terminal_error_class=NULL,updated_at=? WHERE id=? AND status='ambiguous'").run(providerMessageId, timestamp, id);
      this.persistWorkerProjectionInside(now);
      return true;
    });
  }

  recordNotificationOutcome(id: string, token: string, outcome: NotificationOutcome, now = Date.now()) {
    return this.transaction(() => {
      const intent = this.assertNotificationLeaseInside(id, token, now);
      const timestamp = new Date(now).toISOString();
      const attemptId = `${intent.id}-attempt-${intent.attemptCount}`;
      const requestIdentity = intent.semanticIdempotencyKey;
      this.db.prepare("INSERT INTO notification_attempts(id,intent_id,attempt_number,started_at,completed_at,outcome,error_class,provider_message_id,request_identity) VALUES(?,?,?,?,?,?,?,?,?)").run(
        attemptId, intent.id, intent.attemptCount, timestamp, timestamp, outcome.kind, "errorClass" in outcome ? outcome.errorClass : null, "providerMessageId" in outcome ? outcome.providerMessageId ?? null : null, requestIdentity,
      );
      if (outcome.kind === "confirmed") {
        this.db.prepare("INSERT INTO notification_receipts(id,intent_id,attempt_id,receipt_type,provider_message_id,recorded_at) VALUES(?,?,?,?,?,?)").run(`${attemptId}-receipt`, intent.id, attemptId, "confirmed", outcome.providerMessageId ?? null, timestamp);
        this.db.prepare("UPDATE notification_intents SET status='delivered',terminal_state='delivered',provider_message_id=?,terminal_error_class=NULL,lease_owner=NULL,token=NULL,lease_until=0,next_retry_at=NULL,updated_at=? WHERE id=? AND token=?").run(outcome.providerMessageId ?? null, timestamp, id, token);
      } else if (outcome.kind === "provider-accepted") {
        this.db.prepare("INSERT INTO notification_receipts(id,intent_id,attempt_id,receipt_type,provider_message_id,recorded_at) VALUES(?,?,?,?,?,?)").run(`${attemptId}-receipt`, intent.id, attemptId, "provider-accepted", outcome.providerMessageId ?? null, timestamp);
        this.db.prepare("UPDATE notification_intents SET status='ambiguous',terminal_state='ambiguous',provider_message_id=?,terminal_error_class=?,lease_owner=NULL,token=NULL,lease_until=0,next_retry_at=NULL,updated_at=? WHERE id=? AND token=?").run(outcome.providerMessageId ?? null, "provider-accepted-without-confirmation", timestamp, id, token);
      } else if (outcome.kind === "ambiguous") {
        this.db.prepare("UPDATE notification_intents SET status='ambiguous',terminal_state='ambiguous',provider_message_id=?,terminal_error_class=?,lease_owner=NULL,token=NULL,lease_until=0,next_retry_at=NULL,updated_at=? WHERE id=? AND token=?").run(outcome.providerMessageId ?? null, outcome.errorClass.slice(0, 120), timestamp, id, token);
      } else {
        const terminal = intent.attemptCount >= NOTIFICATION_MAX_ATTEMPTS;
        this.db.prepare("UPDATE notification_intents SET status=?,terminal_state=?,terminal_error_class=?,lease_owner=NULL,token=NULL,lease_until=0,next_retry_at=?,updated_at=? WHERE id=? AND token=?").run(
          terminal ? "failed" : "retry-wait", terminal ? "failed" : null, outcome.errorClass.slice(0, 120), terminal ? null : now + notificationRetryDelayMs(intent.attemptCount), timestamp, id, token,
        );
      }
      const saved = this.load();
      if (saved) {
        const projected = this.withWorkerProjectionInside(saved.data, now);
        this.db.prepare("UPDATE workspace SET payload=? WHERE id=1").run(JSON.stringify(validateAppData(projected)));
      }
      return this.notificationIntentInside(id);
    });
  }

  markNotificationBlocked(id: string, reason = "channel-unconfigured", now = Date.now()) {
    this.transaction(() => {
      const intent = this.notificationIntentInside(id);
      if (!intent || ["delivered", "failed", "canceled", "ambiguous"].includes(intent.status)) return;
      this.db.prepare("UPDATE notification_intents SET status='blocked-unconfigured',terminal_state=NULL,terminal_error_class=?,lease_owner=NULL,token=NULL,lease_until=0,updated_at=? WHERE id=? AND status IN ('pending','held','retry-wait','blocked-unconfigured')").run(reason.slice(0, 120), new Date(now).toISOString(), id);
      this.persistWorkerProjectionInside(now);
    });
  }

  cancelNotificationIntent(id: string, reason: string, now = Date.now()) {
    this.transaction(() => {
      const intent = this.notificationIntentInside(id);
      if (!intent) return;
      if (intent.status === "claimed") {
        this.db.prepare("UPDATE notification_intents SET cancellation_requested=1,cancellation_requested_reason=?,updated_at=? WHERE id=? AND status='claimed'").run(reason.slice(0, 120), new Date(now).toISOString(), id);
      } else {
        this.db.prepare("UPDATE notification_intents SET status='canceled',terminal_state='canceled',cancellation_reason=?,lease_owner=NULL,token=NULL,lease_until=0,next_retry_at=NULL,updated_at=? WHERE id=? AND status IN ('pending','held','retry-wait','blocked-unconfigured')").run(reason.slice(0, 120), new Date(now).toISOString(), id);
      }
      this.persistWorkerProjectionInside(now);
    });
  }

  cancelAccountOwnedNotifications(accountId: string, reason = "account-invalidated", now = Date.now()) {
    this.transaction(() => {
      this.db.prepare("UPDATE notification_intents SET cancellation_requested=1,cancellation_requested_reason=?,updated_at=? WHERE account_scope='account-owned' AND account_id=? AND status='claimed'").run(reason.slice(0, 120), new Date(now).toISOString(), accountId);
      this.db.prepare("UPDATE notification_intents SET status='canceled',terminal_state='canceled',cancellation_reason=?,lease_owner=NULL,token=NULL,lease_until=0,next_retry_at=NULL,updated_at=? WHERE account_scope='account-owned' AND account_id=? AND status IN ('pending','held','retry-wait','blocked-unconfigured')").run(reason.slice(0, 120), new Date(now).toISOString(), accountId);
      this.persistWorkerProjectionInside(now);
    });
  }

  reconcileAmbiguousNotification(id: string, providerMessageId: string, now = Date.now()) {
    return this.transaction(() => {
      const intent = this.notificationIntentInside(id);
      if (!intent || intent.status !== "ambiguous") return false;
      const timestamp = new Date(now).toISOString();
      const attempt = this.db.prepare("SELECT * FROM notification_attempts WHERE intent_id=? ORDER BY attempt_number DESC LIMIT 1").get(id) as Record<string, unknown> | undefined;
      if (!attempt) return false;
      const receiptId = `${String(attempt.id)}-reconciled-receipt`;
      this.db.prepare("INSERT OR IGNORE INTO notification_receipts(id,intent_id,attempt_id,receipt_type,provider_message_id,recorded_at) VALUES(?,?,?,?,?,?)").run(receiptId, id, String(attempt.id), "confirmed", providerMessageId, timestamp);
      this.db.prepare("UPDATE notification_intents SET status='delivered',terminal_state='delivered',provider_message_id=?,terminal_error_class=NULL,updated_at=? WHERE id=? AND status='ambiguous'").run(providerMessageId, timestamp, id);
      this.persistWorkerProjectionInside(now);
      return true;
    });
  }

  private readSchedulerState(): SchedulerState | null {
    const row = this.db.prepare("SELECT * FROM scheduler_state WHERE id=1").get() as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      lastInvocationAtUtc: iso(row.last_invocation_at), lastExpectedSession: iso(row.last_expected_session), lastSuccessfulSession: iso(row.last_successful_session),
      lastSuccessfulRunAtUtc: iso(row.last_successful_run_at), lastRunStatus: iso(row.last_run_status), lastSafeError: iso(row.last_safe_error),
      nextDueAtUtc: iso(row.next_due_at), deadlineAtUtc: iso(row.deadline_at),
    };
  }

  getSchedulerCheckpoint() { return this.readSchedulerState(); }

  updateSchedulerState(input: Partial<SchedulerState> & { now?: number }) {
    this.transaction(() => {
      const current = this.readSchedulerState();
      const now = input.now ?? Date.now();
      const provided = <K extends keyof SchedulerState>(key: K) =>
        Object.prototype.hasOwnProperty.call(input, key) ? input[key] ?? null : current?.[key] ?? null;
      const next = {
        lastInvocationAtUtc: provided("lastInvocationAtUtc"),
        lastExpectedSession: provided("lastExpectedSession"),
        lastSuccessfulSession: provided("lastSuccessfulSession"),
        lastSuccessfulRunAtUtc: provided("lastSuccessfulRunAtUtc"),
        lastRunStatus: provided("lastRunStatus"),
        lastSafeError: provided("lastSafeError"),
        nextDueAtUtc: provided("nextDueAtUtc"),
        deadlineAtUtc: provided("deadlineAtUtc"),
      };
      this.db.prepare(`
        INSERT INTO scheduler_state(id,contract_version,contract_revision,last_invocation_at,last_expected_session,last_successful_session,last_successful_run_at,last_run_status,last_safe_error,next_due_at,deadline_at,updated_at)
        VALUES(1,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET contract_version=excluded.contract_version,contract_revision=excluded.contract_revision,last_invocation_at=excluded.last_invocation_at,last_expected_session=excluded.last_expected_session,last_successful_session=excluded.last_successful_session,last_successful_run_at=excluded.last_successful_run_at,last_run_status=excluded.last_run_status,last_safe_error=excluded.last_safe_error,next_due_at=excluded.next_due_at,deadline_at=excluded.deadline_at,updated_at=excluded.updated_at
      `).run(WORKER_JOB_CONTRACT_VERSION, WORKER_JOB_CONTRACT_REVISION, next.lastInvocationAtUtc, next.lastExpectedSession, next.lastSuccessfulSession, next.lastSuccessfulRunAtUtc, next.lastRunStatus, next.lastSafeError, next.nextDueAtUtc, next.deadlineAtUtc, new Date(now).toISOString());
    });
  }

  schedulerStatus(now = new Date(), providerDelayMinutesAfterClose = 45, deadlineBudgetMs = WORKER_DEFAULT_DEADLINE_BUDGET_MS): SchedulerStatus {
    const generatedAtUtc = now.toISOString();
    const expected = latestCompletedTradingDate(now, providerDelayMinutesAfterClose);
    const state = this.readSchedulerState();
    const jobs = this.listJobs().filter(job => job.scheduledSession !== "legacy");
    const currentJobs = jobs.filter(job => !job.reconciledAt && job.status !== "superseded");
    const statuses: WorkerJobStatus[] = ["queued", "running", "retry-wait", "completed", "partial", "blocked", "terminal-failed", "superseded"];
    const jobsByStatus = Object.fromEntries(statuses.map(status => [status, jobs.filter(job => job.status === status).length])) as Record<WorkerJobStatus, number>;
    const calendarSessions = state?.lastExpectedSession && state.lastExpectedSession < expected
      ? (() => {
        const result: string[] = [];
        let cursor = nextUsTradingDate(state.lastExpectedSession);
        while (cursor <= expected) {
          result.push(cursor);
          if (cursor === expected) break;
          cursor = nextUsTradingDate(cursor);
        }
        return result;
      })()
      : [];
    const sessions = [...new Set([...jobs.map(job => job.scheduledSession), ...calendarSessions])].sort();
    const bySession = new Map(sessions.map(session => [session, currentJobs.filter(job => job.scheduledSession === session)]));
    const completedSessions = sessions.filter(session => bySession.get(session)?.some(job => job.kind === "evaluation-scan" && job.status === "completed"));
    const partialSessions = sessions.filter(session => bySession.get(session)?.some(job => job.kind === "evaluation-scan" && job.status === "partial"));
    const blockedSessions = sessions.filter(session => bySession.get(session)?.some(job => job.kind === "evaluation-scan" && job.status === "blocked"));
    const retryingSessions = sessions.filter(session => bySession.get(session)?.some(job => ACTIVE_STATUSES.has(job.status) && job.status !== "queued"));
    const terminalFailedSessions = sessions.filter(session => bySession.get(session)?.some(job => job.status === "terminal-failed"));
    const currentJobSafeError = currentJobs
      .filter(job => ACTIVE_STATUSES.has(job.status) || job.status === "terminal-failed")
      .find(job => job.lastSafeError)?.lastSafeError ?? null;
    const missedSessions = sessions.filter(session => {
      const scan = bySession.get(session)?.find(job => job.kind === "evaluation-scan");
      if (scan) return Date.parse(scan.dueAtUtc) <= now.getTime() && !["completed", "partial", "blocked"].includes(scan.status);
      return calendarSessions.includes(session);
    });
    const nextDueAtUtc = state?.nextDueAtUtc ?? marketSessionDueAtUtc(nextUsTradingDate(expected), providerDelayMinutesAfterClose).toISOString();
    const deadlineAtUtc = state?.deadlineAtUtc ?? new Date(Date.parse(nextDueAtUtc) + deadlineBudgetMs).toISOString();
    const stateValue: SchedulerStatus["state"] = !state
      ? "stopped"
      : state.lastRunStatus === "terminal-failed" || state.lastRunStatus === "admission_blocked" || terminalFailedSessions.length > 0
        ? "blocked"
        : missedSessions.length > 0
          ? "missed"
          : state.lastInvocationAtUtc && now.getTime() - Date.parse(state.lastInvocationAtUtc) > deadlineBudgetMs * 2
            ? "stopped"
            : "healthy";
    return {
      contractVersion: WORKER_JOB_CONTRACT_VERSION, contractRevision: WORKER_JOB_CONTRACT_REVISION, generatedAtUtc, state: stateValue, schedulerInstalled: false,
      lastInvocationAtUtc: state?.lastInvocationAtUtc ?? null, lastSuccessfulRunAtUtc: state?.lastSuccessfulRunAtUtc ?? null,
      latestExpectedCompletedSession: expected, latestSuccessfulSession: state?.lastSuccessfulSession ?? null, nextDueAtUtc, deadlineAtUtc, deadlineBudgetMs,
      missedSessions,
      coverage: { scheduledSessions: sessions, completedSessions, partialSessions, blockedSessions, retryingSessions, terminalFailedSessions },
      jobsByStatus, pendingOutboxIntents: this.pendingOutbox().length,
      localDependency: { mode: "local-first", requiresAwakeMachine: true, requiresAuthorizedDataPath: true, appParticipationRequired: false },
      lastSafeError: currentJobSafeError ?? state?.lastSafeError ?? (state ? null : jobs.find(job => job.lastSafeError)?.lastSafeError ?? null),
    };
  }

  databaseSchemaVersion() { return Number(this.db.prepare("PRAGMA user_version").get()?.user_version ?? 0); }

  async backup(path: string) { mkdirSync(dirname(path), { recursive: true, mode: 0o700 }); await backup(this.db, path); chmodSync(path, 0o600); }
  integrityCheck() { return this.db.prepare("PRAGMA integrity_check").get()?.integrity_check === "ok"; }
}

export const productionJobId = (input: Parameters<typeof jobIdFor>[0]) => jobIdFor(input);
