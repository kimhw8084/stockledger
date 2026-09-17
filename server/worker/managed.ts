import { contentHash } from "../../src/domain/contentHash";
import { evaluateWorkspace } from "../../src/domain/evaluateWorkspace";
import { snapshotFromBars } from "../../src/domain/marketSnapshot";
import { frozenScannerRules } from "../../src/lib/frozenScannerRules";
import {
  latestCompletedTradingDate,
  marketSessionDueAtUtc,
  nextUsTradingDate,
} from "../../src/lib/marketCalendar";
import { runDailyStockConditionScan } from "../../src/lib/stockConditionScanner";
import { FINANCIAL_TRUTH_ENGINE_VERSION } from "../../src/lib/metricCatalog";
import type { RawBarRecord, UniverseSnapshot } from "../../src/types";
import {
  createProductionJob,
  jobIdFor,
  WORKER_DEFAULT_DEADLINE_BUDGET_MS,
  WORKER_DEFAULT_LEASE_MS,
  WORKER_MAX_CATCH_UP_SESSIONS,
  WORKER_MAX_HISTORY_ROWS,
  type WorkerJobKind,
} from "./contract";
import { WorkerAdmissionError, WorkerStore, type RelatedClaim, type SchedulerStatus, type WorkerJob } from "./store";

export interface ManagedHistory {
  symbol: string;
  rows: RawBarRecord[];
  error?: string;
}

export interface ManagedWorkerOptions {
  source: string;
  adjustment: "adjusted" | "unadjusted" | "unknown";
  now?: Date;
  owner?: string;
  leaseMs?: number;
  heartbeatMs?: number;
  deadlineBudgetMs?: number;
}

export interface DeadlineEvidence {
  elapsedMs: number;
  workloadSize: { symbols: number; rows: number; scheduledSessions: number; jobStages: number };
  deadlineBudgetMs: number;
  remainingHeadroomMs: number;
  withinBudget: boolean;
  evidenceOnly: true;
}

export interface ManagedWorkerResult {
  status: "completed" | "partial" | "blocked" | "already_claimed_or_completed" | "retry_wait" | "terminal-failed" | "admission_blocked";
  jobId?: string;
  jobIds: string[];
  scanDate?: string;
  signals?: number;
  alerts?: number;
  sessions: string[];
  scheduler: SchedulerStatus;
  deadline: DeadlineEvidence;
}

const finalStatus = (job?: WorkerJob | null) => job && ["completed", "partial", "blocked", "terminal-failed"].includes(job.status);
const sessionInstant = (session: string) => new Date(`${session}T23:00:00.000Z`);

const sliceHistories = (histories: ManagedHistory[], session: string) => histories.map(history => ({
  ...history,
  rows: history.rows.filter(row => row.date <= session),
}));

const validateBatchSize = (histories: ManagedHistory[]) => {
  const rows = histories.reduce((sum, history) => sum + history.rows.length, 0);
  if (histories.length > 600) throw new WorkerAdmissionError("Managed execution accepts at most 600 symbols; no input was discarded.");
  if (rows > WORKER_MAX_HISTORY_ROWS) throw new WorkerAdmissionError(`Managed execution accepts at most ${WORKER_MAX_HISTORY_ROWS} history rows per invocation; no input was discarded.`);
  return rows;
};

const dueSessions = (lastExpectedSession: string | null, latestExpectedSession: string) => {
  if (!lastExpectedSession || latestExpectedSession <= lastExpectedSession) return [latestExpectedSession];
  const sessions: string[] = [];
  let cursor = nextUsTradingDate(lastExpectedSession);
  while (cursor <= latestExpectedSession) {
    sessions.push(cursor);
    if (sessions.length > WORKER_MAX_CATCH_UP_SESSIONS) throw new WorkerAdmissionError(`Catch-up would exceed the ${WORKER_MAX_CATCH_UP_SESSIONS}-session admission guard; queued work was preserved.`);
    if (cursor === latestExpectedSession) break;
    cursor = nextUsTradingDate(cursor);
  }
  return sessions;
};

