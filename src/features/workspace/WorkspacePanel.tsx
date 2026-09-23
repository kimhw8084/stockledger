import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, Input } from "../../components/common";
import { WindowPanel } from "../../components/WindowPanel";
import type { useAppModel } from "../../hooks/useAppModel";
import type { Stock } from "../../types";
import { downloadText } from "../../platform/fileAccess";
import { t, type AppLanguage } from "../../lib/i18n";

type Actions = ReturnType<typeof useAppModel>["actions"];
export function RecoveryPanel({ error, retry, actions, language }: { error: string; retry: () => void; actions: Actions; language: AppLanguage }) {
  return <View style={styles.panel}><Text accessibilityRole="header" style={styles.title}>{t(language, "workspace.recovery.title")}</Text>
    <Text accessibilityRole="alert" selectable style={styles.body}>{error}</Text>
    <Text style={styles.body}>{t(language, "workspace.recovery.body")}</Text>
    <Button label={t(language, "workspace.recovery.export")} onPress={async () => downloadText("StockLedger-recovery.json", JSON.stringify(await actions.readRecoveryData(), null, 2))} />
    <Button label={t(language, "workspace.recovery.restore")} tone="secondary" onPress={async () => { await actions.restorePreviousBackup(); retry(); }} />
    <Button label={t(language, "workspace.recovery.retry")} tone="secondary" onPress={retry} />
  </View>;
}
export function StockEditor({ stock, onClose, actions, onSaved, language, returnFocusRef, fallbackFocusRef }: { stock?: Stock; onClose: () => void; actions: Actions; onSaved: (id: string) => void; language: AppLanguage; returnFocusRef?: React.RefObject<any>; fallbackFocusRef?: React.RefObject<any> }) {
  const [symbol, setSymbol] = useState(stock?.symbol ?? "");
  const [name, setName] = useState(stock?.name ?? "");
  const [thesis, setThesis] = useState(stock?.thesis ?? "");
  const [error, setError] = useState("");
  return <WindowPanel title={stock ? t(language, "stocks.editor.editTitle") : t(language, "stocks.editor.addTitle")} onClose={onClose} closeLabel={t(language, "common.done")} returnFocusRef={returnFocusRef} fallbackFocusRef={fallbackFocusRef}>
    <Text style={styles.label}>{t(language, "stocks.editor.ticker")}</Text><Input placeholder={t(language, "stocks.editor.tickerPlaceholder")} value={symbol} onChangeText={setSymbol} autoCapitalize="characters" />
    <Text style={styles.label}>{t(language, "stocks.editor.companyName")}</Text><Input placeholder={t(language, "stocks.editor.companyNamePlaceholder")} value={name} onChangeText={setName} />
    <Text style={styles.label}>{t(language, "stocks.editor.thesis")}</Text><Input placeholder={t(language, "stocks.editor.thesisPlaceholder")} value={thesis} onChangeText={setThesis} multiline />
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <Button label={t(language, "stocks.editor.save")} onPress={async () => { try { const id = await actions.saveStock({ id: stock?.id, symbol, name, thesis }); onSaved(id); onClose(); } catch (cause) { setError(cause instanceof Error ? cause.message : t(language, "workspace.saveFailed")); } }} />
  </WindowPanel>;
}
const styles = StyleSheet.create({ panel: { padding: 16, gap: 12 }, title: { fontSize: 22, fontWeight: "700", color: "#15283b" }, label: { fontSize: 15, fontWeight: "600", color: "#243a50" }, body: { fontSize: 15, lineHeight: 23, color: "#334b62" }, error: { fontSize: 15, color: "#a12935" } });
