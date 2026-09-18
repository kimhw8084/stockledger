import type { NotificationPreferences } from "../types";

export const NOTIFICATION_PREFERENCES_CONTRACT_VERSION = "stockledger-notification-preferences-v1" as const;

export const defaultNotificationPreferences = (now = new Date(0)): NotificationPreferences => ({
  contractVersion: NOTIFICATION_PREFERENCES_CONTRACT_VERSION,
  revision: 1,
  explicitConsent: false,
  enabled: false,
  allowedChannels: [],
  destinations: {},
  timezone: "UTC",
  quietHours: { enabled: false, start: "22:00", end: "07:00" },
  deliveryMode: "immediate",
  digestTime: "09:00",
  minimumPriority: "Low",
  privacyMode: "minimal",
  accountScope: "device-local",
  updatedAt: now.toISOString(),
});

export const normalizeNotificationPreferences = (
  value: Partial<NotificationPreferences> | undefined,
  now = new Date(),
): NotificationPreferences => {
  const defaults = defaultNotificationPreferences(now);
  const next = {
    ...defaults,
    ...value,
    quietHours: { ...defaults.quietHours, ...(value?.quietHours ?? {}) },
    destinations: { ...defaults.destinations, ...(value?.destinations ?? {}) },
    allowedChannels: [...new Set(value?.allowedChannels ?? defaults.allowedChannels)],
  } as NotificationPreferences;
  return {
    ...next,
    contractVersion: NOTIFICATION_PREFERENCES_CONTRACT_VERSION,
    revision: 1,
    accountScope: "device-local",
    updatedAt: value?.updatedAt ?? defaults.updatedAt,
  };
};

export const validClockTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export const notificationPreferencesEqual = (left: NotificationPreferences, right: NotificationPreferences) =>
  JSON.stringify(left) === JSON.stringify(right);
