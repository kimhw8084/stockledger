import { DatabaseSync, backup } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { validateAppData } from "../../src/domain/appDataSchema";
import { notificationEligibility, notificationRetryDelayMs, NOTIFICATION_MAX_ATTEMPTS, type NotificationAttemptOutcome, type NotificationDeliveryState, type NotificationIntentInput } from "../../src/domain/notificationDelivery";
import { normalizeNotificationPreferences } from "../../src/domain/notificationPreferences";
import { latestCompletedTradingDate, marketSessionDueAtUtc, nextUsTradingDate } from "../../src/lib/marketCalendar";
import type { AppData, NotificationPreferences } from "../../src/types";
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

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    if (path !== ":memory:") chmodSync(path, 0o600);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
    const version = Number(this.db.prepare("PRAGMA user_version").get()?.user_version ?? 0);
    if (version !== 0 && version !== 1 && version !== 2 && version !== 3 && version !== 4 && version !== 5) throw new Error("Unsupported worker database version.");
    this.createSchema();
    if (version === 1) this.migrateV1ToV2();
    if (version === 1 || version === 2) this.migrateV2ToV3();
    if (version <= 3) this.migrateV3ToV4();
    if (version <= 4) this.migrateV4ToV5();
    this.createIndexes();
    this.db.exec("PRAGMA user_version=5;");
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
    `);
  }

  private createIndexes() {
    this.db.exec("CREATE INDEX IF NOT EXISTS jobs_due_idx ON jobs(status, next_retry_at, due_at); CREATE INDEX IF NOT EXISTS jobs_session_idx ON jobs(scheduled_session, kind); CREATE UNIQUE INDEX IF NOT EXISTS jobs_semantic_key_idx ON jobs(semantic_key); CREATE INDEX IF NOT EXISTS job_reconciliation_replacement_idx ON job_reconciliation(replacement_workflow_key, replacement_job_id); CREATE UNIQUE INDEX IF NOT EXISTS notification_semantic_channel_policy_idx ON notification_intents(semantic_key, channel, policy_key); CREATE INDEX IF NOT EXISTS notification_due_idx ON notification_intents(status, not_before, next_retry_at); CREATE INDEX IF NOT EXISTS notification_alert_idx ON notification_intents(alert_id, channel, policy_key); CREATE INDEX IF NOT EXISTS notification_attempt_intent_idx ON notification_attempts(intent_id, attempt_number); CREATE INDEX IF NOT EXISTS notification_receipt_intent_idx ON notification_receipts(intent_id, recorded_at);");
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

  import(data: AppData, expectedRevision: number) { this.transaction(() => this.writeInside(data, expectedRevision)); }

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
      policyKey: String(row.policy_key), privacyMode: String(row.privacy_mode) as "minimal" | "rich", destination: iso(row.destination),
      status: String(row.status) as NotificationDeliveryState, scheduledAt: Number(row.scheduled_at), notBefore: Number(row.not_before),
      cancellationReason: iso(row.cancellation_reason), leaseOwner: iso(row.lease_owner), leaseToken: iso(row.token), leaseUntil: Number(row.lease_until ?? 0),
      attemptCount: Number(row.attempt_count ?? 0), nextRetryAt: numberOrNull(row.next_retry_at), providerMessageId: iso(row.provider_message_id),
      terminalErrorClass: iso(row.terminal_error_class), terminalState: (iso(row.terminal_state) as NotificationIntent["terminalState"]) ?? null, accountScope: String(row.account_scope) as "device-local" | "account-owned", accountId: iso(row.account_id),
      preferenceUpdatedAt: String(row.preference_updated_at), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
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
      this.writeInside(input.data, input.expectedRevision);
      const timestamp = new Date(now).toISOString();
      const status = input.status ?? "completed";
      this.db.prepare("UPDATE jobs SET status=?,completed_at=?,lease_owner=NULL,token=NULL,lease_until=0,next_retry_at=NULL,updated_at=? WHERE id=? AND token=?").run(status, timestamp, timestamp, input.id, input.token);
      for (const related of input.relatedClaims ?? []) this.db.prepare("UPDATE jobs SET status=?,completed_at=?,lease_owner=NULL,token=NULL,lease_until=0,next_retry_at=NULL,updated_at=? WHERE id=? AND token=?").run(related.status, timestamp, timestamp, related.id, related.token);
      for (const intent of input.notificationIntents ?? []) this.insertNotificationIntentInside(intent);
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
        terminal_error_class,terminal_state,account_scope,account_id,preference_updated_at,created_at,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,NULL,0,0,NULL,NULL,NULL,NULL,?,?,?,?,?)
    `).run(
      intent.id, intent.contractVersion, intent.contractRevision, intent.semanticIdempotencyKey, intent.alertId, intent.channel, intent.policyKey,
      intent.privacyMode, intent.destination, intent.status, intent.scheduledAt, intent.notBefore, intent.cancellationReason,
      intent.accountScope, intent.accountId, intent.preferenceUpdatedAt, intent.createdAt, intent.updatedAt,
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
    const alerts = new Map(data.alerts.map(alert => [alert.id, alert]));
    const intents = this.listNotificationIntents();
    for (const intent of intents) {
      if (!["pending", "held", "retry-wait", "blocked-unconfigured"].includes(intent.status)) continue;
      const alert = alerts.get(intent.alertId);
      if (!alert) {
        this.db.prepare("UPDATE notification_intents SET status='canceled',terminal_state='canceled',cancellation_reason=?,lease_owner=NULL,token=NULL,lease_until=0,updated_at=? WHERE id=?").run("alert-not-found", new Date(now).toISOString(), intent.id);
        continue;
      }
      const eligibility = notificationEligibility(alert, preferences, now, intent.channel, accountInvalidated && intent.accountScope === "account-owned");
      const nextStatus = eligibility.status === "canceled"
        ? "canceled"
        : intent.status === "retry-wait" && (intent.nextRetryAt ?? 0) > now
          ? "retry-wait"
          : eligibility.status;
      this.db.prepare("UPDATE notification_intents SET destination=?,privacy_mode=?,status=?,terminal_state=?,not_before=?,cancellation_reason=?,preference_updated_at=?,updated_at=? WHERE id=?").run(
        eligibility.destination, preferences.privacyMode, nextStatus, eligibility.status === "canceled" ? "canceled" : null, Math.max(intent.notBefore, eligibility.notBefore), eligibility.cancellationReason,
        preferences.updatedAt, new Date(now).toISOString(), intent.id,
      );
    }
  }

  syncNotificationPolicy(data: AppData, now = Date.now(), accountInvalidated = false) {
    this.transaction(() => this.refreshNotificationPolicyInside(data, now, accountInvalidated));
  }

  commitNotificationPreferences(preferences: NotificationPreferences, expectedRevision: number, now = Date.now(), accountInvalidated = false) {
    return this.transaction(() => {
      const saved = this.load();
      if (!saved) throw new Error("Import a StockLedger backup before changing notification preferences.");
      const next = { ...saved.data, notificationPreferences: normalizeNotificationPreferences(preferences, new Date(now)) };
      this.refreshNotificationPolicyInside(next, now, accountInvalidated);
      this.writeInside(next, expectedRevision);
      return { revision: expectedRevision + 1, data: next };
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
    const token = randomUUID();
    const timestamp = new Date(now).toISOString();
    this.db.prepare("UPDATE notification_intents SET status='claimed',lease_owner=?,token=?,lease_until=?,attempt_count=attempt_count+1,next_retry_at=NULL,updated_at=? WHERE id=? AND status IN ('pending','held','retry-wait','blocked-unconfigured')").run(owner, token, now + leaseMs, timestamp, id);
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
      return this.notificationIntentInside(id);
    });
  }

  markNotificationBlocked(id: string, reason = "channel-unconfigured", now = Date.now()) {
    this.transaction(() => {
      const intent = this.notificationIntentInside(id);
      if (!intent || ["delivered", "failed", "canceled", "ambiguous"].includes(intent.status)) return;
      this.db.prepare("UPDATE notification_intents SET status='blocked-unconfigured',terminal_state=NULL,terminal_error_class=?,lease_owner=NULL,token=NULL,lease_until=0,updated_at=? WHERE id=? AND status IN ('pending','held','retry-wait','blocked-unconfigured')").run(reason.slice(0, 120), new Date(now).toISOString(), id);
    });
  }

  cancelNotificationIntent(id: string, reason: string, now = Date.now()) {
    this.transaction(() => {
      this.db.prepare("UPDATE notification_intents SET status='canceled',terminal_state='canceled',cancellation_reason=?,lease_owner=NULL,token=NULL,lease_until=0,next_retry_at=NULL,updated_at=? WHERE id=? AND status IN ('pending','held','retry-wait','blocked-unconfigured')").run(reason.slice(0, 120), new Date(now).toISOString(), id);
    });
  }

  cancelAccountOwnedNotifications(accountId: string, reason = "account-invalidated", now = Date.now()) {
    this.transaction(() => {
      this.db.prepare("UPDATE notification_intents SET status='canceled',terminal_state='canceled',cancellation_reason=?,lease_owner=NULL,token=NULL,lease_until=0,next_retry_at=NULL,updated_at=? WHERE account_scope='account-owned' AND account_id=? AND status IN ('pending','held','retry-wait','blocked-unconfigured')").run(reason.slice(0, 120), new Date(now).toISOString(), accountId);
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

  async backup(path: string) { mkdirSync(dirname(path), { recursive: true, mode: 0o700 }); await backup(this.db, path); chmodSync(path, 0o600); }
  integrityCheck() { return this.db.prepare("PRAGMA integrity_check").get()?.integrity_check === "ok"; }
}

export const productionJobId = (input: Parameters<typeof jobIdFor>[0]) => jobIdFor(input);
