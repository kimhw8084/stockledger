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

  return {
    stockId: stock.id,
    price: 50 + (seed % 150),
    drawdownPct: drawdown,
    nearSupport: seed % 2 === 0,
    stabilizationScore,
    valuationDiscount: seed % 5 !== 0,
    analystRevisionTrend,
    earningsSoon: seed % 4 === 0,
    riskFlags,
    movingAverage50DistancePct: -8 + (seed % 14),
    relativeStrengthVsSpyPct: -6 + (seed % 11),
    volumeSpike: seed % 6 === 0,
    revenueGrowthYoY: -4 + (seed % 24),
    marginChangePct: -5 + (seed % 9),
    debtRiskLevel: seed % 8 === 0 ? "high" : seed % 3 === 0 ? "medium" : "low",
    plannedEntryLow: 48 + (seed % 145),
    plannedEntryHigh: 54 + (seed % 145),
    lastThesisReviewAt: new Date(Date.now() - (seed % 15) * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    sourceName: "Mock Market Adapter",
    freshness: "Mock Data",
    isMock: true,
  };
};
