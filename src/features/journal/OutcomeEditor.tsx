import React, { useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "../../ui";
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
  return <View style={styles.root}>
    <Text variant="h3" accessibilityRole="header">{t(language, "journal.outcome.title")}</Text>
    <Text tone="secondary">{t(language, "journal.outcome.body")}</Text>
    {fields.map(([key, label]) => <TextInput
      key={key}
      accessibilityLabel={label}
      placeholder={label}
      multiline
      value={draft[key]}
      onChangeText={value => { setSaved(false); setDraft(previous => ({ ...previous, [key]: value })); }}
      style={styles.input}
    />)}
    <Button label={t(language, "journal.outcome.save")} disabled={!draft.lesson.trim()} onPress={async () => { await actions.updateOutcome(outcome.id, draft); setSaved(true); }} />
    {saved ? <View accessibilityLiveRegion="polite"><Text tone="positive">{t(language, "journal.outcome.saved")}</Text></View> : null}
  </View>;
}

const styles = StyleSheet.create((theme) => ({
  root: { minWidth: 0, gap: theme.spacing.md, paddingVertical: theme.spacing.md },
  input: { minWidth: 0, width: "100%", minHeight: 44, padding: theme.spacing.md, borderWidth: theme.strokeWidths.standard, borderColor: theme.colors.border.default, borderRadius: theme.radii.md, color: theme.colors.text.primary, backgroundColor: theme.colors.background.surface, fontSize: theme.typography.body.fontSize },
}));
