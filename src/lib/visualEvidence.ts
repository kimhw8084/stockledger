import {
  ConditionEvaluationResult,
  Eye,
  Evaluation,
  FreshnessStatus,
  MockSnapshot,
  Recipe,
  Stock,
  VisualEvidenceCard,
  VisualEvidenceGroup,
} from "../types";
import { getFormulaDefinition, getMetricDefinition } from "./metricCatalog";
import { AppLanguage } from "./preferences";

const asNumber = (value: unknown) => (typeof value === "number" ? value : undefined);
const asBoolean = (value: unknown) => (typeof value === "boolean" ? value : undefined);

const familyForMetric = (metricKey?: string): VisualEvidenceCard["family"] => {
  switch (metricKey) {
    case "drawdown_from_recent_high":
      return "Price Damage";
    case "stabilization_score":
    case "near_support":
    case "distance_from_ma_50":
      return "Trend & Stabilization";
    case "relative_strength_vs_spy":
      return "Relative Strength";
    case "volume_spike":
      return "Volume & Volatility";
    case "valuation_discount":
      return "Valuation";
    case "revenue_growth_yoy":
    case "margin_change_pct":
      return "Financial Quality";
    case "debt_risk_level":
      return "Debt / Balance Sheet Risk";
    case "earnings_soon":
      return "Earnings & Events";
    case "manual_flag_present":
      return "News & Thesis Risk";
    case "price_inside_entry_zone":
    case "days_since_last_review":
      return "User Thesis Match";
    default:
      return "Data Quality";
  }
};

const sourceTypeForMetric = (metricKey: string | undefined, snapshot: MockSnapshot): VisualEvidenceCard["sourceType"] => {
  if (metricKey === "price_inside_entry_zone" || metricKey === "manual_flag_present") {
    return "Manual Input";
  }
  return snapshot.isMock ? "Mock Adapter" : "Provider Adapter";
};

const statusFromResult = (
  result: ConditionEvaluationResult,
  snapshot: MockSnapshot,
): VisualEvidenceCard["status"] => {
  if (result.missingData) {
    return snapshot.freshness === "Unavailable" ? "Unavailable" : "Partial";
  }
  if (snapshot.freshness === "Stale") return "Stale";
  if (result.role === "Hard Disqualifier" && result.passed) return "Blocked";
  if (result.role === "Risk Warning" && result.passed) return "Warning";
  if (!result.passed && typeof result.actualValue === "number" && typeof result.expectedValue === "number") {
    const gap = Math.abs(result.actualValue - result.expectedValue);
    const scale = Math.max(Math.abs(result.expectedValue), 1);
    if (gap / scale <= 0.12) return "Near Trigger";
  }
  return result.passed ? "Passed" : "Failed";
};

const freshnessForCard = (snapshot: MockSnapshot): FreshnessStatus =>
  snapshot.isMock ? "Mock Data" : snapshot.freshness;

const formatMetricValue = (value: unknown, metricKey?: string) => {
  if (value === undefined) return "Unavailable";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value;
  if (typeof value !== "number") return `${value}`;

  switch (metricKey) {
    case "drawdown_from_recent_high":
    case "distance_from_ma_50":
    case "relative_strength_vs_spy":
    case "revenue_growth_yoy":
      return `${value.toFixed(1)}%`;
    case "margin_change_pct":
      return `${value.toFixed(1)} pts`;
    case "stabilization_score":
      return `${value.toFixed(0)} / 100`;
    case "days_since_last_review":
      return `${value.toFixed(0)} days`;
    default:
      return `${value}`;
  }
};

const formatThresholdValue = (value: unknown, metricKey?: string) => {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return `${value[0]} to ${value[1]}`;
  if (typeof value !== "number") return `${value}`;

  switch (metricKey) {
    case "drawdown_from_recent_high":
    case "distance_from_ma_50":
    case "relative_strength_vs_spy":
    case "revenue_growth_yoy":
      return `${value.toFixed(1)}%`;
    case "margin_change_pct":
      return `${value.toFixed(1)} pts`;
    case "stabilization_score":
      return `${value.toFixed(0)} / 100`;
    case "days_since_last_review":
      return `${value.toFixed(0)} days`;
    default:
      return `${value}`;
  }
};

const effectFromResult = (result: ConditionEvaluationResult) => {
  if (result.role === "Hard Disqualifier") {
    return result.passed ? "Blocks the setup and can force Thesis Broken." : "No hard stop triggered.";
  }
  if (result.role === "Risk Warning") {
    return result.passed ? "Adds downgrade pressure and can lift thesis risk." : "No active downgrade from this rule.";
  }
  if (result.role === "Timing Trigger") {
    return result.passed ? "Adds timing confirmation toward an urgent review." : "Timing confirmation is still missing.";
  }
  if (result.role === "Eligibility Filter") {
    return result.passed ? "Keeps the stock eligible for this recipe." : "This stock is not fully eligible yet.";
  }
  return result.passed ? "Adds supporting evidence to the setup." : "Support from this condition is still absent.";
};

const whyItMattersFromMetric = (metricKey?: string) => {
  return (
    getMetricDefinition(metricKey)?.humanMeaning ??
    "This condition affects whether the setup looks more interesting, more risky, or fully blocked."
  );
};

const visualForResult = (
  result: ConditionEvaluationResult,
  eye: Eye,
  snapshot: MockSnapshot,
): VisualEvidenceCard["visual"] => {
  const priceSeries = buildMiniSeries(snapshot.price, snapshot.drawdownPct, snapshot.stabilizationScore);

  switch (result.metricKey) {
    case "drawdown_from_recent_high":
      return {
        kind: "threshold_bar",
        min: -50,
        max: 0,
        current: asNumber(result.actualValue),
        threshold: asNumber(result.expectedValue),
        markerLabel: "52W drawdown",
        series: priceSeries,
      };
    case "distance_from_ma_50":
      return {
        kind: "comparison_bar",
        min: -25,
        max: 25,
        current: asNumber(result.actualValue),
        threshold: asNumber(result.expectedValue),
        markerLabel: "vs 50D MA",
        series: priceSeries,
        secondarySeries: buildMovingAverageSeries(priceSeries, 0.45),
        tertiarySeries: buildMovingAverageSeries(priceSeries, 0.28),
      };
    case "relative_strength_vs_spy":
      return {
        kind: "comparison_bar",
        min: -25,
        max: 25,
        current: asNumber(result.actualValue),
        threshold: asNumber(result.expectedValue),
        markerLabel: "vs SPY",
        series: buildComparisonSeries(asNumber(result.actualValue) ?? 0),
        secondarySeries: buildComparisonSeries(0),
      };
    case "stabilization_score":
      return {
        kind: "threshold_bar",
        min: 0,
        max: 100,
        current: asNumber(result.actualValue),
        threshold: asNumber(result.expectedValue),
        markerLabel: "Cooling score",
      };
    case "price_inside_entry_zone":
      return {
        kind: "entry_zone",
        current: snapshot.price,
        low: eye.plannedEntryLow ?? snapshot.plannedEntryLow,
        high: eye.plannedEntryHigh ?? snapshot.plannedEntryHigh,
        markerLabel: "Entry zone",
      };
    case "manual_flag_present":
    case "near_support":
    case "valuation_discount":
    case "earnings_soon":
      return {
        kind: "binary",
        current: asBoolean(result.actualValue) ? 1 : 0,
        threshold: asBoolean(result.expectedValue) ? 1 : 0,
      };
    default:
      return {
        kind: "freshness",
      };
  }
};

const buildConditionCard = (
  result: ConditionEvaluationResult,
  eye: Eye,
  recipe: Recipe,
  snapshot: MockSnapshot,
): VisualEvidenceCard => {
  const metric = getMetricDefinition(result.metricKey);
  const formula = getFormulaDefinition(result.formulaKey);
  const freshness = freshnessForCard(snapshot);
  const thresholdLabel =
    result.metricKey === "price_inside_entry_zone" && eye.plannedEntryLow !== undefined && eye.plannedEntryHigh !== undefined
      ? `$${eye.plannedEntryLow.toFixed(2)} to $${eye.plannedEntryHigh.toFixed(2)}`
      : formatThresholdValue(result.expectedValue, result.metricKey);

  return {
    id: result.conditionId,
    family: familyForMetric(result.metricKey),
    title: metric?.name ?? result.metricKey ?? "Condition",
    role: result.role,
    status: statusFromResult(result, snapshot),
    summary: result.explanation,
    effect: effectFromResult(result),
    whyItMatters: whyItMattersFromMetric(result.metricKey),
    freshness,
    sourceType: sourceTypeForMetric(result.metricKey, snapshot),
    relatedConditionLabel: result.explanation,
    metric: {
      currentLabel:
        result.metricKey === "price_inside_entry_zone"
          ? `$${snapshot.price.toFixed(2)} now`
          : formatMetricValue(result.actualValue, result.metricKey),
      thresholdLabel,
      comparisonLabel: recipe.name,
    },
    formulaName: formula?.name,
    formulaDescription: formula?.description,
    formulaInputs: metric?.requiredData,
    visual: visualForResult(result, eye, snapshot),
  };
};

