import { fetch_daily_bars } from "./eodDataProvider";
import { latestCompletedTradingDate } from "./marketCalendar";
import { snapshotFromBars } from "../domain/marketSnapshot";
import type { MockSnapshot, Stock } from "../types";

export const buildSnapshotsFromAdapters = async (stocks: Stock[], now = new Date()) => {
  const end = latestCompletedTradingDate(now);
  const start = new Date(now); start.setUTCFullYear(start.getUTCFullYear() - 2);
  const histories = await fetch_daily_bars([...stocks.map(stock => stock.symbol), "SPY"], start.toISOString().slice(0, 10), end);
  const bySymbol = new Map(histories.map(history => [history.symbol, history]));
  return stocks.map(stock => {
    const history = bySymbol.get(stock.symbol);
    if (!history?.rows.length) return { stockId: stock.id, error: history?.error ?? "No market data.", snapshot: undefined };
    try {
      return { stockId: stock.id, snapshot: snapshotFromBars(stock, history.rows, bySymbol.get("SPY")?.rows ?? [], {
        source: "Stooq Daily Provider", origin: "provider", adjustment: "unknown", datasetId: `stooq-${stock.symbol}-${end}`, now,
      }), error: undefined };
    } catch (cause) { return { stockId: stock.id, error: cause instanceof Error ? cause.message : "Invalid provider data.", snapshot: undefined }; }
  });
};
export const buildProviderSnapshot = async (stock: Stock): Promise<MockSnapshot> => {
  const [result] = await buildSnapshotsFromAdapters([stock]);
  if (!result.snapshot) throw new Error(result.error);
  return result.snapshot;
};
