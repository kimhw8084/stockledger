import type { MockSnapshot, RawBarRecord, SnapshotProvenance, Stock } from "../types";
import { lastExpectedTradingDate } from "../lib/marketCalendar";
import { validateResponse } from "../lib/eodDataProvider";
import { getMetricContract } from "../lib/metricCatalog";
import type { MarketDataArchiveMetadata } from "../lib/marketDataContract";

const mean = (values: number[], count: number) => values.length >= count ? values.slice(-count).reduce((a, b) => a + b, 0) / count : undefined;
const pct = (current: number, base?: number) => base !== undefined && base > 0 ? (current / base - 1) * 100 : undefined;
export const unavailableSnapshot = (stock: Stock, now = new Date()): MockSnapshot => ({
  stockId: stock.id, price: 0, drawdownPct: 0, stabilizationScore: 0, riskFlags: [],
  updatedAt: now.toISOString(), sourceName: "No market data imported", freshness: "Unavailable", isMock: false,
});
export function snapshotFromBars(stock: Stock, bars: RawBarRecord[], benchmark: RawBarRecord[], options: {
  source: string; origin: SnapshotProvenance["origin"]; adjustment: SnapshotProvenance["adjustment"];
  datasetId: string; now?: Date; benchmarkSymbol?: string; metadata?: Partial<MarketDataArchiveMetadata>; rightsProfileId?: string;
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
  const benchmarkSymbol = options.benchmarkSymbol ?? "SPY";
  const benchmarkSupported = benchmarkSymbol === "SPY";
  const price = latest.close;
  const ma20 = mean(closes, getMetricContract("distance_from_ma_20")!.warmupSessions);
  const ma50 = mean(closes, getMetricContract("distance_from_ma_50")!.warmupSessions);
  const ma200 = mean(closes, getMetricContract("distance_from_ma_200")!.warmupSessions);
  const high252 = completed.length >= getMetricContract("drawdown_from_recent_high")!.warmupSessions
    ? Math.max(...closes.slice(-getMetricContract("drawdown_from_recent_high")!.windowSessions!)) : undefined;
  const low20 = completed.length >= getMetricContract("near_support")!.warmupSessions
    ? Math.min(...closes.slice(-getMetricContract("near_support")!.windowSessions!)) : undefined;
  const range10 = mean(ranges, getMetricContract("average_range_pct")!.warmupSessions);
  const range30 = mean(ranges, getMetricContract("volatility_compression")!.warmupSessions);
  const volumeWarmup = getMetricContract("volume_spike")!.warmupSessions;
  const baselineVolume = mean(volumes.slice(0, -1), volumeWarmup - 1);
  const return60 = pct(price, closes.at(-getMetricContract("price_return_60d")!.warmupSessions));
  const benchmarkWarmup = getMetricContract("relative_strength_vs_spy")!.warmupSessions;
  const benchmarkWindow = completed.length >= benchmarkWarmup
    ? completed.slice(-benchmarkWarmup).map(bar => benchmarkByDate.get(bar.date) ?? Number.NaN)
    : undefined;
  const benchmarkReturn60 = !benchmarkSupported || !benchmarkWindow || !benchmarkWindow.every(Number.isFinite)
    ? undefined
    : pct(benchmarkWindow.at(-1)!, benchmarkWindow.at(-benchmarkWarmup));
  const supportBand = Number(getMetricContract("near_support")!.thresholds?.supportBandPct);
  const nearSupport = low20 === undefined ? undefined : price >= low20 && price <= low20 * (1 + supportBand);
  const priceReturn20dPct = pct(price, closes.at(-getMetricContract("price_return_20d")!.warmupSessions));
  const compressionMultiple = Number(getMetricContract("volatility_compression")!.thresholds?.compressionMultiple);
  const compression = range10 !== undefined && range30 !== undefined ? range10 < range30 * compressionMultiple : undefined;
  // Keep benchmark arrays dated and raw; never independently min-max normalize.
  const aligned = completed.filter(bar => benchmarkByDate.has(bar.date));
  return {
    stockId: stock.id, price, drawdownPct: pct(price, high252) ?? 0,
    stabilizationScore: ma20 !== undefined && ma50 !== undefined ? Math.round(Math.min(100, Math.max(0, 50 + (pct(price, ma20) ?? 0) * 3 + (pct(ma20, ma50) ?? 0) * 2))) : 0,
    nearSupport, movingAverage20DistancePct: pct(price, ma20), movingAverage50DistancePct: pct(price, ma50), movingAverage200DistancePct: pct(price, ma200),
    priceReturn20dPct, priceReturn60dPct: return60,
    relativeStrengthVsSpyPct: return60 !== undefined && benchmarkReturn60 !== undefined ? return60 - benchmarkReturn60 : undefined,
    volumeSpike: baselineVolume !== undefined && baselineVolume > 0 ? latest.volume > baselineVolume * Number(getMetricContract("volume_spike")!.thresholds?.spikeMultiple) : undefined,
    volatilityCompression: compression, averageRangePct: range10, riskFlags: [],
    priceHistorySeries: closes, historyDates: completed.map(bar => bar.date),
    benchmarkHistorySeries: aligned.map(bar => benchmarkByDate.get(bar.date)!), benchmarkDates: aligned.map(bar => bar.date),
    benchmarkSymbol, volumeHistorySeries: volumes, volatilityHistorySeries: ranges,
    updatedAt: now.toISOString(), sourceName: options.source, isMock: options.origin === "demo",
    freshness: latest.date < expected ? "Stale" : options.adjustment !== "adjusted" ? "Partial" : "Delayed",
    provenance: {
      schemaVersion: 2, origin: options.origin, observedDate: latest.date, retrievedAt: options.metadata?.retrievalTimestampUtc ?? now.toISOString(), currency: "USD", adjustment: options.adjustment, datasetId: options.datasetId,
      ...(options.metadata ? {
        providerIdentity: options.metadata.providerIdentity,
        providerProductId: options.metadata.providerProductId,
        datasetCategory: options.metadata.datasetCategory,
        sourceRequestIdentity: options.metadata.sourceRequestIdentity,
        freshnessState: options.metadata.freshnessState,
        coverageState: options.metadata.coverageState,
        contentHash: options.metadata.stableContentHash,
        rightsProfileId: options.metadata.rightsProfileId,
        rightsProvenance: options.metadata.rightsProvenance,
        validationIssues: options.metadata.validationIssues,
        failureClass: options.metadata.failureClass,
      } : options.rightsProfileId ? { rightsProfileId: options.rightsProfileId } : {}),
    },
  };
}
