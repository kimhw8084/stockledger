import React, { useState } from "react";
import { Text, View } from "react-native";
import { Button, Input } from "../../components/common";
import type { Outcome } from "../../types";
import type { useAppModel } from "../../hooks/useAppModel";
export function OutcomeEditor({ outcome, actions }: { outcome: Outcome; actions: ReturnType<typeof useAppModel>["actions"] }) {
  const [draft, setDraft] = useState(outcome);
  const [saved, setSaved] = useState(false);
  const fields = [ ["reviewWindow", "Review window"], ["priceChangeNote", "Price change and source"], ["maxRunupNote", "Maximum run-up and source"], ["maxDrawdownNote", "Maximum drawdown and source"], ["lesson", "What did you learn?"], ["recipeSuggestion", "What should change next time?"] ] as const;
  return <View style={{ gap: 12, paddingVertical: 12 }}>
    <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: "700", color: "#15283b" }}>Review this outcome</Text>
    <Text style={{ color: "#334b62", lineHeight: 22 }}>Record your observations and their sources. These notes are separate from the original decision evidence.</Text>
    {fields.map(([key, label]) => <Input key={key} placeholder={label} multiline value={draft[key]} onChangeText={value => { setSaved(false); setDraft(previous => ({ ...previous, [key]: value })); }} />)}
    <Button label="Save outcome review" disabled={!draft.lesson.trim()} onPress={async () => { await actions.updateOutcome(outcome.id, draft); setSaved(true); }} />
    {saved ? <Text accessibilityLiveRegion="polite">Outcome review saved.</Text> : null}
  </View>;
}
