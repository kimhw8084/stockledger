import {
  ForwardProofLedger,
  ProcessedFeatureRecord,
  RawBarArchiveBatch,
  RawBarRecord,
  ReviewLog,
  ScanRun,
  ScanSignal,
  ScannerSettings,
  SignalStatus,
  UniverseSnapshot,
} from "../types";
import { fetch_daily_bars, update_manifest, validateResponse, write_raw_archive } from "./eodDataProvider";
import { frozenScannerRules, FrozenScannerRule, ScannerSector, scannerSectorEtfMap } from "./frozenScannerRules";
import { latestCompletedTradingDate } from "./marketCalendar";
import { computeProcessedFeaturesForSymbol } from "./processedFeatureEngine";
import { loadDynamicCurrentUniverse, requiredSymbolsForRules } from "./universeProvider";

const PROVIDER_NAME = "Stooq Daily Provider";
const SURVIVORSHIP_LABEL = "Current-constituent biased historical proof";

const toMap = (bars: RawBarRecord[]) =>
  bars.reduce<Record<string, RawBarRecord[]>>((acc, bar) => {
    if (!acc[bar.symbol]) acc[bar.symbol] = [];
    acc[bar.symbol].push(bar);
    return acc;
  }, {});

const sortBars = (bars: RawBarRecord[]) => [...bars].sort((left, right) => left.date.localeCompare(right.date));

const signalIdFor = (ticker: string, signalDate: string, ruleSignatureHash: string) =>
  `signal-${ticker}-${signalDate}-${ruleSignatureHash.slice(0, 12)}`;

const getSectorMembers = (snapshot: UniverseSnapshot, sector: ScannerSector) =>
  snapshot.sectorSnapshots.find((entry) => entry.sector === sector)?.tickers ?? [];

const missingWarmupForRule = (rule: FrozenScannerRule, stockBars: RawBarRecord[], spyBars: RawBarRecord[], sectorBars: RawBarRecord[]) => {
  const maxLookback = Math.max(rule.parameters.window, 50, 20);
  const required = maxLookback + Math.max(rule.parameters.reclaimDays ?? 0, 20);
  const missing: string[] = [];
  if (stockBars.length < required) missing.push(`stock_history_lt_${required}`);
  if (spyBars.length < 50) missing.push("spy_history_lt_50");
  if (sectorBars.length < 50) missing.push("sector_history_lt_50");
  return missing;
};

const computeFailedBreak = (stockBars: RawBarRecord[], window: number, reclaimDays: number) => {
  if (stockBars.length < window + reclaimDays + 1) return null;
  const brokeFlags: boolean[] = [];
  for (let index = stockBars.length - reclaimDays; index < stockBars.length; index += 1) {
    const priorWindow = stockBars.slice(Math.max(0, index - window), index).map((bar) => bar.low);
    if (priorWindow.length < window) {
      brokeFlags.push(false);
      continue;
    }
    const priorLow = Math.min(...priorWindow);
    brokeFlags.push(stockBars[index].low < priorLow);
  }
  return brokeFlags.some(Boolean);
};

const computeReclaimLow = (stockBars: RawBarRecord[], window: number) => {
  if (stockBars.length < window + 1) return null;
  const priorWindow = stockBars.slice(-(window + 1), -1).map((bar) => bar.low);
  if (priorWindow.length < window) return null;
  const priorLow = Math.min(...priorWindow);
  return stockBars[stockBars.length - 1].close > priorLow;
};

