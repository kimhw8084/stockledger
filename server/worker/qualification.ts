import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { seedData } from "../../src/lib/seed";
import { previousUsTradingDate } from "../../src/lib/marketCalendar";
import { WORKER_DEFAULT_DEADLINE_BUDGET_MS, jobIdentityFor } from "./contract";
import { createOperationsStatus } from "./operations";
import { runRecoveryDrill } from "./recovery";
import { runWorker } from "./run";
import { WorkerStore } from "./store";

export const OPERATIONS_QUALIFICATION_CONTRACT_VERSION = "stockledger-operations-qualification-v1" as const;
export const OPERATIONS_QUALIFICATION_REVISION = 1 as const;

export const percentile = (values: number[], probability: number): number | null => {
  if (values.length < 2) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
};

const bytesFor = (path: string) => [path, `${path}-wal`, `${path}-shm`].reduce((total, file) => total + (existsSync(file) ? statSync(file).size : 0), 0);
const syntheticFixture = (stockCount: number, sessionCount: number, now: Date) => {
  const dates = ["2026-09-14"];
  while (dates.length < sessionCount) dates.unshift(previousUsTradingDate(dates[0]));
  const stocks = Array.from({ length: stockCount }, (_, index) => ({ id: `qualification-stock-${index}`, symbol: `Q${index}`, name: `Synthetic qualification ${index}`, thesis: "Synthetic fixture only", createdAt: now.toISOString() }));
  const sectors = ["XLK", "XLY", "XLI"];
  const data = { ...structuredClone(seedData), stocks, eyes: stocks.map(stock => ({ id: `qualification-eye-${stock.id}`, stockId: stock.id, recipeId: seedData.recipes[0].id, recipeVersionAtCreation: seedData.recipes[0].version, thesisSnapshot: stock.thesis, createdAt: now.toISOString() })), snapshots: [], alerts: [], decisions: [], outcomes: [], evaluations: [], rawBarArchives: [], universeSnapshots: [], scanRuns: [], scanSignals: [], reviewLogs: [], processedFeatures: [], forwardProofLedger: [], scannerSettings: { ...seedData.scannerSettings, universeMode: "frozen_research_universe" as const, frozenUniverseBySector: Object.fromEntries(sectors.map((sector, index) => [sector, stocks.filter((_, stockIndex) => stockIndex % 3 === index).map(stock => stock.symbol)])) } };
  const histories = [...stocks.map(stock => stock.symbol), "SPY", ...sectors].map(symbol => ({ symbol, rows: dates.map((date, index) => ({ symbol, date, open: 100 + index, close: 100 + index, high: 101 + index, low: 99 + index, volume: 1000 })) }));
  return { data, histories, sessions: sessionCount, symbols: histories.length };
};

export interface OperationsQualificationResult {
  synthetic: true;
  contractVersion: typeof OPERATIONS_QUALIFICATION_CONTRACT_VERSION;
  revision: typeof OPERATIONS_QUALIFICATION_REVISION;
  workload: { stocks: number; historySessions: number; symbols: number; sampleCount: number };
  dailyWorkload: { elapsedMs: number; deadlineBudgetMs: number; headroomMs: number; withinBudget: boolean; evidenceOnly: true };
  repeatedSamples: { count: number; elapsedMs: number[]; p50Ms: number | null; p95Ms: number | null; percentilesRequireMultipleSamples: true };
  backlogAndRetrySurge: { queueDepth: number; oldestActionableAgeMs: number | null; retryCount: number; terminalCount: number; attemptBudgetPreserved: boolean };
  storageGrowth: { beforeBytes: number; afterBytes: number; deltaBytes: number; workspaceBytes: number | null };
  restore: { elapsedMs: number; headroomMs: number; withinBudget: boolean; integrity: boolean };
  process: { endingRssBytes: number };
  qualificationBudgets: { dailyDeadlineMs: number; restoreRtoMs: number; rationale: string };
}