const workflowFor = (data: NonNullable<ReturnType<WorkerStore["load"]>>["data"], histories: ManagedHistory[], session: string, options: ManagedWorkerOptions) => {
  const sessionHistories = sliceHistories(histories, session);
  const sourceHash = contentHash(sessionHistories);
  const inputHash = contentHash({
    engine: FINANCIAL_TRUTH_ENGINE_VERSION,
    calendar: "NYSE-2026-09-15",
    date: session,
    sourceHash,
    adjustment: options.adjustment,
    source: options.source,
    settings: data.scannerSettings,
    recipes: data.recipes,
    eyes: data.eyes.map(({ lastEvaluation, ...eye }) => eye),
    rules: frozenScannerRules.map(rule => rule.ruleSignatureHash),
  });
  const workflowKey = contentHash({ contract: "stockledger-production-job-v1", inputHash, session });
  const dueAtUtc = marketSessionDueAtUtc(session, data.scannerSettings.providerDelayMinutesAfterClose).toISOString();
  const jobs = ["ingestion-readiness", "evaluation-scan", "outcome-forward-proof", "notification-outbox-intent"].map(kind => {
    const identity = { kind: kind as WorkerJobKind, scheduledSession: session, workflowKey, inputHash, dueAtUtc };
    return { id: jobIdFor(identity), ...createProductionJob(identity) };
  });
  return { inputHash, workflowKey, sessionHistories, jobs };
};

const claimedStage = (store: WorkerStore, job: WorkerJob, owner: string, now: number, leaseMs: number) => {
  if (finalStatus(job)) return null;
  const token = store.claimJob(job.id, owner, now, leaseMs);
  return token ? { id: job.id, token } : null;
};

const readinessStatus = (histories: ManagedHistory[], data: NonNullable<ReturnType<WorkerStore["load"]>>["data"]) => {
  const requiredSymbols = new Set([
    "SPY",
    ...Object.values(data.scannerSettings.frozenUniverseBySector ?? {}).flat(),
    ...Object.keys(data.scannerSettings.frozenUniverseBySector ?? {}).filter(Boolean),
  ]);
  const problems = histories.filter(history => history.error || history.rows.length === 0).map(history => history.error ?? `${history.symbol}:no_observations`);
  for (const symbol of requiredSymbols) if (!histories.some(history => history.symbol === symbol && history.rows.length > 0)) problems.push(`${symbol}:missing_required_observation`);
  return problems.length ? "partial" as const : "completed" as const;
};

