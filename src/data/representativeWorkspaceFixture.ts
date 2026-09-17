import { validateAppData } from "../domain/appDataSchema";
import type { AppData, ForwardProofLedger, ProcessedFeatureRecord, RawBarArchiveBatch, ScanRun, ScanSignal, UniverseSnapshot } from "../types";
import { createEmptyAppData } from "./workspaceDefaults";

const symbols = Array.from({ length: 10 }, (_, index) => `T${String(index + 1).padStart(2, "0")}`);
const dateFor = (day: number) => new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
const timestampFor = (day: number) => `${dateFor(day)}T16:00:00.000Z`;

const rawBarArchives: RawBarArchiveBatch[] = Array.from({ length: 4 }, (_, batchIndex) => {
  const bars = symbols.flatMap(symbol => Array.from({ length: 90 }, (_, dayIndex) => {
    const close = 100 + batchIndex * 10 + dayIndex / 10;
    return { symbol, date: dateFor(batchIndex * 90 + dayIndex), open: close - 1, high: close + 2, low: close - 2, close, volume: 1_000_000 + dayIndex * 1_000 };
  }));
  return {
    id: `archive-${batchIndex + 1}`,
    provider: "RepresentativeFixture",
    downloadedAtUtc: timestampFor(batchIndex * 90 + 90),
    symbols,
    startDate: dateFor(batchIndex * 90),
    endDate: dateFor(batchIndex * 90 + 89),
    rowCount: bars.length,
    adjustedStatus: "adjusted",
    validationStatus: "valid",
    archiveVersion: 1,
    schemaVersion: "ohlcv-v1",
    bars,
  };
});

const universeSnapshots: UniverseSnapshot[] = Array.from({ length: 8 }, (_, index) => ({
  id: `universe-${index + 1}`,
  universeMode: "frozen_research_universe",
  universeSource: "RepresentativeFixture",
  universeSourceStatus: "frozen_import_fallback",
  snapshotDate: dateFor(index * 15),
  snapshotHash: `hash-${index + 1}`,
  fetchedAtUtc: timestampFor(index * 15),
  sectorSnapshots: [{ sector: "Technology", tickers: symbols }, { sector: "Health Care", tickers: symbols.slice(0, 4) }],
}));

const processedFeatures: ProcessedFeatureRecord[] = symbols.flatMap((symbol, symbolIndex) => Array.from({ length: 8 }, (_, dateIndex) => ({
  id: `feature-${symbolIndex + 1}-${dateIndex + 1}`,
  symbol,
  asOfDate: dateFor(dateIndex * 15),
  sector: "Technology",
  sectorEtf: "XLK",
  featureSemanticsVersion: "fixture-v1",
  computedAtUtc: timestampFor(dateIndex * 15),
  featureValues: { momentum20d: symbolIndex + dateIndex / 10, volumeRatio: 1.2, quality: true, note: null },
  featureMeta: { momentum20d: { formula: "close / close_20d - 1", rawInputs: ["close"], lookbackDays: 20, warmupDays: 20, pointInTimeSafe: true, computedAfterCloseOnly: true, featureVersion: "fixture-v1" } },
})));

const scanRuns: ScanRun[] = Array.from({ length: 8 }, (_, index) => ({
  id: `scan-${index + 1}`,
  scanDate: dateFor(index * 15),
  latestExpectedTradingDate: dateFor(index * 15),
  startedAtUtc: timestampFor(index * 15),
  completedAtUtc: timestampFor(index * 15),
  universeMode: "frozen_research_universe",
  universeSource: "RepresentativeFixture",
  universeSnapshotDate: dateFor(index * 15),
  universeSnapshotHash: `hash-${index + 1}`,
  providerName: "RepresentativeFixture",
  sourceStatus: "frozen_import_fallback",
  status: "completed",
  warnings: [],
}));

const scanSignals: ScanSignal[] = processedFeatures.map((feature, index) => ({
  signalId: `signal-${index + 1}`,
  scanRunId: scanRuns[index % scanRuns.length].id,
  scanDate: feature.asOfDate,
  signalDate: feature.asOfDate,
  ticker: feature.symbol,
  sector: feature.sector,
  ruleId: "rule-fixture",
  ruleSignatureHash: "signature-fixture",
  family: "Representative",
  classificationAtSignal: "matched",
  appPriority: "Medium",
  status: "MATCHED",
  matchedConditionsJson: ["momentum20d"],
  failedConditionsJson: [],
  missingConditionsJson: [],
  featureValuesJson: feature.featureValues,
  closePriceAtSignal: 100 + index,
  spyClose: 500,
  sectorEtf: "XLK",
  sectorEtfClose: 200,
  proofSummarySnapshot: { discoveryMedian30: 0.04, holdoutMedian30: 0.03, lockboxMedian30: 0.02, latestEraStatus: "unknown" },
  riskWarningsSnapshot: [],
  survivorshipBiasLabel: "Fixture only",
  forwardProofRequired: true,
  universeMode: "frozen_research_universe",
  universeSource: "RepresentativeFixture",
  universeSnapshotDate: feature.asOfDate,
  universeSnapshotHash: "hash-fixture",
  sectorMemberCount: symbols.length,
  createdAtUtc: timestampFor(index),
}));

const reviewLogs = scanSignals.slice(0, 40).map((signal, index) => ({
  id: `review-${index + 1}`,
  signalId: signal.signalId,
  reviewedAt: timestampFor(index),
  userDecision: "watch" as const,
  manualReason: "Representative fixture review",
  convictionScoreOptional: 50,
  notes: "Fixture only",
}));

const forwardProofLedger: ForwardProofLedger[] = scanSignals.map((signal, index) => ({
  id: `proof-${index + 1}`,
  signalId: signal.signalId,
  ret5: 0.01,
  ret10: 0.02,
  ret20: 0.03,
  ret30: 0.04,
  spyRet5: 0.005,
  spyRet10: 0.01,
  spyRet20: 0.015,
  spyRet30: 0.02,
  sectorRet5: 0.006,
  sectorRet10: 0.011,
  sectorRet20: 0.016,
  sectorRet30: 0.021,
  beatSpy5: true,
  beatSpy10: true,
  beatSpy20: true,
  beatSpy30: true,
  beatSector5: true,
  beatSector10: true,
  beatSector20: true,
  beatSector30: true,
  mfe30: 0.08,
  mae30: -0.03,
  completed5d: index % 2 === 0,
  completed10d: index % 3 === 0,
  completed20d: index % 4 === 0,
  completed30d: index % 5 === 0,
  lastUpdatedAtUtc: timestampFor(index),
}));

export const createRepresentativeWorkspaceFixture = (): AppData => {
  const data = createEmptyAppData();
  data.workspaceId = "workspace-footprint-fixture";
  data.rawBarArchives = rawBarArchives;
  data.universeSnapshots = universeSnapshots;
  data.processedFeatures = processedFeatures;
  data.scanRuns = scanRuns;
  data.scanSignals = scanSignals;
  data.reviewLogs = reviewLogs;
  data.forwardProofLedger = forwardProofLedger;
  return validateAppData(data);
};
