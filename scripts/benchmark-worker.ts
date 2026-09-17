import { mkdtempSync, rmSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkerStore } from "../server/worker/store";
import { runWorker } from "../server/worker/run";
import { seedData } from "../src/lib/seed";
import { previousUsTradingDate } from "../src/lib/marketCalendar";
async function main() {
  const directory = mkdtempSync(join(tmpdir(), "stockledger-benchmark-"));
  const path = join(directory, "worker.sqlite"); const store = new WorkerStore(path);
  try {
    const now = new Date("2026-09-14T22:00:00Z"); const dates = ["2026-09-14"];
    while (dates.length < 260) dates.unshift(previousUsTradingDate(dates[0]));
    const stocks = Array.from({ length: 100 }, (_, i) => ({ id: `fixture-stock-${i}`, symbol: `T${i}`, name: `Synthetic fixture ${i}`, thesis: "Performance fixture only", createdAt: now.toISOString() }));
    const sectors = ["XLK", "XLY", "XLI"];
    const data = { ...structuredClone(seedData), stocks, eyes: stocks.map(stock => ({ id: `eye-${stock.id}`, stockId: stock.id, recipeId: seedData.recipes[0].id, recipeVersionAtCreation: seedData.recipes[0].version, thesisSnapshot: stock.thesis, createdAt: now.toISOString() })), snapshots: [], alerts: [], decisions: [], outcomes: [], evaluations: [], rawBarArchives: [], universeSnapshots: [], scanRuns: [], scanSignals: [], reviewLogs: [], processedFeatures: [], forwardProofLedger: [], scannerSettings: { ...seedData.scannerSettings, universeMode: "frozen_research_universe" as const, frozenUniverseBySector: Object.fromEntries(sectors.map((sector, i) => [sector, stocks.filter((_, index) => index % 3 === i).map(stock => stock.symbol)])) } };
    const histories = [...stocks.map(stock => stock.symbol), "SPY", ...sectors].map(symbol => ({ symbol, rows: dates.map((date, i) => ({ symbol, date, open: 100 + i, close: 100 + i, high: 101 + i, low: 99 + i, volume: 1000 })) }));
    store.import(data, 0);
    const started = performance.now();
    const result = await runWorker(store, histories, { source: "Synthetic benchmark", adjustment: "adjusted", now });
    const elapsedMs = Math.round(performance.now() - started);
    const saved = store.load()!;
    console.log(JSON.stringify({ synthetic: true, stocks: 100, sessions: 260, evaluations: saved.data.evaluations?.length, scannerRows: saved.data.scanSignals.length, elapsedMs, databaseBytesIncludingWal: [path, path + "-wal", path + "-shm"].reduce((sum, file) => sum + (existsSync(file) ? statSync(file).size : 0), 0), workspaceBytes: Buffer.byteLength(JSON.stringify(saved.data)), endingRssBytes: process.memoryUsage().rss, integrity: store.integrityCheck(), deadlineEvidence: { elapsedMs: result.deadline.elapsedMs, workloadSize: { stocks: 100, sessions: 260, symbols: result.deadline.workloadSize.symbols, rows: result.deadline.workloadSize.rows, jobStages: result.deadline.workloadSize.jobStages }, deadlineBudgetMs: result.deadline.deadlineBudgetMs, remainingHeadroomMs: result.deadline.remainingHeadroomMs, withinBudget: result.deadline.withinBudget, evidenceOnly: true } }, null, 2));
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
