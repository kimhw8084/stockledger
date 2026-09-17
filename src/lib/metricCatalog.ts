import type { Eye, FormulaDefinition, MetricContract, MetricDefinition, MockSnapshot, RecipeCondition } from "../types";

export const PRODUCTION_METRIC_CONTRACT_VERSION = "financial_truth_v1";
export const FINANCIAL_TRUTH_ENGINE_VERSION = "2.1.0";

const makeContract = (
  formulaKey: string,
  formula: string,
  requiredData: string[],
  rawInputFields: string[],
  windowSessions: number | null,
  warmupSessions: number,
  inputUnit: string,
  outputUnit: string,
  benchmark: MetricContract["benchmark"],
  alignment: MetricContract["alignment"],
  adjustmentBasis: MetricContract["adjustmentBasis"],
  includesCurrentObservation: boolean,
  extra: Pick<MetricContract, "thresholds" | "displayPrecision"> = {},
): MetricContract => ({
  version: PRODUCTION_METRIC_CONTRACT_VERSION,
  formulaKey,
  formula,
  requiredData,
  rawInputFields,
  windowSessions,
  warmupSessions,
  inputUnit,
  outputUnit,
  missingData: "unknown",
  benchmark,
  alignment,
  adjustmentBasis,
  includesCurrentObservation,
  ...extra,
});

/**
 * The only authoritative definition of supported metric semantics. Generic
 * recipe metrics and frozen-scanner features intentionally use distinct keys
 * when their units or windows differ (for example percentage vs decimal
 * returns, or current-inclusive vs prior-window volume ratios).
 */
