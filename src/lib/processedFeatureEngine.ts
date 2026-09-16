import { ProcessedFeatureRecord, RawBarRecord } from "../types";
import { ScannerSector, scannerSectorEtfMap } from "./frozenScannerRules";

const avg = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const rollingMean = (values: number[], length: number) =>
  values.length >= length ? avg(values.slice(-length)) : null;
const rollingMax = (values: number[], length: number) =>
  values.length >= length ? Math.max(...values.slice(-length)) : null;
const rollingMin = (values: number[], length: number) =>
  values.length >= length ? Math.min(...values.slice(-length)) : null;
const pctReturn = (current: number | null, base: number | null) =>
  current !== null && base !== null && base !== 0 ? current / base - 1 : null;

const latestValue = (values: number[]) => (values.length ? values[values.length - 1] : null);
const shiftValue = (values: number[], lookback: number) =>
  values.length > lookback ? values[values.length - 1 - lookback] : null;

const featureMeta = (
  formula: string,
  rawInputs: string[],
  lookbackDays: number,
  warmupDays: number,
) => ({
  formula,
  rawInputs,
  lookbackDays,
  warmupDays,
  pointInTimeSafe: true,
  computedAfterCloseOnly: true,
  featureVersion: "scanner_v1",
});

export const computeProcessedFeaturesForSymbol = (
  symbol: string,
  sector: ScannerSector,
  stockBars: RawBarRecord[],
  spyBars: RawBarRecord[],
  sectorBars: RawBarRecord[],
): ProcessedFeatureRecord | null => {
  const closes = stockBars.map((bar) => bar.close);
  const lows = stockBars.map((bar) => bar.low);
  const volumes = stockBars.map((bar) => bar.volume);
  const spyCloses = spyBars.map((bar) => bar.close);
  const sectorCloses = sectorBars.map((bar) => bar.close);

  const close = latestValue(closes);
  if (close === null) return null;

  const ma10 = rollingMean(closes, 10);
  const ma20 = rollingMean(closes, 20);
  const ma50 = rollingMean(closes, 50);
  const dd126Base = rollingMax(closes, 126);
  const dd126 = dd126Base !== null ? close / dd126Base - 1 : null;
  const ret20Stock = pctReturn(close, shiftValue(closes, 20));
  const spyClose = latestValue(spyCloses);
  const ret20Spy = pctReturn(spyClose, shiftValue(spyCloses, 20));
  const sectorClose = latestValue(sectorCloses);
  const ret20Sector = pctReturn(sectorClose, shiftValue(sectorCloses, 20));
  const exret20Spy = ret20Stock !== null && ret20Spy !== null ? ret20Stock - ret20Spy : null;
  const exret20Sector =
    ret20Stock !== null && ret20Sector !== null ? ret20Stock - ret20Sector : null;
  const volSpike20 =
    latestValue(volumes) !== null && rollingMean(volumes, 20) !== null
      ? (latestValue(volumes) as number) / (rollingMean(volumes, 20) as number)
      : null;
  const sectorAboveMa50 =
    sectorClose !== null && rollingMean(sectorCloses, 50) !== null
      ? sectorClose > (rollingMean(sectorCloses, 50) as number)
      : null;
  const rsSeriesSpy = close !== null && spyClose !== null && spyClose !== 0 ? close / spyClose : null;
  const priorRs = shiftValue(
    closes.map((item, index) =>
      spyCloses[index] && spyCloses[index] !== 0 ? item / spyCloses[index] : Number.NaN,
    ),
    5,
  );
  const rsImprove5 = rsSeriesSpy !== null && priorRs !== null && Number.isFinite(priorRs) && priorRs !== 0
    ? rsSeriesSpy / priorRs - 1
    : null;

  const asOfDate = stockBars[stockBars.length - 1]?.date;
  const shiftedLows = lows.slice(0, -1);
  const priorLow45 = shiftedLows.length >= 45 ? Math.min(...shiftedLows.slice(-45)) : null;
  const priorLow63 = shiftedLows.length >= 63 ? Math.min(...shiftedLows.slice(-63)) : null;
  const priorLow90 = shiftedLows.length >= 90 ? Math.min(...shiftedLows.slice(-90)) : null;
  const priorLow126 = shiftedLows.length >= 126 ? Math.min(...shiftedLows.slice(-126)) : null;
  const recentLow = latestValue(lows);
  const broke45 = recentLow !== null && priorLow45 !== null ? recentLow < priorLow45 : null;
  const broke63 = recentLow !== null && priorLow63 !== null ? recentLow < priorLow63 : null;
  const broke90 = recentLow !== null && priorLow90 !== null ? recentLow < priorLow90 : null;
  const broke126 = recentLow !== null && priorLow126 !== null ? recentLow < priorLow126 : null;

  if (!asOfDate) return null;

  return {
    id: `feature-${symbol}-${asOfDate}`,
    symbol,
    asOfDate,
    sector,
    sectorEtf: scannerSectorEtfMap[sector],
    featureSemanticsVersion: "app_v1",
    computedAtUtc: new Date().toISOString(),
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
      MA10: featureMeta("rolling_mean(Close, 10)", ["Close"], 10, 10),
      MA20: featureMeta("rolling_mean(Close, 20)", ["Close"], 20, 20),
      MA50: featureMeta("rolling_mean(Close, 50)", ["Close"], 50, 50),
      DD_126: featureMeta("Close / rolling_max(Close, 126) - 1", ["Close"], 126, 126),
      RET_20_STOCK: featureMeta("Close / Close.shift(20) - 1", ["Close"], 20, 20),
      RET_20_SPY: featureMeta("SPY_Close / SPY_Close.shift(20) - 1", ["SPY_Close"], 20, 20),
      RET_20_SECTOR: featureMeta("SectorETF_Close / SectorETF_Close.shift(20) - 1", ["SectorETF_Close"], 20, 20),
      EXRET_20_SPY: featureMeta("RET_20_STOCK - RET_20_SPY", ["RET_20_STOCK", "RET_20_SPY"], 20, 20),
      EXRET_20_SECTOR: featureMeta("RET_20_STOCK - RET_20_SECTOR", ["RET_20_STOCK", "RET_20_SECTOR"], 20, 20),
      VOL_SPIKE_20: featureMeta("Volume / rolling_mean(Volume, 20)", ["Volume"], 20, 20),
      SECTOR_ABOVE_MA50: featureMeta("SectorETF_Close > rolling_mean(SectorETF_Close, 50)", ["SectorETF_Close"], 50, 50),
      RS_SERIES_SPY: featureMeta("Close / SPY_Close", ["Close", "SPY_Close"], 1, 1),
      RS_IMPROVE_5: featureMeta("RS_SERIES_SPY / RS_SERIES_SPY.shift(5) - 1", ["RS_SERIES_SPY"], 5, 5),
      prior_low_45: featureMeta("rolling_min(Low.shift(1), 45)", ["Low"], 45, 46),
      prior_low_63: featureMeta("rolling_min(Low.shift(1), 63)", ["Low"], 63, 64),
      prior_low_90: featureMeta("rolling_min(Low.shift(1), 90)", ["Low"], 90, 91),
      prior_low_126: featureMeta("rolling_min(Low.shift(1), 126)", ["Low"], 126, 127),
    },
  };
};