export const buildFreshnessCard = (
  snapshot: MockSnapshot,
  evaluation: Evaluation,
): VisualEvidenceCard => ({
  id: `freshness-${snapshot.stockId}`,
  family: "Data Quality",
  title: "Data freshness and source status",
  role: "Data Quality",
  status:
    snapshot.isMock
      ? "Mock"
      : snapshot.freshness === "Stale"
        ? "Stale"
        : snapshot.freshness === "Unavailable"
          ? "Unavailable"
          : snapshot.freshness === "Partial"
            ? "Partial"
            : "Passed",
  summary: evaluation.dataQuality,
  effect:
    evaluation.missingData.length > 0 || evaluation.staleData.length > 0
      ? "Reduce confidence and review before acting."
      : "Data quality does not materially weaken this review.",
  whyItMatters: "Fresh, complete data reduces the chance of acting on outdated or partial evidence.",
  freshness: freshnessForCard(snapshot),
  sourceType: snapshot.isMock ? "Mock Adapter" : "Provider Adapter",
  metric: {
    currentLabel: formatMetricValue(snapshot.updatedAt, undefined),
    thresholdLabel: snapshot.sourceName,
    comparisonLabel: `${snapshot.freshness}${snapshot.isMock ? " · mock-backed" : ""}`,
  },
  formulaName: "Adapter snapshot status",
  formulaDescription: "The visual layer shows whether the evidence is fresh, stale, partial, unavailable, or mock-backed.",
  formulaInputs: ["sourceName", "updatedAt", "freshness", "isMock"],
  visual: {
    kind: "freshness",
  },
});

const groupDefinitions: Array<{
  key: VisualEvidenceGroup["key"];
  title: string;
  note: string;
  families: VisualEvidenceCard["family"][];
}> = [
  {
    key: "setup",
    title: "Setup Evidence",
    note: "What makes the stock interesting or increasingly actionable.",
    families: [
      "Price Damage",
      "Trend & Stabilization",
      "Relative Strength",
      "Volume & Volatility",
      "Valuation",
      "Financial Quality",
    ],
  },
  {
    key: "thesis",
    title: "Thesis Match",
    note: "How the stock aligns with your original plan and entry discipline.",
    families: ["User Thesis Match"],
  },
  {
    key: "risk",
    title: "Risks and Blocks",
    note: "What downgrades or blocks the setup right now.",
    families: ["Debt / Balance Sheet Risk", "Earnings & Events", "News & Thesis Risk"],
  },
  {
    key: "quality",
    title: "Data Quality",
    note: "Whether the evidence is fresh, complete, and trustworthy enough to lean on.",
    families: ["Data Quality"],
  },
];

export const buildEvidenceGroups = ({
  eye,
  recipe,
  snapshot,
  evaluation,
}: {
  eye: Eye;
  recipe: Recipe;
  snapshot: MockSnapshot;
  evaluation: Evaluation;
}): VisualEvidenceGroup[] => {
  const cards = (evaluation.conditionResults ?? []).map((result) =>
    buildConditionCard(result, eye, recipe, snapshot),
  );
  const allCards = [...cards, buildFreshnessCard(snapshot, evaluation)];

  return groupDefinitions
    .map((group) => ({
      key: group.key,
      title: group.title,
      note: group.note,
      cards: allCards.filter((card) => group.families.includes(card.family)),
    }))
    .filter((group) => group.cards.length > 0);
};

export const buildWhatChangedList = ({
  eye,
  snapshot,
  evaluation,
}: {
  eye: Eye;
  snapshot: MockSnapshot;
  evaluation: Evaluation;
}) => {
  const changed: string[] = [];
  changed.push(
    evaluation.stateChanged
      ? `State changed from ${evaluation.previousState} to ${evaluation.currentState}.`
      : `State remains ${evaluation.currentState}.`,
  );
  if (eye.lastReviewedAt) {
    changed.push(`Last thesis review was ${new Date(eye.lastReviewedAt).toLocaleDateString()}.`);
  }
  changed.push(`Snapshot updated ${new Date(snapshot.updatedAt).toLocaleString()}.`);
  if (evaluation.missingData.length > 0) {
    changed.push(`${evaluation.missingData.length} condition inputs are missing.`);
  }
  if (evaluation.staleData.length > 0) {
    changed.push(evaluation.staleData[0]);
  }
  return changed;
};

const buildMiniSeries = (price: number, drawdownPct: number, stabilizationScore: number) => {
  const values = Array.from({ length: 20 }, (_, index) => {
    const wave = Math.sin((index + 2) * 0.56) * 0.05;
    const fade = Math.abs(drawdownPct) / 220;
    const stabilityLift = stabilizationScore / 720;
    const trend = (index / 19) * 0.08;
    return price * (0.89 + wave - fade + stabilityLift + trend);
  });
  const min = Math.min(...values);
  const max = Math.max(...values);
  return values.map((value) => ((value - min) / Math.max(max - min, 1)) * 100);
};

const buildMovingAverageSeries = (series: number[], lag: number) =>
  series.map((point, index) => {
    const previous = index === 0 ? point : series[index - 1];
    return previous + (point - previous) * lag;
  });

const buildComparisonSeries = (edge: number) =>
  Array.from({ length: 16 }, (_, index) => {
    const base = index * 4.2;
    const swing = Math.sin(index * 0.65) * 4.8;
    return Math.max(6, Math.min(94, 45 + base * 0.28 + swing + edge * 1.2));
  });

const defaultFailureStatus = (snapshot: MockSnapshot): VisualEvidenceCard["status"] =>
  snapshot.freshness === "Unavailable"
    ? "Unavailable"
    : snapshot.freshness === "Partial"
      ? "Partial"
      : snapshot.freshness === "Stale"
        ? "Stale"
        : "Failed";

const cardSource = (snapshot: MockSnapshot, sourceType?: VisualEvidenceCard["sourceType"]) =>
  sourceType ?? (snapshot.isMock ? "Mock Adapter" : "Provider Adapter");

const relatedConditionForMetric = (
  metricKey: string,
  eyes: Eye[],
  recipes: Recipe[],
) => {
  for (const eye of eyes) {
    const recipe = recipes.find((item) => item.id === eye.recipeId);
    const condition = recipe?.conditions.find((item) => item.metricKey === metricKey);
    if (condition) {
      return `${recipe?.name ?? "Recipe"}: ${condition.humanDescription ?? condition.label}`;
    }
  }
  return "No active recipe condition is currently mapped to this parameter.";
};

const daysSince = (isoDate?: string) => {
  if (!isoDate) return undefined;
  const ms = new Date().getTime() - new Date(isoDate).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
};

const inferEventDays = (snapshot: MockSnapshot, stock: Stock) =>
  snapshot.earningsSoon ? ((stock.symbol.charCodeAt(0) + stock.symbol.length) % 5) + 2 : 18;

const inferSectorEdge = (snapshot: MockSnapshot) =>
  (snapshot.relativeStrengthVsSpyPct ?? 0) + (snapshot.nearSupport ? 1.2 : -0.9);

const inferMacroRisk = (snapshot: MockSnapshot, benchmark: string) => {
  const base = snapshot.earningsSoon ? 0.68 : 0.38;
  const drawdownPenalty = Math.abs(snapshot.drawdownPct) > 25 ? 0.1 : 0;
  const techPenalty = benchmark === "QQQ" ? 0.08 : 0;
  return Math.min(0.92, base + drawdownPenalty + techPenalty);
};

const statusFromRisk = (level?: string): VisualEvidenceCard["status"] => {
  switch (level) {
    case "low":
      return "Passed";
    case "medium":
      return "Warning";
    case "high":
      return "Blocked";
    default:
      return "Partial";
  }
};

const card = (input: VisualEvidenceCard): VisualEvidenceCard => input;

