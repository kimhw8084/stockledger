import type { MockSnapshot, RawBarRecord, SnapshotProvenance, Stock } from "../types";
import { lastExpectedTradingDate } from "../lib/marketCalendar";
import { validateResponse } from "../lib/eodDataProvider";

const mean = (values: number[], count: number) => values.length >= count ? values.slice(-count).reduce((a, b) => a + b, 0) / count : undefined;
const pct = (current: number, base?: number) => base !== undefined && base > 0 ? (current / base - 1) * 100 : undefined;
export const unavailableSnapshot = (stock: Stock, now = new Date()): MockSnapshot => ({
  stockId: stock.id, price: 0, drawdownPct: 0, stabilizationScore: 0, riskFlags: [],
  updatedAt: now.toISOString(), sourceName: "No market data imported", freshness: "Unavailable", isMock: false,
});
export function snapshotFromBars(stock: Stock, bars: RawBarRecord[], benchmark: RawBarRecord[], options: {
  source: string; origin: SnapshotProvenance["origin"]; adjustment: SnapshotProvenance["adjustment"];
  datasetId: string; now?: Date; benchmarkSymbol?: string;
}): MockSnapshot {
  const now = options.now ?? new Date();
  const expected = lastExpectedTradingDate(now);
  const completed = bars.filter(bar => bar.date <= expected);
  const latest = completed.at(-1);
  if (!latest) throw new Error("No completed market session is available.");
  const validation = validateResponse(completed, latest.date);
  if (!validation.valid || completed.some(bar => bar.symbol !== stock.symbol)) throw new Error("Invalid or mixed-symbol OHLCV history.");
  const benchmarkRows = benchmark.filter(bar => bar.date <= expected);
  if (benchmarkRows.length && !validateResponse(benchmarkRows, benchmarkRows.at(-1)!.date).valid) throw new Error("Invalid benchmark history.");
  const closes = completed.map(bar => bar.close);
  const volumes = completed.map(bar => bar.volume);
  const ranges = completed.map(bar => (bar.high / bar.low - 1) * 100);
  const benchmarkByDate = new Map(benchmarkRows.map(bar => [bar.date, bar.close]));
  const price = latest.close;
  const ma20 = mean(closes, 20), ma50 = mean(closes, 50), ma200 = mean(closes, 200);
  const high252 = completed.length >= 252 ? Math.max(...closes.slice(-252)) : undefined;
  const low20 = completed.length >= 20 ? Math.min(...closes.slice(-20)) : undefined;
  const range10 = mean(ranges, 10), range30 = mean(ranges, 30);
  const baselineVolume = mean(volumes.slice(0, -1), 20);
  const return60 = pct(price, closes.at(-61));
  const benchNow = benchmarkByDate.get(latest.date);
  const benchPast = completed.at(-61) ? benchmarkByDate.get(completed.at(-61)!.date) : undefined;
  const benchmarkReturn60 = benchNow === undefined ? undefined : pct(benchNow, benchPast);
  const nearSupport = low20 === undefined ? undefined : price >= low20 && price <= low20 * 1.05;
  const priceReturn20dPct = pct(price, closes.at(-21));
  const compression = range10 !== undefined && range30 !== undefined ? range10 < range30 * .85 : undefined;
  // Keep benchmark arrays dated and raw; never independently min-max normalize.
  const aligned = completed.filter(bar => benchmarkByDate.has(bar.date));
  return {
    stockId: stock.id, price, drawdownPct: pct(price, high252) ?? 0,
    stabilizationScore: ma20 !== undefined && ma50 !== undefined ? Math.round(Math.min(100, Math.max(0, 50 + (pct(price, ma20) ?? 0) * 3 + (pct(ma20, ma50) ?? 0) * 2))) : 0,
    nearSupport, movingAverage20DistancePct: pct(price, ma20), movingAverage50DistancePct: pct(price, ma50), movingAverage200DistancePct: pct(price, ma200),
    priceReturn20dPct, priceReturn60dPct: return60,
    relativeStrengthVsSpyPct: return60 !== undefined && benchmarkReturn60 !== undefined ? return60 - benchmarkReturn60 : undefined,
    volumeSpike: baselineVolume !== undefined && baselineVolume > 0 ? latest.volume > baselineVolume * 1.4 : undefined,
    volatilityCompression: compression, averageRangePct: range10, riskFlags: [],
    priceHistorySeries: closes, historyDates: completed.map(bar => bar.date),
    benchmarkHistorySeries: aligned.map(bar => benchmarkByDate.get(bar.date)!), benchmarkDates: aligned.map(bar => bar.date),
    benchmarkSymbol: options.benchmarkSymbol ?? "SPY", volumeHistorySeries: volumes, volatilityHistorySeries: ranges,
    updatedAt: now.toISOString(), sourceName: options.source, isMock: options.origin === "demo",
    freshness: latest.date < expected ? "Stale" : options.adjustment !== "adjusted" ? "Partial" : "Delayed",
    provenance: { schemaVersion: 2, origin: options.origin, observedDate: latest.date, retrievedAt: now.toISOString(), currency: "USD", adjustment: options.adjustment, datasetId: options.datasetId },
  };
}
