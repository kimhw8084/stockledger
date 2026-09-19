import { RawBarArchiveBatch, RawBarRecord } from "../types";
import { parseCsvRows } from "./csv";
import { fetchText, mapConcurrent } from "./network";
import { isSessionDate } from "./marketCalendar";
import { contentHash } from "../domain/contentHash";
import { createResearchOnlyRightsProfile, type MarketDataArchiveMetadata, validateDailyBars } from "./marketDataContract";

const STOOQ_BASE = "https://stooq.com/q/d/l/";
const SCHEMA_VERSION = "scanner_raw_bar_v1";
export const STOOQ_PROVIDER_ID = "stooq" as const;
export const STOOQ_PRODUCT_ID = "public-daily-csv" as const;
/** Stooq remains a public/research adapter. It is never a production managed feed. */
export const STOOQ_RESEARCH_RIGHTS_PROFILE = createResearchOnlyRightsProfile(STOOQ_PROVIDER_ID, STOOQ_PRODUCT_ID);

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
  const firstDate = bars[0]?.date ?? latestExpectedTradingDate;
  const report = validateDailyBars({
    symbol: bars[0]?.symbol ?? "UNKNOWN",
    rows: bars,
    requestedStartDate: firstDate,
    requestedEndDate: latestExpectedTradingDate,
    expectedLatestSession: latestExpectedTradingDate,
  });
  return { valid: report.valid, issues: report.issues };
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
  metadata?: MarketDataArchiveMetadata,
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
    id: `raw-${contentHash({ provider, startDate, endDate, adjustment, bars, metadata })}`,
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
    ...(metadata ? {
      contractVersion: metadata.contractVersion,
      contractRevision: metadata.revision,
      providerIdentity: metadata.providerIdentity,
      providerProductId: metadata.providerProductId,
      datasetCategory: metadata.datasetCategory,
      requestedStartDate: metadata.requestedStartDate,
      requestedEndDate: metadata.requestedEndDate,
      observedStartDate: metadata.observedStartDate,
      observedEndDate: metadata.observedEndDate,
      retrievalTimestampUtc: metadata.retrievalTimestampUtc,
      sourceRequestIdentity: metadata.sourceRequestIdentity,
      freshnessState: metadata.freshnessState,
      coverageState: metadata.coverageState,
      contentHash: metadata.stableContentHash,
      datasetIdentity: metadata.datasetIdentity,
      validationIssues: metadata.validationIssues,
      failureClass: metadata.failureClass,
      rightsProfileId: metadata.rightsProfileId,
    } : {}),
  };

  return { batch: existingBatches.find(existing => existing.id === batch.id) ?? batch, validationIssues };
};

export const update_manifest = (
  existingBatches: RawBarArchiveBatch[],
  nextBatch: RawBarArchiveBatch,
) => [nextBatch, ...existingBatches.filter(batch => batch.id !== nextBatch.id)];