const localizeStockCard = ({
  card,
  language,
  stock,
  benchmark,
  lookbackLabel,
  snapshot,
  eventDays,
  thesisAge,
  entryLow,
  entryHigh,
  eyes,
}: {
  card: VisualEvidenceCard;
  language: AppLanguage;
  stock: Stock;
  benchmark: "SPY" | "QQQ" | "Sector ETF";
  lookbackLabel: "20D" | "3M" | "6M";
  snapshot: MockSnapshot;
  eventDays: number;
  thesisAge?: number;
  entryLow?: number;
  entryHigh?: number;
  eyes: Eye[];
}): VisualEvidenceCard => {
  if (language !== "ko") return card;

  if (card.id.endsWith("-drawdown")) {
    return {
      ...card,
      title: `${lookbackLabel} 기준 고점 대비 하락폭`,
      summary:
        snapshot.drawdownPct <= -25
          ? `최근 고점 대비 ${Math.abs(snapshot.drawdownPct)}% 하락해, 의미 있는 가격 훼손 구간으로 볼 수 있습니다.`
          : `최근 고점 대비 ${Math.abs(snapshot.drawdownPct)}% 하락했지만, 아직 충분한 매력 구간으로 보긴 이릅니다.`,
      effect:
        snapshot.drawdownPct <= -25
          ? "눌림목·저평가형 레시피에 가격 왜곡 근거를 더해줍니다."
          : "하락폭만으로는 아직 우선순위를 높이기 어렵습니다.",
      whyItMatters: "의미 있는 하락은 기회의 출발점이지만, 결국 품질과 타이밍이 함께 맞아야 합니다.",
      formulaName: `${lookbackLabel} 기준 하락폭`,
      formulaDescription: "현재 가격을 선택한 기간의 기준 고점과 비교해 얼마나 밀렸는지 계산합니다.",
      metric: {
        ...card.metric,
        comparisonLabel: `현재가 vs ${lookbackLabel} 고점`,
      },
    };
  }

  if (card.id.endsWith("-trend")) {
    return {
      ...card,
      title: "이동평균 회복",
      summary:
        (snapshot.movingAverage50DistancePct ?? -99) >= 0
          ? `가격이 50일선 위로 ${(snapshot.movingAverage50DistancePct ?? 0).toFixed(1)}% 다시 올라왔습니다.`
          : `가격이 50일선 대비 ${(snapshot.movingAverage50DistancePct ?? 0).toFixed(1)}% 수준이라, 타이밍 확인은 아직 부족합니다.`,
      effect:
        (snapshot.movingAverage50DistancePct ?? -99) >= 0
          ? "검토 우선순위를 높일 수 있는 타이밍 근거를 더합니다."
          : "추세 회복이 더 확인돼야 우선순위를 높일 수 있습니다.",
      whyItMatters: "가격이 하락 기준선 아래에만 머물지 않을 때 안정화 신호의 신뢰도가 높아집니다.",
      formulaName: "50일선 대비 거리",
      formulaDescription: "현재 가격이 50일 이동평균선보다 위인지 아래인지와 그 거리를 계산합니다.",
      metric: {
        ...card.metric,
        comparisonLabel: "20일 / 50일 / 200일선",
      },
    };
  }

  if (card.id.endsWith("-trend-stack")) {
    return {
      ...card,
      title: "20일·50일·200일 추세 스택",
      summary: `20일 ${(snapshot.movingAverage20DistancePct ?? 0).toFixed(1)}%, 50일 ${(snapshot.movingAverage50DistancePct ?? 0).toFixed(1)}%, 200일 ${(snapshot.movingAverage200DistancePct ?? 0).toFixed(1)}%입니다.`,
      effect:
        (snapshot.movingAverage20DistancePct ?? -99) >= 0 && (snapshot.movingAverage50DistancePct ?? -99) >= 0
          ? "추세 정렬이 더 깔끔해지고 있음을 보여줍니다."
          : "장단기 추세 정렬이 아직 섞여 있습니다.",
      whyItMatters: "단기·중기 기준선을 함께 회복하는 종목이 단순 반등보다 더 신뢰하기 쉽습니다.",
      formulaName: "이동평균 스택",
      formulaDescription: "20일, 50일, 200일 이동평균선 대비 위치를 한 번에 보여줍니다.",
      metric: {
        ...card.metric,
        thresholdLabel: "20일·50일선 0% 이상",
        comparisonLabel: "20일 / 50일 / 200일",
      },
    };
  }

  if (card.id.endsWith("-relative-strength")) {
    return {
      ...card,
      title: `${benchmark} 대비 상대 강도`,
      summary:
        (snapshot.relativeStrengthVsSpyPct ?? -99) >= 0
          ? `${stock.symbol}이 선택한 기간 동안 ${benchmark}보다 강합니다.`
          : `${stock.symbol}이 ${benchmark}보다 약해, 타이밍 개선이 아직 선명하지 않습니다.`,
      effect:
        (snapshot.relativeStrengthVsSpyPct ?? -99) >= 0
          ? "매도 압력이 완화되고 있다는 해석을 뒷받침합니다."
          : "상대 강도가 약하면 구도가 더 깨끗해 보이기 어렵습니다.",
      whyItMatters: "상대 강도 개선은 시장 전반의 신뢰가 돌아오기 전에 먼저 나타나는 경우가 많습니다.",
      formulaName: "벤치마크 대비 상대 강도",
      formulaDescription: "선택한 기간의 종목 수익률에서 같은 기간 벤치마크 수익률을 뺀 값입니다.",
      metric: {
        ...card.metric,
        comparisonLabel: `${lookbackLabel} vs ${benchmark}`,
      },
    };
  }

  if (card.id.endsWith("-volume-volatility")) {
    return {
      ...card,
      title: "거래량·변동성 진정",
      summary: snapshot.volumeSpike
        ? "최근 거래량이 아직 과열 구간이라 공포 매도가 완전히 끝나지 않았을 수 있습니다."
        : `안정화 점수 ${snapshot.stabilizationScore}/100이며 거래량 급증이 없어 진정 신호를 뒷받침합니다.`,
      effect: snapshot.volumeSpike
        ? "깔끔한 리셋으로 보기엔 아직 조심해야 합니다."
        : "강제 매도 압력이 둔화되고 있다는 해석에 힘을 보탭니다.",
      whyItMatters: "급락 구도는 거래량과 변동성이 함께 진정될수록 활용 가능성이 높아집니다.",
      formulaName: "거래량 급증·안정화 프록시",
      formulaDescription: "비정상 거래량과 안정화 점수를 묶어 매도 압력 진정 여부를 보여줍니다.",
      metric: {
        ...card.metric,
        currentLabel: snapshot.volumeSpike ? "거래량 급증" : `${snapshot.stabilizationScore}/100 안정화`,
        thresholdLabel: "급증 없음 + 60/100 이상",
        comparisonLabel: "거래량 vs 평균치",
      },
    };
  }

  if (card.id.endsWith("-volatility-compression")) {
    return {
      ...card,
      title: "변동성 압축",
      summary:
        snapshot.volatilityCompression === true
          ? `최근 일평균 변동폭이 ${(snapshot.averageRangePct ?? 0).toFixed(2)}% 수준으로 줄어들었습니다.`
          : `최근 일평균 변동폭이 ${(snapshot.averageRangePct ?? 0).toFixed(2)}%로 아직 충분히 차분하진 않습니다.`,
      effect:
        snapshot.volatilityCompression === true
          ? "공포 구간이 진정되고 있다는 해석을 지지합니다."
          : "타이밍이 완전히 정돈돼 보이진 않습니다.",
      whyItMatters: "급락 이후 일중 변동폭이 줄어들기 시작하면 구도의 질이 더 좋아지는 경우가 많습니다.",
      formulaName: "변동폭 압축",
      formulaDescription: "최근 일중 변동폭이 과거 평균보다 줄어드는지 확인합니다.",
      metric: {
        ...card.metric,
        thresholdLabel: "압축 신호 활성",
        comparisonLabel: "최근 일일 변동폭",
      },
    };
  }

  if (card.id.endsWith("-valuation")) {
    return {
      ...card,
      title: "자기 역사 대비 밸류 할인",
      summary: snapshot.valuationDiscount
        ? "과거 자기 밸류 구간보다 더 싸게 보입니다."
        : "아직 과거 자기 기준 대비 충분히 싸다고 보긴 어렵습니다.",
      effect: snapshot.valuationDiscount
        ? "밸류만으로 충분하진 않지만 저평가 근거를 더합니다."
        : "저평가 논리를 더 강하게 만들지는 못합니다.",
      whyItMatters: "일시적 가격 왜곡을 노리는 레시피라면 예전보다 싸 보이는 구간이어야 합니다.",
      formulaName: "밸류 할인",
      formulaDescription: "현재 밸류 프록시가 자기 과거 중간값보다 낮은지 보여줍니다.",
      metric: {
        ...card.metric,
        currentLabel: snapshot.valuationDiscount ? "과거 대비 할인" : "과거와 유사",
        thresholdLabel: "할인 상태",
        comparisonLabel: "현재 vs 과거 중간값",
      },
    };
  }

  if (card.id.endsWith("-quality")) {
    return {
      ...card,
      title: "기초 체력 점검",
      summary: `매출 성장률은 ${(snapshot.revenueGrowthYoY ?? 0).toFixed(1)}%, 마진 변화는 ${(snapshot.marginChangePct ?? 0).toFixed(1)}pt입니다.`,
      effect:
        (snapshot.revenueGrowthYoY ?? -99) >= 0 && (snapshot.marginChangePct ?? -99) > -3
          ? "이번 하락이 구조적 붕괴보다 일시적일 수 있다는 쪽에 무게를 실어줍니다."
          : "사업 체력이 약하면 가치 함정 위험이 커집니다.",
      whyItMatters: "사업 자체가 빠르게 악화된다면 하락폭의 의미는 크게 줄어듭니다.",
      formulaName: "기초 체력 체크",
      formulaDescription: "매출 흐름, 마진 변화, 애널리스트 흐름을 묶어 간단한 사업 건강도를 보여줍니다.",
      metric: {
        ...card.metric,
        thresholdLabel: "매출 0% 이상, 마진 -3pt 초과",
        comparisonLabel: "최근 영업 흐름",
      },
    };
  }

  if (card.id.endsWith("-debt")) {
    return {
      ...card,
      title: "부채·재무구조 위험",
      summary: `현재 부채 위험 추정치는 ${snapshot.debtRiskLevel ?? "확인 불가"} 수준입니다.`,
      effect:
        snapshot.debtRiskLevel === "high"
          ? "이 구도를 차단하거나 크게 낮출 수 있습니다."
          : snapshot.debtRiskLevel === "medium"
            ? "재무구조를 더 깊게 확인해야 합니다."
            : "현재로서는 부채가 핵심 문제처럼 보이진 않습니다.",
      whyItMatters: "레버리지가 크면 싼 종목이 계속 싼 상태로 남을 수 있습니다.",
      formulaName: "부채 위험 프록시",
      formulaDescription: "실제 재무 지표 전 단계로 단순화한 부채 위험 수준을 보여줍니다.",
      metric: {
        ...card.metric,
        currentLabel:
          snapshot.debtRiskLevel === "low"
            ? "낮음"
            : snapshot.debtRiskLevel === "medium"
              ? "보통"
              : snapshot.debtRiskLevel === "high"
                ? "높음"
                : "확인 불가",
        thresholdLabel: "낮음~보통",
        comparisonLabel: "현금 vs 부채 프록시",
      },
    };
  }

  if (card.id.endsWith("-earnings")) {
    return {
      ...card,
      title: "실적 이벤트 근접도",
      summary:
        eventDays <= 7
          ? `실적 발표가 ${eventDays}일 안쪽으로 보여 타이밍 위험이 높습니다.`
          : "향후 일주일 안에 큰 이벤트 압력은 크지 않습니다.",
      effect: eventDays <= 7
        ? "이벤트 하나로 타이밍이 크게 흔들릴 수 있어 더 조심해야 합니다."
        : "지금은 이벤트 타이밍이 핵심 문제는 아닙니다.",
      whyItMatters: "구도가 좋아 보여도 대형 이벤트가 너무 가까우면 행동 난도가 급격히 올라갑니다.",
      formulaName: "실적 카운트다운",
      formulaDescription: "실적 이벤트가 얼마나 가까운지 일수 기준으로 보여줍니다.",
      metric: {
        ...card.metric,
        thresholdLabel: "7일 이상 여유",
        comparisonLabel: "다가오는 이벤트 창",
      },
    };
  }

  if (card.id.endsWith("-news-risk")) {
    return {
      ...card,
      title: "뉴스·논리 훼손 위험",
      summary:
        snapshot.riskFlags.length === 0
          ? "현재 기준으로 논리를 직접 훼손하는 위험 플래그는 없습니다."
          : `현재 활성 위험 플래그: ${snapshot.riskFlags.join(", ")}.`,
      effect:
        snapshot.riskFlags.length === 0
          ? "현재 플래그만 보면 뉴스 때문에 논리가 깨졌다고 보이진 않습니다."
          : "피해가 일시적인지 구조적인지 더 따져볼 필요가 있습니다.",
      whyItMatters: "과민 반응 구도는 뉴스가 실제로 논리를 깨지 않을 때만 유효합니다.",
      formulaName: "논리 위험 플래그",
      formulaDescription: "수동 플래그와 뉴스 위험 단서를 묶어 논리 훼손 가능성을 보여줍니다.",
      metric: {
        ...card.metric,
        currentLabel: snapshot.riskFlags.length === 0 ? "활성 플래그 없음" : `${snapshot.riskFlags.length}개 활성`,
        thresholdLabel: "강한 위험 없음",
        comparisonLabel: "뉴스 / 수동 플래그",
      },
    };
  }

  if (card.id.endsWith("-sector-context")) {
    return {
      ...card,
      title: "섹터 맥락",
      summary:
        inferSectorEdge(snapshot) >= 0
          ? "섹터가 더 이상 이 구도를 강하게 방해하진 않습니다."
          : "현재 타이밍 기준으로는 주변 섹터가 아직 이상적이진 않습니다.",
      effect:
        inferSectorEdge(snapshot) >= 0
          ? "다른 근거가 좋아질 때 종목이 움직일 여지를 넓혀줍니다."
          : "약한 섹터 맥락은 후속 흐름을 어렵게 만듭니다.",
      whyItMatters: "약한 업종 안에서도 상대적으로 더 강한 종목은 더 자세히 볼 가치가 있습니다.",
      formulaName: "섹터 상대 맥락",
      formulaDescription: "종목이 섹터 환경 안에서 상대적으로 버티는지 여부를 보여줍니다.",
      metric: {
        ...card.metric,
        thresholdLabel: "0.0pt 이상",
        comparisonLabel: `${stock.symbol} vs 섹터 ETF`,
      },
    };
  }

  if (card.id.endsWith("-support-behavior")) {
    return {
      ...card,
      title: "지지 구간 반응",
      summary: snapshot.nearSupport
        ? "가격이 지지 구간 근처에서 반응하고 있어 무너짐보다 버팀에 가깝습니다."
        : "가격이 아직 의미 있는 지지 구간에서 반응하는 모습은 약합니다.",
      effect: snapshot.nearSupport
        ? "하락이 일방향으로 이어지지 않고 있다는 근거를 보탭니다."
        : "지지 확인 전까지는 성급한 해석을 줄여야 합니다.",
      whyItMatters: "지지 부근에서의 반응은 단순 낙폭보다 더 빠르게 수급 변화를 보여줄 수 있습니다.",
      formulaName: "지지 구간 반응",
      formulaDescription: "가격이 지지 구간 근처에서 버티거나 반응하는지 여부를 보여줍니다.",
      metric: {
        ...card.metric,
        currentLabel: snapshot.nearSupport ? "지지 구간 반응" : "지지 확인 필요",
        thresholdLabel: "지지 구간 반응",
        comparisonLabel: "현재가 vs 지지 구간",
      },
    };
  }

  if (card.id.endsWith("-entry-zone")) {
    return {
      ...card,
      title: "기존 진입 구간 일치",
      summary:
        entryLow !== undefined && entryHigh !== undefined
          ? snapshot.price >= entryLow && snapshot.price <= entryHigh
            ? "가격이 원래 계획한 검토 구간 안에 들어와 있습니다."
            : "가격이 원래 검토 구간 밖에 있어 처음 계획과 달라졌을 수 있습니다."
          : "이 종목에는 아직 뚜렷한 진입 구간이 기록되지 않았습니다.",
      effect:
        entryLow !== undefined && entryHigh !== undefined && snapshot.price >= entryLow && snapshot.price <= entryHigh
          ? "원래 주목하려던 가격대로 다시 들어왔다는 점을 확인해 줍니다."
          : "구간이 맞지 않으면 행동보다 논리 수정이 먼저일 수 있습니다.",
      whyItMatters: "진입 기준을 지키면 좋은 아이디어가 끝없이 움직이는 목표가 되는 걸 막을 수 있습니다.",
      formulaName: "진입 구간 일치",
      formulaDescription: "현재 가격이 사용자가 정한 진입 구간 안에 들어왔는지 확인합니다.",
      metric: {
        ...card.metric,
        thresholdLabel:
          entryLow !== undefined && entryHigh !== undefined
            ? `$${entryLow.toFixed(2)} ~ $${entryHigh.toFixed(2)}`
            : "진입 구간 추가 필요",
        comparisonLabel: eyes[0]?.invalidationRule ? `훼손 기준: ${eyes[0].invalidationRule}` : "훼손 기준 미기록",
      },
    };
  }

  if (card.id.endsWith("-thesis-age")) {
    return {
      ...card,
      title: "논리 검토 최신성",
      summary:
        thesisAge === undefined
          ? "논리 검토 날짜가 아직 기록되지 않았습니다."
          : `마지막 논리 검토는 ${thesisAge}일 전입니다.`,
      effect:
        thesisAge === undefined || thesisAge > 30
          ? "원래 계획이 오래돼 다시 처음부터 읽어봐야 할 수 있습니다."
          : "검토 시점은 아직 비교적 최신입니다.",
      whyItMatters: "좋은 구도라도 원래 논리를 너무 오래 다시 보지 않으면 신뢰도가 떨어집니다.",
      formulaName: "논리 검토 경과일",
      formulaDescription: "마지막 논리 검토 날짜로부터 얼마나 지났는지 계산합니다.",
      metric: {
        ...card.metric,
        currentLabel: thesisAge === undefined ? "확인 불가" : `${thesisAge}일`,
        thresholdLabel: "14일 이내",
        comparisonLabel: "논리 검토 주기",
      },
    };
  }

  return card;
};

