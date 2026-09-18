import { createServer } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { buildNotificationIntent, notificationIntentIdentity, safeNotificationMessage } from "../src/domain/notificationDelivery";
import { defaultNotificationPreferences } from "../src/domain/notificationPreferences";
import { parseExport, serializeExport } from "../src/domain/backupFormat";
import { seedData } from "../src/lib/seed";
import type { Alert, NotificationPreferences } from "../src/types";
import { jobIdentityFor } from "../server/worker/contract";
import { deliverDueNotifications, InMemoryTestEmailTransport, SmtpEmailTransport } from "../server/worker/notificationTransport";
import { WorkerStore } from "../server/worker/store";

const folders: string[] = [];
const databasePath = () => { const dir = mkdtempSync(join(tmpdir(), "stockledger-notification-test-")); folders.push(dir); return join(dir, "ledger.sqlite"); };
const now = Date.parse("2026-09-18T12:00:00.000Z");
const enabledPreferences = (): NotificationPreferences => ({
  ...defaultNotificationPreferences(new Date(now)),
  explicitConsent: true,
  enabled: true,
  allowedChannels: ["email" as const],
  destinations: { email: { address: "local@example.test" } },
  timezone: "UTC",
});
const testAlert = (id = "alert-notification-test"): Alert => ({
  ...structuredClone(seedData.alerts[0]),
  id,
  reviewed: false,
  snoozedUntil: undefined,
});
const testData = (preferences = enabledPreferences(), alert = testAlert()) => ({
  ...structuredClone(seedData),
  notificationPreferences: preferences,
  alerts: [alert],
});
const queueJob = (store: WorkerStore, suffix: string, at = now) => {
  const job = jobIdentityFor({ kind: "notification-outbox-intent", scheduledSession: "2026-09-18", workflowKey: `notification-${suffix}`, inputHash: `input-${suffix}`, dueAtUtc: new Date(at).toISOString() });
  store.enqueue(job, at);
  return { job, token: store.claimJob(job.id, `test-${suffix}`, at, 10_000)! };
};
const commitIntent = (store: WorkerStore, suffix: string, input = buildNotificationIntent(testAlert(), enabledPreferences(), now)) => {
  const { job, token } = queueJob(store, suffix);
  const data = testData();
  const revision = store.load()?.revision ?? 0;
  store.commitJobResult({ id: job.id, token, data, expectedRevision: revision, notificationIntents: [input], now });
  return input;
};

afterEach(() => { for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true }); });

it("creates one durable semantic intent atomically and deduplicates replayed intent insertion", () => {
  const store = new WorkerStore(databasePath());
  const data = testData();
  store.import(data, 0);
  const input = buildNotificationIntent(data.alerts[0], data.notificationPreferences, now);
  const first = queueJob(store, "first");
  store.commitJobResult({ id: first.job.id, token: first.token, data, expectedRevision: 1, notificationIntents: [input], outbox: { id: "outbox-first", payload: { type: "notification.intent", version: 2, deliveryContractVersion: input.contractVersion, alertIds: [input.alertId], intentIds: [input.id] } }, now });
  const second = queueJob(store, "replay");
  store.commitJobResult({ id: second.job.id, token: second.token, data, expectedRevision: 2, notificationIntents: [input], now: now + 1 });
  expect(store.listNotificationIntents()).toHaveLength(1);
  expect(store.pendingOutbox()).toHaveLength(1);
  expect(store.load()?.data.alerts).toHaveLength(1);
  store.close();
});

it("round-trips versioned device-local notification preferences through full backup export/import", () => {
  const data = testData();
  const restored = parseExport(serializeExport(data, 7));
  expect(restored.notificationPreferences).toEqual(data.notificationPreferences);
  const legacy = { ...data } as Record<string, unknown>;
  delete legacy.notificationPreferences;
  expect(parseExport(JSON.stringify(legacy)).notificationPreferences.enabled).toBe(false);
  expect(restored.notificationPreferences.accountScope).toBe("device-local");
});

