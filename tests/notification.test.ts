import { createServer } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { buildNotificationIntent, notificationDigestGrouping, notificationDigestIdentity, notificationIntentIdentity, safeNotificationDigestMessage, safeNotificationMessage } from "../src/domain/notificationDelivery";
import { defaultNotificationPreferences } from "../src/domain/notificationPreferences";
import { parseExport, serializeExport } from "../src/domain/backupFormat";
import { seedData } from "../src/lib/seed";
import type { Alert, NotificationPreferences } from "../src/types";
import { jobIdentityFor } from "../server/worker/contract";
import { deliverDueNotifications, InMemoryTestEmailTransport, SmtpEmailTransport, type NotificationTransport, type NotificationTransportMessage } from "../server/worker/notificationTransport";
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
const commitIntentData = (store: WorkerStore, suffix: string, data: ReturnType<typeof testData>, input: ReturnType<typeof buildNotificationIntent>, at = now) => {
  const { job, token } = queueJob(store, suffix, at);
  store.commitJobResult({ id: job.id, token, data, expectedRevision: store.load()?.revision ?? 0, notificationIntents: [input], now: at });
  return input;
};
const commitDigestPair = (store: WorkerStore, suffix: string, preferences = { ...enabledPreferences(), deliveryMode: "digest" as const, digestTime: "13:00" }) => {
  const firstAlert = testAlert(`alert-${suffix}-a`); const secondAlert = testAlert(`alert-${suffix}-b`);
  const data = { ...testData(preferences, firstAlert), alerts: [firstAlert, secondAlert] };
  store.import(data, 0);
  const first = buildNotificationIntent(firstAlert, preferences, now); const firstJob = queueJob(store, `${suffix}-a`);
  store.commitJobResult({ id: firstJob.job.id, token: firstJob.token, data, expectedRevision: 1, notificationIntents: [first], now });
  const second = buildNotificationIntent(secondAlert, preferences, now); const secondJob = queueJob(store, `${suffix}-b`);
  store.commitJobResult({ id: secondJob.job.id, token: secondJob.token, data, expectedRevision: 2, notificationIntents: [second], now });
  return { data, first, second };
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
  expect(transport.messages).toHaveLength(1);
  expect(store.listNotificationDigests()).toHaveLength(1);
  expect(store.listNotificationDigestMembers(store.listNotificationDigests()[0].id)).toHaveLength(2);
  expect(store.load()?.data.alerts.every(alert => !alert.reviewed)).toBe(true);
  store.close();
});

it("uses one deterministic digest submission, preserves idempotency, and shares one retry budget", async () => {
  const preferences = { ...enabledPreferences(), deliveryMode: "digest" as const, digestTime: "13:00" };
  const firstAlert = testAlert("alert-digest-contract-a"); const secondAlert = testAlert("alert-digest-contract-b");
  const first = buildNotificationIntent(firstAlert, preferences, now); const second = buildNotificationIntent(secondAlert, preferences, now);
  const store = new WorkerStore(databasePath()); store.import({ ...testData(preferences, firstAlert), alerts: [firstAlert, secondAlert] }, 0);
  const firstJob = queueJob(store, "digest-contract-a");
  store.commitJobResult({ id: firstJob.job.id, token: firstJob.token, data: { ...testData(preferences, firstAlert), alerts: [firstAlert, secondAlert] }, expectedRevision: 1, notificationIntents: [first], now });
  const secondJob = queueJob(store, "digest-contract-b");
  store.commitJobResult({ id: secondJob.job.id, token: secondJob.token, data: { ...testData(preferences, firstAlert), alerts: [firstAlert, secondAlert] }, expectedRevision: 2, notificationIntents: [second], now });
  const transport = new InMemoryTestEmailTransport();
  const grouping = notificationDigestGrouping(first)!;
  const expected = notificationDigestIdentity(grouping, [first.semanticIdempotencyKey, second.semanticIdempotencyKey]).digestKey;
  expect(await deliverDueNotifications(store, transport, { owner: "digest-contract", now: first.notBefore })).toHaveLength(2);
  expect(transport.messages).toHaveLength(1);
  expect(transport.messages[0].digest?.digestKey).toBe(expected);
  expect(await deliverDueNotifications(store, transport, { owner: "digest-contract-replay", now: first.notBefore + 1 })).toEqual([]);
  expect(transport.messages).toHaveLength(1);
  expect(store.listNotificationAttempts(first.id)).toHaveLength(1);
  expect(store.listNotificationAttempts(second.id)).toHaveLength(1);
  expect(store.listNotificationReceipts(first.id)[0].receiptType).toBe("confirmed");
  expect(store.listNotificationReceipts(second.id)[0].receiptType).toBe("confirmed");
  const minimal = safeNotificationDigestMessage({ alerts: [{ ...firstAlert, title: "private thesis", stateChange: "private evidence" }, { ...secondAlert, title: "another thesis", stateChange: "another note" }], destination: "local@example.test", privacyMode: "minimal", messageId: expected });
  expect(minimal.text).not.toContain("private thesis"); expect(minimal.text).not.toContain("private evidence");
  store.close();
});