export const metricContractRegistry: Readonly<Record<string, MetricContract>> = {
  raw_passthrough: makeContract("raw_passthrough", "L1 = L0", [], [], null, 0, "declared", "declared", "none", "point_in_time", "not_applicable", true),
  custom_expression: makeContract("custom_expression", "L1 = f(L0, L0, ...)", [], [], null, 0, "declared", "declared", "none", "point_in_time", "not_applicable", true),
  drawdown_from_recent_high: makeContract("drawdown_pct", "Close[t] / max(Close[t-251:t]) - 1", ["priceHistorySeries"], ["Close"], 252, 252, "USD/share", "percent", "none", "dated_sessions", "adjusted", true, { displayPrecision: 1 }),
  near_support: makeContract("near_support_bool", "Close[t] in [min(Close[t-19:t]), min(Close[t-19:t]) * 1.05]", ["priceHistorySeries"], ["Close"], 20, 20, "USD/share", "boolean", "none", "dated_sessions", "adjusted", true, { thresholds: { supportBandPct: 0.05 } }),
  valuation_discount: makeContract("valuation_discount_bool", "valuationDiscount == true", ["valuationSnapshot"], ["valuationDiscount"], null, 0, "declared valuation", "boolean", "none", "point_in_time", "declared", true),
  relative_strength_vs_spy: makeContract("relative_strength_vs_spy_pct", "(Close[t] / Close[t-60] - 1) - (SPY[t] / SPY[t-60] - 1)", ["priceHistorySeries", "benchmarkHistorySeries"], ["Close", "SPY_Close"], 60, 61, "USD/share", "percent", "SPY", "dated_sessions", "adjusted", true, { displayPrecision: 1 }),
  distance_from_ma_50: makeContract("distance_from_ma_50_pct", "Close[t] / mean(Close[t-49:t]) - 1", ["priceHistorySeries"], ["Close"], 50, 50, "USD/share", "percent", "none", "dated_sessions", "adjusted", true, { displayPrecision: 1 }),
  distance_from_ma_20: makeContract("distance_from_ma_20_pct", "Close[t] / mean(Close[t-19:t]) - 1", ["priceHistorySeries"], ["Close"], 20, 20, "USD/share", "percent", "none", "dated_sessions", "adjusted", true, { displayPrecision: 1 }),
  distance_from_ma_200: makeContract("distance_from_ma_200_pct", "Close[t] / mean(Close[t-199:t]) - 1", ["priceHistorySeries"], ["Close"], 200, 200, "USD/share", "percent", "none", "dated_sessions", "adjusted", true, { displayPrecision: 1 }),
  volume_spike: makeContract("volume_spike_bool", "Volume[t] > 1.4 * mean(Volume[t-20:t-1])", ["volumeHistorySeries"], ["Volume"], 20, 21, "shares", "boolean", "none", "dated_sessions", "declared", true, { thresholds: { spikeMultiple: 1.4 } }),
  volume_average_20d: makeContract("volume_average_20d", "mean(Volume[t-19:t])", ["volumeHistorySeries"], ["Volume"], 20, 20, "shares", "shares", "none", "dated_sessions", "declared", true),
  volatility_compression: makeContract("volatility_compression_bool", "mean(Range[t-9:t]) < 0.85 * mean(Range[t-29:t])", ["volatilityHistorySeries"], ["Range"], 30, 30, "percent", "boolean", "none", "dated_sessions", "declared", true, { thresholds: { compressionMultiple: 0.85 } }),
  average_range_pct: makeContract("average_range_pct", "mean(Range[t-9:t])", ["volatilityHistorySeries"], ["Range"], 10, 10, "percent", "percent", "none", "dated_sessions", "declared", true, { displayPrecision: 1 }),
  price_return_20d: makeContract("price_return_20d_pct", "Close[t] / Close[t-20] - 1", ["priceHistorySeries"], ["Close"], 20, 21, "USD/share", "percent", "none", "dated_sessions", "adjusted", true, { displayPrecision: 1 }),
  price_return_60d: makeContract("price_return_60d_pct", "Close[t] / Close[t-60] - 1", ["priceHistorySeries"], ["Close"], 60, 61, "USD/share", "percent", "none", "dated_sessions", "adjusted", true, { displayPrecision: 1 }),
  rebound_from_recent_low: makeContract("rebound_from_recent_low_pct", "Close[t] / min(Close[t-19:t]) - 1", ["priceHistorySeries"], ["Close"], 20, 20, "USD/share", "percent", "none", "dated_sessions", "adjusted", true, { displayPrecision: 1 }),
  revenue_growth_yoy: makeContract("revenue_growth_yoy", "reported revenue[t] / reported revenue[t-4] - 1", ["financialStatementSnapshot"], ["Revenue"], null, 0, "reported currency", "percent", "none", "point_in_time", "declared", true, { displayPrecision: 1 }),
  margin_change_pct: makeContract("margin_change_pct", "margin[t] - margin[prior reference]", ["financialStatementSnapshot"], ["Margin"], null, 0, "percent", "percentage points", "none", "point_in_time", "declared", true, { displayPrecision: 1 }),
  debt_risk_level: makeContract("debt_risk_level", "declared debt-risk classification", ["financialStatementSnapshot"], ["Cash", "Debt", "CashFlow"], null, 0, "reported currency", "classification", "none", "point_in_time", "declared", true),
  earnings_soon: makeContract("earnings_soon_bool", "next earnings event is within the configured risk window", ["eventCalendar"], ["NextEarningsDate"], null, 0, "calendar date", "boolean", "none", "calendar_days", "declared", true),
  days_until_earnings: makeContract("days_until_earnings", "next earnings date - evaluation date", ["eventCalendar"], ["NextEarningsDate"], null, 0, "calendar date", "calendar days", "none", "calendar_days", "declared", true),
  price_inside_entry_zone: makeContract("price_inside_entry_zone", "EntryLow <= Close[t] <= EntryHigh", ["priceHistorySeries", "plannedEntryRange"], ["Close", "EntryLow", "EntryHigh"], 1, 1, "USD/share", "boolean", "none", "dated_sessions", "adjusted", true),
  price_beyond_entry_zone: makeContract("price_beyond_entry_zone", "Close[t] < EntryLow or Close[t] > EntryHigh", ["priceHistorySeries", "plannedEntryRange"], ["Close", "EntryLow", "EntryHigh"], 1, 1, "USD/share", "boolean", "none", "dated_sessions", "adjusted", true),
  days_since_last_review: makeContract("days_since_last_review", "evaluation instant - last review instant", ["lastThesisReviewAt"], ["LastReviewedAt"], null, 0, "UTC instant", "calendar days", "none", "calendar_days", "not_applicable", true),
  thesis_review_stale: makeContract("thesis_review_stale", "days_since_last_review >= 14", ["lastThesisReviewAt"], ["LastReviewedAt"], null, 0, "UTC instant", "boolean", "none", "calendar_days", "not_applicable", true, { thresholds: { staleAfterDays: 14 } }),
  manual_flag_present: makeContract("manual_flag_present", "riskFlags.length > 0 or expected flag is present", ["manualRiskFlags"], ["RiskFlags"], null, 0, "declared tags", "boolean", "none", "point_in_time", "not_applicable", true),

  // Frozen V12.3 research features. These are separate contracts because the
  // research export uses decimal returns and a current-inclusive volume ratio.
  MA10: makeContract("scanner_ma10", "mean(Close[t-9:t])", ["ohlcvBarSeries"], ["Close"], 10, 10, "USD/share", "USD/share", "none", "dated_sessions", "adjusted", true),
  MA20: makeContract("scanner_ma20", "mean(Close[t-19:t])", ["ohlcvBarSeries"], ["Close"], 20, 20, "USD/share", "USD/share", "none", "dated_sessions", "adjusted", true),
  MA50: makeContract("scanner_ma50", "mean(Close[t-49:t])", ["ohlcvBarSeries"], ["Close"], 50, 50, "USD/share", "USD/share", "none", "dated_sessions", "adjusted", true),
  DD_126: makeContract("scanner_dd_126", "Close[t] / max(Close[t-125:t]) - 1", ["ohlcvBarSeries"], ["Close"], 126, 126, "USD/share", "decimal", "none", "dated_sessions", "adjusted", true),
  RET_20_STOCK: makeContract("scanner_ret_20_stock", "Close[t] / Close[t-20] - 1", ["ohlcvBarSeries"], ["Close"], 20, 21, "USD/share", "decimal", "none", "dated_sessions", "adjusted", true),
  RET_20_SPY: makeContract("scanner_ret_20_spy", "SPY_Close[t] / SPY_Close[t-20] - 1", ["benchmarkHistorySeries"], ["SPY_Close"], 20, 21, "USD/share", "decimal", "SPY", "dated_sessions", "adjusted", true),
  RET_20_SECTOR: makeContract("scanner_ret_20_sector", "SectorETF_Close[t] / SectorETF_Close[t-20] - 1", ["sectorBenchmarkSeries"], ["SectorETF_Close"], 20, 21, "USD/share", "decimal", "sector_etf", "dated_sessions", "adjusted", true),
  EXRET_20_SPY: makeContract("scanner_exret_20_spy", "RET_20_STOCK - RET_20_SPY", ["ohlcvBarSeries", "benchmarkHistorySeries"], ["Close", "SPY_Close"], 20, 21, "decimal return", "decimal", "SPY", "dated_sessions", "adjusted", true, { thresholds: { positive: 0 } }),
  EXRET_20_SECTOR: makeContract("scanner_exret_20_sector", "RET_20_STOCK - RET_20_SECTOR", ["ohlcvBarSeries", "sectorBenchmarkSeries"], ["Close", "SectorETF_Close"], 20, 21, "decimal return", "decimal", "sector_etf", "dated_sessions", "adjusted", true, { thresholds: { positive: 0 } }),
  VOL_SPIKE_20: makeContract("scanner_vol_spike_20", "Volume[t] / mean(Volume[t-19:t])", ["ohlcvBarSeries"], ["Volume"], 20, 20, "shares", "ratio", "none", "dated_sessions", "adjusted", true, { thresholds: { noRejectMax: 2.5 } }),
  SECTOR_ABOVE_MA50: makeContract("scanner_sector_above_ma50", "SectorETF_Close[t] > mean(SectorETF_Close[t-49:t])", ["sectorBenchmarkSeries"], ["SectorETF_Close"], 50, 50, "USD/share", "boolean", "sector_etf", "dated_sessions", "adjusted", true),
  RS_SERIES_SPY: makeContract("scanner_rs_series_spy", "Close[t] / SPY_Close[t]", ["ohlcvBarSeries", "benchmarkHistorySeries"], ["Close", "SPY_Close"], 1, 1, "USD/share", "ratio", "SPY", "dated_sessions", "adjusted", true),
  RS_IMPROVE_5: makeContract("scanner_rs_improve_5", "RS_SERIES_SPY[t] / RS_SERIES_SPY[t-5] - 1", ["ohlcvBarSeries", "benchmarkHistorySeries"], ["Close", "SPY_Close"], 5, 6, "ratio", "decimal", "SPY", "dated_sessions", "adjusted", true, { thresholds: { positive: 0 } }),
  prior_low_45: makeContract("scanner_prior_low_45", "min(Low[t-45:t-1])", ["ohlcvBarSeries"], ["Low"], 45, 46, "USD/share", "USD/share", "none", "dated_sessions", "adjusted", false),
  prior_low_63: makeContract("scanner_prior_low_63", "min(Low[t-63:t-1])", ["ohlcvBarSeries"], ["Low"], 63, 64, "USD/share", "USD/share", "none", "dated_sessions", "adjusted", false),
  prior_low_90: makeContract("scanner_prior_low_90", "min(Low[t-90:t-1])", ["ohlcvBarSeries"], ["Low"], 90, 91, "USD/share", "USD/share", "none", "dated_sessions", "adjusted", false),
  prior_low_126: makeContract("scanner_prior_low_126", "min(Low[t-126:t-1])", ["ohlcvBarSeries"], ["Low"], 126, 127, "USD/share", "USD/share", "none", "dated_sessions", "adjusted", false),
  broke_prior_low_N: makeContract("scanner_broke_prior_low_N", "Low[t] < min(Low[t-N:t-1])", ["ohlcvBarSeries"], ["Low"], null, 0, "USD/share", "boolean", "none", "dated_sessions", "adjusted", true),
  broke_prior_low_45: makeContract("scanner_broke_prior_low_45", "Low[t] < min(Low[t-45:t-1])", ["ohlcvBarSeries"], ["Low"], 45, 46, "USD/share", "boolean", "none", "dated_sessions", "adjusted", true),
  broke_prior_low_63: makeContract("scanner_broke_prior_low_63", "Low[t] < min(Low[t-63:t-1])", ["ohlcvBarSeries"], ["Low"], 63, 64, "USD/share", "boolean", "none", "dated_sessions", "adjusted", true),
  broke_prior_low_90: makeContract("scanner_broke_prior_low_90", "Low[t] < min(Low[t-90:t-1])", ["ohlcvBarSeries"], ["Low"], 90, 91, "USD/share", "boolean", "none", "dated_sessions", "adjusted", true),
  broke_prior_low_126: makeContract("scanner_broke_prior_low_126", "Low[t] < min(Low[t-126:t-1])", ["ohlcvBarSeries"], ["Low"], 126, 127, "USD/share", "boolean", "none", "dated_sessions", "adjusted", true),
  failed_break_N_R: makeContract("scanner_failed_break_N_R", "any(Low[t-i] < min(Low[t-i-N:t-i-1]) for i=0..R-1)", ["ohlcvBarSeries"], ["Low"], null, 0, "USD/share", "boolean", "none", "dated_sessions", "adjusted", true),
  reclaim_low_N: makeContract("scanner_reclaim_low_N", "Close[t] > min(Low[t-N:t-1])", ["ohlcvBarSeries"], ["Close", "Low"], null, 0, "USD/share", "boolean", "none", "dated_sessions", "adjusted", true),
  RECLAIM_LOW_45: makeContract("scanner_reclaim_low_45", "Close[t] > min(Low[t-45:t-1])", ["ohlcvBarSeries"], ["Close", "Low"], 45, 46, "USD/share", "boolean", "none", "dated_sessions", "adjusted", true),
  RECLAIM_LOW_63: makeContract("scanner_reclaim_low_63", "Close[t] > min(Low[t-63:t-1])", ["ohlcvBarSeries"], ["Close", "Low"], 63, 64, "USD/share", "boolean", "none", "dated_sessions", "adjusted", true),
  RECLAIM_LOW_90: makeContract("scanner_reclaim_low_90", "Close[t] > min(Low[t-90:t-1])", ["ohlcvBarSeries"], ["Close", "Low"], 90, 91, "USD/share", "boolean", "none", "dated_sessions", "adjusted", true),
  RECLAIM_LOW_126: makeContract("scanner_reclaim_low_126", "Close[t] > min(Low[t-126:t-1])", ["ohlcvBarSeries"], ["Close", "Low"], 126, 127, "USD/share", "boolean", "none", "dated_sessions", "adjusted", true),
};