it("persists crash-before-claim, concurrent claim fencing, and lease expiry", async () => {
  const path = databasePath();
  const first = new WorkerStore(path); first.import(testData(), 0); const input = commitIntent(first, "lease"); first.close();
  const restarted = new WorkerStore(path);
  expect(restarted.getNotificationIntent(input.id)?.status).toBe("pending");
    const oldToken = restarted.claimNotificationIntent(input.id, "old", now, 100)!;
    expect(restarted.claimNotificationIntent(input.id, "racing", now + 1, 100)).toBeNull();
    expect(await deliverDueNotifications(restarted, null, { owner: "expired-runner", now: now + 101 })).toEqual([{ intentId: input.id, status: "ambiguous" }]);
    expect(restarted.getNotificationIntent(input.id)?.status).toBe("ambiguous");
    expect(() => restarted.recordNotificationOutcome(input.id, oldToken, { kind: "confirmed", providerMessageId: "old" }, now + 102)).toThrow(/lease/);
    expect(restarted.reconcileAmbiguousNotification(input.id, "reconciled-after-lease-expiry", now + 103)).toBe(true);
    expect(restarted.getNotificationIntent(input.id)?.status).toBe("delivered");
  restarted.close();
});

it("records confirmed receipts, leaves review state untouched, and keeps receipts immutable", async () => {
  const store = new WorkerStore(databasePath()); store.import(testData(), 0); const input = commitIntent(store, "success");
  const transport = new InMemoryTestEmailTransport();
  expect(await deliverDueNotifications(store, transport, { owner: "delivery", now })).toEqual([{ intentId: input.id, status: "delivered" }]);
  expect(store.listNotificationReceipts(input.id)[0].receiptType).toBe("confirmed");
  expect(store.load()?.data.alerts[0].reviewed).toBe(false);
  store.cancelNotificationIntent(input.id, "late-opt-out", now + 1);
  expect(store.getNotificationIntent(input.id)?.status).toBe("delivered");
  store.close();
});

it("uses semantic delivery identity for an idempotent-capable transport", async () => {
  const input = buildNotificationIntent(testAlert("alert-provider-idempotency"), enabledPreferences(), now);
  const transport = new InMemoryTestEmailTransport();
  const first = await transport.send({ alert: testAlert("alert-provider-idempotency"), intent: input as never });
  const second = await transport.send({ alert: testAlert("alert-provider-idempotency"), intent: input as never });
  expect(first).toEqual(second);
  expect(transport.messages).toHaveLength(1);
  expect(input.semanticIdempotencyKey).toContain("stockledger-notification-delivery-v1");
});

it("caps definitive failures with deterministic retry-wait and terminal failure", async () => {
  const store = new WorkerStore(databasePath()); store.import(testData(), 0); const input = commitIntent(store, "failure");
  const transport = new InMemoryTestEmailTransport("definitive-failure");
  let clock = now;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const result = await deliverDueNotifications(store, transport, { owner: `failure-${attempt}`, now: clock });
    const intent = store.getNotificationIntent(input.id)!;
    expect(result[0]?.status).toBe(attempt === 5 ? "failed" : "retry-wait");
    if (attempt < 5) clock = intent.nextRetryAt!;
  }
  expect(store.getNotificationIntent(input.id)?.attemptCount).toBe(5);
  expect(store.listNotificationAttempts(input.id)).toHaveLength(5);
  store.close();
});