it("atomically claims a digest across concurrent workers and never splits the batch", async () => {
  const path = databasePath(); const firstStore = new WorkerStore(path); const { first, second } = commitDigestPair(firstStore, "concurrent");
  const secondStore = new WorkerStore(path); const transport = new InMemoryTestEmailTransport();
  const [firstRun, secondRun] = await Promise.all([
    deliverDueNotifications(firstStore, transport, { owner: "digest-worker-a", now: first.notBefore }),
    deliverDueNotifications(secondStore, transport, { owner: "digest-worker-b", now: first.notBefore }),
  ]);
  expect(firstRun.length + secondRun.length).toBe(2);
  expect(transport.messages).toHaveLength(1);
  expect(firstStore.listNotificationDigests()).toHaveLength(1);
  expect(firstStore.listNotificationDigestMembers(firstStore.listNotificationDigests()[0].id).map(member => member.memberSemanticKey)).toEqual([first.semanticIdempotencyKey, second.semanticIdempotencyKey].sort());
  firstStore.close(); secondStore.close();
});

it("survives restart before and after a digest send without a duplicate submission", async () => {
  const path = databasePath();
  const firstStore = new WorkerStore(path); const { first, second } = commitDigestPair(firstStore, "restart");
  firstStore.close();

  const sendingStore = new WorkerStore(path); const firstTransport = new InMemoryTestEmailTransport();
  expect(await deliverDueNotifications(sendingStore, firstTransport, { owner: "restart-before-send", now: first.notBefore })).toHaveLength(2);
  expect(firstTransport.messages).toHaveLength(1);
  sendingStore.close();

  const restartedStore = new WorkerStore(path); const replayTransport = new InMemoryTestEmailTransport();
  expect(await deliverDueNotifications(restartedStore, replayTransport, { owner: "restart-after-send", now: first.notBefore + 1 })).toEqual([]);
  expect(replayTransport.messages).toHaveLength(0);
  expect(restartedStore.getNotificationIntent(first.id)?.status).toBe("delivered");
  expect(restartedStore.getNotificationIntent(second.id)?.status).toBe("delivered");
  restartedStore.close();
});

it("retries a definitive digest failure five times as one bounded batch", async () => {
  const store = new WorkerStore(databasePath()); const { first, second } = commitDigestPair(store, "digest-retry");
  let clock = first.notBefore; let submissions = 0;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const transport = new InMemoryTestEmailTransport("definitive-failure");
    const result = await deliverDueNotifications(store, transport, { owner: `digest-failure-${attempt}`, now: clock });
    submissions += transport.messages.length;
    expect(result.every(item => item.status === (attempt === 5 ? "failed" : "retry-wait"))).toBe(true);
    if (attempt < 5) clock = store.getNotificationIntent(first.id)!.nextRetryAt!;
  }
  expect(submissions).toBe(5);
  expect(store.getNotificationIntent(first.id)?.attemptCount).toBe(5);
  expect(store.getNotificationIntent(second.id)?.attemptCount).toBe(5);
  expect(store.listNotificationAttempts(first.id)).toHaveLength(5);
  expect(store.listNotificationAttempts(second.id)).toHaveLength(5);
  store.close();
});

