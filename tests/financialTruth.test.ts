import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateWorkspace } from "../src/domain/evaluateWorkspace";
import { snapshotFromBars } from "../src/domain/marketSnapshot";
import { evaluateEye } from "../src/lib/evaluateEye";
import {
  FINANCIAL_TRUTH_ENGINE_VERSION,
  getMetricContract,
  metricCatalog,
  metricContractRegistry,
} from "../src/lib/metricCatalog";
import { evaluateExpression } from "../src/lib/expressionEngine";
import { computeProcessedFeaturesForSymbol } from "../src/lib/processedFeatureEngine";
import { evaluateToken } from "../src/lib/stockConditionScanner";
import { frozenScannerRules, validateFrozenResearchBundle } from "../src/lib/frozenScannerRules";
import { seedData } from "../src/lib/seed";
import { previousUsTradingDate } from "../src/lib/marketCalendar";
import type { MockSnapshot, RawBarRecord } from "../src/types";

const endDate = "2026-09-14";
const makeBars = (
  symbol: string,
  count: number,
  closeAt: (index: number) => number = (index) => 100 + index,
  volumeAt: (index: number) => number = () => 100,
): RawBarRecord[] => {
  const dates = [endDate];
  while (dates.length < count) dates.unshift(previousUsTradingDate(dates[0]));
  return dates.map((date, index) => {
    const close = closeAt(index);
    return { symbol, date, open: close, high: close + 1, low: close - 1, close, volume: volumeAt(index) };
  });
};

const featureFixture = (count: number, spyBars = makeBars("SPY", count, (index) => (100 + index) * 2), sectorBars = makeBars("XLK", count, (index) => (100 + index) * 3)) =>
  computeProcessedFeaturesForSymbol("ABC", "XLK", makeBars("ABC", count), spyBars, sectorBars, "2026-09-14T22:00:00.000Z")!;