export async function runOperationsQualification(options: { samples?: number; stocks?: number; sessions?: number } = {}): Promise<OperationsQualificationResult> {
  const sampleCount = Math.max(2, Math.floor(options.samples ?? 3));
  const stocks = Math.max(4, Math.floor(options.stocks ?? 100));
  const sessions = Math.max(20, Math.floor(options.sessions ?? 260));
  const now = new Date("2026-09-14T22:00:00.000Z");
  const elapsedMs: number[] = [];
  let surge: OperationsQualificationResult["backlogAndRetrySurge"] | null = null;
  let storage: OperationsQualificationResult["storageGrowth"] | null = null;
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const directory = mkdtempSync(join(tmpdir(), "stockledger-chg96-qualification-"));
    const path = join(directory, "worker.sqlite");
    const store = new WorkerStore(path);
    try {
      const fixture = syntheticFixture(stocks, sessions, now);
      store.import(fixture.data, 0, now.getTime());
      const beforeBytes = bytesFor(path);
      const started = performance.now();
      const result = await runWorker(store, fixture.histories, { source: "Synthetic qualification", adjustment: "adjusted", now });
      const duration = Math.round(performance.now() - started);
      elapsedMs.push(duration);
      const retry = jobIdentityFor({ kind: "ingestion-readiness", scheduledSession: `qualification-retry-${sample}`, workflowKey: `qualification-retry-${sample}`, inputHash: `qualification-retry-${sample}`, dueAtUtc: now.toISOString() });
      store.enqueue(retry, now.getTime() - 10_000);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const token = store.claimJob(retry.id, "qualification", now.getTime() + (attempt + 1) * 1_000_000);
        if (!token) throw new Error("Qualification retry fixture could not claim its bounded attempt.");
        store.failJob(retry.id, token, "synthetic retry surge", now.getTime() + (attempt + 1) * 1_000_000 + 1);
      }
      const retryBacklog = jobIdentityFor({ kind: "outcome-forward-proof", scheduledSession: `qualification-retry-backlog-${sample}`, workflowKey: `qualification-retry-backlog-${sample}`, inputHash: `qualification-retry-backlog-${sample}`, dueAtUtc: new Date(now.getTime() - 600_000).toISOString() });
      store.enqueue(retryBacklog, now.getTime() - 600_000);
      const retryBacklogToken = store.claimJob(retryBacklog.id, "qualification", now.getTime() - 590_000);
      if (!retryBacklogToken) throw new Error("Qualification retry backlog fixture could not claim its bounded attempt.");
      store.failJob(retryBacklog.id, retryBacklogToken, "synthetic retry backlog", now.getTime() - 589_000);
      for (let index = 0; index < 12; index += 1) {
        store.enqueue(jobIdentityFor({ kind: "evaluation-scan", scheduledSession: `qualification-queue-${sample}-${index}`, workflowKey: `qualification-queue-${sample}-${index}`, inputHash: `qualification-queue-${sample}-${index}`, dueAtUtc: new Date(now.getTime() - 600_000).toISOString() }), now.getTime() - 600_000);
      }
      const projected = createOperationsStatus(store, { observedAt: now, appVersion: "qualification" });
      surge = { queueDepth: projected.workerQueues.activeCount, oldestActionableAgeMs: projected.workerQueues.oldestActionableAgeMs, retryCount: projected.workerQueues.retryCount, terminalCount: projected.workerQueues.terminalCount, attemptBudgetPreserved: store.getJob(retry.id)?.attempts === 5 && store.getJob(retry.id)?.status === "terminal-failed" };
      const afterBytes = bytesFor(path);
      storage = { beforeBytes, afterBytes, deltaBytes: Math.max(0, afterBytes - beforeBytes), workspaceBytes: projected.workspaceStorage.workspaceBytes };
      if (!result.deadline.withinBudget) break;
    } finally {
      store.close();
      rmSync(directory, { recursive: true, force: true });
    }
  }
  const restore = await runRecoveryDrill();
  const p50Ms = percentile(elapsedMs, 0.5);
  const p95Ms = percentile(elapsedMs, 0.95);
  return {
    synthetic: true, contractVersion: OPERATIONS_QUALIFICATION_CONTRACT_VERSION, revision: OPERATIONS_QUALIFICATION_REVISION,
    workload: { stocks, historySessions: sessions, symbols: stocks + 4, sampleCount: elapsedMs.length },
    dailyWorkload: { elapsedMs: elapsedMs[0] ?? 0, deadlineBudgetMs: WORKER_DEFAULT_DEADLINE_BUDGET_MS, headroomMs: WORKER_DEFAULT_DEADLINE_BUDGET_MS - (elapsedMs[0] ?? 0), withinBudget: (elapsedMs[0] ?? Number.POSITIVE_INFINITY) <= WORKER_DEFAULT_DEADLINE_BUDGET_MS, evidenceOnly: true },
    repeatedSamples: { count: elapsedMs.length, elapsedMs, p50Ms, p95Ms, percentilesRequireMultipleSamples: true },
    backlogAndRetrySurge: surge ?? { queueDepth: 0, oldestActionableAgeMs: null, retryCount: 0, terminalCount: 0, attemptBudgetPreserved: false },
    storageGrowth: storage ?? { beforeBytes: 0, afterBytes: 0, deltaBytes: 0, workspaceBytes: null },
    restore: { elapsedMs: restore.elapsedMs, headroomMs: restore.rto.engineeringQualificationBudgetMs - restore.elapsedMs, withinBudget: restore.rto.withinEngineeringQualificationBudget, integrity: restore.restored.integrity },
    process: { endingRssBytes: process.memoryUsage().rss },
    qualificationBudgets: { dailyDeadlineMs: WORKER_DEFAULT_DEADLINE_BUDGET_MS, restoreRtoMs: restore.rto.engineeringQualificationBudgetMs, rationale: "bounded local engineering qualification budgets for synthetic fixtures; not an SLA, production capacity claim, provider throughput, or real-user load" },
  };
}
