import React, { useState } from "react";
import type { AppLanguage } from "../../lib/preferences";
import { AlertBanner, Button, Card, Disclosure, SegmentedControl, StyleSheet, Text, VStack, View } from "../../ui";
import type { useAppModel } from "../../hooks/useAppModel";
import type { AppData, Stock } from "../../types";
import { parseExport } from "../../domain/backupFormat";
import { downloadText, pickTextFile } from "../../platform/fileAccess";
import { reviewReport } from "../../domain/reviewReport";
import { t } from "../../lib/i18n";
import { FormField } from "./FormField";
import { WatchlistImportPanel } from "./WatchlistImportPanel";
import type { LocalWorkerHandoffView } from "../../hooks/useAppModel";

type WorkspaceActions = Pick<ReturnType<typeof useAppModel>["actions"],
  | "exportBackup"
  | "connectLocalWorkerHandoff"
  | "refreshLocalWorkerHandoff"
  | "evaluateSavedData"
  | "startPersonalWorkspace"
  | "importBackup"
  | "importPriceCsv"
  | "addStarterRecipes"
  | "saveStock"
  | "restoreEye"
  | "restoreDecision"
  | "importWatchlist"
>;

const backupName = () => `StockLedger-${new Date().toISOString().slice(0, 10)}.json`;

