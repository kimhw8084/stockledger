import { connect, type Socket } from "node:net";
import { connect as tlsConnect } from "node:tls";
import type { Alert } from "../../src/types";
import { notificationDigestGrouping, safeNotificationDigestMessage, safeNotificationMessage, type NotificationDigestGrouping } from "../../src/domain/notificationDelivery";
import type { NotificationDigest, NotificationIntent, NotificationOutcome, NotificationPreflight, WorkerStore } from "./store";

export interface NotificationTransportMessage {
  alert: Pick<Alert, "id" | "title" | "priority" | "stateChange">;
  intent: NotificationIntent;
  alerts?: Array<Pick<Alert, "id" | "title" | "priority" | "stateChange">>;
  intents?: NotificationIntent[];
  digest?: NotificationDigest;
  beforeAcceptance?: () => Promise<NotificationPreflight>;
}

export type NotificationSendOutcome = NotificationOutcome | { kind: "canceled"; reason: string } | { kind: "replan"; reason: string };

export interface NotificationTransport {
  readonly channel: "email";
  readonly configured: boolean;
  send(message: NotificationTransportMessage): Promise<NotificationSendOutcome>;
}

export interface SmtpEmailTransportOptions {
  host: string;
  port: number;
  from: string;
  secure?: boolean;
  username?: string;
  password?: string;
  timeoutMs?: number;
}

const responseCode = (response: string) => Number(response.slice(0, 3));
const acceptedCode = (response: string, expected: number[]) => {
  const code = responseCode(response);
  if (expected.includes(code)) return;
  const error = new Error(`smtp-${code || "invalid-response"}`);
  (error as Error & { smtpCode?: number }).smtpCode = code;
  throw error;
};

const readReply = (socket: Socket, timeoutMs: number) => new Promise<string>((resolve, reject) => {
  let buffer = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cleanup = () => {
    if (timer) clearTimeout(timer);
    socket.off("data", onData); socket.off("error", onError); socket.off("close", onClose); socket.off("timeout", onTimeout);
  };
  const finish = (error?: Error) => { cleanup(); if (error) reject(error); else resolve(buffer); };
  const onData = (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    const lines = buffer.split(/\r?\n/).filter(Boolean);
    if (lines.length && /^\d{3} /.test(lines.at(-1) ?? "")) finish();
  };
  const onError = (error: Error) => finish(error);
  const onClose = () => finish(new Error("smtp-connection-closed"));
  const onTimeout = () => finish(new Error("smtp-timeout"));
  socket.on("data", onData); socket.once("error", onError); socket.once("close", onClose); socket.once("timeout", onTimeout);
  timer = setTimeout(() => finish(new Error("smtp-timeout")), timeoutMs);
});

const writeCommand = async (socket: Socket, command: string, expected: number[], timeoutMs: number) => {
  socket.write(`${command}\r\n`);
  const response = await readReply(socket, timeoutMs);
  acceptedCode(response, expected);
};

const dotStuff = (value: string) => value.replace(/(^|\r?\n)\./g, "$1..");

/**
 * Server-only SMTP adapter. It deliberately reports a successful SMTP 250 as
 * provider-accepted, not delivered: SMTP has no recipient delivery proof.
 */
export class SmtpEmailTransport implements NotificationTransport {
  readonly channel = "email" as const;
  readonly configured: boolean;
  private readonly options: SmtpEmailTransportOptions;

  constructor(options?: SmtpEmailTransportOptions) {
    this.options = options ?? { host: "", port: 0, from: "" };
    this.configured = Boolean(this.options.host && this.options.port > 0 && this.options.from);
  }

