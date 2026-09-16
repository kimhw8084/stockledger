import { buildMockSnapshot } from "./mockSnapshot";
import { MockSnapshot, Stock } from "../types";

interface DailyBar {
  date: string;
  close: number;
  high: number;
  low: number;
  volume: number;
}

const STOOQ_BASE = "https://stooq.com/q/d/l/";

const fetchCsv = async (symbol: string) => {
  const response = await fetch(`${STOOQ_BASE}?s=${symbol.toLowerCase()}.us&i=d`);
  if (!response.ok) {
    throw new Error(`Stooq request failed for ${symbol}`);
  }
  return response.text();
};

const parseBars = (csv: string): DailyBar[] => {
  const lines = csv.trim().split("\n");
  if (lines.length <= 1) return [];

  return lines
    .slice(1)
    .map((line) => line.split(","))
    .filter((parts) => parts.length >= 6 && parts[4] !== "N/D")
    .map(([date, _open, high, low, close, volume]) => ({
      date,
      close: Number(close),
      high: Number(high),
      low: Number(low),
      volume: Number(volume),
    }))
    .filter(
      (bar) =>
        Number.isFinite(bar.close) &&
        Number.isFinite(bar.high) &&
        Number.isFinite(bar.low) &&
        Number.isFinite(bar.volume),
    );
};

const movingAverage = (values: number[], length: number) => {
  if (values.length < length) return undefined;
  const window = values.slice(values.length - length);
  return window.reduce((sum, value) => sum + value, 0) / length;
};

const pct = (current: number, base: number) => ((current - base) / base) * 100;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizedSeries = (values: number[]) => {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  return values.map((value) => Number((((value - min) / Math.max(max - min, 1)) * 100).toFixed(1)));
};

const returnOverWindow = (values: number[], lookback: number) => {
  if (values.length <= lookback) return undefined;
  const current = values.at(-1);
  const base = values.at(-(lookback + 1));
  if (!current || !base) return undefined;
  return Number(pct(current, base).toFixed(1));
};

const stabilizationFromSeries = (bars: DailyBar[]) => {
  const closes = bars.map((bar) => bar.close);
  const price = closes.at(-1);
  const ma20 = movingAverage(closes, 20);
  const ma50 = movingAverage(closes, 50);
  if (!price || !ma20 || !ma50) return 50;

  const trendScore = clamp(50 + pct(price, ma20) * 3, 10, 85);
  const baseScore = clamp(45 + pct(ma20, ma50) * 4, 10, 85);
  return Math.round((trendScore + baseScore) / 2);
};

const relativeStrengthVsSpy = (stockBars: DailyBar[], spyBars: DailyBar[]) => {
  if (stockBars.length < 21 || spyBars.length < 21) return undefined;
  const stockNow = stockBars.at(-1)?.close;
  const stockPast = stockBars.at(-21)?.close;
  const spyNow = spyBars.at(-1)?.close;
  const spyPast = spyBars.at(-21)?.close;
  if (!stockNow || !stockPast || !spyNow || !spyPast) return undefined;
  return Number((pct(stockNow, stockPast) - pct(spyNow, spyPast)).toFixed(1));
};

const volumeSpike = (bars: DailyBar[]) => {
  if (bars.length < 21) return undefined;
  const latest = bars.at(-1)?.volume;
  const trailing = bars.slice(-21, -1).map((bar) => bar.volume);
  if (!latest || trailing.length === 0) return undefined;
  const average = trailing.reduce((sum, value) => sum + value, 0) / trailing.length;
  return latest > average * 1.35;
};

const averageRangePct = (bars: DailyBar[], length = 14) => {
  if (bars.length < length) return undefined;
  const window = bars.slice(-length);
  const values = window.map((bar) => pct(bar.high, Math.max(bar.low, 0.01)));
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
};

