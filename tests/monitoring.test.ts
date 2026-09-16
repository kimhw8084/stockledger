import { describe, expect, it } from "vitest";
import { createCommandQueue } from "../src/domain/commandQueue";
import { snapshotFromBars } from "../src/domain/marketSnapshot";
import { normalizeToSchema, validateResponse } from "../src/lib/eodDataProvider";
import { parseCsvRows } from "../src/lib/csv";
import { computeProcessedFeaturesForSymbol } from "../src/lib/processedFeatureEngine";
import { buildForwardProof, evaluateToken, runDailyStockConditionScan } from "../src/lib/stockConditionScanner";
import { frozenScannerRules } from "../src/lib/frozenScannerRules";
import { seedData } from "../src/lib/seed";
import type { RawBarRecord, ScanSignal, UniverseSnapshot } from "../src/types";
import { previousUsTradingDate } from "../src/lib/marketCalendar";

export const bars = (symbol: string, count: number, scale = 1): RawBarRecord[] => {
  const dates = ["2026-09-14"];
  while (dates.length < count) dates.unshift(previousUsTradingDate(dates[0]));
  return dates.map((date, i) => ({
  symbol, date,
  open: (100 + i) * scale, close: (100 + i) * scale, high: (101 + i) * scale, low: (99 + i) * scale, volume: 100,
})); };
const universe: UniverseSnapshot = { id: "universe-test", universeMode: "frozen_research_universe", universeSource: "test fixture", universeSourceStatus: "frozen_import_fallback", snapshotDate: "2026-09-14", snapshotHash: "fixture", fetchedAtUtc: "2026-09-14T22:00:00Z", sectorSnapshots: [] };

it("serializes commands against the latest durable state and recovers after a write error", async () => {
  let data = { count: 0 }, fail = true;
  const queue = createCommandQueue(() => data, async () => { if (fail) { fail = false; throw new Error("Disk full"); } }, next => { data = next; });
  await expect(queue(current => ({ count: current.count + 1 }))).rejects.toThrow("Disk full");
  expect(data.count).toBe(0);
  await Promise.all([queue(current => ({ count: current.count + 1 })), queue(current => ({ count: current.count + 1 }))]);
  expect(data.count).toBe(2);
});

describe("market data boundaries", () => {
  it("parses quoted commas, quotes and newlines", () => {
    expect(parseCsvRows('Symbol,Name,Sector\r\nABC,"A, B ""Co""",Tech\r\n')).toEqual([["Symbol", "Name", "Sector"], ["ABC", 'A, B "Co"', "Tech"]]);
    expect(() => parseCsvRows('A,B\n"unfinished,B')).toThrow();
  });
  it("rejects invalid dates, empty numbers and inconsistent OHLC", () => {
    expect(() => normalizeToSchema("ABC", "Date,Open,High,Low,Close,Volume\n2026-09-14,1,2,1,,5")).toThrow();
    expect(validateResponse([{ ...bars("ABC", 1)[0], date: "2026-02-30" }], "2026-02-30").valid).toBe(false);
    expect(validateResponse([{ ...bars("ABC", 1)[0], high: 1 }], "2026-01-01").valid).toBe(false);
  });
  it("rejects non-session dates and missing sessions instead of treating observations as consecutive days", () => {
    const rows = bars("ABC", 10);
    expect(validateResponse(rows.filter((_, index) => index !== 4), rows.at(-1)!.date).issues.join(",")).toContain("session_gap");
    expect(validateResponse([{ ...rows[0], date: "2026-09-13" }], "2026-09-13").issues.join(",")).toContain("non_trading");
    expect(snapshotFromBars(seedData.stocks[0], bars(seedData.stocks[0].symbol, 10), [], { source: "test", origin: "import", adjustment: "unadjusted", datasetId: "unadjusted", now: new Date("2026-09-14T22:00:00Z") }).freshness).toBe("Partial");
  });
  it("preserves raw prices and distinguishes observed date from retrieval time", () => {
    const rows = bars(seedData.stocks[0].symbol, 40);
    rows[rows.length - 1] = { ...rows.at(-1)!, date: "2026-09-14" };
    const snapshot = snapshotFromBars(seedData.stocks[0], rows, [], { source: "test", origin: "import", adjustment: "adjusted", datasetId: "fixture", now: new Date("2026-09-14T22:00:00Z") });
    expect(snapshot.priceHistorySeries?.[0]).toBe(100);
    expect(snapshot.priceHistorySeries?.at(-1)).toBe(139);
    expect(snapshot.movingAverage200DistancePct).toBeUndefined();
    expect(snapshot.provenance?.observedDate).toBe("2026-09-14");
    expect(snapshot.provenance?.retrievedAt).toBe("2026-09-14T22:00:00.000Z");
  });
});

