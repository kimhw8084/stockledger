import React, { useState } from "react";
import type { AppLanguage } from "../../lib/preferences";
import { AlertBanner, Button, Card, HStack, SegmentedControl, StatusIndicator, StyleSheet, Text, VStack, View } from "../../ui";
import { WindowPanel } from "../../components/WindowPanel";
import { useWindowPanelFocus } from "../../hooks/useWindowPanelFocus";
import { defaultNotificationPreferences, validClockTime } from "../../domain/notificationPreferences";
import type { useAppModel } from "../../hooks/useAppModel";
import { t } from "../../lib/i18n";
import type { AppData, NotificationPreferences } from "../../types";
import { FormField } from "../settings/FormField";

type NotificationActions = Pick<ReturnType<typeof useAppModel>["actions"], "updateNotificationPreferences">;
const deliveryModes = ["immediate", "digest"] as const;
const privacyModes = ["minimal", "rich"] as const;

export function NotificationSettingsPanel({
  data,
  actions,
  language,
  fallbackFocusRef,
}: {
  data: Pick<AppData, "notificationPreferences" | "lastKnownNotificationDeliveryStatus">;
  actions: NotificationActions;
  language: AppLanguage;
  fallbackFocusRef?: React.RefObject<any>;
}) {
  const preferences = data.notificationPreferences ?? defaultNotificationPreferences();
  const [email, setEmail] = useState(preferences.destinations.email?.address ?? "");
  const [start, setStart] = useState(preferences.quietHours.start);
  const [end, setEnd] = useState(preferences.quietHours.end);
  const [digestTime, setDigestTime] = useState(preferences.digestTime);
  const [disableConfirmationOpen, setDisableConfirmationOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const disableConfirmationFocus = useWindowPanelFocus(fallbackFocusRef);
  const notificationsEnabled = preferences.enabled && preferences.explicitConsent;
  const configured = notificationsEnabled && preferences.allowedChannels.includes("email") && Boolean(preferences.destinations.email?.address);
  const workerStatus = data.lastKnownNotificationDeliveryStatus;
  const pendingWorkerHandoff = Boolean(workerStatus && Date.parse(preferences.updatedAt) > Date.parse(workerStatus.preferenceUpdatedAt));
  const workerStateKey = workerStatus?.lastState ? `settings.notifications.state.${workerStatus.lastState}` : "settings.notifications.state.none";

  const update = async (change: Partial<NotificationPreferences>) => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await actions.updateNotificationPreferences(change);
      setMessage(language === "ko" ? "알림 설정을 저장했습니다." : "Notification preferences saved.");
      return true;
    } catch {
      setError(t(language, "settings.notifications.saveFailed"));
      return false;
    } finally {
      setSaving(false);
    }
  };
  const disableNotifications = async (close: () => void) => {
    if (await update({ explicitConsent: false, enabled: false, allowedChannels: [] })) close();
  };

  return <>
    <Card variant="subtle">
      <VStack gap="lg">
        <View style={styles.heading}>
          <View style={styles.copy}>
            <Text variant="h3">{t(language, "settings.notifications.title")}</Text>
            <Text tone="secondary">{t(language, "settings.notifications.note")}</Text>
          </View>
          <StatusIndicator
            label={configured ? t(language, "settings.notifications.configured") : t(language, "settings.notifications.unconfigured")}
            description={notificationsEnabled ? t(language, "settings.notifications.enabled") : t(language, "settings.notifications.off")}
            tone={configured ? "positive" : "warning"}
          />
        </View>

        <FormField
          label={t(language, "settings.notifications.email")}
          value={email}
          onChangeText={setEmail}
          placeholder={t(language, "settings.notifications.emailPlaceholder")}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          disabled={saving}
        />
        <Button
          label={notificationsEnabled ? t(language, "settings.notifications.disable") : t(language, "settings.notifications.enable")}
          variant={notificationsEnabled ? "danger" : "primary"}
          disabled={saving}
          loading={saving}
          onPress={() => notificationsEnabled
            ? (disableConfirmationFocus.captureInvoker(), setDisableConfirmationOpen(true))
            : void update({ explicitConsent: true, enabled: true, allowedChannels: ["email"], destinations: email.trim() ? { email: { address: email.trim() } } : preferences.destinations })}
          responsiveWidth="compact-full"
        />

        <SegmentedControl
          label={t(language, "settings.notifications.mode")}
          value={preferences.deliveryMode}
          options={deliveryModes.map((value) => ({ value, label: t(language, `settings.notifications.mode.${value}`) }))}
          disabled={saving}
          onChange={(value) => { void update({ deliveryMode: value as typeof preferences.deliveryMode }); }}
        />
        {preferences.deliveryMode === "digest" ? (
          <FormField
            label={t(language, "settings.notifications.digestTime")}
            value={digestTime}
            onChangeText={setDigestTime}
            placeholder={t(language, "settings.notifications.digestTime")}
            autoCapitalize="none"
            invalid={!validClockTime(digestTime)}
            disabled={saving}
          />
        ) : null}

        <Text variant="label">{t(language, "settings.notifications.quietHours")}</Text>
        <HStack gap="sm" align="start">
          <FormField label={t(language, "settings.notifications.quietStart")} value={start} onChangeText={setStart} placeholder="HH:MM" autoCapitalize="none" invalid={!validClockTime(start)} disabled={saving} />
          <FormField label={t(language, "settings.notifications.quietEnd")} value={end} onChangeText={setEnd} placeholder="HH:MM" autoCapitalize="none" invalid={!validClockTime(end)} disabled={saving} />
        </HStack>
        <Button
          label={preferences.quietHours.enabled ? t(language, "settings.notifications.quietDisable") : t(language, "settings.notifications.quietEnable")}
          variant="secondary"
          disabled={saving || !validClockTime(start) || !validClockTime(end)}
          onPress={() => { void update({ quietHours: { enabled: !preferences.quietHours.enabled, start, end } }); }}
          responsiveWidth="compact-full"
        />

        <SegmentedControl
          label={t(language, "settings.notifications.privacy")}
          value={preferences.privacyMode}
          options={privacyModes.map((value) => ({ value, label: t(language, `settings.notifications.privacy.${value}`) }))}
          disabled={saving}
          onChange={(value) => { void update({ privacyMode: value as typeof preferences.privacyMode }); }}
        />
        <Button
          label={t(language, "settings.notifications.save")}
          disabled={saving || !validClockTime(start) || !validClockTime(end) || !validClockTime(digestTime)}
          loading={saving}
          onPress={() => { void update({ destinations: email.trim() ? { email: { address: email.trim() } } : {}, quietHours: { ...preferences.quietHours, start, end }, digestTime }); }}
          responsiveWidth="compact-full"
        />

        <View style={styles.deliveryStatus}>
          <Text variant="label">{t(language, "settings.notifications.lastStatus")}</Text>
          {pendingWorkerHandoff ? <AlertBanner tone="warning" title={t(language, "settings.notifications.pendingWorkerHandoff")} /> : null}
          {workerStatus ? (
            <Text variant="caption" tone="secondary">
              {t(language, "settings.notifications.lastKnownState", { state: t(language, workerStateKey), at: workerStatus.generatedAt, attempts: workerStatus.attemptCount })}{workerStatus.errorClass ? ` ${workerStatus.errorClass}` : ""}
            </Text>
          ) : <Text variant="caption" tone="secondary">{t(language, "settings.notifications.noLastKnownState")}</Text>}
          <Text variant="caption" tone="secondary">{t(language, "settings.notifications.workerStatus")}</Text>
          <Text variant="caption" tone="secondary">{t(language, "settings.notifications.handoffNote")}</Text>
          <Text variant="caption" tone="secondary">{t(language, "settings.notifications.privacyNote")}</Text>
        </View>
        {error ? <AlertBanner tone="negative" title={error} /> : null}
        {message ? <AlertBanner tone="info" title={message} /> : null}
      </VStack>
    </Card>

    {disableConfirmationOpen ? (
      <WindowPanel
        title={t(language, "settings.notifications.disableConfirmTitle")}
        onClose={() => setDisableConfirmationOpen(false)}
        closeDisabled={saving}
        closeLabel={t(language, "common.close")}
        returnFocusRef={disableConfirmationFocus.returnFocusRef}
        fallbackFocusRef={disableConfirmationFocus.fallbackFocusRef}
      >
        {(close, closeAfterCommit) => (
          <VStack gap="lg">
            <Text>{t(language, "settings.notifications.disableConfirmBody")}</Text>
            <Text variant="caption" tone="secondary">{t(language, "settings.notifications.disableConfirmStatusNote")}</Text>
            {error ? (
              <View style={styles.confirmError}>
                <AlertBanner tone="negative" title={error} />
                <Text variant="caption" tone="secondary">{t(language, "settings.notifications.disableSaveFailed")}</Text>
              </View>
            ) : null}
            <View style={styles.confirmActions}>
              <Button label={t(language, "settings.notifications.disableConfirmCancel")} variant="secondary" disabled={saving} onPress={close} responsiveWidth="compact-full" />
              <Button label={t(language, "settings.notifications.disableConfirmConfirm")} variant="danger" disabled={saving} loading={saving} onPress={() => { void disableNotifications(closeAfterCommit); }} responsiveWidth="compact-full" />
            </View>
          </VStack>
        )}
      </WindowPanel>
    ) : null}
  </>;
}

const styles = StyleSheet.create((theme) => ({
  heading: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, alignItems: { compact: "stretch", medium: "flex-start" }, justifyContent: "space-between", gap: theme.spacing.md },
  copy: { minWidth: 0, flex: 1, gap: theme.spacing.xs },
  deliveryStatus: { minWidth: 0, gap: theme.spacing.sm, paddingTop: theme.spacing.md, borderTopWidth: theme.strokeWidths.standard, borderTopColor: theme.colors.border.subtle },
  confirmActions: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, flexWrap: "wrap", gap: theme.spacing.sm },
  confirmError: { minWidth: 0, gap: theme.spacing.xs },
}));