const evaluateToken = (
  token: string,
  rule: FrozenScannerRule,
  features: ProcessedFeatureRecord,
  stockBars: RawBarRecord[],
) => {
  const values = features.featureValues;
  switch (token) {
    case "DEEP_DISCOUNT":
      return typeof values.DD_126 === "number" && values.DD_126 <= (rule.parameters.ddThresh ?? -0.3);
    case "MA20":
    case "MA20_RECLAIM":
      return typeof values.Close === "number" && typeof values.MA20 === "number" && values.Close > values.MA20;
    case "MA10":
      return typeof values.Close === "number" && typeof values.MA10 === "number" && values.Close > values.MA10;
    case "NO_VOL_REJECT":
      return typeof values.VOL_SPIKE_20 === "number" && values.VOL_SPIKE_20 <= 2.5;
    case "RS_IMP":
      return typeof values.RS_IMPROVE_5 === "number" && values.RS_IMPROVE_5 > 0;
    case "RS_SPY_POS":
      return typeof values.EXRET_20_SPY === "number" && values.EXRET_20_SPY > 0;
    case "RS_SEC_POS":
      return typeof values.EXRET_20_SECTOR === "number" && values.EXRET_20_SECTOR > 0;
    case "SEC_M50":
      return values.SECTOR_ABOVE_MA50 === true;
    case "FAILED_BREAK":
      return computeFailedBreak(stockBars, rule.parameters.window, rule.parameters.reclaimDays ?? 0);
    case "RECLAIM_LOW":
      return computeReclaimLow(stockBars, rule.parameters.window);
    default:
      return null;
  }
};

const nearMatchStatus = (
  rule: FrozenScannerRule,
  tokenResults: Record<string, boolean | null>,
  featureValues: ProcessedFeatureRecord["featureValues"],
) => {
  const failedCount = Object.values(tokenResults).filter((value) => value === false).length;
  if (rule.family === "DeepDiscount") {
    if (typeof featureValues.DD_126 === "number" && typeof rule.parameters.ddThresh === "number") {
      if (featureValues.DD_126 <= rule.parameters.ddThresh + 0.05) return true;
    }
    return failedCount === 1;
  }
  if (tokenResults.FAILED_BREAK === true && tokenResults.RECLAIM_LOW === false) return true;
  if (tokenResults.RECLAIM_LOW === true && failedCount === 1) return true;
  return failedCount === 1;
};

const buildSignal = (
  scanRun: ScanRun,
  universeSnapshot: UniverseSnapshot,
  ticker: string,
  sector: ScannerSector,
  rule: FrozenScannerRule,
  status: SignalStatus,
  tokenResults: Record<string, boolean | null>,
  features: ProcessedFeatureRecord,
) : ScanSignal => {
  const signalDate = features.asOfDate;
  const matchedConditionsJson = Object.entries(tokenResults)
    .filter(([, passed]) => passed === true)
    .map(([token]) => token);
  const failedConditionsJson = Object.entries(tokenResults)
    .filter(([, passed]) => passed === false)
    .map(([token]) => token);
  const missingConditionsJson = Object.entries(tokenResults)
    .filter(([, passed]) => passed === null)
    .map(([token]) => token);
  const sectorMemberCount = getSectorMembers(universeSnapshot, sector).length;
  return {
    signalId: signalIdFor(ticker, signalDate, rule.ruleSignatureHash),
    scanRunId: scanRun.id,
    scanDate: scanRun.scanDate,
    signalDate,
    ticker,
    sector,
    ruleId: rule.ruleId,
    ruleSignatureHash: rule.ruleSignatureHash,
    family: rule.family,
    classificationAtSignal: rule.classification,
    appPriority: rule.appPriority,
    status,
    matchedConditionsJson,
    failedConditionsJson,
    missingConditionsJson,
    featureValuesJson: features.featureValues,
    closePriceAtSignal: typeof features.featureValues.Close === "number" ? features.featureValues.Close : undefined,
    spyClose: typeof features.featureValues.SPY_Close === "number" ? features.featureValues.SPY_Close : undefined,
    sectorEtf: scannerSectorEtfMap[sector],
    sectorEtfClose: typeof features.featureValues.SectorETF_Close === "number" ? features.featureValues.SectorETF_Close : undefined,
    proofSummarySnapshot: rule.proofSummary,
    riskWarningsSnapshot: rule.riskWarnings,
    survivorshipBiasLabel: SURVIVORSHIP_LABEL,
    forwardProofRequired: true,
    universeMode: universeSnapshot.universeMode,
    universeSource: universeSnapshot.universeSource,
    universeSnapshotDate: universeSnapshot.snapshotDate,
    universeSnapshotHash: universeSnapshot.snapshotHash,
    sectorMemberCount,
    createdAtUtc: new Date().toISOString(),
  };
};