export const metricContracts = metricContractRegistry;

export const getMetricContract = (metricKey?: string) =>
  metricKey ? metricContractRegistry[metricKey] : undefined;

const formulaRegistryMetadata: FormulaDefinition[] = [
  {
    key: "raw_passthrough",
    name: "원천값 직접 사용",
    description: "하나의 L0 파라미터를 그대로 L1 값으로 사용합니다.",
    equation: "L1 = L0",
    requiredData: [],
    outputType: "number",
  },
  {
    key: "custom_expression",
    name: "사용자 정의 수식",
    description: "L0 파라미터를 조합해 직접 수학식으로 계산합니다.",
    equation: "L1 = f(L0, L0, ...)",
    requiredData: [],
    outputType: "number",
  },
  {
    key: "drawdown_pct",
    name: "최근 고점 대비 하락률",
    description: "현재 가격이 최근 고점 기준선에서 얼마나 내려와 있는지 계산합니다.",
    equation: "((현재가 / 최근 고점) - 1) × 100",
    requiredData: ["priceHistorySeries"],
    outputType: "number",
  },
  {
    key: "near_support_bool",
    name: "지지 구간 근접 여부",
    description: "가격이 지지 구간 근처에서 버티며 안정을 찾는지 확인합니다.",
    equation: "현재가가 최근 지지 저점 대비 0~5% 범위인지 확인",
    requiredData: ["priceHistorySeries"],
    outputType: "boolean",
  },
  {
    key: "valuation_discount_bool",
    name: "밸류에이션 할인 여부",
    description: "현재 밸류에이션이 최근 자기 기준보다 더 싸 보이는지 확인합니다.",
    requiredData: ["valuationSnapshot"],
    outputType: "boolean",
  },
  {
    key: "earnings_soon_bool",
    name: "실적 발표 임박 여부",
    description: "가까운 실적 이벤트가 단기 불확실성을 키우는지 확인합니다.",
    requiredData: ["eventCalendar"],
    outputType: "boolean",
  },
  {
    key: "relative_strength_vs_spy_pct",
    name: "SPY 대비 상대강도",
    description: "일정 구간에서 종목이 시장 기준 대비 얼마나 강하거나 약한지 계산합니다.",
    equation: "종목 60일 수익률 - SPY 60일 수익률",
    requiredData: ["priceHistorySeries", "benchmarkHistorySeries"],
    outputType: "number",
  },
  {
    key: "distance_from_ma_50_pct",
    name: "50일 이동평균선 대비 거리",
    description: "현재 가격이 50일 이동평균선 기준에서 얼마나 떨어져 있는지 계산합니다.",
    equation: "((현재가 / 50일 평균가) - 1) × 100",
    requiredData: ["priceHistorySeries"],
    outputType: "number",
  },
  {
    key: "distance_from_ma_20_pct",
    name: "20일 이동평균선 대비 거리",
    description: "현재 가격이 20일 이동평균선 기준에서 얼마나 떨어져 있는지 계산합니다.",
    equation: "((현재가 / 20일 평균가) - 1) × 100",
    requiredData: ["priceHistorySeries"],
    outputType: "number",
  },
  {
    key: "distance_from_ma_200_pct",
    name: "200일 이동평균선 대비 거리",
    description: "현재 가격이 200일 이동평균선 기준에서 얼마나 떨어져 있는지 계산합니다.",
    equation: "((현재가 / 200일 평균가) - 1) × 100",
    requiredData: ["priceHistorySeries"],
    outputType: "number",
  },
  {
    key: "price_return_20d_pct",
    name: "20일 수익률",
    description: "최근 20거래일 기준 가격 수익률을 계산합니다.",
    equation: "((현재가 / 20일 전 가격) - 1) × 100",
    requiredData: ["priceHistorySeries"],
    outputType: "number",
  },
  {
    key: "price_return_60d_pct",
    name: "60일 수익률",
    description: "최근 60거래일 기준 가격 수익률을 계산합니다.",
    equation: "((현재가 / 60일 전 가격) - 1) × 100",
    requiredData: ["priceHistorySeries"],
    outputType: "number",
  },
  {
    key: "rebound_from_recent_low_pct",
    name: "최근 저점 대비 반등률",
    description: "최근 저점에서 현재 가격이 얼마나 회복됐는지 계산합니다.",
    equation: "((현재가 / 최근 20일 저점) - 1) × 100",
    requiredData: ["priceHistorySeries"],
    outputType: "number",
  },
  {
    key: "volume_spike_bool",
    name: "거래량 급증 여부",
    description: "평소보다 눈에 띄는 거래량 팽창이 있는지 확인합니다.",
    equation: "최근 거래량 > 직전 평균 거래량 × 1.4",
    requiredData: ["volumeHistorySeries"],
    outputType: "boolean",
  },
  {
    key: "volatility_compression_bool",
    name: "변동폭 압축 여부",
    description: "최근 변동폭이 직전 평균보다 눈에 띄게 줄었는지 확인합니다.",
    equation: "최근 평균 변동폭 < 직전 평균 변동폭 × 0.85",
    requiredData: ["volatilityHistorySeries"],
    outputType: "boolean",
  },
  {
    key: "average_range_pct",
    name: "평균 일중 변동폭",
    description: "최근 평균적인 가격 변동폭 수준을 퍼센트로 보여줍니다.",
    equation: "최근 변동폭 시계열 평균",
    requiredData: ["volatilityHistorySeries"],
    outputType: "number",
  },
  {
    key: "revenue_growth_yoy",
    name: "전년 대비 매출 성장률",
    description: "전년 동기 대비 매출이 얼마나 늘거나 줄었는지 나타냅니다.",
    equation: "((이번 기간 매출 / 전년 동기 매출) - 1) × 100",
    requiredData: ["financialStatementSnapshot"],
    outputType: "number",
  },
  {
    key: "margin_change_pct",
    name: "마진 변화율",
    description: "이전 기준 대비 수익성 마진이 얼마나 좋아지거나 나빠졌는지 보여줍니다.",
    equation: "이번 기간 마진 - 이전 기준 마진",
    requiredData: ["financialStatementSnapshot"],
    outputType: "number",
  },
  {
    key: "debt_risk_level",
    name: "부채 위험 수준",
    description: "부채 부담을 낮음·중간·높음으로 단순 분류합니다.",
    equation: "순부채 / 현금흐름 / 차환 부담을 종합한 단계 분류",
    requiredData: ["financialStatementSnapshot"],
    outputType: "string",
  },
  {
    key: "price_inside_entry_zone",
    name: "계획 진입 구간 내부 여부",
    description: "현재 가격이 사용자가 정한 계획 진입 구간 안에 있는지 확인합니다.",
    requiredData: ["priceHistorySeries", "plannedEntryRange"],
    outputType: "boolean",
  },
  {
    key: "price_beyond_entry_zone",
    name: "계획 진입 구간 이탈 여부",
    description: "현재 가격이 사용자가 정한 계획 진입 구간 밖으로 벗어났는지 확인합니다.",
    requiredData: ["priceHistorySeries", "plannedEntryRange"],
    outputType: "boolean",
  },
  {
    key: "days_since_last_review",
    name: "마지막 논리 검토 후 경과일",
    description: "마지막으로 투자 논리를 검토한 시점 이후 며칠이 지났는지 계산합니다.",
    equation: "오늘 날짜 - 마지막 논리 검토 시점",
    requiredData: ["lastThesisReviewAt"],
    outputType: "number",
  },
  {
    key: "days_until_earnings",
    name: "실적 발표까지 남은 일수",
    description: "다음 실적 이벤트까지 며칠이 남았는지 계산합니다.",
    equation: "다음 실적일 - 오늘",
    requiredData: ["eventCalendar"],
    outputType: "number",
  },
  {
    key: "thesis_review_stale",
    name: "논리 검토 노후화 여부",
    description: "마지막 논리 검토가 너무 오래되어 다시 봐야 하는지 확인합니다.",
    equation: "마지막 검토 후 경과일 >= 14",
    requiredData: ["lastThesisReviewAt"],
    outputType: "boolean",
  },
  {
    key: "manual_flag_present",
    name: "수동 위험 플래그 존재 여부",
    description: "스냅샷이나 Eye에 수동 위험 플래그가 기록되어 있는지 확인합니다.",
    equation: "수동 위험 플래그 배열 길이 > 0 또는 특정 플래그 포함 여부",
    requiredData: ["manualRiskFlags"],
    outputType: "boolean",
  },
];

