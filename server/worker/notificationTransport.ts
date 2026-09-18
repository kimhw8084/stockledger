import { connect, type Socket } from "node:net";
import { connect as tlsConnect } from "node:tls";
import type { Alert } from "../../src/types";
import { safeNotificationMessage } from "../../src/domain/notificationDelivery";
import type { NotificationIntent, NotificationOutcome, WorkerStore } from "./store";

export interface NotificationTransportMessage {
  alert: Pick<Alert, "id" | "title" | "priority" | "stateChange">;
  intent: NotificationIntent;
}

export interface NotificationTransport {
  readonly channel: "email";
  readonly configured: boolean;
  send(message: NotificationTransportMessage): Promise<NotificationOutcome>;
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

  async send(message: NotificationTransportMessage): Promise<NotificationOutcome> {
    if (!this.configured || !message.intent.destination) return { kind: "definitive-failure", errorClass: "channel-unconfigured" };
    const timeoutMs = this.options.timeoutMs ?? 5_000;
    let socket: Socket | undefined;
    let bytesMayHaveBeenAccepted = false;
    const messageId = message.intent.semanticIdempotencyKey.replace(/[^a-zA-Z0-9._:-]/g, "-");
    const rendered = safeNotificationMessage({ alert: message.alert, destination: message.intent.destination, privacyMode: message.intent.privacyMode, messageId });
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
      await writeCommand(socket, `MAIL FROM:<${this.options.from}>`, [250], timeoutMs);
      await writeCommand(socket, `RCPT TO:<${message.intent.destination}>`, [250, 251], timeoutMs);
      await writeCommand(socket, "DATA", [354], timeoutMs);
      bytesMayHaveBeenAccepted = true;
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
  async send(message: NotificationTransportMessage): Promise<NotificationOutcome> {
    if (this.accepted.has(message.intent.semanticIdempotencyKey)) return { kind: "confirmed", providerMessageId: `test-${message.intent.semanticIdempotencyKey}` };
    this.messages.push(message);
    if (this.mode === "definitive-failure") return { kind: "definitive-failure", errorClass: "test-definitive-failure" };
    if (this.mode === "ambiguous") return { kind: "ambiguous", errorClass: "test-ambiguous" };
    this.accepted.add(message.intent.semanticIdempotencyKey);
    return { kind: "confirmed", providerMessageId: `test-${message.intent.semanticIdempotencyKey}` };
  }
}

export async function deliverDueNotifications(store: WorkerStore, transport: NotificationTransport | null, options: { owner: string; now?: number; leaseMs?: number } = { owner: `notification-${process.pid}` }) {
  const now = options.now ?? Date.now();
  const candidates = store.listNotificationIntents().filter(intent => (
    (["pending", "held", "retry-wait", "blocked-unconfigured"].includes(intent.status) && intent.notBefore <= now && (intent.nextRetryAt ?? 0) <= now)
    || (intent.status === "claimed" && intent.leaseUntil <= now)
  ));
  const results: Array<{ intentId: string; status: string }> = [];
  for (const candidate of candidates) {
    if (candidate.status === "claimed") {
      store.claimNotificationIntent(candidate.id, options.owner, now, options.leaseMs);
      results.push({ intentId: candidate.id, status: store.getNotificationIntent(candidate.id)?.status ?? "unknown" });
      continue;
    }
    if (!transport?.configured) { store.markNotificationBlocked(candidate.id, "channel-unconfigured", now); results.push({ intentId: candidate.id, status: "blocked-unconfigured" }); continue; }
    const token = store.claimNotificationIntent(candidate.id, options.owner, now, options.leaseMs);
    if (!token) continue;
    const saved = store.load();
    const alert = saved?.data.alerts.find(item => item.id === candidate.alertId);
    if (!alert) { store.cancelNotificationIntent(candidate.id, "alert-not-found", now); continue; }
    const outcome = await transport.send({ alert, intent: store.getNotificationIntent(candidate.id)! });
    const updated = store.recordNotificationOutcome(candidate.id, token, outcome, now);
    results.push({ intentId: candidate.id, status: updated?.status ?? "unknown" });
  }
  return results;
}