  async send(message: NotificationTransportMessage): Promise<NotificationSendOutcome> {
    if (!this.configured || !message.intent.destination) return { kind: "definitive-failure", errorClass: "channel-unconfigured" };
    const timeoutMs = this.options.timeoutMs ?? 5_000;
    let socket: Socket | undefined;
    let bytesMayHaveBeenAccepted = false;
    const messageId = (message.digest?.digestKey ?? message.intent.semanticIdempotencyKey).replace(/[^a-zA-Z0-9._:-]/g, "-");
    try {
      socket = this.options.secure
        ? tlsConnect({ host: this.options.host, port: this.options.port, servername: this.options.host, rejectUnauthorized: true })
        : connect({ host: this.options.host, port: this.options.port });
      socket.setTimeout(timeoutMs);
      await new Promise<void>((resolve, reject) => { socket!.once("connect", () => resolve()); socket!.once("error", reject); });
      acceptedCode(await readReply(socket, timeoutMs), [220]);
      await writeCommand(socket, "EHLO stockledger.local", [250], timeoutMs);
      if (this.options.username && this.options.password) {
        await writeCommand(socket, "AUTH PLAIN", [334], timeoutMs);
        await writeCommand(socket, Buffer.from(`\0${this.options.username}\0${this.options.password}`).toString("base64"), [235], timeoutMs);
      }
      const beforeMail = await message.beforeAcceptance?.();
      if (beforeMail?.kind && beforeMail.kind !== "send") { socket.destroy(); return beforeMail; }
      await writeCommand(socket, `MAIL FROM:<${this.options.from}>`, [250], timeoutMs);
      const beforeRecipient = await message.beforeAcceptance?.();
      if (beforeRecipient?.kind && beforeRecipient.kind !== "send") { socket.destroy(); return beforeRecipient; }
      await writeCommand(socket, `RCPT TO:<${message.intent.destination}>`, [250, 251], timeoutMs);
      const beforeData = await message.beforeAcceptance?.();
      if (beforeData?.kind && beforeData.kind !== "send") { socket.destroy(); return beforeData; }
      await writeCommand(socket, "DATA", [354], timeoutMs);
      bytesMayHaveBeenAccepted = true;
      const rendered = message.digest
        ? safeNotificationDigestMessage({ alerts: message.alerts ?? [message.alert], destination: message.digest.destination, privacyMode: message.digest.privacyMode, messageId })
        : safeNotificationMessage({ alert: message.alert, destination: message.intent.destination, privacyMode: message.intent.privacyMode, messageId });
      const body = [
        `From: ${this.options.from}`,
        `To: ${rendered.to}`,
        `Subject: ${rendered.subject}`,
        `Message-ID: ${rendered.headers["Message-ID"]}`,
        `X-StockLedger-Delivery-Key: ${rendered.headers["X-StockLedger-Delivery-Key"]}`,
        "Content-Type: text/plain; charset=utf-8",
        "",
        rendered.text,
      ].join("\r\n");
      socket.write(`${dotStuff(body)}\r\n.\r\n`);
      await readReply(socket, timeoutMs).then(response => acceptedCode(response, [250]));
      socket.end("QUIT\r\n");
      return { kind: "provider-accepted", providerMessageId: messageId };
    } catch (cause) {
      const errorClass = cause instanceof Error ? cause.message.slice(0, 120) : "smtp-transport-error";
      socket?.destroy();
      return bytesMayHaveBeenAccepted || errorClass.includes("timeout") || errorClass.includes("connection")
        ? { kind: "ambiguous", errorClass }
        : { kind: "definitive-failure", errorClass };
    }
  }
}

/** Deterministic isolated transport used by local lifecycle tests; it proves acceptance by its own receipt. */
export class InMemoryTestEmailTransport implements NotificationTransport {
  readonly channel = "email" as const;
  readonly configured = true;
  readonly messages: NotificationTransportMessage[] = [];
  private readonly accepted = new Set<string>();
  constructor(private readonly mode: "confirmed" | "definitive-failure" | "ambiguous" = "confirmed") {}
  async send(message: NotificationTransportMessage): Promise<NotificationSendOutcome> {
    const identity = message.digest?.digestKey ?? message.intent.semanticIdempotencyKey;
    const preflight = await message.beforeAcceptance?.();
    if (preflight?.kind && preflight.kind !== "send") return preflight;
    if (this.accepted.has(identity)) return { kind: "confirmed", providerMessageId: `test-${identity}` };
    this.messages.push(message);
    if (this.mode === "definitive-failure") return { kind: "definitive-failure", errorClass: "test-definitive-failure" };
    if (this.mode === "ambiguous") return { kind: "ambiguous", errorClass: "test-ambiguous" };
    this.accepted.add(identity);
    return { kind: "confirmed", providerMessageId: `test-${identity}` };
  }
}