describe("versioned production metric contract", () => {
  it("machine-checks frozen rule parity and fails visibly on a changed hash", () => {
    const bundle = JSON.parse(readFileSync(resolve(process.cwd(), "docs/v12_3_app_import_bundle.json"), "utf8"));
    const valid = validateFrozenResearchBundle(bundle);
    expect(valid.valid).toBe(true);
    expect(valid.status).toBe("blocked_unverified");
    expect(valid.releaseBlocked).toBe(true);
    const tampered = structuredClone(bundle);
    tampered.rules[0].rule_signature_hash = "tampered";
    const invalid = validateFrozenResearchBundle(tampered);
    expect(invalid.valid).toBe(false);
    expect(invalid.errors).toContain(`${frozenScannerRules.find((rule) => rule.ruleId === tampered.rules[0].rule_id)!.ruleId}:signature_hash_mismatch`);
  });

  it("covers every built-in metric and frozen feature with explicit semantics", () => {
    expect(metricCatalog.every((metric) => metric.semanticContract?.version === "financial_truth_v1")).toBe(true);
    for (const key of [
      "drawdown_from_recent_high", "near_support", "relative_strength_vs_spy", "distance_from_ma_20", "distance_from_ma_50", "distance_from_ma_200",
      "price_return_20d", "price_return_60d", "volume_spike", "volatility_compression", "average_range_pct", "rebound_from_recent_low",
      "revenue_growth_yoy", "margin_change_pct", "debt_risk_level", "earnings_soon", "days_until_earnings", "price_inside_entry_zone",
      "price_beyond_entry_zone", "days_since_last_review", "thesis_review_stale", "manual_flag_present", "MA10", "MA20", "MA50", "DD_126",
      "RET_20_STOCK", "RET_20_SPY", "RET_20_SECTOR", "EXRET_20_SPY", "EXRET_20_SECTOR", "VOL_SPIKE_20", "SECTOR_ABOVE_MA50",
      "RS_SERIES_SPY", "RS_IMPROVE_5", "prior_low_45", "prior_low_63", "prior_low_90", "prior_low_126",
      "broke_prior_low_45", "broke_prior_low_63", "broke_prior_low_90", "broke_prior_low_126", "RECLAIM_LOW_45", "RECLAIM_LOW_63", "RECLAIM_LOW_90", "RECLAIM_LOW_126",
    ]) {
      const contract = getMetricContract(key);
      expect(contract?.formula).toBeTruthy();
      expect(contract?.warmupSessions).toBeGreaterThanOrEqual(0);
      expect(contract?.inputUnit).toBeTruthy();
      expect(contract?.outputUnit).toBeTruthy();
      expect(contract?.missingData).toBe("unknown");
      expect(contract?.alignment).toBeTruthy();
    }
    expect(Object.keys(metricContractRegistry).length).toBeGreaterThan(30);
  });

  it.each([
    [19, null, null, null],
    [20, 109.5, null, 2.325581395348837],
    [21, 110.5, 0.2, 2.325581395348837],
  ])("uses exact N-1/N/N+1 boundaries for a 20-session metric (%i)", (count, expectedMa20, expectedReturn20, expectedVolumeRatio) => {
    const result = computeProcessedFeaturesForSymbol(
      "ABC",
      "XLK",
      makeBars("ABC", count, undefined, (index) => index === count - 1 ? 250 : 100),
      makeBars("SPY", count, (index) => (100 + index) * 2),
      makeBars("XLK", count, (index) => (100 + index) * 3),
      "2026-09-14T22:00:00.000Z",
    )!;
    expect(result.featureValues.MA20).toBe(expectedMa20);
    if (expectedReturn20 === null) expect(result.featureValues.RET_20_STOCK).toBeNull();
    else expect(result.featureValues.RET_20_STOCK).toBeCloseTo(expectedReturn20, 12);
    if (expectedVolumeRatio === null) expect(result.featureValues.VOL_SPIKE_20).toBeNull();
    else expect(result.featureValues.VOL_SPIKE_20).toBeCloseTo(expectedVolumeRatio, 12);
  });

  it("requires the full 126-session high and 46-session prior-low warmups", () => {
    expect(featureFixture(125).featureValues.DD_126).toBeNull();
    expect(featureFixture(126).featureValues.DD_126).toBe(0);
    expect(featureFixture(45).featureValues.prior_low_45).toBeNull();
    expect(featureFixture(46).featureValues.prior_low_45).toBe(99);
    expect(featureFixture(46).featureValues.RECLAIM_LOW_45).toBe(true);
  });

  it("does not compress missing stock sessions or benchmark sessions into a false window", () => {
    const stock = makeBars("ABC", 70);
    const missingStockSession = stock.filter((_, index) => index !== 40);
    const stockGap = computeProcessedFeaturesForSymbol("ABC", "XLK", missingStockSession, makeBars("SPY", 69, (index) => (100 + index) * 2), makeBars("XLK", 69, (index) => (100 + index) * 3), "2026-09-14T22:00:00.000Z")!;
    expect(stockGap.featureValues.MA20).toBeNull();
    expect(stockGap.featureValues.RET_20_STOCK).toBeNull();

    const result = computeProcessedFeaturesForSymbol("ABC", "XLK", stock, makeBars("SPY", 70, (index) => (100 + index) * 2).filter((bar) => bar.date !== stock[60].date), makeBars("XLK", 70, (index) => (100 + index) * 3), "2026-09-14T22:00:00.000Z")!;
    expect(result.featureValues.RET_20_SPY).toBeNull();
    expect(result.featureValues.EXRET_20_SPY).toBeNull();
    expect(evaluateToken("RS_SPY_POS", frozenScannerRules[0], result, stock)).toBeNull();

    const staleBenchmark = makeBars("SPY", 70, (index) => (100 + index) * 2).slice(0, -1);
    expect(computeProcessedFeaturesForSymbol("ABC", "XLK", stock, staleBenchmark, makeBars("XLK", 70, (index) => (100 + index) * 3), "2026-09-14T22:00:00.000Z")!.featureValues.RS_SERIES_SPY).toBeNull();
  });

  it("keeps zero denominators unknown and never emits non-finite feature evidence", () => {
    const result = computeProcessedFeaturesForSymbol(
      "ABC",
      "XLK",
      makeBars("ABC", 70, (index) => index === 49 ? 0 : 100 + index),
      makeBars("SPY", 70, (index) => index === 49 ? 0 : (100 + index) * 2),
      makeBars("XLK", 70, (index) => (100 + index) * 3),
      "2026-09-14T22:00:00.000Z",
    )!;
    expect(result.featureValues.RET_20_STOCK).toBeNull();
    expect(result.featureValues.RET_20_SPY).toBeNull();
    expect(Object.values(result.featureValues).some((value) => typeof value === "number" && !Number.isFinite(value))).toBe(false);
    expect(evaluateExpression("PCT_CHANGE(2,0)", [], seedData.snapshots[0], seedData.eyes[0])).toBeUndefined();
  });
});

