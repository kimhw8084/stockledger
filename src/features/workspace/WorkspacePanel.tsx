import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, Card, HorizontalChoice, Input } from "../../components/common";
import { WindowPanel } from "../../components/WindowPanel";
import type { useAppModel } from "../../hooks/useAppModel";
import type { AppData, Stock } from "../../types";
import { parseExport, readRecoveryData, restorePreviousBackup } from "../../lib/storage";
import { downloadText, pickTextFile } from "../../platform/fileAccess";
import { WatchlistImportPanel } from "./WatchlistImportPanel";
import { reviewReport } from "../../domain/reviewReport";

type Actions = ReturnType<typeof useAppModel>["actions"];
const backupName = () => `StockLedger-${new Date().toISOString().slice(0, 10)}.json`;
export function RecoveryPanel({ error, retry }: { error: string; retry: () => void }) {
  return <View style={styles.panel}><Text accessibilityRole="header" style={styles.title}>Your saved data needs attention</Text>
    <Text accessibilityRole="alert" selectable style={styles.body}>{error}</Text>
    <Text style={styles.body}>The original data has been kept. Export a recovery copy before restoring a backup.</Text>
    <Button label="Export recovery copy" onPress={async () => downloadText("StockLedger-recovery.json", JSON.stringify(await readRecoveryData(), null, 2))} />
    <Button label="Restore previous saved copy" tone="secondary" onPress={async () => { await restorePreviousBackup(); retry(); }} />
    <Button label="Retry loading" tone="secondary" onPress={retry} />
  </View>;
}
export function StockEditor({ stock, onClose, actions, onSaved }: { stock?: Stock; onClose: () => void; actions: Actions; onSaved: (id: string) => void }) {
  const [symbol, setSymbol] = useState(stock?.symbol ?? "");
  const [name, setName] = useState(stock?.name ?? "");
  const [thesis, setThesis] = useState(stock?.thesis ?? "");
  const [error, setError] = useState("");
  return <WindowPanel title={stock ? "Edit stock" : "Add to watchlist"} onClose={onClose}>
    <Text style={styles.label}>Ticker</Text><Input placeholder="Ticker, e.g. AAPL" value={symbol} onChangeText={setSymbol} autoCapitalize="characters" />
    <Text style={styles.label}>Company name</Text><Input placeholder="Company name" value={name} onChangeText={setName} />
    <Text style={styles.label}>Why you are watching</Text><Input placeholder="Your thesis and what would change your mind" value={thesis} onChangeText={setThesis} multiline />
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <Button label="Save stock" onPress={async () => { try { const id = await actions.saveStock({ id: stock?.id, symbol, name, thesis }); onSaved(id); onClose(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Save failed."); } }} />
  </WindowPanel>;
}
export function WorkspacePanel({ data, actions }: { data: AppData; actions: Actions }) {
  const [backup, setBackup] = useState("");
  const [preview, setPreview] = useState<AppData | null>(null);
  const [csv, setCsv] = useState("");
  const [benchmark, setBenchmark] = useState("");
  const [stockId, setStockId] = useState(data.stocks.find(stock => !stock.archivedAt)?.id ?? "");
  const [adjustment, setAdjustment] = useState<"adjusted" | "unadjusted" | "unknown">("unknown");
  const [message, setMessage] = useState("");
  const run = async (task: () => Promise<unknown>, success: string) => {
    try { await task(); setMessage(success); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Operation failed."); }
  };
  return <Card><View style={styles.panel}>
    <Text accessibilityRole="header" style={styles.title}>Your workspace</Text>
    <Text style={styles.body}>Stored on this device. Export regular backups to keep your investment notes safe.</Text>
    <Button label="Export complete backup" onPress={() => downloadText(backupName(), actions.exportBackup())} />
    <Button label="Export weekly review report" tone="secondary" onPress={() => downloadText(`StockLedger-review-${new Date().toISOString().slice(0,10)}.md`, reviewReport(data))} />
    <Button label="Re-evaluate saved data" tone="secondary" onPress={actions.evaluateSavedData} />
    {data.snapshots.some(snapshot => snapshot.isMock) ? <Button label="Export sample notes and start a clean personal workspace" tone="secondary" onPress={async () => { await downloadText(backupName(), actions.exportBackup()); await actions.startPersonalWorkspace(); }} /> : null}
    <Text style={styles.label}>Restore a backup</Text>
    <Button label="Choose backup file" tone="secondary" onPress={async () => { const text = await pickTextFile("json"); if (text !== null) { setBackup(text); setPreview(null); } }} />
    <Input placeholder="Paste StockLedger backup JSON" value={backup} onChangeText={value => { setBackup(value); setPreview(null); }} multiline />
    <Button label="Validate backup" tone="secondary" disabled={!backup.trim()} onPress={() => run(async () => { setPreview(parseExport(backup)); }, "Backup validated. Review the contents below before restoring.")} />
    {preview ? <View style={styles.panel}>
      <Text style={styles.body}>{preview.stocks.length} stocks · {preview.recipes.length} recipes · {preview.decisions.length} decisions. Restore replaces the active workspace. A copy of the current workspace will be exported first.</Text>
      <Button label="Export current data and restore this backup" tone="risk" onPress={() => run(async () => { await downloadText(backupName(), actions.exportBackup()); await actions.importBackup(backup); setPreview(null); setBackup(""); }, "Backup restored.")} />
    </View> : null}
    <WatchlistImportPanel data={data} actions={actions} />
    <Text accessibilityRole="header" style={styles.title}>Import daily prices</Text>
    <Text style={styles.body}>CSV columns: Date,Open,High,Low,Close,Volume. Supply provider OHLCV observations, not normalized chart values. History must contain consecutive NYSE sessions. Automated alerts require provider-declared adjusted history; unadjusted or unknown data stays marked partial. Long-window metrics need at least 252 sessions.</Text>
    {data.stocks.length ? <HorizontalChoice options={data.stocks.filter(stock => !stock.archivedAt).map(stock => stock.id)} value={stockId} onSelect={setStockId} labelForOption={id => data.stocks.find(stock => stock.id === id)?.symbol ?? id} /> : <Text style={styles.body}>Add a stock to your watchlist first.</Text>}
    <Input placeholder="Paste daily price CSV" value={csv} onChangeText={setCsv} multiline />
    <Button label="Choose daily price CSV" tone="secondary" onPress={async () => { const text = await pickTextFile("csv"); if (text !== null) setCsv(text); }} />
    <Input placeholder="Optional SPY CSV for matching dates" value={benchmark} onChangeText={setBenchmark} multiline />
    <Button label="Choose SPY CSV" tone="secondary" onPress={async () => { const text = await pickTextFile("csv"); if (text !== null) setBenchmark(text); }} />
    <Text style={styles.label}>Provider-declared adjustment</Text>
    <HorizontalChoice options={["unknown", "adjusted", "unadjusted"] as const} value={adjustment} onSelect={setAdjustment} />
    <Button label="Validate and import prices" disabled={!csv.trim() || !stockId} onPress={() => run(async () => { await actions.importPriceCsv(stockId, csv, adjustment, benchmark); setCsv(""); setBenchmark(""); }, "Prices imported with source and session dates.")} />
    <Button label="Add starter recipes" tone="secondary" onPress={() => run(actions.addStarterRecipes, "Starter recipes added without changing existing recipes.")} />
    {data.stocks.filter(stock => stock.archivedAt).map(stock => <Button key={stock.id} label={`Restore ${stock.symbol}`} tone="ghost" onPress={() => actions.saveStock(stock)} />)}
    {data.eyes.filter(eye => eye.archivedAt).map(eye => <Button key={eye.id} label={`Restore monitoring: ${data.stocks.find(stock => stock.id === eye.stockId)?.symbol ?? eye.stockId}`} tone="ghost" onPress={() => actions.restoreEye(eye.id)} />)}
    {data.decisions.filter(decision => decision.archivedAt).map(decision => <Button key={decision.id} label={`Restore decision: ${decision.createdAt.slice(0,10)} ${decision.action}`} tone="ghost" onPress={() => actions.restoreDecision(decision.id)} />)}
    {message ? <Text accessibilityLiveRegion="polite" selectable style={styles.body}>{message}</Text> : null}
  </View></Card>;
}
const styles = StyleSheet.create({ panel: { padding: 16, gap: 12 }, title: { fontSize: 22, fontWeight: "700", color: "#15283b" }, label: { fontSize: 15, fontWeight: "600", color: "#243a50" }, body: { fontSize: 15, lineHeight: 23, color: "#334b62" }, error: { fontSize: 15, color: "#a12935" } });
