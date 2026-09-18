import { contentHash } from "./contentHash";
import { normalizeNotificationPreferences } from "./notificationPreferences";
import type { Alert, NotificationChannel, NotificationPreferences } from "../types";

export const NOTIFICATION_DELIVERY_CONTRACT_VERSION = "stockledger-notification-delivery-v1" as const;
export const NOTIFICATION_DELIVERY_CONTRACT_REVISION = 1 as const;
export const NOTIFICATION_POLICY_VERSION = "default-review-needed-v1" as const;
export const NOTIFICATION_MAX_ATTEMPTS = 5;
export const NOTIFICATION_INITIAL_RETRY_DELAY_MS = 60_000;
export const NOTIFICATION_MAX_RETRY_DELAY_MS = 15 * 60_000;

export const notificationDeliveryStates = [
  "pending", "held", "claimed", "delivered", "failed", "retry-wait", "canceled", "blocked-unconfigured", "ambiguous",
] as const;
export type NotificationDeliveryState = typeof notificationDeliveryStates[number];
export type NotificationAttemptOutcome = "confirmed" | "provider-accepted" | "definitive-failure" | "ambiguous";

export interface NotificationIntentInput {
  id: string;
  contractVersion: typeof NOTIFICATION_DELIVERY_CONTRACT_VERSION;
  contractRevision: typeof NOTIFICATION_DELIVERY_CONTRACT_REVISION;
  semanticIdempotencyKey: string;
  alertId: string;
  channel: NotificationChannel;
  policyKey: typeof NOTIFICATION_POLICY_VERSION;
  privacyMode: NotificationPreferences["privacyMode"];
  destination: string | null;
  status: NotificationDeliveryState;
  scheduledAt: number;
  notBefore: number;
  cancellationReason: string | null;
  accountScope: "device-local" | "account-owned";
  accountId: string | null;
  preferenceUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
}

const priorityRank = { Low: 1, Medium: 2, High: 3 } as const;
const validEmail = (value?: string) => Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
const clockMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

const localClock = (date: Date, timezone: string) => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
    const hour = Number(parts.find(part => part.type === "hour")?.value ?? 0) % 24;
    const minute = Number(parts.find(part => part.type === "minute")?.value ?? 0);
    return hour * 60 + minute;
  } catch {
    return date.getUTCHours() * 60 + date.getUTCMinutes();
  }
};

const inQuietHours = (date: Date, preferences: NotificationPreferences) => {
  if (!preferences.quietHours.enabled || preferences.quietHours.start === preferences.quietHours.end) return false;
  const current = localClock(date, preferences.timezone);
  const start = clockMinutes(preferences.quietHours.start);
  const end = clockMinutes(preferences.quietHours.end);
  return start < end ? current >= start && current < end : current >= start || current < end;
};

const nextAllowedTime = (from: number, preferences: NotificationPreferences) => {
  if (!inQuietHours(new Date(from), preferences)) return from;
  for (let cursor = from + 60_000; cursor <= from + 72 * 60 * 60_000; cursor += 60_000) {
    if (!inQuietHours(new Date(cursor), preferences)) return cursor;
  }
  return from + 72 * 60 * 60_000;
};

const nextDigestTime = (from: number, preferences: NotificationPreferences) => {
  const wanted = clockMinutes(preferences.digestTime);
  for (let cursor = from; cursor <= from + 72 * 60 * 60_000; cursor += 60_000) {
    if (localClock(new Date(cursor), preferences.timezone) === wanted && cursor >= from) return cursor;
  }
  return from + 24 * 60 * 60_000;
};

export const notificationIntentIdentity = (alertId: string, channel: NotificationChannel, policyKey = NOTIFICATION_POLICY_VERSION) => {
  const semanticIdempotencyKey = `${NOTIFICATION_DELIVERY_CONTRACT_VERSION}:${contentHash({ alertId, channel, policyKey, revision: NOTIFICATION_DELIVERY_CONTRACT_REVISION })}`;
  return { semanticIdempotencyKey, id: `notification-${contentHash({ semanticIdempotencyKey })}` };
};

