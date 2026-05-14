import {
  ConditionEvaluationResult,
  Eye,
  Evaluation,
  FreshnessStatus,
  MockSnapshot,
  Recipe,
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
      return "Trend";
    case "relative_strength_vs_spy":
      return "Relative Strength";
    case "price_inside_entry_zone":
      return "User Thesis";
    case "manual_flag_present":
    case "earnings_soon":
    case "debt_risk_level":
      return "Risk Controls";
    case "revenue_growth_yoy":
    case "margin_change_pct":
    case "valuation_discount":
      return "Quality";
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
  if (snapshot.isMock) return "Mock";
  if (result.role === "Hard Disqualifier" && result.passed) return "Blocked";
  if (result.role === "Risk Warning" && result.passed) return "Warning";
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
  switch (result.metricKey) {
    case "drawdown_from_recent_high":
      return {
        kind: "threshold_bar",
        min: -50,
        max: 0,
        current: asNumber(result.actualValue),
        threshold: asNumber(result.expectedValue),
        markerLabel: "52W drawdown",
      };
    case "distance_from_ma_50":
      return {
        kind: "comparison_bar",
        min: -25,
        max: 25,
        current: asNumber(result.actualValue),
        threshold: asNumber(result.expectedValue),
        markerLabel: "vs 50D MA",
      };
    case "relative_strength_vs_spy":
      return {
        kind: "comparison_bar",
        min: -25,
        max: 25,
        current: asNumber(result.actualValue),
        threshold: asNumber(result.expectedValue),
        markerLabel: "vs SPY",
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
    families: ["Price Damage", "Trend", "Relative Strength", "Quality"],
  },
  {
    key: "thesis",
    title: "Thesis Match",
    note: "How the stock aligns with your original plan and entry discipline.",
    families: ["User Thesis"],
  },
  {
    key: "risk",
    title: "Risks and Blocks",
    note: "What downgrades or blocks the setup right now.",
    families: ["Risk Controls"],
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
