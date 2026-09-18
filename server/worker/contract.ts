import { contentHash } from "../../src/domain/contentHash";
import { CALENDAR_VERSION, marketSessionDueAtUtc } from "../../src/lib/marketCalendar";

export const WORKER_JOB_CONTRACT_VERSION = "stockledger-production-job-v1" as const;
export const WORKER_JOB_CONTRACT_REVISION = 2 as const;
export const WORKER_MAX_ATTEMPTS = 5;
export const WORKER_INITIAL_RETRY_DELAY_MS = 60_000;
export const WORKER_MAX_RETRY_DELAY_MS = 15 * 60_000;
export const WORKER_DEFAULT_LEASE_MS = 15 * 60_000;
export const WORKER_DEFAULT_DEADLINE_BUDGET_MS = 30 * 60_000;
export const WORKER_MAX_CATCH_UP_SESSIONS = 32;
export const WORKER_MAX_QUEUED_JOBS = 256;
export const WORKER_MAX_HISTORY_ROWS = 1_000_000;

export const workerJobKinds = [
  "ingestion-readiness",
  "evaluation-scan",
  "outcome-forward-proof",
  "notification-outbox-intent",
] as const;
export type WorkerJobKind = (typeof workerJobKinds)[number];

export const workerJobStatuses = [
  "queued",
  "running",
  "retry-wait",
  "completed",
  "partial",
  "blocked",
  "terminal-failed",
  "superseded",
] as const;
export type WorkerJobStatus = (typeof workerJobStatuses)[number];

export interface ProductionJobContract {
  contractVersion: typeof WORKER_JOB_CONTRACT_VERSION;
  revision: typeof WORKER_JOB_CONTRACT_REVISION;
  kind: WorkerJobKind;
  scheduledSession: string;
  dueAtUtc: string;
  semanticIdempotencyKey: string;
  workflowKey: string;
  inputHash: string;
}

export interface JobIdentityInput {
  kind: WorkerJobKind;
  scheduledSession: string;
  workflowKey: string;
  inputHash: string;
  dueAtUtc?: string;
}

export const retryDelayMs = (attempt: number) => {
  const normalizedAttempt = Math.max(1, Math.floor(attempt));
  return Math.min(
    WORKER_MAX_RETRY_DELAY_MS,
    WORKER_INITIAL_RETRY_DELAY_MS * (2 ** (normalizedAttempt - 1)),
  );
};

export const semanticIdempotencyKey = (input: JobIdentityInput) =>
  `${WORKER_JOB_CONTRACT_VERSION}:${input.kind}:${input.scheduledSession}:${contentHash({
    contract: WORKER_JOB_CONTRACT_VERSION,
    revision: WORKER_JOB_CONTRACT_REVISION,
    kind: input.kind,
    scheduledSession: input.scheduledSession,
    workflowKey: input.workflowKey,
    inputHash: input.inputHash,
    calendar: CALENDAR_VERSION,
  })}`;

export const jobIdFor = (input: JobIdentityInput) =>
  `job-${contentHash({ contract: WORKER_JOB_CONTRACT_VERSION, ...input })}`;

export const createProductionJob = (input: JobIdentityInput): ProductionJobContract => ({
  contractVersion: WORKER_JOB_CONTRACT_VERSION,
  revision: WORKER_JOB_CONTRACT_REVISION,
  kind: input.kind,
  scheduledSession: input.scheduledSession,
  dueAtUtc: input.dueAtUtc ?? marketSessionDueAtUtc(input.scheduledSession).toISOString(),
  semanticIdempotencyKey: semanticIdempotencyKey(input),
  workflowKey: input.workflowKey,
  inputHash: input.inputHash,
});

export const jobIdentityFor = (input: JobIdentityInput) => ({
  id: jobIdFor(input),
  ...createProductionJob(input),
});
