import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, Card, HorizontalChoice, Input } from "../../components/common";
import { WindowPanel } from "../../components/WindowPanel";
import type { useAppModel } from "../../hooks/useAppModel";
import type { AppData, Stock } from "../../types";
import { parseExport } from "../../domain/backupFormat";
import { downloadText, pickTextFile } from "../../platform/fileAccess";
import { WatchlistImportPanel } from "./WatchlistImportPanel";
import { reviewReport } from "../../domain/reviewReport";
import { t, type AppLanguage } from "../../lib/i18n";

type Actions = ReturnType<typeof useAppModel>["actions"];
const backupName = () => `StockLedger-${new Date().toISOString().slice(0, 10)}.json`;
export function RecoveryPanel({ error, retry, actions, language }: { error: string; retry: () => void; actions: Actions; language: AppLanguage }) {
  return <View style={styles.panel}><Text accessibilityRole="header" style={styles.title}>{t(language, "workspace.recovery.title")}</Text>
    <Text accessibilityRole="alert" selectable style={styles.body}>{error}</Text>
    <Text style={styles.body}>{t(language, "workspace.recovery.body")}</Text>
    <Button label={t(language, "workspace.recovery.export")} onPress={async () => downloadText("StockLedger-recovery.json", JSON.stringify(await actions.readRecoveryData(), null, 2))} />
    <Button label={t(language, "workspace.recovery.restore")} tone="secondary" onPress={async () => { await actions.restorePreviousBackup(); retry(); }} />
    <Button label={t(language, "workspace.recovery.retry")} tone="secondary" onPress={retry} />
  </View>;
}
export function StockEditor({ stock, onClose, actions, onSaved, language }: { stock?: Stock; onClose: () => void; actions: Actions; onSaved: (id: string) => void; language: AppLanguage }) {
  const [symbol, setSymbol] = useState(stock?.symbol ?? "");
  const [name, setName] = useState(stock?.name ?? "");
  const [thesis, setThesis] = useState(stock?.thesis ?? "");
  const [error, setError] = useState("");
  return <WindowPanel title={stock ? t(language, "stocks.editor.editTitle") : t(language, "stocks.editor.addTitle")} onClose={onClose} closeLabel={t(language, "common.done")}>
    <Text style={styles.label}>{t(language, "stocks.editor.ticker")}</Text><Input placeholder={t(language, "stocks.editor.tickerPlaceholder")} value={symbol} onChangeText={setSymbol} autoCapitalize="characters" />
    <Text style={styles.label}>{t(language, "stocks.editor.companyName")}</Text><Input placeholder={t(language, "stocks.editor.companyNamePlaceholder")} value={name} onChangeText={setName} />
    <Text style={styles.label}>{t(language, "stocks.editor.thesis")}</Text><Input placeholder={t(language, "stocks.editor.thesisPlaceholder")} value={thesis} onChangeText={setThesis} multiline />
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <Button label={t(language, "stocks.editor.save")} onPress={async () => { try { const id = await actions.saveStock({ id: stock?.id, symbol, name, thesis }); onSaved(id); onClose(); } catch (cause) { setError(cause instanceof Error ? cause.message : t(language, "workspace.saveFailed")); } }} />
  </WindowPanel>;
}
export function WorkspacePanel({ data, actions, language }: { data: AppData; actions: Actions; language: AppLanguage }) {
  const [backup, setBackup] = useState("");
  const [preview, setPreview] = useState<AppData | null>(null);
  const [csv, setCsv] = useState("");
  const [benchmark, setBenchmark] = useState("");
  const [stockId, setStockId] = useState(data.stocks.find(stock => !stock.archivedAt)?.id ?? "");
  const [adjustment, setAdjustment] = useState<"adjusted" | "unadjusted" | "unknown">("unknown");
  const [message, setMessage] = useState("");
  const run = async (task: () => Promise<unknown>, success: string) => {
    try { await task(); setMessage(success); } catch (cause) { setMessage(cause instanceof Error ? cause.message : t(language, "workspace.operationFailed")); }
  };
  return <Card><View style={styles.panel}>
    <Text accessibilityRole="header" style={styles.title}>{t(language, "workspace.title")}</Text>
    <Text style={styles.body}>{t(language, "workspace.body")}</Text>
    <Button label={t(language, "workspace.export")} onPress={() => downloadText(backupName(), actions.exportBackup())} />
    <Button label={t(language, "workspace.exportReport")} tone="secondary" onPress={() => downloadText(`StockLedger-review-${new Date().toISOString().slice(0,10)}.md`, reviewReport(data))} />
    <Button label={t(language, "workspace.reEvaluate")} tone="secondary" onPress={actions.evaluateSavedData} />
    {data.snapshots.some(snapshot => snapshot.isMock) ? <Button label={t(language, "workspace.exportSample")} tone="secondary" onPress={async () => { await downloadText(backupName(), actions.exportBackup()); await actions.startPersonalWorkspace(); }} /> : null}
    <Text style={styles.label}>{t(language, "workspace.restore.title")}</Text>
    <Button label={t(language, "workspace.chooseBackup")} tone="secondary" onPress={async () => { const text = await pickTextFile("json"); if (text !== null) { setBackup(text); setPreview(null); } }} />
    <Input placeholder={t(language, "workspace.backupPlaceholder")} value={backup} onChangeText={value => { setBackup(value); setPreview(null); }} multiline />
    <Button label={t(language, "workspace.validate")} tone="secondary" disabled={!backup.trim()} onPress={() => run(async () => { setPreview(parseExport(backup)); }, t(language, "workspace.validateSuccess"))} />
    {preview ? <View style={styles.panel}>
      <Text style={styles.body}>{t(language, "workspace.restoreSummary", { stocks: preview.stocks.length, recipes: preview.recipes.length, decisions: preview.decisions.length })}</Text>
      <Button label={t(language, "workspace.restoreCurrent")} tone="risk" onPress={() => run(async () => { await downloadText(backupName(), actions.exportBackup()); await actions.importBackup(backup); setPreview(null); setBackup(""); }, t(language, "workspace.restoreSuccess"))} />
    </View> : null}
    <WatchlistImportPanel data={data} actions={actions} language={language} />
    <Text accessibilityRole="header" style={styles.title}>{t(language, "workspace.prices.title")}</Text>
    <Text style={styles.body}>{t(language, "workspace.prices.body")}</Text>
    {data.stocks.length ? <HorizontalChoice options={data.stocks.filter(stock => !stock.archivedAt).map(stock => stock.id)} value={stockId} onSelect={setStockId} labelForOption={id => data.stocks.find(stock => stock.id === id)?.symbol ?? id} /> : <Text style={styles.body}>{t(language, "workspace.prices.addStock")}</Text>}
    <Input placeholder={t(language, "workspace.prices.placeholder")} value={csv} onChangeText={setCsv} multiline />
    <Button label={t(language, "workspace.prices.choose")} tone="secondary" onPress={async () => { const text = await pickTextFile("csv"); if (text !== null) setCsv(text); }} />
    <Input placeholder={t(language, "workspace.prices.benchmarkPlaceholder")} value={benchmark} onChangeText={setBenchmark} multiline />
    <Button label={t(language, "workspace.prices.chooseBenchmark")} tone="secondary" onPress={async () => { const text = await pickTextFile("csv"); if (text !== null) setBenchmark(text); }} />
    <Text style={styles.label}>{t(language, "workspace.prices.adjustment")}</Text>
    <HorizontalChoice options={["unknown", "adjusted", "unadjusted"] as const} value={adjustment} onSelect={setAdjustment} labelForOption={value => t(language, `workspace.prices.adjustment.${value}`)} />
    <Button label={t(language, "workspace.prices.validate")} disabled={!csv.trim() || !stockId} onPress={() => run(async () => { await actions.importPriceCsv(stockId, csv, adjustment, benchmark); setCsv(""); setBenchmark(""); }, t(language, "workspace.prices.importSuccess"))} />
    <Button label={t(language, "workspace.addRecipes")} tone="secondary" onPress={() => run(actions.addStarterRecipes, t(language, "workspace.addRecipesSuccess"))} />
    {data.stocks.filter(stock => stock.archivedAt).map(stock => <Button key={stock.id} label={t(language, "workspace.restoreStock", { symbol: stock.symbol })} tone="ghost" onPress={() => actions.saveStock(stock)} />)}
    {data.eyes.filter(eye => eye.archivedAt).map(eye => <Button key={eye.id} label={t(language, "workspace.restoreEye", { symbol: data.stocks.find(stock => stock.id === eye.stockId)?.symbol ?? eye.stockId })} tone="ghost" onPress={() => actions.restoreEye(eye.id)} />)}
    {data.decisions.filter(decision => decision.archivedAt).map(decision => <Button key={decision.id} label={t(language, "workspace.restoreDecision", { date: decision.createdAt.slice(0,10), action: decision.action })} tone="ghost" onPress={() => actions.restoreDecision(decision.id)} />)}
    {message ? <Text accessibilityLiveRegion="polite" selectable style={styles.body}>{message}</Text> : null}
  </View></Card>;
}
const styles = StyleSheet.create({ panel: { padding: 16, gap: 12 }, title: { fontSize: 22, fontWeight: "700", color: "#15283b" }, label: { fontSize: 15, fontWeight: "600", color: "#243a50" }, body: { fontSize: 15, lineHeight: 23, color: "#334b62" }, error: { fontSize: 15, color: "#a12935" } });
