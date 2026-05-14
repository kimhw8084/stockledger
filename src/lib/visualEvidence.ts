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
    families: ["Debt / Balance Sheet Risk", "Earnings & Events", "News & Thesis Risk", "Macro Context"],
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

export const buildStockVisualAnalysisGroups = ({
  stock,
  snapshot,
  eyes,
  recipes,
  benchmark,
  lookbackLabel,
}: {
  stock: Stock;
  snapshot: MockSnapshot;
  eyes: Eye[];
  recipes: Recipe[];
  benchmark: "SPY" | "QQQ" | "Sector ETF";
  lookbackLabel: "20D" | "3M" | "6M";
}): VisualEvidenceGroup[] => {
  const freshness = freshnessForCard(snapshot);
  const thesisAge = daysSince(eyes[0]?.lastReviewedAt ?? snapshot.lastThesisReviewAt);
  const eventDays = inferEventDays(snapshot, stock);
  const sectorEdge = inferSectorEdge(snapshot);
  const macroRisk = inferMacroRisk(snapshot, benchmark);
  const entryLow = eyes[0]?.plannedEntryLow ?? snapshot.plannedEntryLow;
  const entryHigh = eyes[0]?.plannedEntryHigh ?? snapshot.plannedEntryHigh;
  const priceSeries = buildMiniSeries(snapshot.price, snapshot.drawdownPct, snapshot.stabilizationScore);
  const rsSeries = buildComparisonSeries(snapshot.relativeStrengthVsSpyPct ?? 0);
  const sectorSeries = buildComparisonSeries(sectorEdge);
  const volumeSeries = buildComparisonSeries((snapshot.volumeSpike ? 6 : -4) + snapshot.stabilizationScore / 20);

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
      formulaDescription: "Combines revenue direction, margin direction, and analyst revision trend into a compact health check.",
      formulaInputs: ["revenueGrowthYoY", "marginChangePct", "analystRevisionTrend"],
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
          {
            label: `Analyst trend ${snapshot.analystRevisionTrend}`,
            tone:
              snapshot.analystRevisionTrend === "improving"
                ? "good"
                : snapshot.analystRevisionTrend === "flat"
                  ? "neutral"
                  : "warning",
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
      id: `${stock.id}-macro`,
      family: "Macro Context",
      title: "Macro context",
      role: "Risk Warning",
      status: macroRisk >= 0.74 ? "Warning" : macroRisk >= 0.52 ? "Near Trigger" : "Passed",
      summary:
        macroRisk >= 0.74
          ? `${benchmark} context is still pressuring this setup, so timing deserves extra skepticism.`
          : `${benchmark} context is not heavily blocking the setup right now.`,
      effect: macroRisk >= 0.74 ? "Broad conditions can downgrade conviction even if stock-specific evidence improves." : "Macro does not dominate the review right now.",
      whyItMatters: "Broad regime pressure can make an otherwise decent setup underperform or fail to trigger cleanly.",
      freshness,
      sourceType: cardSource(snapshot),
      relatedConditionLabel: "Macro context is tracked as a review layer and not yet a recipe-specific metric in V1.",
      metric: {
        currentLabel: macroRisk >= 0.74 ? "Elevated" : macroRisk >= 0.52 ? "Medium" : "Low",
        thresholdLabel: "Low to medium",
        comparisonLabel: `${benchmark} regime`,
      },
      formulaName: "Macro pressure proxy",
      formulaDescription: "Mock regime proxy combining benchmark choice, drawdown pressure, and event sensitivity.",
      formulaInputs: ["benchmark", "drawdownPct", "earningsSoon"],
      visual: {
        kind: "risk_gauge",
        min: 0,
        max: 100,
        current: macroRisk * 100,
        threshold: 65,
        markerLabel: "Macro risk",
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
      key: "macro",
      title: "Macro Context",
      note: "Are broader conditions supportive or increasingly risky?",
      family: "Macro Context",
    },
    {
      key: "thesis",
      title: "User Thesis Match",
      note: "Does today’s setup still line up with your original plan?",
      family: "User Thesis Match",
    },
  ];

  return stockGroups.map((group) => ({
    key: group.key,
    title: group.title,
    note: group.note,
    cards: allCards.filter((item) => item.family === group.family),
  }));
};
