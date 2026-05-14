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
    updatedAt: new Date().toISOString(),
    sourceName: "Mock Market Adapter",
    freshness: "Mock Data",
    isMock: true,
  };
};