it("keeps an ambiguous digest terminal and links reconciliation to every member without resending", async () => {
  const store = new WorkerStore(databasePath()); const { first, second } = commitDigestPair(store, "digest-ambiguous");
  const transport = new InMemoryTestEmailTransport("ambiguous");
  await deliverDueNotifications(store, transport, { owner: "digest-ambiguous", now: first.notBefore });
  expect(transport.messages).toHaveLength(1);
  expect(store.getNotificationDigest(store.listNotificationDigests()[0].id)?.status).toBe("ambiguous");
  expect(await deliverDueNotifications(store, new InMemoryTestEmailTransport(), { owner: "digest-replay", now: first.notBefore + 1 })).toEqual([]);
  expect(store.reconcileAmbiguousNotificationDigest(store.listNotificationDigests()[0].id, "digest-reconciled", now + 2)).toBe(true);
  expect(store.getNotificationIntent(first.id)?.status).toBe("delivered");
  expect(store.getNotificationIntent(second.id)?.status).toBe("delivered");
  expect(store.listNotificationReceipts(first.id).some(receipt => receipt.receiptType === "confirmed")).toBe(true);
  expect(store.listNotificationReceipts(second.id).some(receipt => receipt.receiptType === "confirmed")).toBe(true);
  store.close();
});

it.each(["before-claim", "after-claim-before-acceptance"] as const)("fences opt-out %s without a false delivery", async phase => {
  const store = new WorkerStore(databasePath()); const input = commitIntent(store, `opt-out-${phase}`);
  if (phase === "before-claim") {
    const disabled = { ...enabledPreferences(), enabled: false, explicitConsent: false, allowedChannels: [], updatedAt: new Date(now + 1).toISOString() };
    store.import({ ...testData(disabled), notificationPreferences: disabled }, store.load()!.revision, now + 1);
    const transport = new InMemoryTestEmailTransport();
    expect(await deliverDueNotifications(store, transport, { owner: phase, now: now + 1 })).toEqual([]);
    expect(transport.messages).toHaveLength(0);
    expect(store.getNotificationIntent(input.id)?.status).toBe("canceled");
  } else {
    let entered!: () => void; let release!: () => void;
    const enteredPromise = new Promise<void>(resolve => { entered = resolve; });
    const releasePromise = new Promise<void>(resolve => { release = resolve; });
    const transport: NotificationTransport = { channel: "email", configured: true, async send(message) {
      entered(); await releasePromise;
      const preflight = await message.beforeAcceptance?.();
      return preflight?.kind === "canceled" ? preflight : { kind: "confirmed", providerMessageId: "test" };
    } };
    const delivery = deliverDueNotifications(store, transport, { owner: phase, now });
    await enteredPromise;
    store.cancelNotificationIntent(input.id, "user-opted-out", now + 1);
    release();
    expect(await delivery).toEqual([{ intentId: input.id, status: "canceled" }]);
    expect(store.getNotificationIntent(input.id)?.status).toBe("canceled");
    expect(store.listNotificationAttempts(input.id)).toHaveLength(0);
  }
  store.close();
});

