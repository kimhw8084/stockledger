import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { WorkerStore } from "../server/worker/store";
import { seedData } from "../src/lib/seed";
import { runWorker } from "../server/worker/run";
import { runManagedJob } from "../server/worker/managed";
import { jobIdentityFor, retryDelayMs, WORKER_MAX_ATTEMPTS, WORKER_MAX_QUEUED_JOBS } from "../server/worker/contract";
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
  const firstScanSignalIds = store.load()?.data.scanSignals.map(signal => signal.signalId);
  const firstAlertIds = store.load()?.data.alerts.map(alert => alert.id);
  const second = await runManagedJob(store, histories, options);
  expect(second.status).toBe("already_claimed_or_completed");
  expect(store.load()?.revision).toBe(2);
  expect(store.load()?.data.scanRuns).toHaveLength(1);
  expect(store.load()?.data.scanSignals.map(signal => signal.signalId)).toEqual(firstScanSignalIds);
  expect(store.load()?.data.alerts.map(alert => alert.id)).toEqual(firstAlertIds);
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
  expect(result.scheduler.coverage.partialSessions).toEqual(["2026-09-14"]);
  expect(result.scheduler.coverage.completedSessions).toEqual([]);
  expect(result.scheduler.missedSessions).toEqual([]);
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

it.each([1, 2])("reconciles durable multi-session work after restart when interrupted before session %s completes", async interruptionAt => {
  const path = databasePath();
  const store = new WorkerStore(path);
  const firstFixture = managedFixture();
  store.import(firstFixture.data, 0);
  await runManagedJob(store, firstFixture.histories, { source: "Restart fixture", adjustment: "adjusted", now: new Date("2026-09-14T22:00:00Z") });
  const extended = managedFixture("2026-09-17", 263);
  const originalCommit = store.commitJobResult.bind(store);
  let commitCount = 0;
  store.commitJobResult = (input: Parameters<WorkerStore["commitJobResult"]>[0]) => {
    commitCount += 1;
    if (commitCount === interruptionAt) throw new Error("simulated process interruption");
    return originalCommit(input);
  };
  await expect(runManagedJob(store, extended.histories, { source: "Restart fixture", adjustment: "adjusted", now: new Date("2026-09-17T22:00:00Z") })).rejects.toThrow(/simulated process interruption/);
  expect(store.getSchedulerCheckpoint()?.lastExpectedSession).toBe("2026-09-17");
  expect(store.listJobs().filter(job => job.status === "retry-wait" || job.status === "queued")).not.toHaveLength(0);
  store.close();

  const restarted = new WorkerStore(path);
  const resumed = await runManagedJob(restarted, extended.histories, { source: "Restart fixture", adjustment: "adjusted", now: new Date("2026-09-17T22:02:00Z") });
  expect(resumed.sessions).toEqual(interruptionAt === 1 ? ["2026-09-15", "2026-09-16", "2026-09-17"] : ["2026-09-16", "2026-09-17"]);
  expect(restarted.listJobs().filter(job => job.kind === "evaluation-scan").every(job => job.status === "completed")).toBe(true);
  expect(restarted.schedulerStatus(new Date("2026-09-17T22:02:00Z")).coverage.completedSessions).toEqual(["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17"]);
  const revision = restarted.load()?.revision;
  const scanRuns = restarted.load()?.data.scanRuns.length;
  const signalIds = restarted.load()?.data.scanSignals.map(signal => signal.signalId);
  const alertIds = restarted.load()?.data.alerts.map(alert => alert.id);
  const outboxCount = restarted.pendingOutbox().length;
  const replay = await runManagedJob(restarted, extended.histories, { source: "Restart fixture", adjustment: "adjusted", now: new Date("2026-09-17T22:02:00Z") });
  expect(replay.status).toBe("already_claimed_or_completed");
  expect(restarted.load()?.revision).toBe(revision);
  expect(restarted.load()?.data.scanRuns.length).toBe(scanRuns);
  expect(restarted.load()?.data.scanSignals.map(signal => signal.signalId)).toEqual(signalIds);
  expect(restarted.load()?.data.alerts.map(alert => alert.id)).toEqual(alertIds);
  expect(restarted.pendingOutbox()).toHaveLength(outboxCount);
  restarted.close();
});

