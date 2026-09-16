import { RawBarArchiveBatch, RawBarRecord } from "../types";

const STOOQ_BASE = "https://stooq.com/q/d/l/";
const SCHEMA_VERSION = "scanner_raw_bar_v1";

const normalizeSymbolForStooq = (symbol: string) => `${symbol.toLowerCase()}.us`;

const parseCsv = (csv: string): RawBarRecord[] =>
  csv
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(","))
    .filter((parts) => parts.length >= 6 && parts[0] && parts[4] !== "N/D")
    .map(([date, open, high, low, close, volume]) => ({
      symbol: "",
      date,
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(volume),
    }))
    .filter(
      (bar) =>
        Number.isFinite(bar.open) &&
        Number.isFinite(bar.high) &&
        Number.isFinite(bar.low) &&
        Number.isFinite(bar.close) &&
        Number.isFinite(bar.volume),
    );

const createBatchId = (provider: string, startDate: string, endDate: string, version: number) =>
  `raw-${provider}-${startDate}-${endDate}-v${version}`;

export const validateResponse = (bars: RawBarRecord[], latestExpectedTradingDate: string) => {
  if (!bars.length) return { valid: false, issues: ["missing_symbol_history"] };
  const issues: string[] = [];
  const latest = bars[bars.length - 1];
  if (latest.date !== latestExpectedTradingDate) {
    issues.push(`latest_bar_date_mismatch:${latest.date}`);
  }
  const seen = new Set<string>();
  bars.forEach((bar) => {
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
  const responses = await Promise.all(
    symbols.map(async (symbol) => {
      const response = await fetch(`${STOOQ_BASE}?s=${normalizeSymbolForStooq(symbol)}&i=d`);
      if (!response.ok) {
        throw new Error(`Failed daily fetch for ${symbol}`);
      }
      const rows = normalizeToSchema(symbol, await response.text()).filter(
        (bar) => bar.date >= startDate && bar.date <= endDate,
      );
      return { symbol, rows };
    }),
  );
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
    id: createBatchId(provider, startDate, endDate, archiveVersion),
    provider,
    downloadedAtUtc: new Date().toISOString(),
    symbols: histories.map((entry) => entry.symbol),
    startDate,
    endDate,
    rowCount: bars.length,
    adjustedStatus: "unknown",
    validationStatus: validationIssues.length ? "partial" : "valid",
    archiveVersion,
    schemaVersion: SCHEMA_VERSION,
    bars,
  };

  return { batch, validationIssues };
};

export const update_manifest = (
  existingBatches: RawBarArchiveBatch[],
  nextBatch: RawBarArchiveBatch,
) => [nextBatch, ...existingBatches];