it("records ambiguous provider outcomes once, then allows explicit reconciliation without resending", async () => {
  const store = new WorkerStore(databasePath()); store.import(testData(), 0); const input = commitIntent(store, "ambiguous");
  const transport = new InMemoryTestEmailTransport("ambiguous");
  await deliverDueNotifications(store, transport, { owner: "ambiguous", now });
  expect(store.getNotificationIntent(input.id)?.status).toBe("ambiguous");
  expect(await deliverDueNotifications(store, new InMemoryTestEmailTransport(), { owner: "retry", now: now + 1 })).toEqual([]);
  expect(store.reconcileAmbiguousNotification(input.id, "provider-reconciled", now + 2)).toBe(true);
  expect(store.getNotificationIntent(input.id)?.status).toBe("delivered");
  expect(store.listNotificationAttempts(input.id)).toHaveLength(1);
  store.close();
});

it("holds quiet-hours and digest work deterministically, then delivers the group", async () => {
  const preferences = { ...enabledPreferences(), deliveryMode: "digest" as const, digestTime: "13:00", quietHours: { enabled: true, start: "22:00", end: "07:00" } };
  const firstAlert = testAlert("alert-digest-a"); const secondAlert = testAlert("alert-digest-b");
  const firstIntent = buildNotificationIntent(firstAlert, preferences, now);
  const secondIntent = buildNotificationIntent(secondAlert, preferences, now);
  expect(firstIntent.status).toBe("held");
  expect(firstIntent.notBefore).toBe(secondIntent.notBefore);
  const store = new WorkerStore(databasePath()); store.import({ ...testData(preferences, firstAlert), alerts: [firstAlert, secondAlert] }, 0);
  commitIntent(store, "digest-a", firstIntent);
  const { job, token } = queueJob(store, "digest-b");
  store.commitJobResult({ id: job.id, token, data: { ...testData(preferences, firstAlert), alerts: [firstAlert, secondAlert] }, expectedRevision: 2, notificationIntents: [secondIntent], now });
  const transport = new InMemoryTestEmailTransport();
  expect(await deliverDueNotifications(store, transport, { owner: "digest", now: firstIntent.notBefore })).toHaveLength(2);
  expect(store.load()?.data.alerts.every(alert => !alert.reviewed)).toBe(true);
  store.close();
});

it("does not release a stale held intent while quiet hours are still active", async () => {
  const preferences = { ...enabledPreferences(), quietHours: { enabled: true, start: "22:00", end: "07:00" } };
  const alert = testAlert("alert-quiet-current");
  alert.snoozedUntil = "2026-09-18T22:00:00.000Z";
  const quietNow = Date.parse("2026-09-18T23:00:00.000Z");
  const input = buildNotificationIntent(alert, preferences, Date.parse("2026-09-18T21:00:00.000Z"));
  const store = new WorkerStore(databasePath());
  const data = testData(preferences, alert); store.import(data, 0);
  const { job, token } = queueJob(store, "quiet-current", input.scheduledAt);
  store.commitJobResult({ id: job.id, token, data, expectedRevision: 1, notificationIntents: [input], now: input.scheduledAt });
  expect(await deliverDueNotifications(store, new InMemoryTestEmailTransport(), { owner: "quiet-current", now: quietNow })).toEqual([]);
  expect(store.getNotificationIntent(input.id)?.status).toBe("held");
  expect(store.getNotificationIntent(input.id)?.notBefore).toBeGreaterThan(quietNow);
  store.close();
});

it("cancels pending and retry-wait intents transactionally on opt-out, while snooze blocks claim", () => {
  const snoozed = testAlert("alert-snoozed"); snoozed.snoozedUntil = new Date(now + 60 * 60_000).toISOString();
  const store = new WorkerStore(databasePath());
  const data = testData(enabledPreferences(), snoozed); store.import(data, 0);
  const input = buildNotificationIntent(snoozed, data.notificationPreferences, now);
  const { job, token } = queueJob(store, "snooze");
  store.commitJobResult({ id: job.id, token, data, expectedRevision: 1, notificationIntents: [input], now });
  expect(store.claimNotificationIntent(input.id, "snooze-worker", now, 100)).toBeNull();
  const disabled = { ...data.notificationPreferences, enabled: false, explicitConsent: false, allowedChannels: [], updatedAt: new Date(now + 1).toISOString() };
  store.commitNotificationPreferences(disabled, 2, now + 1);
  expect(store.getNotificationIntent(input.id)?.status).toBe("canceled");
  store.close();
});