it("persists retry deadlines and reclaims expired running work across SQLite restart", () => {
  const path = databasePath();
  const store = new WorkerStore(path);
  store.import(seedData, 0);
  const retryJob = jobIdentityFor({ kind: "ingestion-readiness", scheduledSession: "2026-09-14", workflowKey: "restart-retry", inputHash: "restart-retry", dueAtUtc: marketSessionDueAtUtc("2026-09-14").toISOString() });
  store.enqueue(retryJob, 1000);
  const retryToken = store.claimJob(retryJob.id, "retry-worker", 1000, 10_000)!;
  store.failJob(retryJob.id, retryToken, "persisted failure", 1001);
  const retryBeforeClose = store.getJob(retryJob.id)!;
  store.close();
  const restarted = new WorkerStore(path);
  expect(restarted.getJob(retryJob.id)?.attempts).toBe(1);
  expect(restarted.getJob(retryJob.id)?.nextRetryAt).toBe(retryBeforeClose.nextRetryAt);
  expect(restarted.claimJob(retryJob.id, "retry-worker", retryBeforeClose.nextRetryAt! - 1, 10_000)).toBeNull();
  expect(restarted.getJob(retryJob.id)?.attempts).toBe(1);
  expect(restarted.claimJob(retryJob.id, "retry-worker", retryBeforeClose.nextRetryAt!, 10_000)).not.toBeNull();

  const runningJob = jobIdentityFor({ kind: "evaluation-scan", scheduledSession: "2026-09-15", workflowKey: "restart-lease", inputHash: "restart-lease", dueAtUtc: marketSessionDueAtUtc("2026-09-15").toISOString() });
  restarted.enqueue(runningJob, 2000);
  const oldToken = restarted.claimJob(runningJob.id, "old-worker", 2000, 100)!;
  restarted.close();
  const reclaimed = new WorkerStore(path);
  const newToken = reclaimed.claimJob(runningJob.id, "new-worker", 2101, 100)!;
  expect(newToken).not.toBe(oldToken);
  expect(() => reclaimed.complete(runningJob.id, oldToken, seedData, 1, 2101)).toThrow(/lease/);
  reclaimed.close();
});

it("reports calendar missed sessions from a known baseline without inventing pre-baseline obligations", () => {
  const path = databasePath();
  const store = new WorkerStore(path);
  store.import(seedData, 0);
  store.updateSchedulerState({
    lastInvocationAtUtc: "2026-09-14T22:00:00.000Z",
    lastExpectedSession: "2026-09-14",
    lastSafeError: null,
    now: Date.parse("2026-09-14T22:00:00.000Z"),
  });
  store.close();
  const restarted = new WorkerStore(path);
  const status = restarted.schedulerStatus(new Date("2026-09-17T22:00:00Z"));
  expect(status.missedSessions).toEqual(["2026-09-15", "2026-09-16", "2026-09-17"]);
  expect(status.coverage.scheduledSessions).toEqual(["2026-09-15", "2026-09-16", "2026-09-17"]);
  expect(status.coverage.completedSessions).toEqual([]);
  expect(status.state).toBe("missed");
  restarted.close();
});