const buildForwardProof = (
  signal: ScanSignal,
  stockBars: RawBarRecord[],
  spyBars: RawBarRecord[],
  sectorBars: RawBarRecord[],
): ForwardProofLedger => {
  const startIndex = stockBars.findIndex((bar) => bar.date === signal.signalDate);
  const baseClose = stockBars[startIndex]?.close;
  const spyBase = spyBars.find((bar) => bar.date === signal.signalDate)?.close;
  const sectorBase = sectorBars.find((bar) => bar.date === signal.signalDate)?.close;
  const horizonReturn = (bars: RawBarRecord[], base: number | undefined, offset: number) => {
    if (startIndex < 0 || base === undefined || startIndex + offset >= bars.length) return undefined;
    return bars[startIndex + offset].close / base - 1;
  };
  const ret5 = horizonReturn(stockBars, baseClose, 5);
  const ret10 = horizonReturn(stockBars, baseClose, 10);
  const ret20 = horizonReturn(stockBars, baseClose, 20);
  const ret30 = horizonReturn(stockBars, baseClose, 30);
  const spyRet5 = horizonReturn(spyBars, spyBase, 5);
  const spyRet10 = horizonReturn(spyBars, spyBase, 10);
  const spyRet20 = horizonReturn(spyBars, spyBase, 20);
  const spyRet30 = horizonReturn(spyBars, spyBase, 30);
  const sectorRet5 = horizonReturn(sectorBars, sectorBase, 5);
  const sectorRet10 = horizonReturn(sectorBars, sectorBase, 10);
  const sectorRet20 = horizonReturn(sectorBars, sectorBase, 20);
  const sectorRet30 = horizonReturn(sectorBars, sectorBase, 30);
  const window30 = startIndex >= 0 ? stockBars.slice(startIndex, Math.min(stockBars.length, startIndex + 31)) : [];
  const mfe30 =
    baseClose && window30.length >= 2 ? Math.max(...window30.map((bar) => bar.high / baseClose - 1)) : undefined;
  const mae30 =
    baseClose && window30.length >= 2 ? Math.min(...window30.map((bar) => bar.low / baseClose - 1)) : undefined;
  return {
    id: `forward-${signal.signalId}`,
    signalId: signal.signalId,
    ret5,
    ret10,
    ret20,
    ret30,
    spyRet5,
    spyRet10,
    spyRet20,
    spyRet30,
    sectorRet5,
    sectorRet10,
    sectorRet20,
    sectorRet30,
    beatSpy5: ret5 !== undefined && spyRet5 !== undefined ? ret5 > spyRet5 : undefined,
    beatSpy10: ret10 !== undefined && spyRet10 !== undefined ? ret10 > spyRet10 : undefined,
    beatSpy20: ret20 !== undefined && spyRet20 !== undefined ? ret20 > spyRet20 : undefined,
    beatSpy30: ret30 !== undefined && spyRet30 !== undefined ? ret30 > spyRet30 : undefined,
    beatSector5: ret5 !== undefined && sectorRet5 !== undefined ? ret5 > sectorRet5 : undefined,
    beatSector10: ret10 !== undefined && sectorRet10 !== undefined ? ret10 > sectorRet10 : undefined,
    beatSector20: ret20 !== undefined && sectorRet20 !== undefined ? ret20 > sectorRet20 : undefined,
    beatSector30: ret30 !== undefined && sectorRet30 !== undefined ? ret30 > sectorRet30 : undefined,
    mfe30,
    mae30,
    completed5d: ret5 !== undefined,
    completed10d: ret10 !== undefined,
    completed20d: ret20 !== undefined,
    completed30d: ret30 !== undefined,
    lastUpdatedAtUtc: new Date().toISOString(),
  };
};