it("rolls back an immediate claim on opt-out, including the safe worker projection", async () => {
  const store = new WorkerStore(databasePath()); const data = testData(); store.import(data, 0);
  const input = commitIntentData(store, "preflight-opt-out", data, buildNotificationIntent(data.alerts[0], data.notificationPreferences, now));
  let submitted = false;
  const transport: NotificationTransport = { channel: "email", configured: true, async send(message) {
    store.cancelNotificationIntent(input.id, "user-opted-out", now + 1);
    const preflight = await message.beforeAcceptance?.();
    if (!preflight || preflight.kind === "send") { submitted = true; return { kind: "confirmed", providerMessageId: "unexpected" }; }
    return preflight;
  } };
  await deliverDueNotifications(store, transport, { owner: "preflight-opt-out", now });
  const intent = store.getNotificationIntent(input.id)!;
  expect(submitted).toBe(false);
  expect(intent.status).toBe("canceled");
  expect(intent.cancellationReason).toBe("user-opted-out");
  expect(intent.attemptCount).toBe(0);
  expect(intent.leaseToken).toBeNull();
  expect(store.listNotificationAttempts(input.id)).toHaveLength(0);
  expect(store.load()?.data.lastKnownNotificationDeliveryStatus?.lastState).toBe("canceled");
  expect(store.load()?.data.lastKnownNotificationDeliveryStatus?.attemptCount).toBe(0);
  store.close();
});

it("replans a claimed destination change and sends exactly once to the new destination", async () => {
  const store = new WorkerStore(databasePath()); const initial = enabledPreferences(); const data = testData(initial); store.import(data, 0);
  const input = commitIntentData(store, "preflight-destination", data, buildNotificationIntent(data.alerts[0], initial, now));
  let changed = false; const destinations: string[] = [];
  const transport: NotificationTransport = { channel: "email", configured: true, async send(message) {
    if (!changed) {
      changed = true;
      const updated = { ...initial, destinations: { email: { address: "new@example.test" } }, updatedAt: new Date(now + 1).toISOString() };
      store.commitNotificationPreferences(updated, store.load()!.revision, now + 1);
    }
    const preflight = await message.beforeAcceptance?.();
    if (preflight && preflight.kind !== "send") return preflight;
    destinations.push(message.intent.destination!);
    return { kind: "confirmed", providerMessageId: `destination-${destinations.length}` };
  } };
  await deliverDueNotifications(store, transport, { owner: "preflight-destination", now });
  expect(destinations).toEqual(["new@example.test"]);
  expect(store.getNotificationIntent(input.id)?.status).toBe("delivered");
  expect(store.getNotificationIntent(input.id)?.cancellationReason).toBeNull();
  expect(store.getNotificationIntent(input.id)?.attemptCount).toBe(1);
  expect(store.listNotificationAttempts(input.id)).toHaveLength(1);
  expect(await deliverDueNotifications(store, transport, { owner: "preflight-destination-replay", now: now + 1 })).toEqual([]);
  expect(destinations).toHaveLength(1);
  store.close();
});

it("replans privacy drift before acceptance and renders only the current privacy mode", async () => {
  const store = new WorkerStore(databasePath()); const initial = enabledPreferences(); const data = testData(initial); store.import(data, 0);
  const input = commitIntentData(store, "preflight-privacy", data, buildNotificationIntent(data.alerts[0], initial, now));
  let changed = false; const rendered: string[] = [];
  const transport: NotificationTransport = { channel: "email", configured: true, async send(message) {
    if (!changed) {
      changed = true;
      const updated = { ...initial, privacyMode: "rich" as const, updatedAt: new Date(now + 1).toISOString() };
      store.commitNotificationPreferences(updated, store.load()!.revision, now + 1);
    }
    const preflight = await message.beforeAcceptance?.();
    if (preflight && preflight.kind !== "send") return preflight;
    rendered.push(safeNotificationMessage({ alert: message.alert, destination: message.intent.destination!, privacyMode: message.intent.privacyMode, messageId: message.intent.semanticIdempotencyKey }).text);
    return { kind: "confirmed", providerMessageId: "privacy-current" };
  } };
  await deliverDueNotifications(store, transport, { owner: "preflight-privacy", now });
  expect(store.getNotificationIntent(input.id)?.privacyMode).toBe("rich");
  expect(rendered).toHaveLength(1);
  expect(rendered[0]).toContain(data.alerts[0].title);
  expect(store.listNotificationAttempts(input.id)).toHaveLength(1);
  store.close();
});