const runSession = async (store: WorkerStore, histories: ManagedHistory[], options: ManagedWorkerOptions, session: string, jobs: JobContractResult, nowMs: number) => {
  const owner = options.owner ?? `managed-${process.pid}`;
  const leaseMs = options.leaseMs ?? WORKER_DEFAULT_LEASE_MS;
  const claims: Array<{ id: string; token: string }> = [];
  const ingestionJob = store.getJob(jobs.byKind["ingestion-readiness"].id)!;
  const ingestionClaim = claimedStage(store, ingestionJob, owner, nowMs, leaseMs);
  if (ingestionClaim) {
    const saved = store.load();
    if (!saved) throw new Error("Import a StockLedger backup before running the worker.");
    store.finishJob(ingestionClaim.id, ingestionClaim.token, readinessStatus(jobs.sessionHistories, saved.data), nowMs, jobs.inputHash);
  } else if (!finalStatus(store.getJob(ingestionJob.id))) {
    return { status: "retry_wait" as const, jobIds: jobs.ids };
  }

  const evaluation = store.getJob(jobs.byKind["evaluation-scan"].id)!;
  if (finalStatus(evaluation)) return { status: "already_claimed_or_completed" as const, jobIds: jobs.ids };
  const evaluationClaim = claimedStage(store, evaluation, owner, nowMs, leaseMs);
  if (!evaluationClaim) return { status: "retry_wait" as const, jobIds: jobs.ids };
  claims.push(evaluationClaim);

  const outcome = store.getJob(jobs.byKind["outcome-forward-proof"].id)!;
  const outcomeClaim = claimedStage(store, outcome, owner, nowMs, leaseMs);
  if (outcomeClaim) claims.push(outcomeClaim);
  const notification = store.getJob(jobs.byKind["notification-outbox-intent"].id)!;
  const notificationClaim = claimedStage(store, notification, owner, nowMs, leaseMs);
  if (notificationClaim) claims.push(notificationClaim);

  const heartbeatMs = options.heartbeatMs ?? Math.max(10, Math.floor(leaseMs / 3));
  const wallStartedAt = Date.now();
  const leaseClock = () => nowMs + Math.max(0, Date.now() - wallStartedAt);
  let leaseLost = false;
  const heartbeat = setInterval(() => {
    for (const claim of claims) if (!store.renewLease(claim.id, claim.token, leaseClock(), leaseMs)) leaseLost = true;
  }, heartbeatMs);
  try {
    const saved = store.load();
    if (!saved) throw new Error("Import a StockLedger backup before running the worker.");
    const now = sessionInstant(session);
    const members = saved.data.scannerSettings.frozenUniverseBySector ?? {};
    const universe: UniverseSnapshot = {
      id: `universe-${contentHash({ date: session, members })}`,
      universeMode: "frozen_research_universe",
      universeSource: "Local configured CSV universe",
      universeSourceStatus: "frozen_import_fallback",
      snapshotDate: session,
      snapshotHash: contentHash(members),
      fetchedAtUtc: now.toISOString(),
      sectorSnapshots: Object.entries(members).map(([sector, tickers]) => ({ sector, tickers })),
    };
    const result = await runDailyStockConditionScan({
      existingBatches: saved.data.rawBarArchives,
      existingSignals: saved.data.scanSignals,
      existingForwardProof: saved.data.forwardProofLedger,
      scannerSettings: saved.data.scannerSettings,
      histories: jobs.sessionHistories,
      universeSnapshot: universe,
      now,
      scheduledSession: session,
      adjustment: options.adjustment,
      providerName: options.source,
    });
    const snapshots = saved.data.stocks.map(stock => {
      const existing = saved.data.snapshots.find(snapshot => snapshot.stockId === stock.id);
      const history = jobs.sessionHistories.find(history => history.symbol === stock.symbol);
      if (!history?.rows.length || stock.archivedAt) return existing;
      try {
        const snapshot = snapshotFromBars(stock, history.rows, jobs.sessionHistories.find(entry => entry.symbol === "SPY")?.rows ?? [], { source: options.source, origin: "import", adjustment: options.adjustment, datasetId: jobs.inputHash, now });
        return { ...snapshot, plannedEntryLow: existing?.plannedEntryLow, plannedEntryHigh: existing?.plannedEntryHigh, lastThesisReviewAt: existing?.lastThesisReviewAt, riskFlags: existing?.riskFlags ?? [] };
      } catch {
        return existing;
      }
    }).filter((snapshot): snapshot is NonNullable<typeof snapshot> => Boolean(snapshot));
    const next = evaluateWorkspace({
      ...saved.data,
      snapshots,
      rawBarArchives: result.rawArchiveBatch ? [result.rawArchiveBatch, ...saved.data.rawBarArchives.filter(batch => batch.id !== result.rawArchiveBatch!.id)] : saved.data.rawBarArchives,
      universeSnapshots: [result.universeSnapshot, ...saved.data.universeSnapshots.filter(snapshot => snapshot.id !== result.universeSnapshot.id)],
      processedFeatures: [...result.processedFeatures, ...saved.data.processedFeatures.filter(feature => !result.processedFeatures.some(nextFeature => nextFeature.id === feature.id))],
      scanRuns: [result.scanRun, ...saved.data.scanRuns.filter(run => run.id !== result.scanRun.id)],
      scanSignals: result.scanSignals,
      forwardProofLedger: result.forwardProofLedger,
    }, now);
    if (leaseLost) throw new Error("Worker lease renewal failed before commit.");
    const resultStatus = result.scanRun.status;
    const relatedClaims: RelatedClaim[] = [];
    if (outcomeClaim) relatedClaims.push({ ...outcomeClaim, status: resultStatus });
    if (notificationClaim) relatedClaims.push({ ...notificationClaim, status: "completed" });
    store.commitJobResult({
      id: evaluationClaim.id,
      token: evaluationClaim.token,
      data: next,
      expectedRevision: saved.revision,
      status: resultStatus,
      relatedClaims,
      outbox: notificationClaim ? {
        id: `intent-${notification.id}`,
        jobId: notification.id,
        payload: {
          type: "notification.intent",
          version: 1,
          semanticIdempotencyKey: notification.semanticIdempotencyKey,
          scheduledSession: session,
          scanRunId: result.scanRun.id,
          status: resultStatus,
          newAlerts: next.alerts.filter(alert => !alert.reviewed).length,
        },
      } : undefined,
      now: leaseClock(),
    });
    return { status: resultStatus, jobIds: jobs.ids, scanDate: session, signals: result.scanSignals.length, alerts: next.alerts.length };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Managed worker failed.";
    for (const claim of claims) store.failJob(claim.id, claim.token, message, leaseClock());
    throw cause;
  } finally {
    clearInterval(heartbeat);
  }
};

type JobContractResult = {
  inputHash: string;
  workflowKey: string;
  sessionHistories: ManagedHistory[];
  jobs: Array<ReturnType<typeof createProductionJob> & { id: string }>;
  byKind: Record<WorkerJobKind, ReturnType<typeof createProductionJob> & { id: string }>;
  ids: string[];
};