export interface ScannerExecutionResult {
  universeSnapshot: UniverseSnapshot;
  processedFeatures: ProcessedFeatureRecord[];
  scanRun: ScanRun;
  rawArchiveBatch?: RawBarArchiveBatch;
  scanSignals: ScanSignal[];
  forwardProofLedger: ForwardProofLedger[];
}

export const runDailyStockConditionScan = async (input: {
  existingBatches: RawBarArchiveBatch[];
  existingSignals: ScanSignal[];
  existingForwardProof: ForwardProofLedger[];
  scannerSettings: ScannerSettings;
  previousUniverseSnapshot?: UniverseSnapshot;
}) : Promise<ScannerExecutionResult> => {
  const latestExpectedDate = latestCompletedTradingDate(
    new Date(),
    input.scannerSettings.providerDelayMinutesAfterClose,
  );
  const universeSnapshot = await loadDynamicCurrentUniverse(
    input.scannerSettings,
    input.previousUniverseSnapshot,
  );

  if (
    universeSnapshot.universeSourceStatus === "current_universe_unavailable" &&
    !input.scannerSettings.fallbackToFrozenUniverse
  ) {
    const blockedRun: ScanRun = {
      id: `scan-${latestExpectedDate}-blocked`,
      scanDate: latestExpectedDate,
      latestExpectedTradingDate: latestExpectedDate,
      startedAtUtc: new Date().toISOString(),
      completedAtUtc: new Date().toISOString(),
      universeMode: input.scannerSettings.universeMode,
      universeSource: universeSnapshot.universeSource,
      universeSnapshotDate: universeSnapshot.snapshotDate,
      universeSnapshotHash: universeSnapshot.snapshotHash,
      providerName: PROVIDER_NAME,
      sourceStatus: universeSnapshot.universeSourceStatus,
      status: "blocked",
      warnings: universeSnapshot.warning ? [universeSnapshot.warning] : [],
      blockedReason: "current universe unavailable",
    };
    return {
      universeSnapshot,
      processedFeatures: [],
      scanRun: blockedRun,
      scanSignals: [],
      forwardProofLedger: input.existingForwardProof,
    };
  }

  const targetSymbols = requiredSymbolsForRules(universeSnapshot);
  const startDate = "2024-01-01";
  const histories = await fetch_daily_bars(targetSymbols, startDate, latestExpectedDate);
  const { batch, validationIssues } = write_raw_archive(
    PROVIDER_NAME,
    histories,
    latestExpectedDate,
    input.existingBatches,
  );
  const archiveList = update_manifest(input.existingBatches, batch);
  const barsBySymbol = Object.fromEntries(
    Object.entries(toMap(batch.bars)).map(([symbol, bars]) => [symbol, sortBars(bars)]),
  );

  const scanRun: ScanRun = {
    id: `scan-${latestExpectedDate}-${batch.archiveVersion}`,
    scanDate: latestExpectedDate,
    latestExpectedTradingDate: latestExpectedDate,
    startedAtUtc: new Date().toISOString(),
    completedAtUtc: new Date().toISOString(),
    universeMode: universeSnapshot.universeMode,
    universeSource: universeSnapshot.universeSource,
    universeSnapshotDate: universeSnapshot.snapshotDate,
    universeSnapshotHash: universeSnapshot.snapshotHash,
    providerName: PROVIDER_NAME,
    sourceStatus: universeSnapshot.universeSourceStatus,
    status: validationIssues.length ? "partial" : "completed",
    warnings: validationIssues,
  };

  const processedFeatures: ProcessedFeatureRecord[] = [];
  const scanSignals: ScanSignal[] = [];
  const spyBars = barsBySymbol.SPY ?? [];

  frozenScannerRules.forEach((rule) => {
    const sectorMembers = getSectorMembers(universeSnapshot, rule.sector);
    const sectorBars = barsBySymbol[scannerSectorEtfMap[rule.sector]] ?? [];
    sectorMembers.forEach((ticker) => {
      const stockBars = barsBySymbol[ticker] ?? [];
      const symbolValidation = validateResponse(stockBars, latestExpectedDate);
      const missingWarmup = missingWarmupForRule(rule, stockBars, spyBars, sectorBars);
      if (!symbolValidation.valid || missingWarmup.length > 0) {
        const blockedFeature = computeProcessedFeaturesForSymbol(ticker, rule.sector, stockBars, spyBars, sectorBars);
        if (blockedFeature) processedFeatures.push(blockedFeature);
        scanSignals.push(
          buildSignal(
            scanRun,
            universeSnapshot,
            ticker,
            rule.sector,
            rule,
            "BLOCKED_OR_INCOMPLETE_DATA",
            Object.fromEntries(rule.activeConditions.map((token) => [token, null])),
            blockedFeature ?? {
              id: `feature-${ticker}-${latestExpectedDate}`,
              symbol: ticker,
              asOfDate: latestExpectedDate,
              sector: rule.sector,
              sectorEtf: scannerSectorEtfMap[rule.sector],
              featureSemanticsVersion: "app_v1",
              computedAtUtc: new Date().toISOString(),
              featureValues: {},
              featureMeta: {},
            },
          ),
        );
        return;
      }

      const featureRecord = computeProcessedFeaturesForSymbol(ticker, rule.sector, stockBars, spyBars, sectorBars);
      if (!featureRecord) return;
      processedFeatures.push(featureRecord);
      const tokenResults = Object.fromEntries(
        rule.activeConditions.map((token) => [token, evaluateToken(token, rule, featureRecord, stockBars)]),
      ) as Record<string, boolean | null>;

      const allTrue = Object.values(tokenResults).every((value) => value === true);
      const anyMissing = Object.values(tokenResults).some((value) => value === null);
      const status: SignalStatus = anyMissing
        ? "BLOCKED_OR_INCOMPLETE_DATA"
        : allTrue
          ? "MATCHED"
          : nearMatchStatus(rule, tokenResults, featureRecord.featureValues)
            ? "NEAR_MATCH"
            : "FAILED";

      if (status !== "FAILED") {
        scanSignals.push(
          buildSignal(scanRun, universeSnapshot, ticker, rule.sector, rule, status, tokenResults, featureRecord),
        );
      }
    });
  });

  const dedupedSignals = [
    ...scanSignals,
    ...input.existingSignals.filter(
      (existing) =>
        !scanSignals.some(
          (next) =>
            next.ticker === existing.ticker &&
            next.signalDate === existing.signalDate &&
            next.ruleSignatureHash === existing.ruleSignatureHash,
        ),
    ),
  ];

  const updatedForwardProof = dedupedSignals
    .filter((signal) => signal.status === "MATCHED")
    .map((signal) => {
      const stockBars = barsBySymbol[signal.ticker] ?? [];
      const sectorBars = barsBySymbol[signal.sectorEtf] ?? [];
      return buildForwardProof(signal, stockBars, spyBars, sectorBars);
    });

  return {
    universeSnapshot,
    processedFeatures,
    scanRun,
    rawArchiveBatch: archiveList[0],
    scanSignals: dedupedSignals,
    forwardProofLedger: [
      ...updatedForwardProof,
      ...input.existingForwardProof.filter(
        (entry) => !updatedForwardProof.some((updated) => updated.signalId === entry.signalId),
      ),
    ],
  };
};

export const createReviewLogEntry = (input: Omit<ReviewLog, "id">): ReviewLog => ({
  id: `review-${input.signalId}-${Date.now()}`,
  ...input,
});