const volatilityCompression = (bars: DailyBar[]) => {
  if (bars.length < 21) return undefined;
  const recent = averageRangePct(bars.slice(-5), 5);
  const baseline = averageRangePct(bars.slice(-21), 14);
  if (recent === undefined || baseline === undefined) return undefined;
  return recent <= baseline * 0.86;
};

const nearSupport = (bars: DailyBar[]) => {
  if (bars.length < 20) return undefined;
  const latest = bars.at(-1)?.close;
  const recentLow = Math.min(...bars.slice(-20).map((bar) => bar.low));
  if (!latest || !Number.isFinite(recentLow)) return undefined;
  return latest <= recentLow * 1.05;
};

export const buildProviderSnapshot = async (stock: Stock): Promise<MockSnapshot> => {
  const fallback = buildMockSnapshot(stock);

  try {
    const [stockCsv, spyCsv] = await Promise.all([fetchCsv(stock.symbol), fetchCsv("SPY")]);
    const stockBars = parseBars(stockCsv);
    const spyBars = parseBars(spyCsv);
    if (stockBars.length < 60) {
      return fallback;
    }

    const latest = stockBars.at(-1);
    if (!latest) return fallback;

    const closes = stockBars.map((bar) => bar.close);
    const high252 = Math.max(...stockBars.slice(-252).map((bar) => bar.high));
    const ma20 = movingAverage(closes, 20);
    const ma50 = movingAverage(closes, 50);
    const ma200 = movingAverage(closes, 200);
    const recentPriceSeries = normalizedSeries(closes.slice(-24));
    const recentBenchmarkSeries = normalizedSeries(spyBars.map((bar) => bar.close).slice(-24));
    const recentVolumeSeries = normalizedSeries(stockBars.map((bar) => bar.volume).slice(-24));
    const recentVolatilitySeries = normalizedSeries(
      stockBars
        .slice(-24)
        .map((bar) => pct(bar.high, Math.max(bar.low, 0.01))),
    );

    return {
      stockId: stock.id,
      price: latest.close,
      drawdownPct: Number(pct(latest.close, high252).toFixed(1)),
      nearSupport: nearSupport(stockBars),
      stabilizationScore: stabilizationFromSeries(stockBars),
      movingAverage20DistancePct: ma20 ? Number(pct(latest.close, ma20).toFixed(1)) : undefined,
      valuationDiscount: undefined,
      earningsSoon: undefined,
      daysUntilEarnings: undefined,
      riskFlags: [],
      movingAverage50DistancePct: ma50 ? Number(pct(latest.close, ma50).toFixed(1)) : undefined,
      movingAverage200DistancePct: ma200 ? Number(pct(latest.close, ma200).toFixed(1)) : undefined,
      relativeStrengthVsSpyPct: relativeStrengthVsSpy(stockBars, spyBars),
      priceReturn20dPct: returnOverWindow(closes, 20),
      priceReturn60dPct: returnOverWindow(closes, 60),
      volumeSpike: volumeSpike(stockBars),
      volatilityCompression: volatilityCompression(stockBars),
      averageRangePct: averageRangePct(stockBars),
      revenueGrowthYoY: undefined,
      marginChangePct: undefined,
      debtRiskLevel: undefined,
      plannedEntryLow: undefined,
      plannedEntryHigh: undefined,
      lastThesisReviewAt: fallback.lastThesisReviewAt,
      priceHistorySeries: recentPriceSeries,
      benchmarkHistorySeries: recentBenchmarkSeries,
      volumeHistorySeries: recentVolumeSeries,
      volatilityHistorySeries: recentVolatilitySeries,
      updatedAt: new Date().toISOString(),
      sourceName: "Stooq Daily Provider",
      freshness: "Delayed",
      isMock: false,
    };
  } catch {
    return fallback;
  }
};

export const buildSnapshotsFromAdapters = async (stocks: Stock[]) =>
  Promise.all(stocks.map((stock) => buildProviderSnapshot(stock)));
