import { contentHash } from "../../src/domain/contentHash";
import { evaluateWorkspace } from "../../src/domain/evaluateWorkspace";
import { snapshotFromBars } from "../../src/domain/marketSnapshot";
import { runDailyStockConditionScan } from "../../src/lib/stockConditionScanner";
import { latestCompletedTradingDate } from "../../src/lib/marketCalendar";
import { frozenScannerRules } from "../../src/lib/frozenScannerRules";
import type { RawBarRecord, UniverseSnapshot } from "../../src/types";
import { WorkerStore } from "./store";

export async function runWorker(store: WorkerStore, histories: { symbol: string; rows: RawBarRecord[] }[], options: { source: string; adjustment: "adjusted" | "unadjusted" | "unknown"; now?: Date }) {
  const saved = store.load();
  if (!saved) throw new Error("Import a StockLedger backup before running the worker.");
  const now = options.now ?? new Date();
  const data = saved.data;
  const date = latestCompletedTradingDate(now, data.scannerSettings.providerDelayMinutesAfterClose);
  const sourceHash = contentHash(histories);
  const id = contentHash({ date, sourceHash, adjustment: options.adjustment, source: options.source, settings: data.scannerSettings, recipes: data.recipes, eyes: data.eyes.map(({ lastEvaluation, ...eye }) => eye), rules: frozenScannerRules.map(rule => rule.ruleSignatureHash) });
  const token = store.claim(id);
  if (!token) return { status: "already_claimed_or_completed", jobId: id };
  try {
    const members = data.scannerSettings.frozenUniverseBySector ?? {};
    const universe: UniverseSnapshot = { id: `universe-${contentHash(members)}`, universeMode: "frozen_research_universe", universeSource: "Local configured CSV universe", universeSourceStatus: "frozen_import_fallback", snapshotDate: date, snapshotHash: contentHash(members), fetchedAtUtc: now.toISOString(), sectorSnapshots: Object.entries(members).map(([sector, tickers]) => ({ sector, tickers })) };
    const result = await runDailyStockConditionScan({ existingBatches: data.rawBarArchives, existingSignals: data.scanSignals, existingForwardProof: data.forwardProofLedger, scannerSettings: data.scannerSettings, histories, universeSnapshot: universe, now, adjustment: options.adjustment, providerName: options.source });
    const snapshots = data.stocks.map(stock => {
      const existing = data.snapshots.find(snapshot => snapshot.stockId === stock.id);
      const rows = histories.find(history => history.symbol === stock.symbol)?.rows;
      if (!rows?.length || stock.archivedAt) return existing;
      const snapshot = snapshotFromBars(stock, rows, histories.find(history => history.symbol === "SPY")?.rows ?? [], { source: options.source, origin: "import", adjustment: options.adjustment, datasetId: sourceHash, now });
      return { ...snapshot, plannedEntryLow: existing?.plannedEntryLow, plannedEntryHigh: existing?.plannedEntryHigh, lastThesisReviewAt: existing?.lastThesisReviewAt, riskFlags: existing?.riskFlags ?? [] };
    }).filter((snapshot): snapshot is NonNullable<typeof snapshot> => Boolean(snapshot));
    const next = evaluateWorkspace({ ...data, snapshots,
      rawBarArchives: result.rawArchiveBatch ? [result.rawArchiveBatch, ...data.rawBarArchives.filter(batch => batch.id !== result.rawArchiveBatch!.id)] : data.rawBarArchives,
      universeSnapshots: [result.universeSnapshot, ...data.universeSnapshots.filter(snapshot => snapshot.id !== result.universeSnapshot.id)],
      processedFeatures: [...result.processedFeatures, ...data.processedFeatures.filter(feature => !result.processedFeatures.some(next => next.id === feature.id))],
      scanRuns: [result.scanRun, ...data.scanRuns.filter(run => run.id !== result.scanRun.id)],
      scanSignals: result.scanSignals, forwardProofLedger: result.forwardProofLedger,
    }, now);
    store.complete(id, token, next, saved.revision);
    return { status: result.scanRun.status, jobId: id, scanDate: date, signals: result.scanSignals.length, alerts: next.alerts.length };
  } catch (cause) {
    store.fail(id, token, cause instanceof Error ? cause.message : "Worker failed");
    throw cause;
  }
}