export function WorkspaceSettingsPanel({
  data,
  actions,
  language,
  localWorkerHandoff,
}: {
  data: AppData;
  actions: WorkspaceActions;
  language: AppLanguage;
  localWorkerHandoff: LocalWorkerHandoffView;
}) {
  const [backup, setBackup] = useState("");
  const [preview, setPreview] = useState<AppData | null>(null);
  const [csv, setCsv] = useState("");
  const [benchmark, setBenchmark] = useState("");
  const [stockId, setStockId] = useState(data.stocks.find((stock) => !stock.archivedAt)?.id ?? "");
  const [adjustment, setAdjustment] = useState<"adjusted" | "unadjusted" | "unknown">("unknown");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (task: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await task();
      setMessage(success);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(language, "workspace.operationFailed"));
    } finally {
      setBusy(false);
    }
  };
  const connectWorkerFolder = () => {
    void run(actions.connectLocalWorkerHandoff, t(language, "workspace.handoff.connected")).finally(() => {
      if (typeof document !== "undefined") {
        window.setTimeout(() => (document.querySelector('[data-testid="local-worker-handoff-folder"]') as HTMLElement | null)?.focus(), 0);
      }
    });
  };
  const activeStocks = data.stocks.filter((stock) => !stock.archivedAt);
  const archivedStocks = data.stocks.filter((stock) => stock.archivedAt);
  const archivedEyes = data.eyes.filter((eye) => eye.archivedAt);
  const archivedDecisions = data.decisions.filter((decision) => decision.archivedAt);
  const stockLabel = (stock: Stock) => `${stock.symbol} · ${stock.name}`;

  return (
    <VStack gap="lg">
      <Card variant="subtle">
        <VStack gap="md">
          <Text variant="h3">{t(language, "workspace.title")}</Text>
          <Text tone="secondary">{t(language, "workspace.body")}</Text>
          <View style={styles.actions}>
            <Button label={t(language, "workspace.export")} onPress={() => { void downloadText(backupName(), actions.exportBackup()); }} responsiveWidth="compact-full" />
            <Button label={t(language, "workspace.exportReport")} variant="secondary" onPress={() => { void downloadText(`StockLedger-review-${new Date().toISOString().slice(0, 10)}.md`, reviewReport(data)); }} responsiveWidth="compact-full" />
            <Button label={t(language, "workspace.reEvaluate")} variant="secondary" disabled={busy} loading={busy} onPress={() => { void run(async () => actions.evaluateSavedData(), language === "ko" ? "저장된 데이터 재평가 요청을 마쳤습니다." : "The saved-data review request finished."); }} responsiveWidth="compact-full" />
            {data.snapshots.some((snapshot) => snapshot.isMock) ? (
              <Button
                label={t(language, "workspace.exportSample")}
                variant="secondary"
                disabled={busy}
                onPress={() => { void run(async () => { await downloadText(backupName(), actions.exportBackup()); await actions.startPersonalWorkspace(); }, language === "ko" ? "개인 워크스페이스를 시작했습니다." : "Personal workspace started."); }}
                responsiveWidth="compact-full"
              />
            ) : null}
          </View>
        </VStack>
      </Card>

      <Card variant="subtle" testID="local-worker-handoff">
        <VStack gap="md">
          <Text variant="h3">{t(language, "workspace.handoff.title")}</Text>
          <Text tone="secondary">{t(language, "workspace.handoff.body")}</Text>
          <AlertBanner
            tone={localWorkerHandoff.status === "applied" ? "positive" : localWorkerHandoff.status === "conflict" || localWorkerHandoff.status === "failed" || localWorkerHandoff.status === "missed" || localWorkerHandoff.status === "partial" || localWorkerHandoff.status === "stale" ? "warning" : "info"}
            title={t(language, `workspace.handoff.status.${localWorkerHandoff.status}`)}
            message={localWorkerHandoff.errorCode ? t(language, `workspace.handoff.error.${localWorkerHandoff.errorCode}`) : undefined}
          />
          {localWorkerHandoff.lastAppliedAt ? <Text variant="caption" tone="secondary">{t(language, "workspace.handoff.lastApplied", { at: localWorkerHandoff.lastAppliedAt })}</Text> : null}
          {localWorkerHandoff.pendingBatchCount ? <Text variant="caption" tone="secondary">{t(language, "workspace.handoff.pendingCount", { count: localWorkerHandoff.pendingBatchCount })}</Text> : null}
          <View style={styles.actions}>
            <Button testID="local-worker-handoff-folder" label={t(language, localWorkerHandoff.configured ? "workspace.handoff.changeFolder" : "workspace.handoff.chooseFolder")} variant="secondary" disabled={busy} onPress={connectWorkerFolder} responsiveWidth="compact-full" />
            {localWorkerHandoff.configured ? <Button label={t(language, "workspace.handoff.checkNow")} variant="ghost" disabled={busy} onPress={() => { void run(actions.refreshLocalWorkerHandoff, t(language, "workspace.handoff.checked")); }} responsiveWidth="compact-full" /> : null}
          </View>
        </VStack>
      </Card>

      <Card variant="subtle">
        <VStack gap="md">
          <Text variant="h3">{t(language, "workspace.restore.title")}</Text>
          <Text tone="secondary">{language === "ko" ? "복원 전 내용 검증을 마친 뒤 현재 워크스페이스를 백업합니다." : "Validate the file first. The current workspace is exported before a restore."}</Text>
          <Button
            label={t(language, "workspace.chooseBackup")}
            variant="secondary"
            onPress={async () => {
              const text = await pickTextFile("json");
              if (text !== null) { setBackup(text); setPreview(null); setMessage(""); setError(""); }
            }}
            responsiveWidth="compact-full"
          />
          <FormField label={t(language, "workspace.restore.title")} placeholder={t(language, "workspace.backupPlaceholder")} value={backup} onChangeText={(value) => { setBackup(value); setPreview(null); setError(""); }} multiline />
          <Button
            label={t(language, "workspace.validate")}
            variant="secondary"
            disabled={!backup.trim() || busy}
            onPress={() => { void run(async () => { setPreview(parseExport(backup)); }, t(language, "workspace.validateSuccess")); }}
            responsiveWidth="compact-full"
          />
          {preview ? (
            <Card variant="elevated" padding="compact">
              <VStack gap="sm">
                <Text>{t(language, "workspace.restoreSummary", { stocks: preview.stocks.length, recipes: preview.recipes.length, decisions: preview.decisions.length })}</Text>
                <Button
                  label={t(language, "workspace.restoreCurrent")}
                  variant="danger"
                  disabled={busy}
                  loading={busy}
                  onPress={() => { void run(async () => { await downloadText(backupName(), actions.exportBackup()); await actions.importBackup(backup); setPreview(null); setBackup(""); }, t(language, "workspace.restoreSuccess")); }}
                  responsiveWidth="compact-full"
                />
              </VStack>
            </Card>
          ) : null}
        </VStack>
      </Card>

      <WatchlistImportPanel data={data} actions={actions} language={language} />

      <Disclosure id="settings-price-import" title={t(language, "workspace.prices.title")} description={t(language, "workspace.prices.body")}>
        <View style={styles.priceImport}>
        <VStack gap="md">
          {activeStocks.length ? (
            <VStack gap="xs">
              <Text variant="label">{language === "ko" ? "가져올 종목" : "Stock receiving the import"}</Text>
              <View style={styles.stockChoices}>
                {activeStocks.map((stock) => (
                  <Button
                    key={stock.id}
                    label={stockLabel(stock)}
                    variant={stockId === stock.id ? "secondary" : "ghost"}
                    size="sm"
                    onPress={() => setStockId(stock.id)}
                    responsiveWidth="compact-full"
                  />
                ))}
              </View>
            </VStack>
          ) : <Text tone="secondary">{t(language, "workspace.prices.addStock")}</Text>}
          <FormField
            label={t(language, "workspace.prices.title")}
            placeholder={t(language, "workspace.prices.placeholder")}
            value={csv}
            onChangeText={setCsv}
            multiline
          />
          <Button label={t(language, "workspace.prices.choose")} variant="secondary" onPress={async () => { const text = await pickTextFile("csv"); if (text !== null) setCsv(text); }} responsiveWidth="compact-full" />
          <FormField label={t(language, "workspace.prices.benchmarkPlaceholder")} placeholder={t(language, "workspace.prices.benchmarkPlaceholder")} value={benchmark} onChangeText={setBenchmark} multiline />
          <Button label={t(language, "workspace.prices.chooseBenchmark")} variant="secondary" onPress={async () => { const text = await pickTextFile("csv"); if (text !== null) setBenchmark(text); }} responsiveWidth="compact-full" />
          <SegmentedControl
            label={t(language, "workspace.prices.adjustment")}
            value={adjustment}
            options={(["unknown", "adjusted", "unadjusted"] as const).map((value) => ({ value, label: t(language, `workspace.prices.adjustment.${value}`) }))}
            onChange={(value) => setAdjustment(value as typeof adjustment)}
          />
          <Button
            label={t(language, "workspace.prices.validate")}
            disabled={!csv.trim() || !stockId || busy}
            loading={busy}
            onPress={() => { void run(async () => { await actions.importPriceCsv(stockId, csv, adjustment, benchmark); setCsv(""); setBenchmark(""); }, t(language, "workspace.prices.importSuccess")); }}
            responsiveWidth="compact-full"
          />
        </VStack>
        </View>
      </Disclosure>

      <Button label={t(language, "workspace.addRecipes")} variant="secondary" disabled={busy} onPress={() => { void run(actions.addStarterRecipes, t(language, "workspace.addRecipesSuccess")); }} responsiveWidth="compact-full" />

      {(archivedStocks.length || archivedEyes.length || archivedDecisions.length) ? (
        <Disclosure id="settings-archived-records" title={language === "ko" ? "보관된 기록" : "Archived records"}>
          <VStack gap="xs">
            {archivedStocks.map((stock) => <Button key={stock.id} label={t(language, "workspace.restoreStock", { symbol: stock.symbol })} variant="ghost" onPress={() => { void actions.saveStock(stock); }} responsiveWidth="compact-full" />)}
            {archivedEyes.map((eye) => <Button key={eye.id} label={t(language, "workspace.restoreEye", { symbol: data.stocks.find((stock) => stock.id === eye.stockId)?.symbol ?? eye.stockId })} variant="ghost" onPress={() => { void actions.restoreEye(eye.id); }} responsiveWidth="compact-full" />)}
            {archivedDecisions.map((decision) => <Button key={decision.id} label={t(language, "workspace.restoreDecision", { date: decision.createdAt.slice(0, 10), action: decision.action })} variant="ghost" onPress={() => { void actions.restoreDecision(decision.id); }} responsiveWidth="compact-full" />)}
          </VStack>
        </Disclosure>
      ) : null}

      {error ? <AlertBanner tone="negative" title={error} /> : null}
      {message ? <AlertBanner tone="info" title={message} /> : null}
    </VStack>
  );
}

const styles = StyleSheet.create((theme) => ({
  actions: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, flexWrap: "wrap", gap: theme.spacing.sm },
  stockChoices: { minWidth: 0, flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs },
  priceImport: { paddingTop: theme.spacing.md },
}));
