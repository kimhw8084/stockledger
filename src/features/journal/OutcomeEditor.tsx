import React, { useState } from "react";
import { Text, View } from "react-native";
import { Button, Input } from "../../components/common";
import type { Outcome } from "../../types";
import type { useAppModel } from "../../hooks/useAppModel";
import { t, type AppLanguage } from "../../lib/i18n";
export function OutcomeEditor({ outcome, actions, language }: { outcome: Outcome; actions: ReturnType<typeof useAppModel>["actions"]; language: AppLanguage }) {
  const [draft, setDraft] = useState(outcome);
  const [saved, setSaved] = useState(false);
  const fields = [
    ["reviewWindow", t(language, "journal.outcome.reviewWindow")],
    ["priceChangeNote", t(language, "journal.outcome.priceChange")],
    ["maxRunupNote", t(language, "journal.outcome.maxRunup")],
    ["maxDrawdownNote", t(language, "journal.outcome.maxDrawdown")],
    ["lesson", t(language, "journal.outcome.lesson")],
    ["recipeSuggestion", t(language, "journal.outcome.recipeSuggestion")],
  ] as const;
  return <View style={{ gap: 12, paddingVertical: 12 }}>
    <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: "700", color: "#15283b" }}>{t(language, "journal.outcome.title")}</Text>
    <Text style={{ color: "#334b62", lineHeight: 22 }}>{t(language, "journal.outcome.body")}</Text>
    {fields.map(([key, label]) => <Input key={key} placeholder={label} multiline value={draft[key]} onChangeText={value => { setSaved(false); setDraft(previous => ({ ...previous, [key]: value })); }} />)}
    <Button label={t(language, "journal.outcome.save")} disabled={!draft.lesson.trim()} onPress={async () => { await actions.updateOutcome(outcome.id, draft); setSaved(true); }} />
    {saved ? <Text accessibilityLiveRegion="polite">{t(language, "journal.outcome.saved")}</Text> : null}
  </View>;
}