it("replans immediate-to-digest drift and joins the deterministic digest", async () => {
  const store = new WorkerStore(databasePath()); const initial = enabledPreferences(); const firstAlert = testAlert("alert-immediate-to-digest"); const data = testData(initial, firstAlert); store.import(data, 0);
  const first = commitIntentData(store, "immediate-to-digest", data, buildNotificationIntent(firstAlert, initial, now));
  let changed = false;
  const firstPassTransport: NotificationTransport = { channel: "email", configured: true, async send(message) {
    if (!changed) {
      changed = true;
      const updated = { ...initial, deliveryMode: "digest" as const, digestTime: "13:00", updatedAt: new Date(now + 1).toISOString() };
      store.commitNotificationPreferences(updated, store.load()!.revision, now + 1);
    }
    const preflight = await message.beforeAcceptance?.();
    return preflight && preflight.kind !== "send" ? preflight : { kind: "confirmed", providerMessageId: "unexpected" };
  } };
  await deliverDueNotifications(store, firstPassTransport, { owner: "immediate-to-digest", now });
  expect(store.getNotificationIntent(first.id)?.status).toBe("held");
  expect(store.getNotificationIntent(first.id)?.deliveryMode).toBe("digest");
  expect(store.getNotificationIntent(first.id)?.attemptCount).toBe(0);
  expect(store.listNotificationAttempts(first.id)).toHaveLength(0);

  const secondAlert = testAlert("alert-immediate-to-digest-second");
  const expanded = { ...store.load()!.data, alerts: [firstAlert, secondAlert] };
  store.import(expanded, store.load()!.revision, now + 1);
  const digestPreferences = store.load()!.data.notificationPreferences;
  const second = commitIntentData(store, "immediate-to-digest-second", store.load()!.data, buildNotificationIntent(secondAlert, digestPreferences, now));
  const digestTransport = new InMemoryTestEmailTransport();
  await deliverDueNotifications(store, digestTransport, { owner: "immediate-to-digest-digest", now: Date.parse("2026-09-18T13:00:00.000Z") });
  expect(digestTransport.messages).toHaveLength(1);
  expect(digestTransport.messages[0].intents?.map(intent => intent.id).sort()).toEqual([first.id, second.id].sort());
  expect(store.getNotificationIntent(first.id)?.status).toBe("delivered");
  expect(store.getNotificationIntent(second.id)?.status).toBe("delivered");
  expect(store.listNotificationDigests()).toHaveLength(1);
  store.close();
});

it("returns a claimed intent to held when a new quiet-hours notBefore appears", async () => {
  const store = new WorkerStore(databasePath()); const initial = enabledPreferences(); const data = testData(initial); store.import(data, 0);
  const input = commitIntentData(store, "preflight-quiet", data, buildNotificationIntent(data.alerts[0], initial, now));
  let changed = false;
  const transport: NotificationTransport = { channel: "email", configured: true, async send(message) {
    if (!changed) {
      changed = true;
      const updated = { ...initial, quietHours: { enabled: true, start: "11:00", end: "13:00" }, updatedAt: new Date(now + 1).toISOString() };
      store.commitNotificationPreferences(updated, store.load()!.revision, now + 1);
    }
    const preflight = await message.beforeAcceptance?.();
    return preflight && preflight.kind !== "send" ? preflight : { kind: "confirmed", providerMessageId: "unexpected" };
  } };
  await deliverDueNotifications(store, transport, { owner: "preflight-quiet", now });
  const intent = store.getNotificationIntent(input.id)!;
  expect(intent.status).toBe("held");
  expect(intent.notBefore).toBeGreaterThan(now);
  expect(intent.attemptCount).toBe(0);
  expect(store.listNotificationAttempts(input.id)).toHaveLength(0);
  expect(store.load()?.data.lastKnownNotificationDeliveryStatus?.attemptCount).toBe(0);
  store.close();
});

