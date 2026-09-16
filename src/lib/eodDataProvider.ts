import { RawBarArchiveBatch, RawBarRecord } from "../types";
import { parseCsvRows } from "./csv";
import { fetchText, mapConcurrent } from "./network";
import { isSessionDate, isUsTradingDate, previousUsTradingDate } from "./marketCalendar";
import { contentHash } from "../domain/contentHash";

const STOOQ_BASE = "https://stooq.com/q/d/l/";
const SCHEMA_VERSION = "scanner_raw_bar_v1";

const normalizeSymbolForStooq = (symbol: string) => `${symbol.toLowerCase()}.us`;

const parseCsv = (csv: string): RawBarRecord[] => {
  const [header, ...rows] = parseCsvRows(csv);
  if (!header || header.join(",").toLowerCase() !== "date,open,high,low,close,volume") throw new Error("Expected Date,Open,High,Low,Close,Volume CSV columns.");
  return rows.map(([date, open, high, low, close, volume]) => {
    if ([open, high, low, close, volume].some(value => value.trim() === "")) throw new Error(`Missing OHLCV value on ${date}.`);
    return { symbol: "", date, open: Number(open), high: Number(high), low: Number(low), close: Number(close), volume: Number(volume) };
  });
};

export const validateResponse = (bars: RawBarRecord[], latestExpectedTradingDate: string) => {
  if (!bars.length) return { valid: false, issues: ["missing_symbol_history"] };
  const issues: string[] = [];
  const latest = bars[bars.length - 1];
  if (latest.date !== latestExpectedTradingDate) {
    issues.push(`latest_bar_date_mismatch:${latest.date}`);
  }
  const seen = new Set<string>();
  let previousDate = "";
  bars.forEach((bar) => {
    if (!isSessionDate(bar.date)) issues.push(`invalid_date:${bar.date}`);
    else {
      try {
        if (!isUsTradingDate(bar.date)) issues.push(`non_trading_date:${bar.date}`);
        else if (previousDate && previousDate !== previousUsTradingDate(bar.date)) issues.push(`session_gap_before:${bar.date}`);
      } catch { issues.push(`calendar_coverage_unavailable:${bar.date}`); }
    }
    if (bar.date < previousDate) issues.push(`unsorted_date:${bar.date}`);
    previousDate = bar.date;
    if (![bar.open, bar.high, bar.low, bar.close].every(value => Number.isFinite(value) && value > 0) || !Number.isFinite(bar.volume)) issues.push(`invalid_value:${bar.date}`);
    if (seen.has(bar.date)) {
      issues.push(`duplicate_date:${bar.date}`);
    }
    seen.add(bar.date);
    if (
      bar.high < Math.max(bar.open, bar.close, bar.low) ||
      bar.low > Math.min(bar.open, bar.close, bar.high)
    ) {
      issues.push(`ohlc_inconsistent:${bar.date}`);
    }
    if (bar.volume < 0) {
      issues.push(`negative_volume:${bar.date}`);
    }
  });
  return { valid: issues.length === 0, issues };
};

export const normalizeToSchema = (symbol: string, csv: string) =>
  parseCsv(csv).map((bar) => ({ ...bar, symbol }));

export const fetch_daily_bars = async (
  symbols: string[],
  startDate: string,
  endDate: string,
) => {
  if (!isSessionDate(startDate) || !isSessionDate(endDate) || startDate > endDate) throw new Error("Invalid provider date range.");
  const unique = [...new Set(symbols)];
  if (unique.length > 600 || unique.some(symbol => !/^[A-Z0-9][A-Z0-9.-]{0,15}$/.test(symbol))) throw new Error("Invalid or oversized symbol list.");
  const responses = await mapConcurrent(unique, 3, async symbol => {
    try {
      const csv = await fetchText(`${STOOQ_BASE}?s=${encodeURIComponent(normalizeSymbolForStooq(symbol))}&i=d&d1=${startDate.replace(/-/g, "")}&d2=${endDate.replace(/-/g, "")}`);
      const rows = normalizeToSchema(symbol, csv).filter(bar => bar.date >= startDate && bar.date <= endDate);
      const validation = validateResponse(rows, rows.at(-1)?.date ?? endDate);
      if (!validation.valid) throw new Error(validation.issues.join(", "));
      return { symbol, rows, error: undefined as string | undefined };
    } catch (cause) {
      return { symbol, rows: [] as RawBarRecord[], error: cause instanceof Error ? cause.message : "Provider unavailable." };
    }
  });
  return responses;
};

export const fetch_latest_daily_bar = async (symbols: string[]) => {
  const histories = await fetch_daily_bars(symbols, "1900-01-01", "2999-12-31");
  return histories.map((entry) => ({ symbol: entry.symbol, row: entry.rows[entry.rows.length - 1] }));
};

export const write_raw_archive = (
  provider: string,
  histories: { symbol: string; rows: RawBarRecord[] }[],
  latestExpectedTradingDate: string,
  existingBatches: RawBarArchiveBatch[],
  adjustment: "adjusted" | "unadjusted" | "unknown" = "unknown",
) => {
  const startDate = histories.flatMap((entry) => entry.rows).sort((a, b) => a.date.localeCompare(b.date))[0]?.date ?? latestExpectedTradingDate;
  const endDate = latestExpectedTradingDate;
  const archiveVersion =
    existingBatches
      .filter((batch) => batch.provider === provider && batch.startDate === startDate && batch.endDate === endDate)
      .reduce((max, batch) => Math.max(max, batch.archiveVersion), 0) + 1;

  const bars = histories.flatMap((entry) => entry.rows);
  const validationIssues = histories.flatMap((entry) =>
    validateResponse(entry.rows, latestExpectedTradingDate).issues.map((issue) => `${entry.symbol}:${issue}`),
  );

  const batch: RawBarArchiveBatch = {
    id: `raw-${contentHash({ provider, startDate, endDate, adjustment, bars })}`,
    provider,
    downloadedAtUtc: new Date().toISOString(),
    symbols: histories.map((entry) => entry.symbol),
    startDate,
    endDate,
    rowCount: bars.length,
    adjustedStatus: adjustment,
    validationStatus: validationIssues.length ? "partial" : "valid",
    archiveVersion,
    schemaVersion: SCHEMA_VERSION,
    bars,
  };

  return { batch: existingBatches.find(existing => existing.id === batch.id) ?? batch, validationIssues };
};

export const update_manifest = (
  existingBatches: RawBarArchiveBatch[],
  nextBatch: RawBarArchiveBatch,
) => [nextBatch, ...existingBatches.filter(batch => batch.id !== nextBatch.id)];