describe("date aligned scanning", () => {
  it("aligns benchmarks by date even when histories have different starting rows", () => {
    const stock = bars("ABC", 70), spy = bars("SPY", 70, 2).slice(10), sector = bars("XLK", 70, 3).slice(15);
    const result = computeProcessedFeaturesForSymbol("ABC", "XLK", stock, spy, sector)!;
    expect(result.featureValues.RS_IMPROVE_5).toBeCloseTo(0, 8);
    expect(result.featureValues.EXRET_20_SPY).toBeCloseTo(0, 8);
  });
  it("keeps missing benchmark inputs unknown and zero-volume ratios finite", () => {
    const stock = bars("ABC", 70).map(bar => ({ ...bar, volume: 0 }));
    const result = computeProcessedFeaturesForSymbol("ABC", "XLK", stock, [], [])!;
    expect(result.featureValues.VOL_SPIKE_20).toBeNull();
    expect(evaluateToken("RS_IMP", frozenScannerRules[0], result, stock)).toBeNull();
    expect(Object.values(result.featureValues).some(value => typeof value === "number" && !Number.isFinite(value))).toBe(false);
  });
  it("does not clear earlier signals when the universe is unavailable", async () => {
    const existing = [{ signalId: "prior-signal" }] as ScanSignal[];
    const result = await runDailyStockConditionScan({ existingBatches: [], existingSignals: existing, existingForwardProof: [], scannerSettings: seedData.scannerSettings, universeSnapshot: universe, now: new Date("2026-09-14T22:00:00Z") });
    expect(result.scanRun.status).toBe("blocked");
    expect(result.scanSignals).toEqual(existing);
  });
  it("retains earlier scan evidence when corrected data produces a new revision", async () => {
    const sample = { ...universe, sectorSnapshots: [{ sector: "XLK", tickers: ["ABC"] }] };
    const histories = ["ABC", "SPY", "XLK"].map(symbol => ({ symbol, rows: bars(symbol, 260) }));
    const input = { existingBatches: [], existingSignals: [], existingForwardProof: [], scannerSettings: seedData.scannerSettings, universeSnapshot: sample, histories, adjustment: "adjusted" as const, now: new Date("2026-09-14T22:00:00Z") };
    const first = await runDailyStockConditionScan(input);
    histories[0].rows.at(-1)!.volume += 10;
    const second = await runDailyStockConditionScan({ ...input, existingBatches: [first.rawArchiveBatch!], existingSignals: first.scanSignals, existingForwardProof: first.forwardProofLedger });
    expect(second.scanRun.id).not.toBe(first.scanRun.id);
    expect(second.scanSignals.length).toBeGreaterThan(first.scanSignals.length);
    for (const signal of first.scanSignals) expect(second.scanSignals.find(next => next.signalId === signal.signalId)).toEqual(signal);
  });
  it("uses matching horizon dates and excludes the signal bar from future excursions", () => {
    const stock = bars("ABC", 40), spy = bars("SPY", 40, 2).slice(3), sector = bars("XLK", 40, 3).slice(4);
    const signal = { signalId: "fixture", signalDate: stock[5].date } as ScanSignal;
    stock[5] = { ...stock[5], high: 10000, low: 1 };
    const proof = buildForwardProof(signal, stock, spy, sector);
    expect(proof.ret5).toBeCloseTo(proof.spyRet5!, 8);
    expect(proof.ret5).toBeCloseTo(proof.sectorRet5!, 8);
    expect(proof.mfe30).toBeLessThan(1);
    expect(proof.mae30).toBeGreaterThan(-.1);
    const partial = buildForwardProof(signal, stock.slice(0, 10), spy, sector);
    expect(partial.completed30d).toBe(false);
    expect(partial.mfe30).toBeUndefined();
  });
});