const metricCatalogMetadata: MetricDefinition[] = [
  {
    key: "drawdown_from_recent_high",
    name: "최근 고점 대비 하락폭",
    humanMeaning: "종목이 최근 고점 기준선에서 얼마나 내려와 있는지 보여줍니다.",
    formulaKey: "drawdown_pct",
    requiredData: ["priceHistorySeries"],
    freshnessExpectation: "Daily",
    availability: "automated",
    exampleConditions: ["최근 고점 대비 최소 25% 이상 하락한 종목만 포함합니다."],
    exampleDisplayText: "최근 고점 대비 25% 이상 내려온 상태입니다.",
    missingDataBehavior: "데이터가 없으면 통과로 보지 않고, 데이터 품질을 부분 상태로 표시합니다.",
  },
  {
    key: "near_support",
    name: "지지 구간 근접",
    humanMeaning: "가격이 이전 지지 구간 근처에서 버티는지 보여줍니다.",
    formulaKey: "near_support_bool",
    requiredData: ["priceHistorySeries"],
    freshnessExpectation: "Daily",
    availability: "automated",
    exampleConditions: ["가격이 이전 지지 구간 근처에서 안정되는지 확인합니다."],
    exampleDisplayText: "가격이 지지 구간 부근에서 안정을 찾는 모습입니다.",
    missingDataBehavior: "경고로 처리하고, 타이밍 판단 근거가 일부 비어 있음을 표시합니다.",
  },
  {
    key: "valuation_discount",
    name: "자기 역사 대비 밸류에이션 할인",
    humanMeaning: "해당 종목의 최근 자기 기준 대비 현재 밸류에이션이 더 싸 보이는지 보여줍니다.",
    formulaKey: "valuation_discount_bool",
    requiredData: ["valuationSnapshot"],
    freshnessExpectation: "Daily",
    availability: "automated",
    exampleConditions: ["밸류에이션 할인 구간인지 확인합니다."],
    exampleDisplayText: "최근 기준 대비 밸류에이션이 더 매력적인 편입니다.",
    missingDataBehavior: "경고로 처리하고, 검토 중심 구도로 남겨둡니다.",
  },
  {
    key: "relative_strength_vs_spy",
    name: "SPY 대비 상대강도",
    humanMeaning: "종목이 시장 기준 대비 얼마나 강하게 버티는지 보여줍니다.",
    formulaKey: "relative_strength_vs_spy_pct",
    requiredData: ["priceHistorySeries", "benchmarkHistorySeries"],
    freshnessExpectation: "Daily",
    availability: "automated",
    exampleConditions: ["SPY 대비 상대강도가 -3%보다 낫거나 같은지 확인합니다."],
    exampleDisplayText: "시장 대비 상대강도가 심하게 무너지지는 않고 있습니다.",
    missingDataBehavior: "경고로 처리하되 평가는 계속 진행합니다.",
  },
  {
    key: "distance_from_ma_50",
    name: "50일선 대비 거리",
    humanMeaning: "가격이 중기 추세 기준선에서 얼마나 과도하게 이탈했는지 보여줍니다.",
    formulaKey: "distance_from_ma_50_pct",
    requiredData: ["priceHistorySeries"],
    freshnessExpectation: "Daily",
    availability: "automated",
    exampleConditions: ["가격이 50일선 아래로 5%보다 더 심하게 밀리지 않았는지 확인합니다."],
    exampleDisplayText: "가격이 50일선에서 과도하게 멀어지지 않은 상태입니다.",
    missingDataBehavior: "경고로 처리하고, 타이밍 확증 근거로는 쓰지 않습니다.",
  },
  {
    key: "distance_from_ma_20",
    name: "20일선 대비 거리",
    humanMeaning: "가격이 단기 추세 기준에서 얼마나 벌어져 있는지 보여줍니다.",
    formulaKey: "distance_from_ma_20_pct",
    requiredData: ["priceHistorySeries"],
    freshnessExpectation: "Daily",
    availability: "automated",
    exampleConditions: ["가격이 20일선 대비 과열되거나 과도하게 밀리지 않았는지 확인합니다."],
    exampleDisplayText: "단기 추세선과 현재 가격의 벌어짐 정도를 보여줍니다.",
    missingDataBehavior: "경고로 처리하고, 단기 타이밍 판단 신뢰도를 낮춥니다.",
  },
  {
    key: "distance_from_ma_200",
    name: "200일선 대비 거리",
    humanMeaning: "가격이 장기 추세 기준에서 구조적으로 얼마나 이탈했는지 보여줍니다.",
    formulaKey: "distance_from_ma_200_pct",
    requiredData: ["priceHistorySeries"],
    freshnessExpectation: "Daily",
    availability: "automated",
    exampleConditions: ["가격이 200일선 대비 심하게 눌린 상태인지 확인합니다."],
    exampleDisplayText: "장기 추세 기준에서 현재 위치를 보여줍니다.",
    missingDataBehavior: "경고로 처리하고, 장기 추세 해석의 신뢰도를 낮춥니다.",
  },
  {
    key: "volume_spike",
    name: "거래량 급증",
    humanMeaning: "눈에 띄는 거래량 팽창이 발생했는지 보여줍니다.",
    formulaKey: "volume_spike_bool",
    requiredData: ["volumeHistorySeries"],
    freshnessExpectation: "Daily",
    availability: "future",
    exampleConditions: ["거래량 급증이 있는지 확인합니다."],
    exampleDisplayText: "거래량이 평소보다 크게 늘어난 상태입니다.",
    missingDataBehavior: "보류 처리하고, 향후 확장 대상 지표로 표시합니다.",
  },
  {
    key: "volatility_compression",
    name: "변동폭 압축",
    humanMeaning: "급락 뒤 일중 변동폭이 진정되며 가격이 정리되는지 보여줍니다.",
    formulaKey: "volatility_compression_bool",
    requiredData: ["volatilityHistorySeries"],
    freshnessExpectation: "Daily",
    availability: "automated",
    exampleConditions: ["최근 변동폭이 직전 평균보다 충분히 압축됐는지 확인합니다."],
    exampleDisplayText: "변동폭이 줄며 가격 움직임이 한 단계 정리되는 모습입니다.",
    missingDataBehavior: "경고로 처리하고, 진정 구도 판단에서는 보조 증거만으로 사용합니다.",
  },
  {
    key: "average_range_pct",
    name: "평균 일중 변동폭",
    humanMeaning: "최근 평균적인 일중 변동폭이 아직 과열 상태인지 보여줍니다.",
    formulaKey: "average_range_pct",
    requiredData: ["volatilityHistorySeries"],
    freshnessExpectation: "Daily",
    availability: "automated",
    exampleConditions: ["최근 평균 변동폭이 4.5% 이하로 내려왔는지 확인합니다."],
    exampleDisplayText: "일중 흔들림이 과도하게 큰 구간은 지나가고 있습니다.",
    missingDataBehavior: "경고로 처리하고, 타이밍 정교화 대신 보조 판단 근거로만 씁니다.",
  },
  {
    key: "price_return_20d",
    name: "20일 수익률",
    humanMeaning: "최근 한 달 남짓 가격 모멘텀이 얼마나 약하거나 강한지 보여줍니다.",
    formulaKey: "price_return_20d_pct",
    requiredData: ["priceHistorySeries"],
    freshnessExpectation: "Daily",
    availability: "automated",
    exampleConditions: ["최근 20일 수익률이 -10% 이하로 과도하게 무너졌는지 확인합니다."],
    exampleDisplayText: "최근 20일 동안 가격이 급격히 밀린 상태입니다.",
    missingDataBehavior: "경고로 처리하고, 이벤트 충격 강도 판단을 약하게 봅니다.",
  },
  {
    key: "price_return_60d",
    name: "60일 수익률",
    humanMeaning: "중기 흐름이 여전히 살아 있는지, 아니면 구조적으로 꺾였는지 보여줍니다.",
    formulaKey: "price_return_60d_pct",
    requiredData: ["priceHistorySeries"],
    freshnessExpectation: "Daily",
    availability: "automated",
    exampleConditions: ["최근 60일 수익률이 아직 0% 이상인지 확인합니다."],
    exampleDisplayText: "중기 흐름은 아직 완전히 꺾이지 않았습니다.",
    missingDataBehavior: "경고로 처리하고, 추세 해석의 신뢰도를 낮춥니다.",
  },
  {
    key: "rebound_from_recent_low",
    name: "최근 저점 대비 반등률",
    humanMeaning: "최근 저점에서 회복이 얼마나 나왔는지 보여줍니다.",
    formulaKey: "rebound_from_recent_low_pct",
    requiredData: ["priceHistorySeries"],
    freshnessExpectation: "Daily",
    availability: "automated",
    exampleConditions: ["최근 저점에서 최소 5% 이상 회복했는지 확인합니다."],
    exampleDisplayText: "최근 저점 기준 회복 폭을 보여줍니다.",
    missingDataBehavior: "경고로 처리하고, 회복 확인 증거를 약하게 봅니다.",
  },
  {
    key: "revenue_growth_yoy",
    name: "전년 대비 매출 성장률",
    humanMeaning: "사업의 외형이 무너지지 않는지를 보여주는 기초 품질 지표입니다.",
    formulaKey: "revenue_growth_yoy",
    requiredData: ["financialStatementSnapshot"],
    freshnessExpectation: "Daily",
    availability: "automated",
    exampleConditions: ["전년 대비 매출 성장률이 0% 이상인지 확인합니다."],
    exampleDisplayText: "전년 대비 매출이 무너지는 흐름은 아닙니다.",
    missingDataBehavior: "경고로 처리하고, 품질 신뢰도를 낮춥니다.",
  },
  {
    key: "margin_change_pct",
    name: "마진 변화",
    humanMeaning: "수익성 마진이 안정되는지, 아니면 나빠지는지 보여줍니다.",
    formulaKey: "margin_change_pct",
    requiredData: ["financialStatementSnapshot"],
    freshnessExpectation: "Daily",
    availability: "automated",
    exampleConditions: ["마진 변화율이 -3%보다 양호한지 확인합니다."],
    exampleDisplayText: "마진이 구조적으로 무너지는 흐름은 아닙니다.",
    missingDataBehavior: "경고로 처리하고, 품질 신뢰도를 낮춥니다.",
  },
  {
    key: "debt_risk_level",
    name: "부채 위험",
    humanMeaning: "부채 부담이 낮은지, 중간인지, 높은지 단순 분류해 보여줍니다.",
    formulaKey: "debt_risk_level",
    requiredData: ["financialStatementSnapshot"],
    freshnessExpectation: "Daily",
    availability: "automated",
    exampleConditions: ["부채 위험 수준이 높음이 아닌지 확인합니다."],
    exampleDisplayText: "부채 위험이 심각한 수준으로 보이지는 않습니다.",
    missingDataBehavior: "경고로 처리하고, 위험 민감 레시피에서는 수동 검토를 요구합니다.",
  },
  {
    key: "earnings_soon",
    name: "실적 발표까지 남은 기간",
    humanMeaning: "가까운 실적 이벤트가 단기 불확실성을 키우는지 보여줍니다.",
    formulaKey: "earnings_soon_bool",
    requiredData: ["eventCalendar"],
    freshnessExpectation: "Daily",
    availability: "automated",
    exampleConditions: ["실적 발표가 너무 가까운 구간이 아닌지 확인합니다."],
    exampleDisplayText: "실적 이벤트가 가까워 단기 불확실성이 커진 상태입니다.",
    missingDataBehavior: "경고로 처리하되 평가는 계속 진행합니다.",
  },
  {
    key: "days_until_earnings",
    name: "실적 발표까지 남은 일수",
    humanMeaning: "다음 실적 이벤트까지 얼마나 남았는지 정량으로 보여줍니다.",
    formulaKey: "days_until_earnings",
    requiredData: ["eventCalendar"],
    freshnessExpectation: "Daily",
    availability: "automated",
    exampleConditions: ["실적 발표까지 최소 7일 이상 남았는지 확인합니다."],
    exampleDisplayText: "다음 실적 이벤트까지 남은 시간을 보여줍니다.",
    missingDataBehavior: "경고로 처리하고, 이벤트 리스크 판단을 약하게 봅니다.",
  },
  {
    key: "price_inside_entry_zone",
    name: "계획 진입 구간 내부",
    humanMeaning: "현재 가격이 사용자가 정한 진입 구간 안에 들어와 있는지 보여줍니다.",
    formulaKey: "price_inside_entry_zone",
    requiredData: ["priceHistorySeries", "plannedEntryRange"],
    freshnessExpectation: "Daily",
    availability: "manual",
    exampleConditions: ["가격이 계획 진입 구간 안에 있는지 확인합니다."],
    exampleDisplayText: "현재 가격이 계획한 진입 구간 안에 들어와 있습니다.",
    missingDataBehavior: "경고로 처리하고, 진입 구간 타이밍 정보가 비어 있음을 표시합니다.",
  },
  {
    key: "price_beyond_entry_zone",
    name: "계획 진입 구간 이탈",
    humanMeaning: "현재 가격이 계획 진입 구간을 벗어났는지 보여줍니다.",
    formulaKey: "price_beyond_entry_zone",
    requiredData: ["priceHistorySeries", "plannedEntryRange"],
    freshnessExpectation: "Daily",
    availability: "manual",
    exampleConditions: ["가격이 계획한 진입 구간 밖으로 이탈했는지 확인합니다."],
    exampleDisplayText: "현재 가격이 계획한 진입 구간을 벗어났습니다.",
    missingDataBehavior: "경고로 처리하고, 계획 가격대 정보가 비어 있음을 표시합니다.",
  },
  {
    key: "days_since_last_review",
    name: "마지막 논리 검토 후 경과일",
    humanMeaning: "투자 논리 검토가 얼마나 오래됐는지 보여줍니다.",
    formulaKey: "days_since_last_review",
    requiredData: ["lastThesisReviewAt"],
    freshnessExpectation: "Review Cadence",
    availability: "manual",
    exampleConditions: ["투자 논리를 최소 14일 이상 다시 보지 않았는지 확인합니다."],
    exampleDisplayText: "이 Eye는 최근 투자 논리 재점검이 없었습니다.",
    missingDataBehavior: "검토 메타데이터 누락으로 처리하고, 재검토를 유도합니다.",
  },
  {
    key: "thesis_review_stale",
    name: "논리 재검토 필요",
    humanMeaning: "논리 검토가 오래되어 재검토가 필요한지 보여줍니다.",
    formulaKey: "thesis_review_stale",
    requiredData: ["lastThesisReviewAt"],
    freshnessExpectation: "Review Cadence",
    availability: "manual",
    exampleConditions: ["마지막 검토 후 14일 이상 지났는지 확인합니다."],
    exampleDisplayText: "논리 재검토 주기를 넘긴 상태입니다.",
    missingDataBehavior: "검토 이력이 비어 있으면 재검토 필요로 강하게 표시합니다.",
  },
  {
    key: "manual_flag_present",
    name: "수동 강제 제외 플래그",
    humanMeaning: "사용자가 중대한 위험이나 논리 훼손 사건을 수동으로 표시했는지 보여줍니다.",
    formulaKey: "manual_flag_present",
    requiredData: ["manualRiskFlags"],
    freshnessExpectation: "Review Cadence",
    availability: "manual",
    exampleConditions: ["수동 플래그에 회계 이슈 같은 중대한 위험이 포함됐는지 확인합니다."],
    exampleDisplayText: "수동 강제 제외 플래그가 기록되어 있습니다.",
    missingDataBehavior: "위험이 없다고 가정하지 않습니다. 명시적으로 없을 때만 통과로 봅니다.",
  },
];

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
export const latestFinite = (values?: number[]) => {
  const value = values?.at(-1);
  return finite(value) ? value : undefined;
};
const exactWindow = (values: number[] | undefined, length: number) => {
  if (!values || values.length < length) return undefined;
  const window = values.slice(-length);
  return window.every(finite) ? window : undefined;
};
const contractWarmup = (key: string) => {
  const warmup = getMetricContract(key)?.warmupSessions;
  if (typeof warmup !== "number") throw new Error(`Metric contract ${key} has no warmup.`);
  return warmup;
};
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
export const pctChange = (current: number | undefined, base: number | undefined) =>
  current !== undefined && base !== undefined && base !== 0 ? (current / base - 1) * 100 : undefined;
