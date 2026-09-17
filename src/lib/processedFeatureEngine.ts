import { ProcessedFeatureRecord, RawBarRecord } from "../types";
import { isUsTradingDate, previousUsTradingDate } from "./marketCalendar";
import {
  getMetricContract,
  PRODUCTION_METRIC_CONTRACT_VERSION,
} from "./metricCatalog";
import { ScannerSector, scannerSectorEtfMap } from "./frozenScannerRules";

const avg = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const exactWindow = (values: number[], length: number) => {
  if (values.length < length) return null;
  const window = values.slice(-length);
  return window.every(Number.isFinite) ? window : null;
};
const rollingMean = (values: number[], length: number) => {
  const window = exactWindow(values, length);
  return window ? avg(window) : null;
};
const rollingMax = (values: number[], length: number) => {
  const window = exactWindow(values, length);
  return window ? Math.max(...window) : null;
};
const pctReturn = (current: number | null, base: number | null) =>
  current !== null && base !== null && base !== 0 ? current / base - 1 : null;

const latestValue = (values: number[]) => (values.length && Number.isFinite(values[values.length - 1]) ? values[values.length - 1] : null);
const contractWindow = (key: string) => {
  const window = getMetricContract(key)?.windowSessions;
  if (typeof window !== "number") throw new Error(`Metric contract ${key} has no fixed session window.`);
  return window;
};

const isContiguousSessionSeries = (bars: RawBarRecord[]) => {
  if (!bars.length) return false;
  try {
    return bars.every((bar, index) =>
      isUsTradingDate(bar.date) &&
      [bar.open, bar.high, bar.low, bar.close, bar.volume].every(Number.isFinite) &&
      [bar.open, bar.high, bar.low, bar.close].every((value) => value > 0) &&
      bar.volume >= 0 &&
      (index === 0 || previousUsTradingDate(bar.date) === bars[index - 1].date),
    );
  } catch {
    return false;
  }
};

const featureMeta = (key: string) => {
  const contract = getMetricContract(key);
  if (!contract) throw new Error(`Missing metric contract for processed feature ${key}.`);
  return {
    formula: contract.formula,
    rawInputs: contract.rawInputFields,
    lookbackDays: contract.windowSessions ?? 0,
    warmupDays: contract.warmupSessions,
    pointInTimeSafe: true,
    computedAfterCloseOnly: true,
    featureVersion: contract.version,
  };
};