export async function runManagedJob(store: WorkerStore, histories: ManagedHistory[], options: ManagedWorkerOptions): Promise<ManagedWorkerResult> {
  const started = performance.now();
  const now = options.now ?? new Date();
  const deadlineBudgetMs = options.deadlineBudgetMs ?? WORKER_DEFAULT_DEADLINE_BUDGET_MS;
  const rows = validateBatchSize(histories);
  const saved = store.load();
  if (!saved) throw new Error("Import a StockLedger backup before running the worker.");
  const latestExpectedSession = latestCompletedTradingDate(now, saved.data.scannerSettings.providerDelayMinutesAfterClose);
  const checkpoint = store.getSchedulerCheckpoint();
  let sessions: string[];
  try {
    sessions = dueSessions(checkpoint?.lastExpectedSession ?? null, latestExpectedSession);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Scheduler admission guard blocked catch-up.";
    store.updateSchedulerState({ lastInvocationAtUtc: now.toISOString(), lastExpectedSession: latestExpectedSession, lastRunStatus: "admission_blocked", lastSafeError: message, now: now.getTime() });
    const elapsedMs = Math.round(performance.now() - started);
    return { status: "admission_blocked", jobIds: [], sessions: [], scheduler: store.schedulerStatus(now, saved.data.scannerSettings.providerDelayMinutesAfterClose, deadlineBudgetMs), deadline: { elapsedMs, workloadSize: { symbols: histories.length, rows, scheduledSessions: 0, jobStages: 0 }, deadlineBudgetMs, remainingHeadroomMs: deadlineBudgetMs - elapsedMs, withinBudget: elapsedMs <= deadlineBudgetMs, evidenceOnly: true } };
  }
  const workflows = sessions.map(session => workflowFor(saved.data, histories, session, options));
  const queued = workflows.flatMap(workflow => workflow.jobs);
  try {
    store.enqueueMany(queued, now.getTime());
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Scheduler admission guard blocked enqueue.";
    store.updateSchedulerState({ lastInvocationAtUtc: now.toISOString(), lastExpectedSession: latestExpectedSession, lastRunStatus: "admission_blocked", lastSafeError: message, now: now.getTime() });
    const elapsedMs = Math.round(performance.now() - started);
    return { status: "admission_blocked", jobIds: [], sessions, scheduler: store.schedulerStatus(now, saved.data.scannerSettings.providerDelayMinutesAfterClose, deadlineBudgetMs), deadline: { elapsedMs, workloadSize: { symbols: histories.length, rows, scheduledSessions: sessions.length, jobStages: queued.length }, deadlineBudgetMs, remainingHeadroomMs: deadlineBudgetMs - elapsedMs, withinBudget: elapsedMs <= deadlineBudgetMs, evidenceOnly: true } };
  }
  store.updateSchedulerState({
    lastInvocationAtUtc: now.toISOString(),
    lastExpectedSession: latestExpectedSession,
    nextDueAtUtc: marketSessionDueAtUtc(nextUsTradingDate(latestExpectedSession), saved.data.scannerSettings.providerDelayMinutesAfterClose).toISOString(),
    deadlineAtUtc: new Date(marketSessionDueAtUtc(nextUsTradingDate(latestExpectedSession), saved.data.scannerSettings.providerDelayMinutesAfterClose).getTime() + deadlineBudgetMs).toISOString(),
    lastSafeError: null,
    now: now.getTime(),
  });

  let latest: Awaited<ReturnType<typeof runSession>> | null = null;
  for (const workflow of workflows) {
    const byKind = Object.fromEntries(workflow.jobs.map(job => [job.kind, job])) as Record<WorkerJobKind, JobContractResult["jobs"][number]>;
    latest = await runSession(store, histories, options, workflow.jobs[0].scheduledSession, { ...workflow, byKind, ids: workflow.jobs.map(job => job.id) }, now.getTime());
    const sessionResult = latest;
    if (["completed", "partial", "blocked"].includes(sessionResult.status)) {
      const completed = sessionResult.status === "completed";
      store.updateSchedulerState({
        lastSuccessfulSession: completed ? workflow.jobs[0].scheduledSession : undefined,
        lastSuccessfulRunAtUtc: completed ? now.toISOString() : undefined,
        lastRunStatus: sessionResult.status,
        lastSafeError: null,
        now: now.getTime(),
      });
    }
  }
  const elapsedMs = Math.round(performance.now() - started);
  const scheduler = store.schedulerStatus(now, saved.data.scannerSettings.providerDelayMinutesAfterClose, deadlineBudgetMs);
  const status = latest?.status ?? "already_claimed_or_completed";
  return {
    status,
    jobId: latest?.jobIds.at(-1),
    jobIds: workflows.flatMap(workflow => workflow.jobs.map(job => job.id)),
    scanDate: latest?.scanDate,
    signals: latest?.signals,
    alerts: latest?.alerts,
    sessions,
    scheduler,
    deadline: { elapsedMs, workloadSize: { symbols: histories.length, rows, scheduledSessions: sessions.length, jobStages: queued.length }, deadlineBudgetMs, remainingHeadroomMs: deadlineBudgetMs - elapsedMs, withinBudget: elapsedMs <= deadlineBudgetMs, evidenceOnly: true },
  };
}

export const runManagedWorker = runManagedJob;
