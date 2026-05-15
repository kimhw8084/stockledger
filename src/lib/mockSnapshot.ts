import { MockSnapshot, Stock } from "../types";

const symbolSeed = (symbol: string) =>
  symbol
    .toUpperCase()
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);

export const buildMockSnapshot = (stock: Stock): MockSnapshot => {
  const seed = symbolSeed(stock.symbol);
  const drawdown = -10 - (seed % 25);
  const stabilizationScore = 35 + (seed % 45);
  const analystRevisionTrend =
    seed % 3 === 0 ? "weak" : seed % 3 === 1 ? "flat" : "improving";
  const riskFlags = seed % 7 === 0 ? ["guidance_pressure"] : [];
  const priceBase = 50 + (seed % 150);
  const priceHistorySeries = Array.from({ length: 24 }, (_, index) => {
    const wave = Math.sin((index + 1) * 0.46 + seed / 100) * 12;
    const drift = index * 0.8;
    return Math.max(10, priceBase - 18 + drift + wave);
  });
  const benchmarkHistorySeries = priceHistorySeries.map((value, index) => value * (0.94 + Math.cos(index * 0.22) * 0.015));
  const volumeHistorySeries = Array.from({ length: 24 }, (_, index) => 55 + Math.sin(index * 0.4 + seed / 80) * 20 + index * 0.4);
  const volatilityHistorySeries = Array.from({ length: 24 }, (_, index) => 62 - index * 0.7 + Math.cos(index * 0.35 + seed / 110) * 8);

  return {
    stockId: stock.id,
    price: priceBase,
    drawdownPct: drawdown,
    nearSupport: seed % 2 === 0,
    stabilizationScore,
    movingAverage20DistancePct: -5 + (seed % 10),
    valuationDiscount: seed % 5 !== 0,
    analystRevisionTrend,
    earningsSoon: seed % 4 === 0,
    riskFlags,
    movingAverage50DistancePct: -8 + (seed % 14),
    movingAverage200DistancePct: -10 + (seed % 18),
    relativeStrengthVsSpyPct: -6 + (seed % 11),
    priceReturn20dPct: -7 + (seed % 18),
    priceReturn60dPct: -11 + (seed % 28),
    volumeSpike: seed % 6 === 0,
    volatilityCompression: seed % 4 !== 0,
    averageRangePct: 1.4 + (seed % 18) / 10,
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
    sourceName: "Mock Market Adapter",
    freshness: "Mock Data",
    isMock: true,
  };
};
