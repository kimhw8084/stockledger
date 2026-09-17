import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { WorkerStore } from "../server/worker/store";
import { seedData } from "../src/lib/seed";
import { runWorker } from "../server/worker/run";
import { runManagedJob } from "../server/worker/managed";
import { jobIdentityFor, retryDelayMs, WORKER_MAX_ATTEMPTS } from "../server/worker/contract";
import { marketSessionDueAtUtc, previousUsTradingDate } from "../src/lib/marketCalendar";
import { serializeExport } from "../src/domain/backupFormat";
const folders: string[] = [];
const databasePath = () => { const dir = mkdtempSync(join(tmpdir(), "stockledger-test-")); folders.push(dir); return join(dir, "ledger.sqlite"); };
afterEach(() => { for (const dir of folders.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const managedFixture = (endDate = "2026-09-14", count = 260) => {
  const data = structuredClone(seedData);
  data.scannerSettings = { ...data.scannerSettings, universeMode: "frozen_research_universe", frozenUniverseBySector: { XLK: [data.stocks[0].symbol] } };
  const dates = [endDate];
  while (dates.length < count) dates.unshift(previousUsTradingDate(dates[0]));
  const histories = [...new Set([data.stocks[0].symbol, "SPY", "XLK"])].map(symbol => ({ symbol, rows: dates.map((date, index) => ({ symbol, date, open: 100 + index, close: 100 + index, high: 101 + index, low: 99 + index, volume: 1000 })) }));
  return { data, histories };
};
it("persists revisions and rejects stale writes without losing records", () => {
  const path = databasePath(); const first = new WorkerStore(path);
  first.import(seedData, 0); first.close();
  const reopened = new WorkerStore(path);
  expect(reopened.load()?.revision).toBe(1);
  expect(() => reopened.import(seedData, 0)).toThrow(/conflict/);
  expect(reopened.load()?.data.stocks.length).toBe(seedData.stocks.length);
  expect(reopened.integrityCheck()).toBe(true); reopened.close();
});
it("reclaims expired work and prevents the former worker from committing", () => {
  const store = new WorkerStore(databasePath()); store.import(seedData, 0);
  const oldToken = store.claim("job", 1000, 100)!;
  expect(store.claim("job", 1050, 100)).toBeNull();
  const token = store.claim("job", 1200, 100)!;
  expect(() => store.complete("job", oldToken, seedData, 1, 1250)).toThrow(/lease/);
  store.complete("job", token, seedData, 1, 1250);
  expect(store.load()?.revision).toBe(2);
  expect(store.claim("job", 2000)).toBeNull();
  expect(store.pendingOutbox()).toHaveLength(1);
  store.acknowledge(String(store.pendingOutbox()[0].id));
  expect(store.pendingOutbox()).toHaveLength(0); store.close();
});
it("commits results and notification intent atomically", () => {
  const store = new WorkerStore(databasePath()); store.import(seedData, 0);
  const token = store.claim("job", 1000)!;
  expect(() => store.complete("job", token, seedData, 99, 1100)).toThrow(/conflict/);
  expect(store.load()?.revision).toBe(1);
  expect(store.pendingOutbox()).toHaveLength(0); store.close();
});
it("restores a consistent SQLite snapshot", async () => {
  const path = databasePath(); const store = new WorkerStore(path); store.import(seedData, 0);
  await store.backup(path + ".backup"); store.close();
  const restored = new WorkerStore(path + ".backup");
  expect(restored.integrityCheck()).toBe(true);
  expect(restored.load()?.data.recipes).toEqual(seedData.recipes);
  restored.close();
});
it("runs the shared engine from local CSV observations and survives restart without repeating a job", async () => {
  const path = databasePath(); const store = new WorkerStore(path);
  const data = structuredClone(seedData);
  data.scannerSettings = { ...data.scannerSettings, universeMode: "frozen_research_universe", frozenUniverseBySector: { XLK: [data.stocks[0].symbol] } };
  store.import(data, 0);
  const dates = ["2026-09-14"];
  while (dates.length < 260) dates.unshift(previousUsTradingDate(dates[0]));
  const histories = [...new Set([data.stocks[0].symbol, "SPY", "XLK"])].map(symbol => ({ symbol, rows: dates.map((date, index) => ({ symbol, date, open: 100 + index, close: 100 + index, high: 101 + index, low: 99 + index, volume: 1000 })) }));
  const options = { source: "Regression fixture", adjustment: "adjusted" as const, now: new Date("2026-09-14T22:00:00Z") };
  await runWorker(store, histories, options);
  expect(store.load()?.data.scanRuns[0].providerName).toBe("Regression fixture");
  expect(store.load()?.data.snapshots[0].provenance?.observedDate).toBe("2026-09-14");
  expect(store.pendingOutbox()).toHaveLength(1); store.close();
  const restarted = new WorkerStore(path);
  expect((await runWorker(restarted, histories, options)).status).toBe("already_claimed_or_completed");
  expect(restarted.load()?.revision).toBe(2); expect(restarted.pendingOutbox()).toHaveLength(1); restarted.close();
});

it("creates deterministic versioned stage keys and deduplicates repeated managed invocations", async () => {
  const path = databasePath(); const store = new WorkerStore(path); const { data, histories } = managedFixture();
  store.import(data, 0);
  const options = { source: "Managed fixture", adjustment: "adjusted" as const, now: new Date("2026-09-14T22:00:00Z"), owner: "managed-test" };
  const first = await runManagedJob(store, histories, options);
  expect(first.status).toBe("completed");
  const jobs = store.listJobs({ scheduledSession: "2026-09-14" });
  expect(jobs.map(job => job.kind)).toEqual(["ingestion-readiness", "evaluation-scan", "notification-outbox-intent", "outcome-forward-proof"].sort());
  expect(new Set(jobs.map(job => job.contractVersion))).toEqual(new Set(["stockledger-production-job-v1"]));
  expect(new Set(jobs.map(job => job.semanticIdempotencyKey)).size).toBe(4);
  const second = await runManagedJob(store, histories, options);
  expect(second.status).toBe("already_claimed_or_completed");
  expect(store.listJobs()).toHaveLength(4);
  expect(store.pendingOutbox()).toHaveLength(1);
  expect(first.deadline.workloadSize).toEqual({ symbols: 3, rows: 780, scheduledSessions: 1, jobStages: 4 });
  store.close();
});

it("renews a legitimate long lease and still rejects the replaced former worker", () => {
  const store = new WorkerStore(databasePath()); store.import(seedData, 0);
  const job = jobIdentityFor({ kind: "evaluation-scan", scheduledSession: "2026-09-14", workflowKey: "renewal", inputHash: "renewal", dueAtUtc: marketSessionDueAtUtc("2026-09-14").toISOString() });
  store.enqueue(job, 1000);
  const oldToken = store.claimJob(job.id, "worker-a", 1000, 100)!;
  expect(store.renewLease(job.id, oldToken, 1050, 100)).toBe(true);
  expect(store.claimJob(job.id, "worker-b", 1149, 100)).toBeNull();
  store.complete(job.id, oldToken, seedData, 1, 1149);
  expect(store.claimJob(job.id, "worker-b", 1300, 100)).toBeNull();
  expect(() => store.complete(job.id, oldToken, seedData, 2, 1300)).toThrow(/lease/);
  store.close();
});

it("uses deterministic capped retry backoff and terminal-fails after five attempts", () => {
  const store = new WorkerStore(databasePath()); store.import(seedData, 0);
  const job = jobIdentityFor({ kind: "ingestion-readiness", scheduledSession: "2026-09-14", workflowKey: "retry", inputHash: "retry", dueAtUtc: marketSessionDueAtUtc("2026-09-14").toISOString() });
  store.enqueue(job, 1000);
  let now = 1000;
  for (let attempt = 1; attempt <= WORKER_MAX_ATTEMPTS; attempt += 1) {
    const token = store.claimJob(job.id, "retry-worker", now, 10_000)!;
    store.failJob(job.id, token, `failure-${attempt}`, now + 1);
    const saved = store.getJob(job.id)!;
    expect(saved.attempts).toBe(attempt);
    if (attempt < WORKER_MAX_ATTEMPTS) {
      expect(saved.status).toBe("retry-wait");
      expect(saved.nextRetryAt).toBe(now + 1 + retryDelayMs(attempt));
      expect(store.claimJob(job.id, "retry-worker", now + 2, 10_000)).toBeNull();
      now = saved.nextRetryAt!;
    } else expect(saved.status).toBe("terminal-failed");
  }
  store.close();
});

it("preserves partial provider coverage while committing one result and one outbox intent", async () => {
  const store = new WorkerStore(databasePath()); const { data, histories } = managedFixture();
  store.import(data, 0);
  const partial = histories.map(history => history.symbol === data.stocks[0].symbol ? { ...history, rows: [], error: "provider timeout" } : history);
  const result = await runManagedJob(store, partial, { source: "Partial provider", adjustment: "adjusted", now: new Date("2026-09-14T22:00:00Z") });
  expect(result.status).toBe("partial");
  expect(store.load()?.revision).toBe(2);
  expect(store.listJobs({ scheduledSession: "2026-09-14" }).find(job => job.kind === "evaluation-scan")?.status).toBe("partial");
  expect(store.listJobs({ scheduledSession: "2026-09-14" }).find(job => job.kind === "notification-outbox-intent")?.status).toBe("completed");
  expect(store.pendingOutbox()).toHaveLength(1);
  store.close();
});

it("catches up missed completed-market sessions without replaying completed semantic work", async () => {
  const store = new WorkerStore(databasePath()); const { data, histories } = managedFixture(); store.import(data, 0);
  const first = await runManagedJob(store, histories, { source: "Catch-up fixture", adjustment: "adjusted", now: new Date("2026-09-14T22:00:00Z") });
  const extended = managedFixture("2026-09-17", 263);
  const second = await runManagedJob(store, extended.histories, { source: "Catch-up fixture", adjustment: "adjusted", now: new Date("2026-09-17T22:00:00Z") });
  expect(first.status).toBe("completed");
  expect(second.status).toBe("completed");
  expect(second.sessions).toEqual(["2026-09-15", "2026-09-16", "2026-09-17"]);
  expect(second.scheduler.coverage.completedSessions).toEqual(["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17"]);
  const jobCount = store.listJobs().length;
  const repeated = await runManagedJob(store, extended.histories, { source: "Catch-up fixture", adjustment: "adjusted", now: new Date("2026-09-17T22:00:00Z") });
  expect(repeated.status).toBe("already_claimed_or_completed");
  expect(store.listJobs()).toHaveLength(jobCount);
  expect(store.pendingOutbox()).toHaveLength(4);
  store.close();
});

it("runs the managed entry point from the app-closed CLI and reports truthful status", () => {
  const directory = mkdtempSync(join(tmpdir(), "stockledger-cli-test-")); folders.push(directory);
  const { data, histories } = managedFixture();
  const backup = join(directory, "workspace.json"); const csvDirectory = join(directory, "prices"); const db = join(directory, "worker.sqlite"); const output = join(directory, "worker.json");
  mkdirSync(csvDirectory);
  writeFileSync(backup, serializeExport(data, 0));
  for (const history of histories) writeFileSync(join(csvDirectory, `${history.symbol}.csv`), `Date,Open,High,Low,Close,Volume\n${history.rows.map(row => `${row.date},${row.open},${row.high},${row.low},${row.close},${row.volume}`).join("\n")}\n`);
  const stdout = execFileSync(process.execPath, ["--experimental-sqlite", join(process.cwd(), "node_modules/tsx/dist/cli.mjs"), "server/worker/cli.ts", "--managed", "--db", db, "--import", backup, "--csv", csvDirectory, "--output", output, "--adjustment", "adjusted", "--source", "CLI fixture"], { cwd: process.cwd(), encoding: "utf8" });
  expect(stdout).toContain('"mode":"managed"');
  expect(stdout).toContain('"schedulerInstalled":false');
  expect(existsSync(output)).toBe(true);
});

it("rejects pathological input without silently discarding queued work", async () => {
  const store = new WorkerStore(databasePath()); store.import(seedData, 0);
  const histories = Array.from({ length: 601 }, (_, index) => ({ symbol: `T${index}`, rows: [] }));
  await expect(runManagedJob(store, histories, { source: "guard fixture", adjustment: "unknown", now: new Date("2026-09-14T22:00:00Z") })).rejects.toThrow(/600 symbols/);
  expect(store.listJobs()).toHaveLength(0);
  store.close();
});