export async function deliverDueNotifications(store: WorkerStore, transport: NotificationTransport | null, options: { owner: string; now?: number; leaseMs?: number } = { owner: `notification-${process.pid}` }) {
  const now = options.now ?? Date.now();
  const results: Array<{ intentId: string; status: string }> = [];
  for (let pass = 0; pass < 2; pass += 1) {
    for (const expired of store.listNotificationIntents({ status: "claimed" }).filter(intent => intent.deliveryMode !== "digest" && intent.leaseUntil <= now)) {
      store.claimNotificationIntent(expired.id, options.owner, now, options.leaseMs);
      results.push({ intentId: expired.id, status: store.getNotificationIntent(expired.id)?.status ?? "unknown" });
    }
    for (const expiredDigest of store.listNotificationDigests({ status: "claimed" }).filter(digest => digest.leaseUntil <= now)) {
      for (const memberId of store.reclaimExpiredNotificationDigest(expiredDigest.id, now)) results.push({ intentId: memberId, status: store.getNotificationIntent(memberId)?.status ?? "unknown" });
    }
    const candidates = store.listNotificationIntents().filter(intent => ["pending", "held", "retry-wait", "blocked-unconfigured"].includes(intent.status) && intent.notBefore <= now && (intent.nextRetryAt ?? 0) <= now);
    const digestGroups = new Map<string, NotificationDigestGrouping>();
    for (const candidate of candidates) {
      const grouping = candidate.deliveryMode === "digest" ? notificationDigestGrouping(candidate) : null;
      if (grouping) digestGroups.set(JSON.stringify(grouping), grouping);
    }
    for (const grouping of digestGroups.values()) {
      if (!transport?.configured) {
        for (const candidate of candidates.filter(item => item.deliveryMode === "digest" && JSON.stringify(notificationDigestGrouping(item)) === JSON.stringify(grouping))) {
          store.markNotificationBlocked(candidate.id, "channel-unconfigured", now);
          results.push({ intentId: candidate.id, status: "blocked-unconfigured" });
        }
        continue;
      }
      const claim = store.claimNotificationDigest(grouping!, options.owner, now, options.leaseMs);
      if (!claim || claim.kind !== "claimed") continue;
      const saved = store.load();
      const intents = claim.memberIds.map(id => store.getNotificationIntent(id)).filter((intent): intent is NonNullable<typeof intent> => Boolean(intent));
      const alerts = intents.map(intent => saved?.data.alerts.find(item => item.id === intent.alertId)).filter((alert): alert is NonNullable<typeof alert> => Boolean(alert));
      if (!alerts.length || alerts.length !== intents.length) {
        store.preflightNotificationDigest(claim.digest.id, claim.token, now);
        for (const memberId of claim.memberIds) results.push({ intentId: memberId, status: store.getNotificationIntent(memberId)?.status ?? "unknown" });
        continue;
      }
      const preflight = store.preflightNotificationDigest(claim.digest.id, claim.token, now);
      if (preflight.kind !== "send") {
        for (const memberId of claim.memberIds) results.push({ intentId: memberId, status: store.getNotificationIntent(memberId)?.status ?? "unknown" });
        continue;
      }
      const representative = store.getNotificationIntent(claim.memberIds[0]);
      if (!representative) continue;
      const outcome = await transport.send({
        alert: alerts[0], alerts, intents, digest: claim.digest, intent: representative,
        beforeAcceptance: () => Promise.resolve(store.preflightNotificationDigest(claim.digest.id, claim.token, now)),
      });
      if (outcome.kind === "canceled" || outcome.kind === "replan") continue;
      const updated = store.recordNotificationDigestOutcome(claim.digest.id, claim.token, outcome, now);
      for (const memberId of claim.memberIds) results.push({ intentId: memberId, status: updated?.status ?? "unknown" });
    }
    const immediateCandidates = store.listNotificationIntents().filter(intent => intent.deliveryMode !== "digest" && ["pending", "held", "retry-wait", "blocked-unconfigured"].includes(intent.status) && intent.notBefore <= now && (intent.nextRetryAt ?? 0) <= now);
    for (const candidate of immediateCandidates) {
      if (!transport?.configured) { store.markNotificationBlocked(candidate.id, "channel-unconfigured", now); results.push({ intentId: candidate.id, status: "blocked-unconfigured" }); continue; }
      const token = store.claimNotificationIntent(candidate.id, options.owner, now, options.leaseMs);
      if (!token) continue;
      const saved = store.load();
      const alert = saved?.data.alerts.find(item => item.id === candidate.alertId);
      if (!alert) {
        store.cancelNotificationIntent(candidate.id, "alert-not-found", now);
        const canceled = store.preflightNotificationIntent(candidate.id, token, now);
        results.push({ intentId: candidate.id, status: canceled.kind === "canceled" ? "canceled" : "unknown" });
        continue;
      }
      const preflight = store.preflightNotificationIntent(candidate.id, token, now);
      if (preflight.kind !== "send") { results.push({ intentId: candidate.id, status: store.getNotificationIntent(candidate.id)?.status ?? "unknown" }); continue; }
      const outcome = await transport.send({ alert, intent: store.getNotificationIntent(candidate.id)!, beforeAcceptance: () => Promise.resolve(store.preflightNotificationIntent(candidate.id, token, now)) });
      if (outcome.kind !== "confirmed" && outcome.kind !== "provider-accepted" && outcome.kind !== "definitive-failure" && outcome.kind !== "ambiguous") {
        results.push({ intentId: candidate.id, status: store.getNotificationIntent(candidate.id)?.status ?? "unknown" });
        continue;
      }
      const updated = store.recordNotificationOutcome(candidate.id, token, outcome, now);
      results.push({ intentId: candidate.id, status: updated?.status ?? "unknown" });
    }
  }
  return results;
}