export const buildStockVisualAnalysisGroups = ({
  stock,
  snapshot,
  eyes,
  recipes,
  benchmark,
  lookbackLabel,
  language = "en",
}: {
  stock: Stock;
  snapshot: MockSnapshot;
  eyes: Eye[];
  recipes: Recipe[];
  benchmark: "SPY" | "QQQ" | "Sector ETF";
  lookbackLabel: "20D" | "3M" | "6M";
  language?: AppLanguage;
}): VisualEvidenceGroup[] => {
  const freshness = freshnessForCard(snapshot);
  const thesisAge = daysSince(eyes[0]?.lastReviewedAt ?? snapshot.lastThesisReviewAt);
  const eventDays = inferEventDays(snapshot, stock);
  const sectorEdge = inferSectorEdge(snapshot);
  const entryLow = eyes[0]?.plannedEntryLow ?? snapshot.plannedEntryLow;
  const entryHigh = eyes[0]?.plannedEntryHigh ?? snapshot.plannedEntryHigh;
  const priceSeries = snapshot.priceHistorySeries ?? buildMiniSeries(snapshot.price, snapshot.drawdownPct, snapshot.stabilizationScore);
  const rsSeries = snapshot.benchmarkHistorySeries ?? buildComparisonSeries(snapshot.relativeStrengthVsSpyPct ?? 0);
  const sectorSeries = buildComparisonSeries(sectorEdge);
  const volumeSeries = snapshot.volumeHistorySeries ?? buildComparisonSeries((snapshot.volumeSpike ? 6 : -4) + snapshot.stabilizationScore / 20);
  const volatilitySeries = snapshot.volatilityHistorySeries ?? buildComparisonSeries((snapshot.volatilityCompression ? -4 : 6) + (snapshot.averageRangePct ?? 0));

  const allCards: VisualEvidenceCard[] = [
    card({
      id: `${stock.id}-drawdown`,
      family: "Price Damage",
      title: `Drawdown from ${lookbackLabel} reference high`,
      role: "Supporting Evidence",
      status:
        snapshot.drawdownPct <= -25 ? "Passed" : snapshot.drawdownPct <= -20 ? "Near Trigger" : defaultFailureStatus(snapshot),
      summary:
        snapshot.drawdownPct <= -25
          ? `The stock is down ${Math.abs(snapshot.drawdownPct)}% from its recent high, enough to count as meaningful damage.`
          : `The stock is down ${Math.abs(snapshot.drawdownPct)}% from its recent high, which is not yet a full bargain-style selloff.`,
      effect:
        snapshot.drawdownPct <= -25
          ? "Adds mispricing evidence for pullback and bargain recipes."
          : "Price damage alone is not yet deep enough to lift urgency.",
      whyItMatters: "Meaningful selloffs create the raw opportunity window, but only if quality and timing still hold.",
      freshness,
      sourceType: cardSource(snapshot),
      relatedConditionLabel: relatedConditionForMetric("drawdown_from_recent_high", eyes, recipes),
      metric: {
        currentLabel: `${snapshot.drawdownPct.toFixed(1)}%`,
        thresholdLabel: "-25.0%",
        comparisonLabel: `Price vs ${lookbackLabel} high`,
      },
      formulaName: "Drawdown from reference high",
      formulaDescription: "Current price compared with the highest closing level across the selected lookback window.",
      formulaInputs: ["price", "historical high", "lookback window"],
      visual: {
        kind: "threshold_bar",
        min: -50,
        max: 0,
        current: snapshot.drawdownPct,
        threshold: -25,
        markerLabel: "Drawdown",
        series: priceSeries,
      },
    }),
    card({
      id: `${stock.id}-trend`,
      family: "Trend & Stabilization",
      title: "Moving-average recovery",
      role: "Timing Trigger",
      status:
        (snapshot.movingAverage50DistancePct ?? -99) >= 0
          ? "Passed"
          : (snapshot.movingAverage50DistancePct ?? -99) >= -2
            ? "Near Trigger"
            : defaultFailureStatus(snapshot),
      summary:
        (snapshot.movingAverage50DistancePct ?? -99) >= 0
          ? `Price is back above the 50-day baseline by ${(snapshot.movingAverage50DistancePct ?? 0).toFixed(1)}%.`
          : `Price is ${(snapshot.movingAverage50DistancePct ?? 0).toFixed(1)}% from the 50-day baseline, so timing confirmation is still incomplete.`,
      effect:
        (snapshot.movingAverage50DistancePct ?? -99) >= 0
          ? "Adds timing confirmation toward a closer review."
          : "Trend recovery still needs work before urgency should rise.",
      whyItMatters: "Stabilization is more useful when price stops living below a falling baseline.",
      freshness,
      sourceType: cardSource(snapshot),
      relatedConditionLabel: relatedConditionForMetric("distance_from_ma_50", eyes, recipes),
      metric: {
        currentLabel: `${(snapshot.movingAverage50DistancePct ?? 0).toFixed(1)}%`,
        thresholdLabel: "0.0%",
        comparisonLabel: "20D / 50D / 200D overlay",
      },
      formulaName: "Distance from 50-day moving average",
      formulaDescription: "Current price minus the 50-day moving average, divided by the 50-day moving average.",
      formulaInputs: ["price", "50-day MA"],
      visual: {
        kind: "comparison_bar",
        min: -20,
        max: 20,
        current: snapshot.movingAverage50DistancePct,
        threshold: 0,
        markerLabel: "vs 50D",
        series: priceSeries,
        secondarySeries: buildMovingAverageSeries(priceSeries, 0.44),
        tertiarySeries: buildMovingAverageSeries(priceSeries, 0.2),
      },
    }),
    card({
      id: `${stock.id}-trend-stack`,
      family: "Trend & Stabilization",
      title: "Trend stack vs 20D / 50D / 200D",
      role: "Timing Trigger",
      status:
        (snapshot.movingAverage20DistancePct ?? -99) >= 0 && (snapshot.movingAverage50DistancePct ?? -99) >= 0
          ? "Passed"
          : (snapshot.movingAverage20DistancePct ?? -99) >= 0 || (snapshot.movingAverage50DistancePct ?? -99) >= -2
            ? "Near Trigger"
            : defaultFailureStatus(snapshot),
      summary: `20D ${(snapshot.movingAverage20DistancePct ?? 0).toFixed(1)}%, 50D ${(snapshot.movingAverage50DistancePct ?? 0).toFixed(1)}%, 200D ${(snapshot.movingAverage200DistancePct ?? 0).toFixed(1)}%.`,
      effect:
        (snapshot.movingAverage20DistancePct ?? -99) >= 0 && (snapshot.movingAverage50DistancePct ?? -99) >= 0
          ? "Supports a cleaner stabilization stack."
          : "The longer trend stack is still mixed.",
      whyItMatters: "A stock reclaiming shorter and medium baselines often becomes easier to trust than one only bouncing intraday.",
      freshness,
      sourceType: cardSource(snapshot),
      relatedConditionLabel: "Trend stack is an additional factual readout and not yet a recipe-specific metric.",
      metric: {
        currentLabel: `${(snapshot.movingAverage20DistancePct ?? 0).toFixed(1)} / ${(snapshot.movingAverage50DistancePct ?? 0).toFixed(1)} / ${(snapshot.movingAverage200DistancePct ?? 0).toFixed(1)}%`,
        thresholdLabel: "20D and 50D >= 0%",
        comparisonLabel: "20D / 50D / 200D",
      },
      formulaName: "Moving-average stack",
      formulaDescription: "Shows how far price is from the 20-day, 50-day, and 200-day moving averages at the same time.",
      formulaInputs: ["price", "20-day MA", "50-day MA", "200-day MA"],
      visual: {
        kind: "checklist",
        items: [
          {
            label: `20D ${(snapshot.movingAverage20DistancePct ?? 0).toFixed(1)}%`,
            tone: (snapshot.movingAverage20DistancePct ?? -99) >= 0 ? "good" : "warning",
          },
          {
            label: `50D ${(snapshot.movingAverage50DistancePct ?? 0).toFixed(1)}%`,
            tone: (snapshot.movingAverage50DistancePct ?? -99) >= 0 ? "good" : (snapshot.movingAverage50DistancePct ?? -99) >= -2 ? "warning" : "danger",
          },
          {
            label: `200D ${(snapshot.movingAverage200DistancePct ?? 0).toFixed(1)}%`,
            tone: (snapshot.movingAverage200DistancePct ?? -99) >= 0 ? "good" : "neutral",
          },
        ],
      },
    }),
    card({
      id: `${stock.id}-relative-strength`,
      family: "Relative Strength",
      title: `Relative strength vs ${benchmark}`,
      role: "Timing Trigger",
      status:
        (snapshot.relativeStrengthVsSpyPct ?? -99) >= 0
          ? "Passed"
          : (snapshot.relativeStrengthVsSpyPct ?? -99) >= -2
            ? "Near Trigger"
            : defaultFailureStatus(snapshot),
      summary:
        (snapshot.relativeStrengthVsSpyPct ?? -99) >= 0
          ? `${stock.symbol} is outperforming ${benchmark} over the selected window.`
          : `${stock.symbol} is lagging ${benchmark}, so timing is not yet improving cleanly.`,
      effect:
        (snapshot.relativeStrengthVsSpyPct ?? -99) >= 0
          ? "Supports the idea that selling pressure is easing."
          : "Weak relative strength keeps the setup from feeling cleaner.",
      whyItMatters: "Improving relative strength often appears before broader confidence returns.",
      freshness,
      sourceType: cardSource(snapshot),
      relatedConditionLabel: relatedConditionForMetric("relative_strength_vs_spy", eyes, recipes),
      metric: {
        currentLabel: `${(snapshot.relativeStrengthVsSpyPct ?? 0).toFixed(1)}%`,
        thresholdLabel: "0.0%",
        comparisonLabel: `${lookbackLabel} vs ${benchmark}`,
      },
      formulaName: "Relative strength vs benchmark",
      formulaDescription: "Stock return over the selected window minus benchmark return over the same window.",
      formulaInputs: ["stock return", "benchmark return", "lookback window"],
      visual: {
        kind: "comparison_bar",
        min: -15,
        max: 15,
        current: snapshot.relativeStrengthVsSpyPct,
        threshold: 0,
        markerLabel: benchmark,
        series: rsSeries,
        secondarySeries: buildComparisonSeries(0),
      },
    }),
    card({
      id: `${stock.id}-volume-volatility`,
      family: "Volume & Volatility",
      title: "Volume and volatility cooling",
      role: "Supporting Evidence",
      status: snapshot.volumeSpike ? "Warning" : snapshot.stabilizationScore >= 60 ? "Passed" : "Near Trigger",
      summary: snapshot.volumeSpike
        ? "Recent volume still looks stressed, so panic may not be fully out of the tape yet."
        : `Stabilization is scoring ${snapshot.stabilizationScore}/100 and volume is not spiking, which supports cooling pressure.`,
      effect: snapshot.volumeSpike
        ? "Adds caution against treating this as a clean reset."
        : "Supports the idea that forced selling may be slowing.",
      whyItMatters: "Panic setups are more usable once volatility and abnormal volume begin to cool.",
      freshness,
      sourceType: cardSource(snapshot),
      relatedConditionLabel:
        relatedConditionForMetric("stabilization_score", eyes, recipes) ||
        relatedConditionForMetric("volume_spike", eyes, recipes),
      metric: {
        currentLabel: snapshot.volumeSpike ? "Volume spike active" : `${snapshot.stabilizationScore}/100 cooling`,
        thresholdLabel: "No spike + 60/100 cooling",
        comparisonLabel: "Volume vs trailing average",
      },
      formulaName: "Volume spike and stabilization proxy",
      formulaDescription: "Mock proxy combining unusual volume and a simplified stabilization score until real ATR and range data arrive.",
      formulaInputs: ["volumeSpike", "stabilizationScore"],
      visual: {
        kind: "mini_trend",
        series: volumeSeries,
        secondarySeries: buildMovingAverageSeries(volumeSeries, 0.32),
        current: snapshot.stabilizationScore,
        threshold: 60,
        markerLabel: "Cooling proxy",
      },
    }),
    card({
      id: `${stock.id}-volatility-compression`,
      family: "Volume & Volatility",
      title: "Volatility compression",
      role: "Timing Trigger",
      status:
        snapshot.volatilityCompression === true
          ? "Passed"
          : snapshot.averageRangePct !== undefined && snapshot.averageRangePct <= 2.2
            ? "Near Trigger"
            : defaultFailureStatus(snapshot),
      summary:
        snapshot.volatilityCompression === true
          ? `Recent trading range has compressed to about ${(snapshot.averageRangePct ?? 0).toFixed(2)}% per day.`
          : `Recent average range is ${(snapshot.averageRangePct ?? 0).toFixed(2)}% per day, so the tape is not yet especially calm.`,
      effect:
        snapshot.volatilityCompression === true
          ? "Supports the idea that panic is cooling."
          : "Keeps timing from looking fully settled.",
      whyItMatters: "Cleaner setups often appear once daily range starts narrowing after a sharp move.",
      freshness,
      sourceType: cardSource(snapshot),
      relatedConditionLabel: "Volatility compression is an adapter-derived factual layer and not yet a recipe-specific metric.",
      metric: {
        currentLabel: `${(snapshot.averageRangePct ?? 0).toFixed(2)}%`,
        thresholdLabel: "Compression active",
        comparisonLabel: "Recent daily range",
      },
      formulaName: "Average range compression",
      formulaDescription: "Compares the most recent daily trading ranges against the trailing baseline to see whether volatility is cooling.",
      formulaInputs: ["daily high", "daily low", "trailing range average"],
      visual: {
        kind: "mini_trend",
        series: volatilitySeries,
        secondarySeries: buildMovingAverageSeries(volatilitySeries, 0.3),
        current: snapshot.averageRangePct,
        threshold: 2.2,
        markerLabel: "Range compression",
      },
    }),
    card({
      id: `${stock.id}-valuation`,
      family: "Valuation",
      title: "Valuation discount vs own history",
      role: "Supporting Evidence",
      status: snapshot.valuationDiscount ? "Passed" : defaultFailureStatus(snapshot),
      summary: snapshot.valuationDiscount
        ? "The stock is screening cheaper than its own recent history."
        : "The stock does not yet look discounted against its own recent baseline.",
      effect: snapshot.valuationDiscount
        ? "Adds mispricing support without pretending valuation alone is enough."
        : "Keeps the bargain case from becoming stronger.",
      whyItMatters: "A stock should look cheaper than before if the recipe depends on temporary mispricing.",
      freshness,
      sourceType: cardSource(snapshot),
      relatedConditionLabel: relatedConditionForMetric("valuation_discount", eyes, recipes),
      metric: {
        currentLabel: snapshot.valuationDiscount ? "Below history" : "Near history",
        thresholdLabel: "Discount active",
        comparisonLabel: "Current vs historical median",
      },
      formulaName: "Valuation discount",
      formulaDescription: "Compares the current valuation proxy against a simplified recent historical median band.",
      formulaInputs: ["valuation proxy", "historical median"],
      visual: {
        kind: "binary",
        current: snapshot.valuationDiscount ? 1 : 0,
        threshold: 1,
      },
    }),
    card({
      id: `${stock.id}-quality`,
      family: "Financial Quality",
      title: "Financial quality check",
      role: "Eligibility Filter",
      status:
        (snapshot.revenueGrowthYoY ?? -99) >= 0 && (snapshot.marginChangePct ?? -99) > -3
          ? "Passed"
          : (snapshot.revenueGrowthYoY ?? -99) >= 0 || (snapshot.marginChangePct ?? 0) > -6
            ? "Warning"
            : defaultFailureStatus(snapshot),
      summary: `Revenue is ${(snapshot.revenueGrowthYoY ?? 0).toFixed(1)}% YoY and margin change is ${(snapshot.marginChangePct ?? 0).toFixed(1)} pts.`,
      effect:
        (snapshot.revenueGrowthYoY ?? -99) >= 0 && (snapshot.marginChangePct ?? -99) > -3
          ? "Helps argue the selloff may be temporary rather than structural."
          : "Weak business quality increases value-trap risk.",
      whyItMatters: "Price damage matters less when the business itself is deteriorating too quickly.",
      freshness,
      sourceType: cardSource(snapshot),
      relatedConditionLabel:
        `${relatedConditionForMetric("revenue_growth_yoy", eyes, recipes)} | ${relatedConditionForMetric("margin_change_pct", eyes, recipes)}`,
      metric: {
        currentLabel: `${(snapshot.revenueGrowthYoY ?? 0).toFixed(1)}% rev / ${(snapshot.marginChangePct ?? 0).toFixed(1)} pts margin`,
        thresholdLabel: "Revenue >= 0%, margin > -3 pts",
        comparisonLabel: "Recent operating trend",
      },
      formulaName: "Business quality checklist",
      formulaDescription: "Combines revenue direction and margin direction into a compact operating quality check.",
      formulaInputs: ["revenueGrowthYoY", "marginChangePct"],
      visual: {
        kind: "checklist",
        items: [
          {
            label: `Revenue growth ${(snapshot.revenueGrowthYoY ?? 0).toFixed(1)}%`,
            tone: (snapshot.revenueGrowthYoY ?? -99) >= 0 ? "good" : "danger",
          },
          {
            label: `Margin change ${(snapshot.marginChangePct ?? 0).toFixed(1)} pts`,
            tone: (snapshot.marginChangePct ?? 0) > -3 ? "good" : (snapshot.marginChangePct ?? 0) > -6 ? "warning" : "danger",
          },
        ],
      },
    }),
    card({
      id: `${stock.id}-debt`,
      family: "Debt / Balance Sheet Risk",
      title: "Debt and balance-sheet risk",
      role: "Risk Warning",
      status: statusFromRisk(snapshot.debtRiskLevel),
      summary: `Current debt-risk proxy is ${snapshot.debtRiskLevel ?? "unavailable"}.`,
      effect:
        snapshot.debtRiskLevel === "high"
          ? "Can block or sharply downgrade the setup."
          : snapshot.debtRiskLevel === "medium"
            ? "Requires closer balance-sheet review."
            : "Debt does not currently look like the main problem.",
      whyItMatters: "A cheap stock can stay cheap when leverage turns a slowdown into a balance-sheet issue.",
      freshness,
      sourceType: cardSource(snapshot),
      relatedConditionLabel: relatedConditionForMetric("debt_risk_level", eyes, recipes),
      metric: {
        currentLabel: snapshot.debtRiskLevel ?? "Unavailable",
        thresholdLabel: "Low to medium",
        comparisonLabel: "Cash vs debt proxy",
      },
      formulaName: "Debt risk proxy",
      formulaDescription: "Simplified debt-risk level until provider-backed leverage and coverage metrics are available.",
      formulaInputs: ["debtRiskLevel"],
      visual: {
        kind: "risk_gauge",
        min: 0,
        max: 100,
        current: snapshot.debtRiskLevel === "low" ? 26 : snapshot.debtRiskLevel === "medium" ? 58 : 86,
        threshold: 60,
        markerLabel: "Risk level",
      },
    }),
    card({
      id: `${stock.id}-earnings`,
      family: "Earnings & Events",
      title: "Earnings event proximity",
      role: "Risk Warning",
      status: eventDays <= 7 ? "Warning" : "Passed",
      summary:
        eventDays <= 7
          ? `Earnings are likely within ${eventDays} days, so timing risk is elevated.`
          : `No immediate earnings event is pressing inside the next week.`,
      effect: eventDays <= 7 ? "Keep the setup review tighter because event risk can invalidate timing quickly." : "Event timing is not the main issue right now.",
      whyItMatters: "A setup can look attractive and still become harder to act on when a major event is too close.",
      freshness,
      sourceType: cardSource(snapshot),
      relatedConditionLabel: relatedConditionForMetric("earnings_soon", eyes, recipes),
      metric: {
        currentLabel: `${eventDays} days`,
        thresholdLabel: "More than 7 days",
        comparisonLabel: "Upcoming event window",
      },
      formulaName: "Earnings countdown",
      formulaDescription: "Mock countdown based on the earnings-soon flag until a full event calendar is integrated.",
      formulaInputs: ["earningsSoon", "mock event calendar"],
      visual: {
        kind: "event_countdown",
        countdownDays: eventDays,
        countdownLabel: eventDays <= 7 ? "Review before event" : "No near event",
      },
    }),
    card({
      id: `${stock.id}-news-risk`,
      family: "News & Thesis Risk",
      title: "News and thesis risk",
      role: "Hard Disqualifier",
      status:
        snapshot.riskFlags.length === 0
          ? "Passed"
          : snapshot.riskFlags.some((flag) => flag.includes("accounting") || flag.includes("fraud"))
            ? "Blocked"
            : "Warning",
      summary:
        snapshot.riskFlags.length === 0
          ? "No thesis-damaging risk flags are active in the current mock feed."
          : `Active thesis-risk flags: ${snapshot.riskFlags.join(", ")}.`,
      effect:
        snapshot.riskFlags.length === 0
          ? "No headline-driven thesis break is evident from current flags."
          : "Raises the need to test whether the damage is temporary or permanent.",
      whyItMatters: "Temporary overreactions are useful only if the news is not actually breaking the thesis.",
      freshness,
      sourceType: snapshot.riskFlags.length > 0 ? "Manual Input" : cardSource(snapshot),
      relatedConditionLabel: relatedConditionForMetric("manual_flag_present", eyes, recipes),
      metric: {
        currentLabel: snapshot.riskFlags.length === 0 ? "No active flags" : `${snapshot.riskFlags.length} active`,
        thresholdLabel: "No hard disqualifier",
        comparisonLabel: "Headlines and manual flags",
      },
      formulaName: "Thesis risk flags",
      formulaDescription: "Groups manual and adapter risk flags into a visible thesis-risk review layer.",
      formulaInputs: ["riskFlags", "manual flags"],
      visual: {
        kind: "checklist",
        items:
          snapshot.riskFlags.length === 0
            ? [{ label: "No active thesis-risk flags", tone: "good" }]
            : snapshot.riskFlags.map((flag) => ({
                label: flag.replace(/_/g, " "),
                tone: flag.includes("accounting") || flag.includes("fraud") ? "danger" : "warning",
              })),
      },
    }),
    card({
      id: `${stock.id}-sector-context`,
      family: "Sector & Market Context",
      title: "Sector context",
      role: "Supporting Evidence",
      status: sectorEdge >= 0 ? "Passed" : sectorEdge >= -1.5 ? "Near Trigger" : defaultFailureStatus(snapshot),
      summary:
        sectorEdge >= 0
          ? "Sector context is no longer fighting the setup aggressively."
          : "The surrounding sector still looks weaker than ideal for this timing window.",
      effect: sectorEdge >= 0 ? "Gives the stock more room to work if other evidence is improving." : "Weak sector context makes follow-through harder.",
      whyItMatters: "A stock acting better than a weakening peer group deserves more attention than one merely moving with it.",
      freshness,
      sourceType: cardSource(snapshot),
      relatedConditionLabel: "Sector context is not yet wired to a recipe-specific metric in V1.",
      metric: {
        currentLabel: `${sectorEdge.toFixed(1)} pts`,
        thresholdLabel: "0.0 pts",
        comparisonLabel: `${stock.symbol} vs sector ETF`,
      },
      formulaName: "Sector relative context",
      formulaDescription: "Mock sector-relative view derived from the current stock strength and support behavior until sector adapters are live.",
      formulaInputs: ["relativeStrengthVsSpyPct", "nearSupport"],
      visual: {
        kind: "comparison_bar",
        min: -10,
        max: 10,
        current: sectorEdge,
        threshold: 0,
        markerLabel: "Sector",
        series: sectorSeries,
        secondarySeries: buildComparisonSeries(0.4),
      },
    }),
    card({
      id: `${stock.id}-support-behavior`,
      family: "Trend & Stabilization",
      title: "Support-zone behavior",
      role: "Supporting Evidence",
      status: snapshot.nearSupport ? "Passed" : "Near Trigger",
      summary: snapshot.nearSupport
        ? "Price is reacting near support instead of drifting away from it."
        : "Price is not yet showing a clear response near support.",
      effect: snapshot.nearSupport
        ? "Adds support for the idea that the slide is no longer one-way."
        : "Keeps the setup from looking cleaner until support behavior improves.",
      whyItMatters: "Behavior near support can reveal changing supply pressure before a broader trend fully improves.",
      freshness,
      sourceType: cardSource(snapshot),
      relatedConditionLabel: "Support behavior is a factual readout and not yet a recipe-specific metric in V1.",
      metric: {
        currentLabel: snapshot.nearSupport ? "Holding support" : "Needs support response",
        thresholdLabel: "Responding near support",
        comparisonLabel: "Current price vs support zone",
      },
      formulaName: "Support-zone behavior",
      formulaDescription: "Shows whether price is behaving like it is finding interest near support.",
      formulaInputs: ["nearSupport", "price", "drawdownPct"],
      visual: {
        kind: "binary",
        current: snapshot.nearSupport ? 1 : 0,
        threshold: 1,
        markerLabel: "Support",
      },
    }),
    card({
      id: `${stock.id}-entry-zone`,
      family: "User Thesis Match",
      title: "Original entry zone match",
      role: "Eligibility Filter",
      status:
        entryLow !== undefined && entryHigh !== undefined
          ? snapshot.price >= entryLow && snapshot.price <= entryHigh
            ? "Passed"
            : snapshot.price >= entryLow * 0.98 && snapshot.price <= entryHigh * 1.02
              ? "Near Trigger"
              : "Failed"
          : "Partial",
      summary:
        entryLow !== undefined && entryHigh !== undefined
          ? snapshot.price >= entryLow && snapshot.price <= entryHigh
            ? "Price is inside the planned review zone."
            : "Price is outside the original review zone, so the setup may not match the initial plan."
          : "No clear entry zone is recorded for this stock yet.",
      effect:
        entryLow !== undefined && entryHigh !== undefined && snapshot.price >= entryLow && snapshot.price <= entryHigh
          ? "Confirms the stock is back where you wanted to pay attention."
          : "Without zone alignment, the original thesis may need revision instead of action.",
      whyItMatters: "Entry discipline helps stop a useful idea from turning into a moving target.",
      freshness,
      sourceType: "Manual Input",
      relatedConditionLabel: relatedConditionForMetric("price_inside_entry_zone", eyes, recipes),
      metric: {
        currentLabel: `$${snapshot.price.toFixed(2)}`,
        thresholdLabel:
          entryLow !== undefined && entryHigh !== undefined
            ? `$${entryLow.toFixed(2)} to $${entryHigh.toFixed(2)}`
            : "Add an entry zone",
        comparisonLabel: eyes[0]?.invalidationRule ? `Invalidation: ${eyes[0].invalidationRule}` : "No invalidation rule recorded",
      },
      formulaName: "Price inside entry zone",
      formulaDescription: "Current price compared with the user-planned entry band recorded on the Eye.",
      formulaInputs: ["price", "plannedEntryLow", "plannedEntryHigh"],
      visual: {
        kind: "entry_zone",
        current: snapshot.price,
        low: entryLow,
        high: entryHigh,
        markerLabel: "Entry zone",
      },
    }),
    card({
      id: `${stock.id}-thesis-age`,
      family: "User Thesis Match",
      title: "Thesis review freshness",
      role: "Review Trigger",
      status:
        thesisAge === undefined
          ? "Partial"
          : thesisAge <= 14
            ? "Passed"
            : thesisAge <= 30
              ? "Warning"
              : "Stale",
      summary:
        thesisAge === undefined
          ? "No thesis review date is recorded yet."
          : `The thesis was last reviewed ${thesisAge} days ago.`,
      effect:
        thesisAge === undefined || thesisAge > 30
          ? "The original plan may be stale enough to require a clean re-read."
          : "Review timing is still reasonably current.",
      whyItMatters: "Even a good setup becomes less reliable if the original thesis has not been revisited recently.",
      freshness,
      sourceType: "Manual Input",
      relatedConditionLabel: relatedConditionForMetric("days_since_last_review", eyes, recipes),
      metric: {
        currentLabel: thesisAge === undefined ? "Unavailable" : `${thesisAge} days`,
        thresholdLabel: "<= 14 days",
        comparisonLabel: "Thesis cadence",
      },
      formulaName: "Days since thesis review",
      formulaDescription: "Current date minus the most recent thesis review timestamp recorded on the Eye.",
      formulaInputs: ["lastReviewedAt"],
      visual: {
        kind: "checklist",
        items: [
          {
            label: thesisAge === undefined ? "No thesis review date recorded" : `Last review ${thesisAge} days ago`,
            tone: thesisAge === undefined ? "warning" : thesisAge <= 14 ? "good" : thesisAge <= 30 ? "warning" : "danger",
          },
          {
            label: eyes[0]?.thesisSnapshot ?? stock.thesis,
            tone: "neutral",
          },
        ],
      },
    }),
  ];

  const stockGroups: Array<{
    key: string;
    title: string;
    note: string;
    family: VisualEvidenceCard["family"];
  }> = [
    {
      key: "price-damage",
      title: "Price Damage",
      note: "Has the stock sold off enough to become interesting at all?",
      family: "Price Damage",
    },
    {
      key: "trend",
      title: "Trend & Stabilization",
      note: "Is the slide still active, or is the setup beginning to stabilize?",
      family: "Trend & Stabilization",
    },
    {
      key: "relative-strength",
      title: "Relative Strength",
      note: "Is the stock acting better or worse than the benchmark context?",
      family: "Relative Strength",
    },
    {
      key: "volume-volatility",
      title: "Volume & Volatility",
      note: "Has panic behavior cooled enough to matter?",
      family: "Volume & Volatility",
    },
    {
      key: "valuation",
      title: "Valuation",
      note: "Does the stock actually look cheaper than before?",
      family: "Valuation",
    },
    {
      key: "financial-quality",
      title: "Financial Quality",
      note: "Does the business still look healthy enough to avoid a value trap?",
      family: "Financial Quality",
    },
    {
      key: "debt",
      title: "Debt / Balance Sheet Risk",
      note: "Can leverage or cash stress block the setup?",
      family: "Debt / Balance Sheet Risk",
    },
    {
      key: "events",
      title: "Earnings & Events",
      note: "Is an upcoming event making timing harder right now?",
      family: "Earnings & Events",
    },
    {
      key: "news-risk",
      title: "News & Thesis Risk",
      note: "Is the damage temporary panic, or something that could break the thesis?",
      family: "News & Thesis Risk",
    },
    {
      key: "sector",
      title: "Sector & Market Context",
      note: "Is the stock getting help or resistance from its environment?",
      family: "Sector & Market Context",
    },
    {
      key: "thesis",
      title: "User Thesis Match",
      note: "Does today’s setup still line up with your original plan?",
      family: "User Thesis Match",
    },
  ];

  const localizedCards = allCards.map((analysisCard) =>
    localizeStockCard({
      card: analysisCard,
      language,
      stock,
      benchmark,
      lookbackLabel,
      snapshot,
      eventDays,
      thesisAge,
      entryLow,
      entryHigh,
      eyes,
    }),
  );

  return stockGroups.map((group) => ({
    key: group.key,
    title:
      language === "ko"
        ? group.key === "price-damage"
          ? "가격 훼손"
          : group.key === "trend"
            ? "추세·안정화"
            : group.key === "relative-strength"
              ? "상대 강도"
              : group.key === "volume-volatility"
                ? "거래량·변동성"
                : group.key === "valuation"
                  ? "밸류에이션"
                  : group.key === "financial-quality"
                    ? "기초 체력"
                    : group.key === "debt"
                      ? "부채·재무구조 위험"
                      : group.key === "events"
                        ? "실적·이벤트"
                        : group.key === "news-risk"
                          ? "뉴스·논리 위험"
                          : group.key === "sector"
                            ? "섹터·시장 맥락"
                            : "내 투자 논리와의 일치"
        : group.title,
    note:
      language === "ko"
        ? group.key === "price-damage"
          ? "이 종목이 관심을 가질 만큼 충분히 밀렸는가?"
          : group.key === "trend"
            ? "하락이 계속되는가, 아니면 안정화가 시작되는가?"
            : group.key === "relative-strength"
              ? "벤치마크 대비 더 강한가, 더 약한가?"
              : group.key === "volume-volatility"
                ? "공포성 움직임이 의미 있게 진정됐는가?"
                : group.key === "valuation"
                  ? "실제로 예전보다 싸 보이는가?"
                  : group.key === "financial-quality"
                    ? "가치 함정을 피할 만큼 사업이 아직 건강한가?"
                    : group.key === "debt"
                      ? "부채나 현금 압박이 구도를 막을 수 있는가?"
                      : group.key === "events"
                        ? "다가오는 이벤트가 타이밍을 어렵게 만드는가?"
                        : group.key === "news-risk"
                          ? "이번 손상이 일시적 과민 반응인가, 아니면 논리를 깨는 종류인가?"
                          : group.key === "sector"
                            ? "주변 환경이 도와주는가, 방해하는가?"
                            : "지금의 구도가 원래 계획과 아직 맞는가?"
        : group.note,
    cards: localizedCards.filter((item) => item.family === group.family),
  }));
};
