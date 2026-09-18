import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, Card, HorizontalChoice, Input, MetaPill } from "../../components/common";
import { defaultNotificationPreferences, validClockTime } from "../../domain/notificationPreferences";
import type { useAppModel } from "../../hooks/useAppModel";
import { t, type AppLanguage } from "../../lib/i18n";
import type { AppData, NotificationPreferences } from "../../types";

const deliveryModes = ["immediate", "digest"] as const;
const privacyModes = ["minimal", "rich"] as const;

export function NotificationSettingsPanel({ data, actions, language }: { data: AppData; actions: ReturnType<typeof useAppModel>["actions"]; language: AppLanguage }) {
  const preferences = data.notificationPreferences ?? defaultNotificationPreferences();
  const [email, setEmail] = useState(preferences.destinations.email?.address ?? "");
  const [start, setStart] = useState(preferences.quietHours.start);
  const [end, setEnd] = useState(preferences.quietHours.end);
  const [digestTime, setDigestTime] = useState(preferences.digestTime);
  const save = (change: Partial<NotificationPreferences>) => actions.updateNotificationPreferences(change);
  const configured = preferences.enabled && preferences.explicitConsent && preferences.allowedChannels.includes("email") && Boolean(preferences.destinations.email?.address);
  return <Card>
    <View style={styles.panel}>
      <Text accessibilityRole="header" style={styles.title}>{t(language, "settings.notifications.title")}</Text>
      <Text style={styles.body}>{t(language, "settings.notifications.note")}</Text>
      <View style={styles.statusRow} accessibilityLiveRegion="polite">
        <MetaPill label={configured ? t(language, "settings.notifications.configured") : t(language, "settings.notifications.unconfigured")} tone={configured ? "success" : "risk"} />
        <MetaPill label={preferences.enabled && preferences.explicitConsent ? t(language, "settings.notifications.enabled") : t(language, "settings.notifications.off")} />
      </View>
      <Text style={styles.label}>{t(language, "settings.notifications.email")}</Text>
      <Input value={email} onChangeText={setEmail} placeholder={t(language, "settings.notifications.emailPlaceholder")} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Button label={preferences.enabled && preferences.explicitConsent ? t(language, "settings.notifications.disable") : t(language, "settings.notifications.enable")} tone={preferences.enabled && preferences.explicitConsent ? "risk" : "primary"} onPress={() => save({
        explicitConsent: !(preferences.enabled && preferences.explicitConsent),
        enabled: !(preferences.enabled && preferences.explicitConsent),
        allowedChannels: !(preferences.enabled && preferences.explicitConsent) ? ["email"] : [],
        destinations: !(preferences.enabled && preferences.explicitConsent) && email.trim() ? { email: { address: email.trim() } } : preferences.destinations,
      })} />
      <Text style={styles.label}>{t(language, "settings.notifications.mode")}</Text>
      <HorizontalChoice options={deliveryModes} value={preferences.deliveryMode} onSelect={deliveryMode => save({ deliveryMode })} variant="segmented" labelForOption={option => t(language, `settings.notifications.mode.${option}`)} />
      {preferences.deliveryMode === "digest" ? <Input value={digestTime} onChangeText={setDigestTime} placeholder={t(language, "settings.notifications.digestTime")} autoCapitalize="none" invalid={!validClockTime(digestTime)} /> : null}
      <Text style={styles.label}>{t(language, "settings.notifications.quietHours")}</Text>
      <View style={styles.inline}>
        <Input value={start} onChangeText={setStart} placeholder={t(language, "settings.notifications.quietStart")} autoCapitalize="none" invalid={!validClockTime(start)} />
        <Input value={end} onChangeText={setEnd} placeholder={t(language, "settings.notifications.quietEnd")} autoCapitalize="none" invalid={!validClockTime(end)} />
      </View>
      <Button label={preferences.quietHours.enabled ? t(language, "settings.notifications.quietDisable") : t(language, "settings.notifications.quietEnable")} tone="secondary" onPress={() => save({ quietHours: { enabled: !preferences.quietHours.enabled, start, end } })} />
      <Text style={styles.label}>{t(language, "settings.notifications.privacy")}</Text>
      <HorizontalChoice options={privacyModes} value={preferences.privacyMode} onSelect={privacyMode => save({ privacyMode })} variant="segmented" labelForOption={option => t(language, `settings.notifications.privacy.${option}`)} />
      <Button label={t(language, "settings.notifications.save")} disabled={!validClockTime(start) || !validClockTime(end) || !validClockTime(digestTime)} onPress={() => save({ destinations: email.trim() ? { email: { address: email.trim() } } : {}, quietHours: { ...preferences.quietHours, start, end }, digestTime })} />
      <Text style={styles.detail}>{t(language, "settings.notifications.lastStatus")}</Text>
      <Text style={styles.detail}>{t(language, "settings.notifications.workerStatus")}</Text>
      <Text style={styles.detail}>{t(language, "settings.notifications.privacyNote")}</Text>
    </View>
  </Card>;
}

const styles = StyleSheet.create({
  panel: { padding: 16, gap: 12 }, title: { fontSize: 22, fontWeight: "700", color: "#15283b" }, body: { fontSize: 15, lineHeight: 23, color: "#334b62" }, detail: { fontSize: 12, lineHeight: 18, color: "#334b62" }, label: { fontSize: 13, fontWeight: "700", color: "#15283b" }, inline: { flexDirection: "row", gap: 8 }, statusRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
});
