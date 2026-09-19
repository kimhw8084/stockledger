import { beforeEach, expect, it } from "vitest";
import { buildNotificationIntent } from "../src/domain/notificationDelivery";
import { createOperationsStatus, OPERATIONS_STATUS_CONTRACT_VERSION } from "../server/worker/operations";
import { jobIdentityFor } from "../server/worker/contract";
import { WorkerStore } from "../server/worker/store";
import { seedData } from "../src/lib/seed";
import { verifyRuntimeReleaseEvidence } from "../server/worker/releaseEvidenceRuntime";

const observedAt = new Date("2026-09-18T16:00:00.000Z");
let store: WorkerStore;
beforeEach(() => { store = new WorkerStore(":memory:"); store.import(structuredClone(seedData), 0, observedAt.getTime()); });

it("projects a stable versioned status with deterministic safe classification", () => {
  const job = jobIdentityFor({ kind: "evaluation-scan", scheduledSession: "2026-09-17", workflowKey: "operations-test", inputHash: "operations-test", dueAtUtc: "2026-09-17T15:00:00.000Z" });
  store.enqueue(job, observedAt.getTime() - 60_000);
  const run = store.createIngestionRun({ id: "operations-run", contractVersion: "stockledger-market-data-ingestion-v1", contractRevision: 1, providerIdentity: "synthetic", providerProductId: "fixture", datasetCategory: "daily_ohlcv", requestedStartDate: "2026-09-17", requestedEndDate: "2026-09-17", rightsProfileId: "fixture", requestBudget: 2 }, ["SYN"], observedAt.getTime() - 30_000);
  store.finishIngestionItem({ runId: run.run.id, symbol: "SYN", status: "blocked-rights", errorClass: "rights_blocked", errorMessage: "private provider detail must not escape", now: observedAt.getTime() - 20_000 });
  store.updateIngestionRun(run.run.id, { status: "blocked-rights", now: observedAt.getTime() - 10_000 });
  const status = createOperationsStatus(store, { observedAt, appVersion: "test" });
  expect(status.contractVersion).toBe(OPERATIONS_STATUS_CONTRACT_VERSION);
  expect(status.revision).toBe(1);
  expect(status.overall.state).toBe("blocked");
  expect(status.overall.reasons).toEqual([...status.overall.reasons].sort());
  expect(status.workerQueues.countsByState.queued).toBe(1);
  expect(status.workerQueues.oldestActionableDueAtUtc).toBe("2026-09-17T15:00:00.000Z");
  expect(status.ingestion.itemsByState["blocked-rights"]).toBe(1);
  expect(status.ingestion.failureClasses.rightsBlocked).toBe(2);
  expect(status.sync.state).toBe("unavailable");
  expect(status.externalDependencies.providerQuotaCostRunway).toBe("unavailable");
  expect(status.externalDependencies.hostedScheduler).toBe("not-configured");
  store.close();
});

it("keeps notification state counts and safe diagnostics free of private fields", () => {
  const data = structuredClone(seedData);
  data.notificationPreferences = { ...data.notificationPreferences, explicitConsent: true, enabled: true, allowedChannels: ["email"], destinations: { email: { address: "secret@example.invalid" } }, updatedAt: observedAt.toISOString() };
  store.import(data, store.load()?.revision ?? 0, observedAt.getTime());
  const job = jobIdentityFor({ kind: "notification-outbox-intent", scheduledSession: "2026-09-17", workflowKey: "notification-operations-test", inputHash: "notification-operations-test", dueAtUtc: observedAt.toISOString() });
  store.enqueue(job, observedAt.getTime());
  const token = store.claimJob(job.id, "operations-test", observedAt.getTime());
  expect(token).toBeTruthy();
  store.commitJobResult({ id: job.id, token: token!, data, expectedRevision: store.load()?.revision ?? 0, status: "completed", notificationIntents: [buildNotificationIntent(data.alerts[0], data.notificationPreferences, observedAt.getTime())], now: observedAt.getTime() });
  const status = createOperationsStatus(store, { observedAt, appVersion: "test" });
  const serialized = JSON.stringify(status);
  expect(status.notificationDelivery.countsByState.pending).toBe(1);
  expect(serialized).not.toContain("secret@example.invalid");
  expect(serialized).not.toContain("thesis");
  expect(serialized).not.toContain("notification body");
  expect(serialized).not.toContain("private provider detail");
  expect(Object.keys(status.notificationDelivery)).not.toContain("destination");
  store.close();
});

it("keeps release identity unavailable or mismatched unless independently verified", () => {
  const unavailable = verifyRuntimeReleaseEvidence({ source: { commit: "a".repeat(40), tree: "b".repeat(40) } });
  expect(unavailable.state).toBe("unavailable");
  expect(unavailable.reason).toBe("release_identity_unavailable");

  const mismatched = createOperationsStatus(store, {
    observedAt,
    sourceIdentity: { commit: "a".repeat(40), tree: "b".repeat(40), state: "mismatched", reason: "release_identity_mismatched" },
  });
  expect(mismatched.releaseIdentity.state).toBe("mismatched");
  expect(mismatched.releaseIdentity.reason).toBe("release_identity_mismatched");
  expect(mismatched.overall.reasons).toContain("release_identity_mismatched");
  expect(mismatched.overall.state).not.toBe("healthy");
  store.close();
});