it("applies destination changes to pending work and cancels an intent during retry-wait", async () => {
  const store = new WorkerStore(databasePath()); const data = testData(); store.import(data, 0); const input = commitIntent(store, "preference-change");
  const firstPreferences = { ...data.notificationPreferences, destinations: { email: { address: "changed@example.test" } }, updatedAt: new Date(now + 1).toISOString() };
  store.commitNotificationPreferences(firstPreferences, 2, now + 1);
  expect(store.getNotificationIntent(input.id)?.destination).toBe("changed@example.test");
  const token = store.claimNotificationIntent(input.id, "retry-worker", now + 2)!;
  store.recordNotificationOutcome(input.id, token, { kind: "definitive-failure", errorClass: "temporary" }, now + 2);
  expect(store.getNotificationIntent(input.id)?.status).toBe("retry-wait");
  const disabled = { ...firstPreferences, enabled: false, explicitConsent: false, allowedChannels: [], updatedAt: new Date(now + 3).toISOString() };
  store.syncNotificationPolicy({ ...data, notificationPreferences: disabled }, now + 3);
  expect(store.getNotificationIntent(input.id)?.status).toBe("canceled");
  store.close();
});

it("recovers an unconfigured channel, cancels account-owned work on invalidation, and preserves minimal privacy", async () => {
  const preferences: NotificationPreferences = { ...enabledPreferences(), destinations: {} };
  const alert = testAlert("alert-private");
  const store = new WorkerStore(databasePath()); store.import(testData(preferences, alert), 0);
  const input = buildNotificationIntent(alert, preferences, now, { accountId: "account-1", accountOwned: true });
  const { job, token } = queueJob(store, "unconfigured");
  store.commitJobResult({ id: job.id, token, data: testData(preferences, alert), expectedRevision: 1, notificationIntents: [input], now });
  await deliverDueNotifications(store, null, { owner: "outage", now });
  expect(store.getNotificationIntent(input.id)?.status).toBe("blocked-unconfigured");
  store.cancelAccountOwnedNotifications("account-1");
  expect(store.getNotificationIntent(input.id)?.status).toBe("canceled");
  const minimal = safeNotificationMessage({ alert: { ...alert, title: "Sensitive thesis text", stateChange: "private evidence" }, destination: "local@example.test", privacyMode: "minimal", messageId: input.semanticIdempotencyKey });
  expect(minimal.text).not.toContain("Sensitive thesis text");
  expect(minimal.text).not.toContain("private evidence");
  store.close();
});

it("releases a blocked channel after configuration recovery", async () => {
  const preferences: NotificationPreferences = { ...enabledPreferences(), destinations: {} };
  const alert = testAlert("alert-recovery"); const store = new WorkerStore(databasePath()); const data = testData(preferences, alert); store.import(data, 0);
  const input = buildNotificationIntent(alert, preferences, now); const { job, token } = queueJob(store, "recovery");
  store.commitJobResult({ id: job.id, token, data, expectedRevision: 1, notificationIntents: [input], now });
  await deliverDueNotifications(store, null, { owner: "outage", now });
  expect(store.getNotificationIntent(input.id)?.status).toBe("blocked-unconfigured");
  const recovered = { ...preferences, destinations: { email: { address: "recovered@example.test" } }, updatedAt: new Date(now + 1).toISOString() };
  store.commitNotificationPreferences(recovered, 2, now + 1);
  expect(store.getNotificationIntent(input.id)?.status).toBe("pending");
  expect((await deliverDueNotifications(store, new InMemoryTestEmailTransport(), { owner: "recovered", now: now + 1 }))[0].status).toBe("delivered");
  store.close();
});

