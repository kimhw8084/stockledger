import { MockSnapshot, Stock } from "../types";

const symbolSeed = (symbol: string) =>
  symbol
    .toUpperCase()
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);

export const buildMockSnapshot = (stock: Stock): MockSnapshot => {
  const seed = symbolSeed(stock.symbol);
  const riskFlags = seed % 7 === 0 ? ["가이던스 압박"] : [];
  const priceBase = 55 + (seed % 140);
  const priceHistorySeries = Array.from({ length: 252 }, (_, index) => {
    const phase = (index + 1) / 9.5 + seed / 110;
    const trendA = index < 108 ? index * (0.32 + (seed % 4) * 0.01) : 108 * (0.32 + (seed % 4) * 0.01);
    const trendB =
      index >= 108 && index < 178
        ? -(index - 108) * (0.42 + (seed % 5) * 0.018)
        : -(178 - 108) * (0.42 + (seed % 5) * 0.018);
    const recovery = index >= 178 ? (index - 178) * (0.26 + (seed % 3) * 0.02) : 0;
    const wave = Math.sin(phase) * 3.8 + Math.cos(phase / 2.1) * 1.9;
    return Math.max(12, priceBase - 10 + trendA + trendB + recovery + wave);
  });
  const benchmarkHistorySeries = Array.from({ length: 252 }, (_, index) => {
    const phase = (index + 1) / 12.4 + seed / 130;
    const drift = index * 0.18;
    const wave = Math.sin(phase) * 2.4 + Math.cos(phase / 1.8) * 1.2;
    return Math.max(40, priceBase * 0.82 + drift + wave);
  });
  const volumeHistorySeries = Array.from({ length: 252 }, (_, index) => {
    const phase = index * 0.28 + seed / 75;
    const base = 58 + Math.sin(phase) * 12 + Math.cos(phase / 1.7) * 6;
    const lateBurst = index > 230 ? 18 + (seed % 7) * 1.6 : 0;
    return Math.max(20, base + lateBurst);
  });
  const volatilityHistorySeries = Array.from({ length: 252 }, (_, index) => {
    const phase = index * 0.23 + seed / 95;
    const early = 4.9 + Math.sin(phase) * 0.9;
    const compression = index > 208 ? (index - 208) * 0.025 : 0;
    return Math.max(1.1, early - compression + Math.cos(phase / 1.6) * 0.35);
  });

  const price = Number(priceHistorySeries.at(-1)?.toFixed(2) ?? priceBase.toFixed(2));
  const recentHigh = Math.max(...priceHistorySeries);
  const drawdown = Number((((price / recentHigh) - 1) * 100).toFixed(1));
  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const ma20 = average(priceHistorySeries.slice(-20));
  const ma50 = average(priceHistorySeries.slice(-50));
  const ma200 = average(priceHistorySeries.slice(-200));
  const movingAverage20DistancePct = Number((((price / ma20) - 1) * 100).toFixed(1));
  const movingAverage50DistancePct = Number((((price / ma50) - 1) * 100).toFixed(1));
  const movingAverage200DistancePct = Number((((price / ma200) - 1) * 100).toFixed(1));
  const recentLow = Math.min(...priceHistorySeries.slice(-15));
  const nearSupport = price >= recentLow && price <= recentLow * 1.05;
  const price20Base = priceHistorySeries.at(-21) ?? priceHistorySeries[0];
  const price60Base = priceHistorySeries.at(-61) ?? priceHistorySeries[0];
  const benchmark20Base = benchmarkHistorySeries.at(-21) ?? benchmarkHistorySeries[0];
  const benchmark60Base = benchmarkHistorySeries.at(-61) ?? benchmarkHistorySeries[0];
  const priceReturn20dPct = Number((((price / price20Base) - 1) * 100).toFixed(1));
  const priceReturn60dPct = Number((((price / price60Base) - 1) * 100).toFixed(1));
  const benchmarkReturn60dPct = Number((((benchmarkHistorySeries.at(-1)! / benchmark60Base) - 1) * 100).toFixed(1));
  const relativeStrengthVsSpyPct = Number((priceReturn60dPct - benchmarkReturn60dPct).toFixed(1));
  const recentVolume = volumeHistorySeries.at(-1) ?? 0;
  const baselineVolume = average(volumeHistorySeries.slice(-21, -1));
  const volumeSpike = recentVolume > baselineVolume * 1.4;
  const averageRangePct = Number(average(volatilityHistorySeries.slice(-10)).toFixed(1));
  const earlierAverageRangePct = average(volatilityHistorySeries.slice(-30));
  const volatilityCompression = averageRangePct < earlierAverageRangePct * 0.85;
  const stabilizationScore = Math.max(
    18,
    Math.min(
      92,
      Math.round(
        52 +
          (nearSupport ? 9 : -6) +
          (volatilityCompression ? 10 : -5) +
          (priceReturn20dPct > -4 ? 8 : priceReturn20dPct < -12 ? -8 : 0) +
          (volumeSpike ? -4 : 6) +
          (movingAverage20DistancePct > -2 ? 5 : movingAverage20DistancePct < -8 ? -7 : 0),
      ),
    ),
  );

  return {
    stockId: stock.id,
    price,
    drawdownPct: drawdown,
    nearSupport,
    stabilizationScore,
    movingAverage20DistancePct,
    valuationDiscount: seed % 5 !== 0,
    earningsSoon: seed % 4 === 0,
    daysUntilEarnings: 3 + (seed % 28),
    riskFlags,
    movingAverage50DistancePct,
    movingAverage200DistancePct,
    relativeStrengthVsSpyPct,
    priceReturn20dPct,
    priceReturn60dPct,
    volumeSpike,
    volatilityCompression,
    averageRangePct,
    revenueGrowthYoY: -4 + (seed % 24),
    marginChangePct: -5 + (seed % 9),
    debtRiskLevel: seed % 8 === 0 ? "high" : seed % 3 === 0 ? "medium" : "low",
    plannedEntryLow: 48 + (seed % 145),
    plannedEntryHigh: 54 + (seed % 145),
    lastThesisReviewAt: new Date(Date.now() - (seed % 15) * 24 * 60 * 60 * 1000).toISOString(),
    priceHistorySeries,
    benchmarkHistorySeries,
    volumeHistorySeries,
    volatilityHistorySeries,
    updatedAt: new Date().toISOString(),
    sourceName: "더미 시장 어댑터",
    freshness: "Mock Data",
    isMock: true,
  };
};
