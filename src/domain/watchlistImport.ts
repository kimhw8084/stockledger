import { parseCsvRows } from "../lib/csv";
import type { AppData } from "../types";
import { unavailableSnapshot } from "./marketSnapshot";
import { createId } from "../platform/identity";
export type WatchlistRow = { symbol: string; name: string; thesis: string };
export function parseWatchlistCsv(csv: string): WatchlistRow[] {
  const [header, ...rows] = parseCsvRows(csv);
  if (!header || rows.length > 500 || !rows.length) throw new Error("Choose a CSV containing 1–500 stocks.");
  const keys = header.map(value => value.trim().toLowerCase());
  const symbol = keys.findIndex(key => ["symbol", "ticker"].includes(key));
  const name = keys.findIndex(key => ["name", "company", "company name"].includes(key));
  const thesis = keys.findIndex(key => ["thesis", "notes"].includes(key));
  if (symbol < 0) throw new Error("The CSV needs a Symbol or Ticker column. Name and Thesis columns are optional.");
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const ticker = row[symbol].trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9.-]{0,15}$/.test(ticker)) throw new Error(`Row ${index + 2}: invalid ticker.`);
    if (seen.has(ticker)) throw new Error(`Row ${index + 2}: ${ticker} appears twice. Remove the duplicate before import.`);
    seen.add(ticker);
    return { symbol: ticker, name: name >= 0 ? row[name].trim() || ticker : ticker, thesis: thesis >= 0 ? row[thesis].trim() : "" };
  });
}
export function mergeWatchlist(data: AppData, rows: WatchlistRow[], now = new Date()): AppData {
  const additions = rows.filter(row => !data.stocks.some(stock => stock.symbol === row.symbol)).map(row => ({ ...row, id: createId("stock"), createdAt: now.toISOString() }));
  return { ...data, stocks: [...data.stocks, ...additions], snapshots: [...data.snapshots, ...additions.map(stock => unavailableSnapshot(stock, now))] };
}