const daysBetween = (now: Date, value?: string) => {
  if (!value) return undefined;
  const time = Date.parse(value);
  return Number.isFinite(time) ? Math.floor((now.getTime() - time) / 86400000) : undefined;
};

const benchmarkValueAtDate = (snapshot: MockSnapshot, date: string | undefined) => {
  if (!date || !snapshot.benchmarkDates || !snapshot.benchmarkHistorySeries) return undefined;
  const index = snapshot.benchmarkDates.indexOf(date);
  const value = index < 0 ? undefined : snapshot.benchmarkHistorySeries[index];
  return finite(value) ? value : undefined;
};

const datedBenchmarkWindow = (snapshot: MockSnapshot, length: number) => {
  const stockDates = snapshot.historyDates;
  if (!stockDates || stockDates.length < length) return undefined;
  const dates = stockDates.slice(-length);
  const values = dates.map((date) => benchmarkValueAtDate(snapshot, date));
  return values.every(finite) ? values : undefined;
};

const expressionParameterValue = (
  snapshot: MockSnapshot,
  eye: Eye,
  key: string,
  now = new Date(snapshot.updatedAt),
): number | undefined => {
  switch (key) {
    case "PRICE_NOW":
      return latestFinite(snapshot.priceHistorySeries) ?? (finite(snapshot.price) ? snapshot.price : undefined);
    case "PRICE_20D_AGO":
      return exactWindow(snapshot.priceHistorySeries, contractWarmup("price_return_20d"))?.at(-contractWarmup("price_return_20d"));
    case "PRICE_60D_AGO":
      return exactWindow(snapshot.priceHistorySeries, contractWarmup("price_return_60d"))?.at(-contractWarmup("price_return_60d"));
    case "PRICE_HIGH_252D": {
      const values = exactWindow(snapshot.priceHistorySeries, contractWarmup("drawdown_from_recent_high"));
      return values ? Math.max(...values) : undefined;
    }
    case "PRICE_LOW_20D": {
      const values = exactWindow(snapshot.priceHistorySeries, contractWarmup("near_support"));
      return values ? Math.min(...values) : undefined;
    }
    case "PRICE_AVG_20D": {
      const values = exactWindow(snapshot.priceHistorySeries, contractWarmup("distance_from_ma_20"));
      return values ? average(values) : undefined;
    }
    case "PRICE_AVG_50D": {
      const values = exactWindow(snapshot.priceHistorySeries, contractWarmup("distance_from_ma_50"));
      return values ? average(values) : undefined;
    }
    case "PRICE_AVG_200D": {
      const values = exactWindow(snapshot.priceHistorySeries, contractWarmup("distance_from_ma_200"));
      return values ? average(values) : undefined;
    }
    case "BENCH_NOW": {
      if (!snapshot.isMock && snapshot.benchmarkSymbol !== getMetricContract("relative_strength_vs_spy")?.benchmark) return undefined;
      const dated = benchmarkValueAtDate(snapshot, snapshot.historyDates?.at(-1));
      return dated ?? (snapshot.isMock ? latestFinite(snapshot.benchmarkHistorySeries) : undefined);
    }
    case "BENCH_60D_AGO": {
      if (!snapshot.isMock && snapshot.benchmarkSymbol !== getMetricContract("relative_strength_vs_spy")?.benchmark) return undefined;
      const warmup = contractWarmup("relative_strength_vs_spy");
      const dated = benchmarkValueAtDate(snapshot, snapshot.historyDates?.at(-warmup));
      return dated ?? (snapshot.isMock ? exactWindow(snapshot.benchmarkHistorySeries, warmup)?.at(-warmup) : undefined);
    }
    case "VOL_NOW":
      return latestFinite(snapshot.volumeHistorySeries);
    case "VOL_AVG_20D": {
      const values = exactWindow(snapshot.volumeHistorySeries, contractWarmup("volume_average_20d"));
      return values ? average(values) : undefined;
    }
    case "RANGE_AVG_10D": {
      const values = exactWindow(snapshot.volatilityHistorySeries, contractWarmup("average_range_pct"));
      return values ? average(values) : undefined;
    }
    case "RANGE_AVG_30D": {
      const values = exactWindow(snapshot.volatilityHistorySeries, contractWarmup("volatility_compression"));
      return values ? average(values) : undefined;
    }
    case "REV_GROWTH": return finite(snapshot.revenueGrowthYoY) ? snapshot.revenueGrowthYoY : undefined;
    case "MARGIN_DELTA": return finite(snapshot.marginChangePct) ? snapshot.marginChangePct : undefined;
    case "EARN_DAYS": return finite(snapshot.daysUntilEarnings) ? snapshot.daysUntilEarnings : undefined;
    case "ENTRY_LOW": return finite(eye.plannedEntryLow ?? snapshot.plannedEntryLow) ? eye.plannedEntryLow ?? snapshot.plannedEntryLow : undefined;
    case "ENTRY_HIGH": return finite(eye.plannedEntryHigh ?? snapshot.plannedEntryHigh) ? eye.plannedEntryHigh ?? snapshot.plannedEntryHigh : undefined;
    case "REVIEW_DAYS": return daysBetween(now, eye.lastReviewedAt ?? snapshot.lastThesisReviewAt);
    case "FLAG_COUNT": return [...(snapshot.riskFlags ?? []), ...(eye.manualFlags ?? [])].length;
    default: return undefined;
  }
};