it("derives stable provider request identity and exercises real SMTP serialization against an isolated local server", async () => {
  const received: string[] = [];
  const server = createServer(socket => {
    socket.write("220 local-test\r\n");
    let buffer = ""; let inData = false; const dataLines: string[] = [];
    socket.on("data", chunk => {
      buffer += chunk.toString();
      let lineEnd = buffer.indexOf("\r\n");
      while (lineEnd >= 0) {
        const line = buffer.slice(0, lineEnd); buffer = buffer.slice(lineEnd + 2); lineEnd = buffer.indexOf("\r\n");
        if (inData) { if (line === ".") { inData = false; received.push(dataLines.join("\n")); socket.write("250 queued\r\n"); } else dataLines.push(line); continue; }
        if (line.startsWith("EHLO")) socket.write("250 local-test\r\n");
        else if (line === "DATA") { inData = true; socket.write("354 data\r\n"); }
        else if (line === "QUIT") socket.end("221 bye\r\n");
        else socket.write("250 ok\r\n");
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as { port: number }).port;
  const alert = testAlert(); const preferences = enabledPreferences(); const input = buildNotificationIntent(alert, preferences, now);
  const transport = new SmtpEmailTransport({ host: "127.0.0.1", port, from: "worker@local.test", timeoutMs: 1_000 });
  const outcome = await transport.send({ alert, intent: input as never });
  expect(outcome.kind).toBe("provider-accepted");
  expect(received.join("\n")).toContain("StockLedger review needed");
  expect(notificationIntentIdentity(alert.id, "email")).toEqual(notificationIntentIdentity(alert.id, "email"));
  await new Promise<void>(resolve => server.close(() => resolve()));
});

it("classifies SMTP definitive rejection and post-DATA timeout without retrying blindly", async () => {
  const alert = testAlert("alert-smtp-outcomes"); const input = buildNotificationIntent(alert, enabledPreferences(), now);
  const sockets = new Set<import("node:net").Socket>();
  const server = createServer(socket => {
    sockets.add(socket); socket.write("220 local-test\r\n"); let buffer = "";
    socket.on("data", chunk => {
      buffer += chunk.toString(); let end = buffer.indexOf("\r\n");
      while (end >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 2); end = buffer.indexOf("\r\n");
        if (line.startsWith("RCPT")) socket.write("550 rejected\r\n"); else if (line === "DATA") socket.write("354 data\r\n"); else socket.write("250 ok\r\n");
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as { port: number }).port;
  const definitive = await new SmtpEmailTransport({ host: "127.0.0.1", port, from: "worker@local.test", timeoutMs: 500 }).send({ alert, intent: input as never });
  expect(definitive.kind).toBe("definitive-failure");
  for (const socket of sockets) socket.destroy(); await new Promise<void>(resolve => server.close(() => resolve()));

  const timeoutSockets = new Set<import("node:net").Socket>();
  const timeoutServer = createServer(socket => {
    timeoutSockets.add(socket); socket.write("220 local-test\r\n"); let buffer = "";
    socket.on("data", chunk => {
      buffer += chunk.toString(); let end = buffer.indexOf("\r\n");
      while (end >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        if (line === "DATA") socket.write("354 data\r\n");
        end = buffer.indexOf("\r\n");
      }
    });
  });
  await new Promise<void>(resolve => timeoutServer.listen(0, "127.0.0.1", () => resolve()));
  const timeoutPort = (timeoutServer.address() as { port: number }).port;
  const ambiguous = await new SmtpEmailTransport({ host: "127.0.0.1", port: timeoutPort, from: "worker@local.test", timeoutMs: 50 }).send({ alert, intent: input as never });
  expect(ambiguous.kind).toBe("ambiguous");
  for (const socket of timeoutSockets) socket.destroy(); await new Promise<void>(resolve => timeoutServer.close(() => resolve()));
});
