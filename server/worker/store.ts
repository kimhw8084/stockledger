import { DatabaseSync, backup } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { validateAppData } from "../../src/domain/appDataSchema";
import { latestCompletedTradingDate, marketSessionDueAtUtc, nextUsTradingDate } from "../../src/lib/marketCalendar";
import type { AppData } from "../../src/types";
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

type JobContractWithId = ProductionJobContract & { id: string };
export type RelatedClaim = { id: string; token: string; status: Extract<WorkerJobStatus, "completed" | "partial" | "blocked"> };

export class WorkerAdmissionError extends Error {
  readonly code = "WORKER_ADMISSION_GUARD" as const;
  constructor(message: string) { super(message); this.name = "WorkerAdmissionError"; }
}

const FINAL_STATUSES = new Set<WorkerJobStatus>(["completed", "partial", "blocked", "terminal-failed"]);
const ACTIVE_STATUSES = new Set<WorkerJobStatus>(["queued", "running", "retry-wait"]);
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
    if (version !== 0 && version !== 1 && version !== 2) throw new Error("Unsupported worker database version.");
    this.createSchema();
    if (version === 1) this.migrateV1ToV2();
    this.createIndexes();
    this.db.exec("PRAGMA user_version=2;");
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
    `);
  }

  private createIndexes() {
    this.db.exec("CREATE INDEX IF NOT EXISTS jobs_due_idx ON jobs(status, next_retry_at, due_at); CREATE INDEX IF NOT EXISTS jobs_session_idx ON jobs(scheduled_session, kind); CREATE UNIQUE INDEX IF NOT EXISTS jobs_semantic_key_idx ON jobs(semantic_key);");
  }

  private migrateV1ToV2() {
    const columns = new Set((this.db.prepare("PRAGMA table_info(jobs)").all() as Array<{ name: string }>).map(column => column.name));
    const additions: Array<[string, string]> = [
      ["contract_version", `TEXT NOT NULL DEFAULT '${WORKER_JOB_CONTRACT_VERSION}'`],
      ["contract_revision", `INTEGER NOT NULL DEFAULT ${WORKER_JOB_CONTRACT_REVISION}`],
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
    };
  }

  private getJobInside(id: string): WorkerJob | null {
    const row = this.db.prepare("SELECT * FROM jobs WHERE id=?").get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToJob(row) : null;
  }

  getJob(id: string) { return this.getJobInside(id); }

  listJobs(options: { scheduledSession?: string; kind?: WorkerJobKind } = {}): WorkerJob[] {
    const clauses: string[] = [];
    const values: string[] = [];
    if (options.scheduledSession) { clauses.push("scheduled_session=?"); values.push(options.scheduledSession); }
    if (options.kind) { clauses.push("kind=?"); values.push(options.kind); }
    const query = `SELECT * FROM jobs${clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""} ORDER BY due_at, kind, id`;
    return (this.db.prepare(query).all(...values) as Array<Record<string, unknown>>).map(row => this.rowToJob(row));
  }

  private insertJobInside(job: JobContractWithId, now: number) {
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

  enqueue(job: JobContractWithId, now = Date.now()): WorkerJob {
    return this.transaction(() => {
      const existing = this.getJobInside(job.id);
      if (existing) return existing;
      const active = (this.db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE status IN ('queued','running','retry-wait')").get() as { count: number }).count;
      if (Number(active) >= WORKER_MAX_QUEUED_JOBS) throw new WorkerAdmissionError(`Queued work exceeds the ${WORKER_MAX_QUEUED_JOBS}-job admission guard; no jobs were discarded.`);
      this.insertJobInside(job, now);
      return this.getJobInside(job.id)!;
    });
  }

  enqueueMany(jobs: JobContractWithId[], now = Date.now()): WorkerJob[] {
    return this.transaction(() => {
      const unique = [...new Map(jobs.map(job => [job.id, job])).values()];
      const newCount = unique.filter(job => !this.getJobInside(job.id)).length;
      const active = (this.db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE status IN ('queued','running','retry-wait')").get() as { count: number }).count;
      if (Number(active) + newCount > WORKER_MAX_QUEUED_JOBS) throw new WorkerAdmissionError(`Queued work would exceed the ${WORKER_MAX_QUEUED_JOBS}-job admission guard; no jobs were discarded.`);
      for (const job of unique) this.insertJobInside(job, now);
      return unique.map(job => this.getJobInside(job.id)!);
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
    now?: number;
  }) {
    const now = input.now ?? Date.now();
    this.transaction(() => {
      this.assertLeaseInside(input.id, input.token, now);
      for (const related of input.relatedClaims ?? []) this.assertLeaseInside(related.id, related.token, now);
      this.writeInside(input.data, input.expectedRevision);
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
    const statuses: WorkerJobStatus[] = ["queued", "running", "retry-wait", "completed", "partial", "blocked", "terminal-failed"];
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
    const bySession = new Map(sessions.map(session => [session, jobs.filter(job => job.scheduledSession === session)]));
    const completedSessions = sessions.filter(session => bySession.get(session)?.some(job => job.kind === "evaluation-scan" && job.status === "completed"));
    const partialSessions = sessions.filter(session => bySession.get(session)?.some(job => job.kind === "evaluation-scan" && job.status === "partial"));
    const blockedSessions = sessions.filter(session => bySession.get(session)?.some(job => job.kind === "evaluation-scan" && job.status === "blocked"));
    const retryingSessions = sessions.filter(session => bySession.get(session)?.some(job => ACTIVE_STATUSES.has(job.status) && job.status !== "queued"));
    const terminalFailedSessions = sessions.filter(session => bySession.get(session)?.some(job => job.status === "terminal-failed"));
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
      lastSafeError: state ? state.lastSafeError : jobs.find(job => job.lastSafeError)?.lastSafeError ?? null,
    };
  }

  async backup(path: string) { mkdirSync(dirname(path), { recursive: true, mode: 0o700 }); await backup(this.db, path); chmodSync(path, 0o600); }
  integrityCheck() { return this.db.prepare("PRAGMA integrity_check").get()?.integrity_check === "ok"; }
}

export const productionJobId = (input: Parameters<typeof jobIdFor>[0]) => jobIdFor(input);