export const notificationRetryDelayMs = (attempt: number) => Math.min(
  NOTIFICATION_MAX_RETRY_DELAY_MS,
  NOTIFICATION_INITIAL_RETRY_DELAY_MS * (2 ** Math.max(0, Math.floor(attempt) - 1)),
);

export const safeNotificationMessage = (input: {
  alert: Pick<Alert, "id" | "title" | "priority" | "stateChange">;
  destination: string;
  privacyMode: NotificationPreferences["privacyMode"];
  messageId: string;
}) => {
  const subject = "StockLedger review needed";
  const safeLink = `stockledger://alerts/${encodeURIComponent(input.alert.id)}`;
  const text = input.privacyMode === "rich"
    ? `A review is needed for ${input.alert.title}.\nPriority: ${input.alert.priority}.\nChange: ${input.alert.stateChange}.\nOpen StockLedger: ${safeLink}`
    : `A review is needed in StockLedger.\nOpen StockLedger: ${safeLink}`;
  return {
    to: input.destination,
    subject,
    text,
    messageId: input.messageId,
    headers: {
      "Message-ID": `<${input.messageId}@stockledger.local>`,
      "X-StockLedger-Delivery-Key": input.messageId,
    },
  };
};

export const notificationEligibility = (alert: Pick<Alert, "id" | "priority" | "snoozedUntil">, rawPreferences: NotificationPreferences, now: number, channel: NotificationChannel = "email", accountInvalidated = false) => {
  const preferences = normalizeNotificationPreferences(rawPreferences, new Date(now));
  const destination = preferences.destinations.email?.address ?? null;
  if (accountInvalidated) return { status: "canceled" as const, notBefore: now, cancellationReason: "account-invalidated", destination };
  if (!preferences.explicitConsent || !preferences.enabled || !preferences.allowedChannels.includes(channel)) {
    return { status: "canceled" as const, notBefore: now, cancellationReason: "preference-opted-out", destination };
  }
  if (priorityRank[alert.priority] < priorityRank[preferences.minimumPriority]) {
    return { status: "canceled" as const, notBefore: now, cancellationReason: "below-minimum-priority", destination };
  }
  if (!validEmail(destination ?? undefined)) return { status: "blocked-unconfigured" as const, notBefore: now, cancellationReason: "channel-unconfigured", destination };
  let notBefore = now;
  if (alert.snoozedUntil) notBefore = Math.max(notBefore, Date.parse(alert.snoozedUntil));
  if (preferences.deliveryMode === "digest") notBefore = Math.max(notBefore, nextDigestTime(now, preferences));
  notBefore = Math.max(notBefore, nextAllowedTime(notBefore, preferences));
  return { status: notBefore > now ? "held" as const : "pending" as const, notBefore, cancellationReason: null, destination };
};

export const buildNotificationIntent = (alert: Alert, preferences: NotificationPreferences, now: number, options: { accountId?: string; accountInvalidated?: boolean; accountOwned?: boolean } = {}): NotificationIntentInput => {
  const identity = notificationIntentIdentity(alert.id, "email");
  const eligibility = notificationEligibility(alert, preferences, now, "email", Boolean(options.accountInvalidated && options.accountOwned));
  const timestamp = new Date(now).toISOString();
  return {
    ...identity,
    contractVersion: NOTIFICATION_DELIVERY_CONTRACT_VERSION,
    contractRevision: NOTIFICATION_DELIVERY_CONTRACT_REVISION,
    alertId: alert.id,
    channel: "email",
    policyKey: NOTIFICATION_POLICY_VERSION,
    privacyMode: preferences.privacyMode,
    destination: eligibility.destination,
    status: eligibility.status,
    scheduledAt: now,
    notBefore: eligibility.notBefore,
    cancellationReason: eligibility.cancellationReason,
    accountScope: options.accountOwned ? "account-owned" : "device-local",
    accountId: options.accountId ?? null,
    preferenceUpdatedAt: preferences.updatedAt,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};