describe("shared preview and worker evaluation truth", () => {
  it("produces equivalent results for the same dated observation and explicit clock", () => {
    const now = new Date("2026-09-14T22:00:00.000Z");
    const data = structuredClone(seedData);
    data.eyes = [{ ...data.eyes[0], lastEvaluation: undefined }];
    data.snapshots = [{ ...data.snapshots[0], freshness: "Fresh" as const }];
    data.alerts = [];
    data.evaluations = [];
    const eye = data.eyes[0];
    const recipe = data.recipes.find((item) => item.id === eye.recipeId)!;
    const snapshot = data.snapshots[0];
    const preview = evaluateEye(eye, recipe, snapshot, metricCatalog, now);
    const workerPath = evaluateWorkspace(data, now);
    const persisted = workerPath.evaluations?.find((evaluation) => evaluation.eyeId === eye.id)!;
    expect({ ...persisted, id: undefined, inputHash: undefined }).toEqual({ ...preview, id: undefined, inputHash: undefined });
    expect(preview.engineVersion).toBe(FINANCIAL_TRUTH_ENGINE_VERSION);
    expect(persisted.engineVersion).toBe(FINANCIAL_TRUTH_ENGINE_VERSION);
  });

  it("does not turn partial split-basis or symbol-mixed input into production evidence", () => {
    const stock = seedData.stocks[0];
    const splitBasis = makeBars(stock.symbol, 61, (index) => index < 30 ? 200 + index : 100 + index);
    const partial = snapshotFromBars(stock, splitBasis, [], { source: "independent split fixture", origin: "import", adjustment: "unadjusted", datasetId: "split-fixture", now: new Date("2026-09-14T22:00:00.000Z") });
    expect(partial.freshness).toBe("Partial");
    expect(evaluateEye(seedData.eyes[0], seedData.recipes[0], partial, metricCatalog, new Date("2026-09-14T22:00:00.000Z")).qualityBlocked).toBe(true);
    expect(() => snapshotFromBars(stock, [{ ...splitBasis[0], symbol: "OLD" }, ...splitBasis.slice(1)], [], { source: "independent symbol-change fixture", origin: "import", adjustment: "adjusted", datasetId: "symbol-fixture", now: new Date("2026-09-14T22:00:00.000Z") })).toThrow(/mixed-symbol/);
  });

  it("keeps stale and unsupported benchmark evidence blocked", () => {
    const stock = seedData.stocks[0];
    const bars = makeBars(stock.symbol, 61);
    const stale = snapshotFromBars(stock, bars, [], { source: "stale fixture", origin: "import", adjustment: "adjusted", datasetId: "stale-fixture", now: new Date("2026-09-14T22:00:00.000Z") });
    const staleResult = evaluateEye(seedData.eyes[0], seedData.recipes[0], { ...stale, freshness: "Stale" }, metricCatalog, new Date("2026-09-14T22:00:00.000Z"));
    expect(staleResult.qualityBlocked).toBe(true);
    expect(staleResult.currentState).toBe("Not Relevant");
    const unsupported = snapshotFromBars(stock, bars, makeBars("QQQ", 61, (index) => (100 + index) * 2), { source: "unsupported benchmark fixture", origin: "import", adjustment: "adjusted", datasetId: "unsupported-benchmark-fixture", benchmarkSymbol: "QQQ", now: new Date("2026-09-14T22:00:00.000Z") });
    const relativeRecipe = { ...seedData.recipes[0], conditions: [{ id: "rs", label: "SPY relative strength", role: "Eligibility Filter" as const, kind: "required" as const, metricKey: "relative_strength_vs_spy", operator: ">=" as const, value: 0 }] };
    const result = evaluateEye(seedData.eyes[0], relativeRecipe, unsupported, metricCatalog, new Date("2026-09-14T22:00:00.000Z"));
    expect(unsupported.relativeStrengthVsSpyPct).toBeUndefined();
    expect((result.conditionResults ?? []).some((condition) => condition.metricKey === "relative_strength_vs_spy" && condition.truth === "unknown")).toBe(true);
    expect(result.qualityBlocked).toBe(true);
    expect(result.currentState).toBe("Not Relevant");
  });
});
