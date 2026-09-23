import type { Evaluation, Recipe, VisualEvidenceCard } from "../types";
import { localizedEyeState } from "./i18n";
import type { AppLanguage } from "./preferences";

const generatedQualitySuffix = " Partial confidence due to missing or stale inputs.";

export const localizedEvidenceFamily = (
  language: AppLanguage,
  family: VisualEvidenceCard["family"],
) => {
  if (language !== "ko") return family;
  switch (family) {
    case "Price Damage": return "가격 훼손";
    case "Trend & Stabilization": return "추세·안정화";
    case "Relative Strength": return "상대 강도";
    case "Volume & Volatility": return "거래량·변동성";
    case "Valuation": return "밸류에이션";
    case "Financial Quality": return "재무 건전성";
    case "Debt / Balance Sheet Risk": return "부채·재무구조 위험";
    case "Earnings & Events": return "실적·이벤트";
    case "News & Thesis Risk": return "뉴스·논리 위험";
    case "Sector & Market Context": return "섹터·시장 맥락";
    case "User Thesis Match": return "사용자 투자 논리 일치";
    case "Recipe Condition Map": return "레시피 조건 지도";
    case "Data Quality": return "데이터 품질";
    case "Risk Controls": return "위험 통제";
  }
};

export const localizedEvaluationWhyNow = (
  language: AppLanguage,
  evaluation?: Evaluation,
  recipe?: Recipe,
) => {
  if (!evaluation || language !== "ko" || !recipe) return evaluation?.whyNow ?? "";

  const version = evaluation.recipeVersion ?? recipe.version;
  const currentVersionName = `${recipe.name} v${version}`;
  const generatedWhyNow = evaluation.stateChanged
    ? `${currentVersionName} changed from ${evaluation.previousState} to ${evaluation.currentState} because the recipe's evidence, timing, and risk roles evaluated differently on the latest snapshot.`
    : `${currentVersionName} remains ${evaluation.currentState} because the current condition mix is materially unchanged.`;
  if (evaluation.whyNow !== generatedWhyNow) return evaluation.whyNow;

  if (evaluation.stateChanged) {
    return `${recipe.name} v${version}: 상태가 ${localizedEyeState(language, evaluation.previousState)}에서 ${localizedEyeState(language, evaluation.currentState)}(으)로 변경되었습니다. 최신 스냅샷에서 레시피의 근거·타이밍·위험 조건 평가가 달라졌습니다.`;
  }
  return `${recipe.name} v${version}: ${localizedEyeState(language, evaluation.currentState)} 상태를 유지합니다. 현재 조건 구성에 큰 변화가 없습니다.`;
};

export const localizedEvaluationDataQuality = (language: AppLanguage, value?: string | null) => {
  if (!value || language !== "ko") return value ?? "";
  const prefix = value.startsWith("Mock-backed snapshot from ")
    ? "Mock-backed snapshot from "
    : value.startsWith("Provider-backed snapshot from ")
      ? "Provider-backed snapshot from "
      : undefined;
  if (!prefix) return value;

  const partial = value.endsWith(generatedQualitySuffix);
  const qualityText = partial ? value.slice(0, -generatedQualitySuffix.length) : value;
  const sourceName = qualityText.slice(prefix.length).replace(/\.$/, "");
  const sourceType = prefix.startsWith("Mock") ? "모의 데이터" : "제공자 데이터";
  return `${sourceType} 스냅샷 · 데이터 원천: ${sourceName}.${partial ? " 누락되었거나 오래된 입력이 있어 신뢰도가 일부 제한됩니다." : ""}`;
};

const localizedMetricLabels: Record<string, string> = {
  revenue_growth_yoy: "매출 성장률",
  margin_change_pct: "마진 변화",
  drawdown_from_recent_high: "최근 고점 대비 하락률",
  distance_from_ma_50: "50일 이동평균 대비 거리",
  relative_strength_vs_spy: "SPY 대비 상대 강도",
  volume_spike: "거래량 급증",
  stabilization_score: "안정화 점수",
  valuation_discount: "밸류에이션 할인",
  debt_risk_level: "부채 위험 수준",
  earnings_soon: "실적 발표 임박",
  price_inside_entry_zone: "계획 진입 구간 내 가격",
  days_since_last_review: "마지막 검토 후 경과일",
};

const localizedFreshness = (value: string) => {
  switch (value.toLowerCase()) {
    case "fresh": return "최신";
    case "delayed": return "지연";
    case "stale": return "오래됨";
    case "partial": return "일부";
    case "unavailable": return "사용 불가";
    default: return undefined;
  }
};

export const localizedEvaluationDiagnostics = (language: AppLanguage, evaluation?: Evaluation) => {
  const missingData = evaluation?.missingData ?? [];
  const staleData = evaluation?.staleData ?? [];
  if (!evaluation || language !== "ko") return { missingData, staleData };

  const missingResults = evaluation.conditionResults?.filter((result) => result.missingData) ?? [];
  return {
    missingData: missingData.map((_, index) => {
      const result = missingResults[index];
      if (!result) return "필요한 입력 데이터가 누락되었습니다.";
      const metric = result.metricKey
        ? localizedMetricLabels[result.metricKey] ?? result.metricKey
        : "조건";
      const formula = result.formulaKey ? ` (계산식 ${result.formulaKey})` : "";
      return `${metric} 입력값이 누락되었습니다${formula}.`;
    }),
    staleData: staleData.map((item) => {
      const match = item.match(/^Snapshot freshness is (Fresh|Delayed|Stale|Partial|Unavailable)\.$/i);
      const freshness = match ? localizedFreshness(match[1]!) : undefined;
      return freshness ? `스냅샷 최신성: ${freshness}.` : item;
    }),
  };
};
