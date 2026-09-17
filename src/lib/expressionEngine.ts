import { Eye, MockSnapshot } from "../types";
import { evaluateArithmetic, expressionTokens, parseExpression } from "../domain/arithmetic";
import { latestFinite, pctChange, resolveExpressionParameter } from "./metricCatalog";

export type ExpressionParameter = {
  key: string;
  label: string;
  description: string;
  requiredData: string[];
};

export const expressionParameterRegistry: ExpressionParameter[] = [
  { key: "PRICE_NOW", label: "현재가", description: "가격 시계열의 최신값", requiredData: ["priceHistorySeries"] },
  { key: "PRICE_20D_AGO", label: "20일 전 가격", description: "가격 시계열의 20거래일 전 값", requiredData: ["priceHistorySeries"] },
  { key: "PRICE_60D_AGO", label: "60일 전 가격", description: "가격 시계열의 60거래일 전 값", requiredData: ["priceHistorySeries"] },
  { key: "PRICE_HIGH_252D", label: "252일 고점", description: "가격 시계열 최근 252거래일 고점", requiredData: ["priceHistorySeries"] },
  { key: "PRICE_LOW_20D", label: "20일 저점", description: "가격 시계열 최근 20거래일 저점", requiredData: ["priceHistorySeries"] },
  { key: "PRICE_AVG_20D", label: "20일 평균가", description: "가격 시계열 최근 20거래일 평균", requiredData: ["priceHistorySeries"] },
  { key: "PRICE_AVG_50D", label: "50일 평균가", description: "가격 시계열 최근 50거래일 평균", requiredData: ["priceHistorySeries"] },
  { key: "PRICE_AVG_200D", label: "200일 평균가", description: "가격 시계열 최근 200거래일 평균", requiredData: ["priceHistorySeries"] },
  { key: "BENCH_NOW", label: "벤치마크 현재값", description: "벤치마크 시계열의 최신값", requiredData: ["benchmarkHistorySeries"] },
  { key: "BENCH_60D_AGO", label: "벤치마크 60일 전", description: "벤치마크 시계열의 60거래일 전 값", requiredData: ["benchmarkHistorySeries"] },
  { key: "VOL_NOW", label: "현재 거래량", description: "거래량 시계열의 최신값", requiredData: ["volumeHistorySeries"] },
  { key: "VOL_AVG_20D", label: "20일 평균 거래량", description: "거래량 시계열 최근 20거래일 평균", requiredData: ["volumeHistorySeries"] },
  { key: "RANGE_AVG_10D", label: "10일 평균 변동폭", description: "변동폭 시계열 최근 10거래일 평균", requiredData: ["volatilityHistorySeries"] },
  { key: "RANGE_AVG_30D", label: "30일 평균 변동폭", description: "변동폭 시계열 최근 30거래일 평균", requiredData: ["volatilityHistorySeries"] },
  { key: "REV_GROWTH", label: "매출 성장률", description: "재무 스냅샷의 전년 대비 매출 성장률", requiredData: ["financialStatementSnapshot"] },
  { key: "MARGIN_DELTA", label: "마진 변화율", description: "재무 스냅샷의 마진 변화", requiredData: ["financialStatementSnapshot"] },
  { key: "EARN_DAYS", label: "실적 발표까지 일수", description: "이벤트 캘린더 기반 남은 일수", requiredData: ["eventCalendar"] },
  { key: "ENTRY_LOW", label: "진입 구간 하단", description: "사용자 입력 진입 구간 하단", requiredData: ["plannedEntryRange"] },
  { key: "ENTRY_HIGH", label: "진입 구간 상단", description: "사용자 입력 진입 구간 상단", requiredData: ["plannedEntryRange"] },
  { key: "REVIEW_DAYS", label: "검토 경과일", description: "마지막 논리 검토 이후 경과일", requiredData: ["lastThesisReviewAt"] },
  { key: "FLAG_COUNT", label: "위험 플래그 수", description: "수동/스냅샷 위험 플래그 개수", requiredData: ["manualRiskFlags"] },
];

export const expressionParameterLabel = (key: string) =>
  expressionParameterRegistry.find((item) => item.key === key)?.label ?? key;

export const expressionParameterKeys = expressionParameterRegistry.map((item) => item.key);

export const expressionParameterRequiredData = (keys: string[]) =>
  Array.from(
    new Set(
      keys.flatMap(
        (key) => expressionParameterRegistry.find((item) => item.key === key)?.requiredData ?? [],
      ),
    ),
  );

export const parameterValue = resolveExpressionParameter;

export const evaluateExpression = (
  expression: string, parameterKeys: string[], snapshot: MockSnapshot, eye: Eye,
  now = new Date(snapshot.updatedAt),
) => {
  try {
    const allowed = parameterKeys.filter(key => expressionParameterKeys.includes(key));
    const tree = parseExpression(expression, allowed);
    const result = evaluateArithmetic(tree, key => parameterValue(snapshot, eye, key, now));
    return result === undefined ? undefined : Number(result.toFixed(2));
  } catch { return undefined; }
};

export const buildExpressionPreview = (expression: string, parameterKeys: string[]) =>
  parameterKeys.reduce((current, key) => current.replace(new RegExp(`\\b${key}\\b`, "g"), expressionParameterLabel(key)), expression);

export const tokenizeExpression = (expression: string) => {
  try { return expressionTokens(expression); } catch { return []; }
};

export const appendExpressionToken = (expression: string, token: string) =>
  [...tokenizeExpression(expression), token].join(" ").trim();

export const removeLastExpressionToken = (expression: string) =>
  tokenizeExpression(expression).slice(0, -1).join(" ");

export const referencedExpressionParameters = (expression: string) =>
  Array.from(new Set(tokenizeExpression(expression).filter((token) => expressionParameterKeys.includes(token))));

export const functionTokenTemplates = [
  "ABS ( )",
  "PCT_CHANGE ( , )",
  "AVG ( , )",
  "MIN ( , )",
  "MAX ( , )",
  "CLAMP ( , , )",
] as const;

export const validateExpressionSyntax = (expression: string, parameterKeys: string[]): { valid: boolean; reason: "empty" | "characters" | "syntax" | "ok" } => {
  if (!expression.trim()) return { valid: false, reason: "empty" as const };
  try {
    parseExpression(expression, parameterKeys.filter(key => expressionParameterKeys.includes(key)));
    return { valid: true, reason: "ok" as const };
  } catch { return { valid: false, reason: "syntax" as const }; }
};

export const pctChangeFromSeries = (series?: number[], lookback = 20) => {
  const current = latestFinite(series);
  const base = series?.at(-(lookback + 1));
  const value = pctChange(current, base);
  return value !== undefined ? Number(value.toFixed(2)) : undefined;
};