/** Shared raw-parameter resolver used by the bounded expression engine. */
export const resolveExpressionParameter = expressionParameterValue;

const evaluateBuiltInMetric = (
  eye: Eye,
  snapshot: MockSnapshot,
  condition: RecipeCondition,
  key: string,
  now: Date,
): string | number | boolean | undefined => {
  const round = (value: number, precision = 1) => Number(value.toFixed(precision));
  switch (key) {
    case "drawdown_from_recent_high":
    case "drawdown_pct": {
      const values = exactWindow(snapshot.priceHistorySeries, getMetricContract("drawdown_from_recent_high")!.warmupSessions);
      const value = values ? pctChange(values.at(-1), Math.max(...values)) : undefined;
      return value === undefined ? undefined : round(value);
    }
    case "near_support":
    case "near_support_bool": {
      const values = exactWindow(snapshot.priceHistorySeries, getMetricContract("near_support")!.warmupSessions);
      if (!values) return undefined;
      const low = Math.min(...values);
      const band = Number(getMetricContract("near_support")?.thresholds?.supportBandPct ?? Number.NaN);
      return values.at(-1)! >= low && values.at(-1)! <= low * (1 + band);
    }
    case "valuation_discount":
    case "valuation_discount_bool":
      return typeof snapshot.valuationDiscount === "boolean" ? snapshot.valuationDiscount : undefined;
    case "relative_strength_vs_spy":
    case "relative_strength_vs_spy_pct": {
      const contract = getMetricContract("relative_strength_vs_spy")!;
      if (!snapshot.isMock && snapshot.benchmarkSymbol !== contract.benchmark) return undefined;
      const stock = exactWindow(snapshot.priceHistorySeries, contract.warmupSessions);
      const benchmark = snapshot.isMock && !snapshot.historyDates
        ? exactWindow(snapshot.benchmarkHistorySeries, contract.warmupSessions)
        : datedBenchmarkWindow(snapshot, contract.warmupSessions);
      if (!stock || !benchmark) return undefined;
      const stockReturn = pctChange(stock.at(-1), stock.at(-contract.warmupSessions));
      const benchmarkReturn = pctChange(benchmark.at(-1), benchmark.at(-contract.warmupSessions));
      if (stockReturn === undefined || benchmarkReturn === undefined) return undefined;
      const value = stockReturn - benchmarkReturn;
      return round(value);
    }
    case "distance_from_ma_50":
    case "distance_from_ma_50_pct": {
      const values = exactWindow(snapshot.priceHistorySeries, getMetricContract("distance_from_ma_50")!.warmupSessions);
      const value = values ? pctChange(values.at(-1), average(values)) : undefined;
      return value === undefined ? undefined : round(value);
    }
    case "distance_from_ma_20":
    case "distance_from_ma_20_pct": {
      const values = exactWindow(snapshot.priceHistorySeries, getMetricContract("distance_from_ma_20")!.warmupSessions);
      const value = values ? pctChange(values.at(-1), average(values)) : undefined;
      return value === undefined ? undefined : round(value);
    }
    case "distance_from_ma_200":
    case "distance_from_ma_200_pct": {
      const values = exactWindow(snapshot.priceHistorySeries, getMetricContract("distance_from_ma_200")!.warmupSessions);
      const value = values ? pctChange(values.at(-1), average(values)) : undefined;
      return value === undefined ? undefined : round(value);
    }
    case "price_return_20d":
    case "price_return_20d_pct": {
      const warmup = contractWarmup("price_return_20d");
      const values = exactWindow(snapshot.priceHistorySeries, warmup);
      const value = values ? pctChange(values.at(-1), values.at(-warmup)) : undefined;
      return value === undefined ? undefined : round(value);
    }
    case "price_return_60d":
    case "price_return_60d_pct": {
      const warmup = contractWarmup("price_return_60d");
      const values = exactWindow(snapshot.priceHistorySeries, warmup);
      const value = values ? pctChange(values.at(-1), values.at(-warmup)) : undefined;
      return value === undefined ? undefined : round(value);
    }
    case "volume_spike":
    case "volume_spike_bool": {
      const values = exactWindow(snapshot.volumeHistorySeries, getMetricContract("volume_spike")!.warmupSessions);
      if (!values) return undefined;
      const baseline = average(values.slice(0, -1));
      const multiple = Number(getMetricContract("volume_spike")?.thresholds?.spikeMultiple ?? Number.NaN);
      return baseline === undefined || baseline <= 0 ? undefined : values.at(-1)! > baseline * multiple;
    }
    case "volatility_compression":
    case "volatility_compression_bool": {
      const values = exactWindow(snapshot.volatilityHistorySeries, contractWarmup("volatility_compression"));
      if (!values) return undefined;
      const recentWarmup = contractWarmup("average_range_pct");
      const multiple = Number(getMetricContract("volatility_compression")?.thresholds?.compressionMultiple ?? Number.NaN);
      return average(values.slice(-recentWarmup))! < average(values)! * multiple;
    }
    case "average_range_pct": {
      const values = exactWindow(snapshot.volatilityHistorySeries, getMetricContract("average_range_pct")!.warmupSessions);
      const value = values ? average(values) : undefined;
      return value === undefined ? undefined : round(value);
    }
    case "revenue_growth_yoy": return finite(snapshot.revenueGrowthYoY) ? round(snapshot.revenueGrowthYoY) : undefined;
    case "margin_change_pct": return finite(snapshot.marginChangePct) ? round(snapshot.marginChangePct) : undefined;
    case "debt_risk_level": return snapshot.debtRiskLevel;
    case "earnings_soon":
    case "earnings_soon_bool": return typeof snapshot.earningsSoon === "boolean" ? snapshot.earningsSoon : undefined;
    case "days_until_earnings": return finite(snapshot.daysUntilEarnings) ? snapshot.daysUntilEarnings : undefined;
    case "price_inside_entry_zone": {
      const low = expressionParameterValue(snapshot, eye, "ENTRY_LOW", now);
      const high = expressionParameterValue(snapshot, eye, "ENTRY_HIGH", now);
      const current = expressionParameterValue(snapshot, eye, "PRICE_NOW", now);
      return low !== undefined && high !== undefined && current !== undefined ? current >= low && current <= high : undefined;
    }
    case "price_beyond_entry_zone": {
      const low = expressionParameterValue(snapshot, eye, "ENTRY_LOW", now);
      const high = expressionParameterValue(snapshot, eye, "ENTRY_HIGH", now);
      const current = expressionParameterValue(snapshot, eye, "PRICE_NOW", now);
      return low !== undefined && high !== undefined && current !== undefined ? current < low || current > high : undefined;
    }
    case "days_since_last_review": return expressionParameterValue(snapshot, eye, "REVIEW_DAYS", now);
    case "thesis_review_stale": {
      const days = expressionParameterValue(snapshot, eye, "REVIEW_DAYS", now);
      const staleAfterDays = Number(getMetricContract("thesis_review_stale")?.thresholds?.staleAfterDays ?? Number.NaN);
      return days === undefined || !Number.isFinite(staleAfterDays) ? undefined : days >= staleAfterDays;
    }
    case "manual_flag_present": {
      const expected = typeof condition.value === "string" ? condition.value : undefined;
      const flags = [...(snapshot.riskFlags ?? []), ...(eye.manualFlags ?? [])];
      return expected ? flags.includes(expected) : flags.length > 0;
    }
    default: return undefined;
  }
};