it("fences the former token after a replan and keeps drift distinct from revocation", () => {
  const store = new WorkerStore(databasePath()); const initial = enabledPreferences(); const data = testData(initial); store.import(data, 0);
  const input = commitIntentData(store, "preflight-token", data, buildNotificationIntent(data.alerts[0], initial, now));
  const token = store.claimNotificationIntent(input.id, "former-token", now, 10_000)!;
  const updated = { ...initial, destinations: { email: { address: "replanned@example.test" } }, updatedAt: new Date(now + 1).toISOString() };
  store.commitNotificationPreferences(updated, store.load()!.revision, now + 1);
  expect(store.preflightNotificationIntent(input.id, token, now + 1)).toEqual({ kind: "replan", reason: "preference-changed-before-submit" });
  expect(store.getNotificationIntent(input.id)?.status).toBe("pending");
  expect(store.getNotificationIntent(input.id)?.cancellationReason).toBeNull();
  expect(store.getNotificationIntent(input.id)?.attemptCount).toBe(0);
  expect(store.listNotificationAttempts(input.id)).toHaveLength(0);
  expect(() => store.recordNotificationOutcome(input.id, token, { kind: "confirmed", providerMessageId: "stale" }, now + 2)).toThrow(/lease/);
  store.close();
});

it("cancels or replans SMTP before recipient and DATA submission", async () => {
  const runFence = async (mode: "cancel" | "replan") => {
    const store = new WorkerStore(databasePath()); const initial = enabledPreferences(); const data = testData(initial); store.import(data, 0);
    const input = commitIntentData(store, `smtp-${mode}`, data, buildNotificationIntent(data.alerts[0], initial, now));
    const token = store.claimNotificationIntent(input.id, `smtp-${mode}`, now, 10_000)!;
    const lines: string[] = []; const sockets = new Set<import("node:net").Socket>();
    const server = createServer(socket => {
      sockets.add(socket); socket.write("220 local-test\r\n"); let buffer = "";
      socket.on("data", chunk => {
        buffer += chunk.toString(); let end = buffer.indexOf("\r\n");
        while (end >= 0) {
          const line = buffer.slice(0, end); buffer = buffer.slice(end + 2); end = buffer.indexOf("\r\n"); lines.push(line);
          if (line.startsWith("EHLO")) socket.write("250 local-test\r\n"); else socket.write("250 ok\r\n");
        }
      });
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
    const port = (server.address() as { port: number }).port; let fenced = false;
    const transport = new SmtpEmailTransport({ host: "127.0.0.1", port, from: "worker@local.test", timeoutMs: 500 });
    const outcome = await transport.send({
      alert: data.alerts[0], intent: store.getNotificationIntent(input.id)!, beforeAcceptance: async () => {
        if (!fenced) {
          fenced = true;
          if (mode === "cancel") store.cancelNotificationIntent(input.id, "smtp-opted-out", now + 1);
          else {
            const updated = { ...initial, destinations: { email: { address: "smtp-new@example.test" } }, updatedAt: new Date(now + 1).toISOString() };
            store.commitNotificationPreferences(updated, store.load()!.revision, now + 1);
          }
        }
        return store.preflightNotificationIntent(input.id, token, now + 1);
      },
    });
    const result = { outcome, lines, intent: store.getNotificationIntent(input.id)!, attempts: store.listNotificationAttempts(input.id), receipts: store.listNotificationReceipts(input.id) };
    for (const socket of sockets) socket.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
    store.close();
    return result;
  };

  const canceled = await runFence("cancel");
  expect(canceled.outcome).toEqual({ kind: "canceled", reason: "smtp-opted-out" });
  expect(canceled.lines.some(line => line === "RCPT TO:<local@example.test>" || line === "DATA")).toBe(false);
  expect(canceled.lines.join("\n")).not.toContain("StockLedger review needed");
  expect(canceled.intent.status).toBe("canceled");
  expect(canceled.intent.attemptCount).toBe(0);
  expect(canceled.attempts).toHaveLength(0);
  expect(canceled.receipts).toHaveLength(0);

  const replanned = await runFence("replan");
  expect(replanned.outcome).toEqual({ kind: "replan", reason: "preference-changed-before-submit" });
  expect(replanned.lines.some(line => line.startsWith("RCPT") || line === "DATA")).toBe(false);
  expect(replanned.lines.join("\n")).not.toContain("StockLedger review needed");
  expect(replanned.intent.status).toBe("pending");
  expect(replanned.intent.destination).toBe("smtp-new@example.test");
  expect(replanned.intent.attemptCount).toBe(0);
  expect(replanned.attempts).toHaveLength(0);
  expect(replanned.receipts).toHaveLength(0);
});

it("keeps a provider-accepted outcome truthful when opt-out occurs after the acceptance point", async () => {
  const store = new WorkerStore(databasePath()); const input = commitIntent(store, "opt-out-after-acceptance");
  const transport: NotificationTransport = { channel: "email", configured: true, async send(message) {
    const preflight = await message.beforeAcceptance?.();
    if (preflight?.kind === "canceled") return preflight;
    store.cancelNotificationIntent(input.id, "late-opt-out", now + 1);
    return { kind: "provider-accepted", providerMessageId: "provider-accepted-after-opt-out" };
  } };
  await deliverDueNotifications(store, transport, { owner: "late-opt-out", now });
  expect(store.getNotificationIntent(input.id)?.status).toBe("ambiguous");
  expect(store.getNotificationIntent(input.id)?.status).not.toBe("canceled");
  expect(store.listNotificationAttempts(input.id)[0].outcome).toBe("provider-accepted");
  store.close();
});

it("excludes a digest member canceled while transport waits and sends the remaining member once", async () => {
  const store = new WorkerStore(databasePath()); const { first, second } = commitDigestPair(store, "member-cancel");
  let entered!: () => void; let release!: () => void;
  const enteredPromise = new Promise<void>(resolve => { entered = resolve; });
  const releasePromise = new Promise<void>(resolve => { release = resolve; });
  const transportMessages: NotificationTransportMessage[] = [];
  const transport: NotificationTransport = { channel: "email", configured: true, async send(message) {
    entered(); await releasePromise;
    const preflight = await message.beforeAcceptance?.();
    if (preflight?.kind === "canceled") return preflight;
    transportMessages.push(message);
    return { kind: "confirmed", providerMessageId: "remaining-member" };
  } };
  const delivery = deliverDueNotifications(store, transport, { owner: "member-cancel", now: first.notBefore });
  await enteredPromise;
  store.cancelNotificationIntent(first.id, "member-canceled", now + 1);
  release();
  const result = await delivery;
  expect(transportMessages).toHaveLength(1);
  expect(transportMessages[0].intents).toHaveLength(1);
  expect(transportMessages[0].intents?.[0].id).toBe(second.id);
  expect(store.getNotificationIntent(first.id)?.status).toBe("canceled");
  expect(store.getNotificationIntent(second.id)?.status).toBe("delivered");
  expect(result.some(item => item.intentId === second.id && item.status === "delivered")).toBe(true);
  store.close();
});

it("imports disabled worker policy atomically, preserves immutable delivery history, and exports safe last-known status", () => {
  const store = new WorkerStore(databasePath()); const data = testData(); store.import(data, 0); const input = commitIntent(store, "handoff");
  const delivered = new InMemoryTestEmailTransport();
  const disabled = { ...data, notificationPreferences: { ...data.notificationPreferences, enabled: false, explicitConsent: false, allowedChannels: [], updatedAt: new Date(now + 1).toISOString() } };
  store.import(disabled, store.load()!.revision, now + 1);
  expect(store.getNotificationIntent(input.id)?.status).toBe("canceled");
  expect(store.listNotificationAttempts(input.id)).toHaveLength(0);
  const projection = store.load()?.data.lastKnownNotificationDeliveryStatus;
  expect(projection?.lastState).toBe("canceled");
  expect(projection?.preferenceUpdatedAt).toBe(disabled.notificationPreferences.updatedAt);
  expect(projection?.preferenceHash).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(projection)).not.toContain("Sensitive thesis");
  expect(delivered.messages).toHaveLength(0);
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