export const computeProcessedFeaturesForSymbol = (
  symbol: string,
  sector: ScannerSector,
  stockBars: RawBarRecord[],
  spyBars: RawBarRecord[],
  sectorBars: RawBarRecord[],
  computedAtUtc?: string,
): ProcessedFeatureRecord | null => {
  const closes = stockBars.map((bar) => bar.close);
  const lows = stockBars.map((bar) => bar.low);
  const volumes = stockBars.map((bar) => bar.volume);
  const stockSessionsValid = isContiguousSessionSeries(stockBars);

  // Join benchmarks by the stock's actual session dates. A missing benchmark
  // session invalidates the complete window; positions are never substituted.
  const spyByDate = new Map(spyBars.map((bar) => [bar.date, bar.close]));
  const sectorByDate = new Map(sectorBars.map((bar) => [bar.date, bar.close]));
  const alignedWindow = (byDate: Map<string, number>, length: number) => {
    if (!stockSessionsValid || stockBars.length < length) return null;
    const values = stockBars.slice(-length).map((bar) => byDate.get(bar.date) ?? Number.NaN);
    return values.every(Number.isFinite) ? values : null;
  };

  const asOfDate = stockBars.at(-1)?.date;
  const close = latestValue(closes);
  if (close === null || !asOfDate) return null;

  const ma10 = stockSessionsValid ? rollingMean(closes, contractWindow("MA10")) : null;
  const ma20 = stockSessionsValid ? rollingMean(closes, contractWindow("MA20")) : null;
  const ma50 = stockSessionsValid ? rollingMean(closes, contractWindow("MA50")) : null;
  const dd126Base = stockSessionsValid ? rollingMax(closes, contractWindow("DD_126")) : null;
  const dd126 = pctReturn(close, dd126Base);

  const stockReturnWarmup = getMetricContract("RET_20_STOCK")!.warmupSessions;
  const spyReturnWarmup = getMetricContract("RET_20_SPY")!.warmupSessions;
  const sectorReturnWarmup = getMetricContract("RET_20_SECTOR")!.warmupSessions;
  const stockReturnWindow = stockSessionsValid ? exactWindow(closes, stockReturnWarmup) : null;
  const ret20Stock = stockReturnWindow ? pctReturn(close, stockReturnWindow.at(-stockReturnWarmup)!) : null;
  const spyReturnWindow = alignedWindow(spyByDate, spyReturnWarmup);
  const sectorReturnWindow = alignedWindow(sectorByDate, sectorReturnWarmup);
  const spyClose = alignedWindow(spyByDate, 1)?.at(-1) ?? null;
  const sectorClose = alignedWindow(sectorByDate, 1)?.at(-1) ?? null;
  const ret20Spy = spyReturnWindow ? pctReturn(spyClose, spyReturnWindow.at(-spyReturnWarmup)!) : null;
  const ret20Sector = sectorReturnWindow ? pctReturn(sectorClose, sectorReturnWindow.at(-sectorReturnWarmup)!) : null;
  const exret20Spy = ret20Stock !== null && ret20Spy !== null ? ret20Stock - ret20Spy : null;
  const exret20Sector = ret20Stock !== null && ret20Sector !== null ? ret20Stock - ret20Sector : null;

  const volumeWindow = stockSessionsValid ? exactWindow(volumes, contractWindow("VOL_SPIKE_20")) : null;
  const latestVolume = latestValue(volumes);
  const volumeAverage = volumeWindow ? avg(volumeWindow) : null;
  const volSpike20 = latestVolume !== null && volumeAverage !== null && volumeAverage > 0
    ? latestVolume / volumeAverage
    : null;
  const sectorMaWindow = alignedWindow(sectorByDate, contractWindow("SECTOR_ABOVE_MA50"));
  const sectorAboveMa50 = sectorClose !== null && sectorMaWindow !== null
    ? sectorClose > avg(sectorMaWindow)
    : null;

  const rsWindow = alignedWindow(spyByDate, getMetricContract("RS_IMPROVE_5")!.warmupSessions);
  const rsSeriesSpy = spyClose !== null && spyClose !== 0 ? close / spyClose : null;
  const rsStockWindow = stockSessionsValid ? exactWindow(closes, getMetricContract("RS_IMPROVE_5")!.warmupSessions) : null;
  const priorRs = rsWindow && rsStockWindow && rsWindow.every((value) => value !== 0)
    ? rsStockWindow.map((item, index) => item / rsWindow[index])
    : null;
  const rsImprove5 = rsSeriesSpy !== null && priorRs?.[0] !== undefined && priorRs[0] !== 0
    ? rsSeriesSpy / priorRs[0] - 1
    : null;

  const priorLow = (key: string) => {
    const window = exactWindow(lows, getMetricContract(key)!.warmupSessions);
    return stockSessionsValid && window ? Math.min(...window.slice(0, -1)) : null;
  };
  const priorLow45 = priorLow("prior_low_45");
  const priorLow63 = priorLow("prior_low_63");
  const priorLow90 = priorLow("prior_low_90");
  const priorLow126 = priorLow("prior_low_126");
  const recentLow = Number.isFinite(lows.at(-1)) ? lows.at(-1)! : null;
  const broke45 = recentLow !== null && priorLow45 !== null ? recentLow < priorLow45 : null;
  const broke63 = recentLow !== null && priorLow63 !== null ? recentLow < priorLow63 : null;
  const broke90 = recentLow !== null && priorLow90 !== null ? recentLow < priorLow90 : null;
  const broke126 = recentLow !== null && priorLow126 !== null ? recentLow < priorLow126 : null;

  return {
    id: `feature-${symbol}-${asOfDate}-${PRODUCTION_METRIC_CONTRACT_VERSION}`,
    symbol,
    asOfDate,
    sector,
    sectorEtf: scannerSectorEtfMap[sector],
    featureSemanticsVersion: PRODUCTION_METRIC_CONTRACT_VERSION,
    computedAtUtc: computedAtUtc === undefined ? `${asOfDate}T23:59:59.999Z` : computedAtUtc,
    featureValues: {
      Close: close,
      SPY_Close: spyClose,
      SectorETF_Close: sectorClose,
      MA10: ma10,
      MA20: ma20,
      MA50: ma50,
      DD_126: dd126,
      RET_20_STOCK: ret20Stock,
      RET_20_SPY: ret20Spy,
      RET_20_SECTOR: ret20Sector,
      EXRET_20_SPY: exret20Spy,
      EXRET_20_SECTOR: exret20Sector,
      VOL_SPIKE_20: volSpike20,
      SECTOR_ABOVE_MA50: sectorAboveMa50,
      RS_SERIES_SPY: rsSeriesSpy,
      RS_IMPROVE_5: rsImprove5,
      prior_low_45: priorLow45,
      prior_low_63: priorLow63,
      prior_low_90: priorLow90,
      prior_low_126: priorLow126,
      broke_prior_low_45: broke45,
      broke_prior_low_63: broke63,
      broke_prior_low_90: broke90,
      broke_prior_low_126: broke126,
      RECLAIM_LOW_45: close !== null && priorLow45 !== null ? close > priorLow45 : null,
      RECLAIM_LOW_63: close !== null && priorLow63 !== null ? close > priorLow63 : null,
      RECLAIM_LOW_90: close !== null && priorLow90 !== null ? close > priorLow90 : null,
      RECLAIM_LOW_126: close !== null && priorLow126 !== null ? close > priorLow126 : null,
    },
    featureMeta: {
      MA10: featureMeta("MA10"),
      MA20: featureMeta("MA20"),
      MA50: featureMeta("MA50"),
      DD_126: featureMeta("DD_126"),
      RET_20_STOCK: featureMeta("RET_20_STOCK"),
      RET_20_SPY: featureMeta("RET_20_SPY"),
      RET_20_SECTOR: featureMeta("RET_20_SECTOR"),
      EXRET_20_SPY: featureMeta("EXRET_20_SPY"),
      EXRET_20_SECTOR: featureMeta("EXRET_20_SECTOR"),
      VOL_SPIKE_20: featureMeta("VOL_SPIKE_20"),
      SECTOR_ABOVE_MA50: featureMeta("SECTOR_ABOVE_MA50"),
      RS_SERIES_SPY: featureMeta("RS_SERIES_SPY"),
      RS_IMPROVE_5: featureMeta("RS_IMPROVE_5"),
      prior_low_45: featureMeta("prior_low_45"),
      prior_low_63: featureMeta("prior_low_63"),
      prior_low_90: featureMeta("prior_low_90"),
      prior_low_126: featureMeta("prior_low_126"),
      broke_prior_low_45: featureMeta("broke_prior_low_45"),
      broke_prior_low_63: featureMeta("broke_prior_low_63"),
      broke_prior_low_90: featureMeta("broke_prior_low_90"),
      broke_prior_low_126: featureMeta("broke_prior_low_126"),
      RECLAIM_LOW_45: featureMeta("RECLAIM_LOW_45"),
      RECLAIM_LOW_63: featureMeta("RECLAIM_LOW_63"),
      RECLAIM_LOW_90: featureMeta("RECLAIM_LOW_90"),
      RECLAIM_LOW_126: featureMeta("RECLAIM_LOW_126"),
    },
  };
};