/** One evaluator for built-in metric formulas used by preview and workspace/worker paths. */
export const evaluateMetricValue = (
  eye: Eye,
  snapshot: MockSnapshot,
  condition: RecipeCondition,
  now = new Date(snapshot.updatedAt),
) => {
  for (const key of [condition.metricKey, condition.formulaKey]) {
    if (!key) continue;
    const value = evaluateBuiltInMetric(eye, snapshot, condition, key, now);
    if (value !== undefined) return value;
  }
  return undefined;
};

const contractForFormula = (formulaKey: string) =>
  Object.values(metricContractRegistry).find((contract) => contract.formulaKey === formulaKey);

export const formulaRegistry: FormulaDefinition[] = formulaRegistryMetadata.map((formula) => ({
  ...formula,
  equation: contractForFormula(formula.key)?.formula ?? formula.equation,
  requiredData: contractForFormula(formula.key)?.requiredData ?? formula.requiredData,
  semanticContract: contractForFormula(formula.key),
}));

export const metricCatalog: MetricDefinition[] = metricCatalogMetadata.map((metric) => {
  const semanticContract = getMetricContract(metric.key);
  return {
    ...metric,
    formulaKey: semanticContract?.formulaKey ?? metric.formulaKey,
    requiredData: semanticContract?.requiredData ?? metric.requiredData,
    semanticContract,
  };
});

export const getMetricDefinition = (metricKey?: string) =>
  metricKey ? metricCatalog.find((metric) => metric.key === metricKey) : undefined;

export const getFormulaDefinition = (formulaKey?: string) =>
  formulaKey ? formulaRegistry.find((formula) => formula.key === formulaKey) : undefined;