it.each(["partial", "blocked"] as const)("creates a new immutable semantic revision for corrected older %s evidence", async mode => {
  const path = databasePath();
  const fixture = managedFixture();
  const initialData = structuredClone(fixture.data);
  if (mode === "blocked") initialData.scannerSettings = { ...initialData.scannerSettings, frozenUniverseBySector: {} };
  const store = new WorkerStore(path);
  store.import(initialData, 0);
  const initialHistories = mode === "partial"
    ? fixture.histories.map(history => history.symbol === initialData.stocks[0].symbol ? { ...history, rows: [], error: "provider timeout" } : history)
    : fixture.histories;
  const initial = await runManagedJob(store, initialHistories, { source: `Initial ${mode}`, adjustment: "adjusted", now: new Date("2026-09-14T22:00:00Z") });
  expect(initial.status).toBe(mode);
  const oldJob = store.listJobs({ scheduledSession: "2026-09-14", kind: "evaluation-scan" })[0];
  const oldRun = store.load()?.data.scanRuns[0];
  if (mode === "blocked") {
    const recoveredData = structuredClone(store.load()!.data);
    recoveredData.scannerSettings = fixture.data.scannerSettings;
    store.import(recoveredData, 2);
  }
  const corrected = await runManagedJob(store, fixture.histories, { source: `Corrected ${mode}`, adjustment: "adjusted", now: new Date("2026-09-14T22:00:00Z") });
  const evaluationJobs = store.listJobs({ scheduledSession: "2026-09-14", kind: "evaluation-scan" });
  expect(corrected.status).toBe("completed");
  expect(evaluationJobs).toHaveLength(2);
  expect(evaluationJobs.find(job => job.id === oldJob.id)?.status).toBe(mode);
  expect(evaluationJobs.find(job => job.id !== oldJob.id)?.status).toBe("completed");
  expect(store.load()?.data.scanRuns).toHaveLength(2);
  expect(store.load()?.data.scanRuns.some(run => run.id === oldRun?.id)).toBe(true);
  const jobCount = store.listJobs().length;
  const revision = store.load()?.revision;
  await runManagedJob(store, fixture.histories, { source: `Corrected ${mode}`, adjustment: "adjusted", now: new Date("2026-09-14T22:00:00Z") });
  expect(store.listJobs()).toHaveLength(jobCount);
  expect(store.load()?.revision).toBe(revision);
  store.close();
});

it("keeps durable work when the 32-session and 256-active-job guards reject new planning", async () => {
  const firstPath = databasePath();
  const first = new WorkerStore(firstPath);
  const fixture = managedFixture("2026-09-17", 263);
  first.import(fixture.data, 0);
  const durable = jobIdentityFor({ kind: "evaluation-scan", scheduledSession: "2026-09-14", workflowKey: "guard-durable", inputHash: "guard-durable", dueAtUtc: marketSessionDueAtUtc("2026-09-14").toISOString() });
  first.enqueue(durable, Date.parse("2026-09-14T22:00:00Z"));
  first.updateSchedulerState({ lastExpectedSession: "2026-07-01", lastSafeError: null, now: Date.parse("2026-09-14T22:00:00Z") });
  const catchUp = await runManagedJob(first, fixture.histories, { source: "guard", adjustment: "adjusted", now: new Date("2026-09-17T22:00:00Z") });
  expect(catchUp.status).toBe("admission_blocked");
  expect(first.getJob(durable.id)?.status).toBe("queued");
  first.close();

  const second = new WorkerStore(databasePath());
  second.import(fixture.data, 0);
  let session = "2026-09-17";
  const jobs = [];
  for (let index = 0; index < WORKER_MAX_QUEUED_JOBS / 4; index += 1) {
    session = previousUsTradingDate(session);
    for (const kind of ["ingestion-readiness", "evaluation-scan", "outcome-forward-proof", "notification-outbox-intent"] as const) {
      jobs.push(jobIdentityFor({ kind, scheduledSession: session, workflowKey: `guard-${index}`, inputHash: `guard-${index}`, dueAtUtc: marketSessionDueAtUtc(session).toISOString() }));
    }
  }
  second.enqueueMany(jobs, Date.parse("2026-09-17T22:00:00Z"));
  const queueFull = await runManagedJob(second, fixture.histories, { source: "guard", adjustment: "adjusted", now: new Date("2026-09-17T22:00:00Z") });
  expect(queueFull.status).toBe("admission_blocked");
  expect(second.listJobs()).toHaveLength(WORKER_MAX_QUEUED_JOBS);
  expect(second.listJobs().every(job => job.status === "queued")).toBe(true);
  second.close();
});

it("distinguishes an explicit null scheduler patch from an omitted property", () => {
  const store = new WorkerStore(databasePath());
  store.updateSchedulerState({ lastSafeError: "stale safe error", now: 1000 });
  expect(store.getSchedulerCheckpoint()?.lastSafeError).toBe("stale safe error");
  store.updateSchedulerState({ lastSafeError: null, now: 1001 });
  expect(store.getSchedulerCheckpoint()?.lastSafeError).toBeNull();
  store.updateSchedulerState({ now: 1002 });
  expect(store.getSchedulerCheckpoint()?.lastSafeError).toBeNull();
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
