import type { AppLanguage } from "../../lib/preferences";
import { formatLocaleDateTime, localizedProviderStatus, t } from "../../lib/i18n";
import { defaultNotificationPreferences } from "../../domain/notificationPreferences";
import type { AppData, ProviderHealthEntry } from "../../types";
import type { SettingsProviderView } from "./SettingsScreen";

export interface SettingsModel {
  providers: SettingsProviderView[];
  healthyCount: number;
  limitedCount: number;
  unconfiguredCount: number;
  unavailableCount: number;
  notificationSummary: string;
  notificationTone: "positive" | "warning" | "neutral";
  syncSummary: string;
  lastSnapshotUpdate: string;
}

export const buildSettingsModel = ({
  language,
  data,
  providerHealth,
  cloudConfigured,
}: {
  language: AppLanguage;
  data: Pick<AppData, "notificationPreferences" | "lastKnownNotificationDeliveryStatus" | "snapshots">;
  providerHealth: readonly ProviderHealthEntry[];
  cloudConfigured: boolean;
}): SettingsModel => {
  const preferences = data.notificationPreferences ?? defaultNotificationPreferences();
  const notificationsEnabled = preferences.enabled && preferences.explicitConsent;
  const workerStatus = data.lastKnownNotificationDeliveryStatus;
  const notificationPending = Boolean(workerStatus && Date.parse(preferences.updatedAt) > Date.parse(workerStatus.preferenceUpdatedAt));
  const notificationSummary = notificationPending
    ? language === "ko" ? "워커에 전달 대기 중" : "Pending worker handoff"
    : notificationsEnabled
      ? language === "ko" ? "설정에서 사용 중 · 전달 확인 별도" : "Enabled by preference · delivery not confirmed"
      : language === "ko" ? "꺼짐" : "Disabled by preference";
  const providers = providerHealth.map((entry) => ({
    provider: entry.provider,
    status: localizedProviderStatus(language, entry.status),
    tone: entry.status === "Healthy" ? "positive" as const : entry.status === "Error" ? "negative" as const : "warning" as const,
    mode: entry.mode === "Background" ? t(language, "settings.providers.modeBackground") : entry.mode === "On Demand" ? t(language, "settings.providers.modeOnDemand") : t(language, "settings.providers.modeDisabled"),
    configured: entry.configured,
    note: entry.note,
    endpoint: entry.endpoint,
    checkedAt: entry.lastCheckedAt ? formatLocaleDateTime(language, entry.lastCheckedAt) : undefined,
  }));
  const lastSnapshot = [...data.snapshots].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  return {
    providers,
    healthyCount: providerHealth.filter((entry) => entry.status === "Healthy").length,
    limitedCount: providerHealth.filter((entry) => entry.status === "Plan Limited").length,
    unconfiguredCount: providerHealth.filter((entry) => entry.status === "Unconfigured").length,
    unavailableCount: providerHealth.filter((entry) => entry.status === "Error").length,
    notificationSummary,
    notificationTone: notificationPending ? "warning" : notificationsEnabled ? "positive" : "neutral",
    syncSummary: cloudConfigured
      ? language === "ko" ? "선택적 개인 클라우드가 설정됨 · 계정 상태는 아래에서 확인" : "Optional personal cloud is configured · account state is below"
      : language === "ko" ? "미설정 · 데이터는 이 기기에 유지" : "Not configured · data stays on this device",
    lastSnapshotUpdate: lastSnapshot ? formatLocaleDateTime(language, lastSnapshot.updatedAt) : "",
  };
};
