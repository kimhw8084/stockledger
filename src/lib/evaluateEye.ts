import {
  ConditionEvaluationResult,
  ConditionOperator,
  ConditionRole,
  Evaluation,
  Eye,
  EyeState,
  MockSnapshot,
  MetricDefinition,
  Recipe,
  RecipeCondition,
} from "../types";
import { evaluateExpression } from "./expressionEngine";
import { getFormulaDefinition, getMetricDefinition, metricCatalog } from "./metricCatalog";

const DEFAULT_STATE_CONFIG = {
  attentionNeededMinScore: 5,
  opportunityMinScore: 4,
  watchMinScore: 3,
  becomingInterestingMinScore: 1,
  riskWarningThreshold: 2,
};

const asNumber = (value: unknown) => (typeof value === "number" ? value : undefined);
const asString = (value: unknown) => (typeof value === "string" ? value : undefined);
const asBoolean = (value: unknown) => (typeof value === "boolean" ? value : undefined);
const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined);
const latest = (values?: number[]) => (values && values.length ? values[values.length - 1] : undefined);
const pctChange = (current: number | undefined, base: number | undefined) =>
  current !== undefined && base !== undefined && base !== 0 ? ((current / base) - 1) * 100 : undefined;

const resolveFormulaValue = (
  eye: Eye,
  snapshot: MockSnapshot,
  condition: RecipeCondition,
  key?: string,
) => {
  switch (key) {
    case "drawdown_from_recent_high":
    case "drawdown_pct": {
      const current = latest(snapshot.priceHistorySeries) ?? snapshot.price;
      const recentHigh = snapshot.priceHistorySeries?.length ? Math.max(...snapshot.priceHistorySeries) : undefined;
      return recentHigh && current ? Number((((current / recentHigh) - 1) * 100).toFixed(1)) : snapshot.drawdownPct;
    }
    case "near_support":
    case "near_support_bool": {
      const current = latest(snapshot.priceHistorySeries) ?? snapshot.price;
      const recentSupport = snapshot.priceHistorySeries?.length
        ? Math.min(...snapshot.priceHistorySeries.slice(-15))
        : undefined;
      return current !== undefined && recentSupport !== undefined
        ? current >= recentSupport && current <= recentSupport * 1.05
        : snapshot.nearSupport;
    }
    case "valuation_discount":
    case "valuation_discount_bool":
      return snapshot.valuationDiscount;
    case "relative_strength_vs_spy":
    case "relative_strength_vs_spy_pct": {
      const current = latest(snapshot.priceHistorySeries) ?? snapshot.price;
      const stockBase = snapshot.priceHistorySeries?.at(-61) ?? snapshot.priceHistorySeries?.[0];
      const benchmarkCurrent = latest(snapshot.benchmarkHistorySeries);
      const benchmarkBase = snapshot.benchmarkHistorySeries?.at(-61) ?? snapshot.benchmarkHistorySeries?.[0];
      const stockReturn = pctChange(current, stockBase);
      const benchmarkReturn = pctChange(benchmarkCurrent, benchmarkBase);
      return stockReturn !== undefined && benchmarkReturn !== undefined
        ? Number((stockReturn - benchmarkReturn).toFixed(1))
        : snapshot.relativeStrengthVsSpyPct;
    }
    case "distance_from_ma_50":
    case "distance_from_ma_50_pct": {
      const current = latest(snapshot.priceHistorySeries) ?? snapshot.price;
      const ma50 = average(snapshot.priceHistorySeries?.slice(-50) ?? []);
      const value = pctChange(current, ma50);
      return value !== undefined ? Number(value.toFixed(1)) : snapshot.movingAverage50DistancePct;
    }
    case "distance_from_ma_20":
    case "distance_from_ma_20_pct": {
      const current = latest(snapshot.priceHistorySeries) ?? snapshot.price;
      const ma20 = average(snapshot.priceHistorySeries?.slice(-20) ?? []);
      const value = pctChange(current, ma20);
      return value !== undefined ? Number(value.toFixed(1)) : snapshot.movingAverage20DistancePct;
    }
    case "distance_from_ma_200":
    case "distance_from_ma_200_pct": {
      const current = latest(snapshot.priceHistorySeries) ?? snapshot.price;
      const ma200 = average(snapshot.priceHistorySeries?.slice(-200) ?? snapshot.priceHistorySeries ?? []);
      const value = pctChange(current, ma200);
      return value !== undefined ? Number(value.toFixed(1)) : snapshot.movingAverage200DistancePct;
    }
    case "price_return_20d":
    case "price_return_20d_pct": {
      const current = latest(snapshot.priceHistorySeries) ?? snapshot.price;
      const base = snapshot.priceHistorySeries?.at(-21) ?? snapshot.priceHistorySeries?.[0];
      const value = pctChange(current, base);
      return value !== undefined ? Number(value.toFixed(1)) : snapshot.priceReturn20dPct;
    }
    case "price_return_60d":
    case "price_return_60d_pct": {
      const current = latest(snapshot.priceHistorySeries) ?? snapshot.price;
      const base = snapshot.priceHistorySeries?.at(-61) ?? snapshot.priceHistorySeries?.[0];
      const value = pctChange(current, base);
      return value !== undefined ? Number(value.toFixed(1)) : snapshot.priceReturn60dPct;
    }
    case "volume_spike":
    case "volume_spike_bool": {
      const recentVolume = latest(snapshot.volumeHistorySeries);
      const baselineVolume = average(snapshot.volumeHistorySeries?.slice(-21, -1) ?? []);
      return recentVolume !== undefined && baselineVolume !== undefined
        ? recentVolume > baselineVolume * 1.35
        : snapshot.volumeSpike;
    }
    case "volatility_compression":
    case "volatility_compression_bool": {
      const latestAverage = average(snapshot.volatilityHistorySeries?.slice(-10) ?? []);
      const priorAverage = average(snapshot.volatilityHistorySeries?.slice(-30, -10) ?? []);
      return latestAverage !== undefined && priorAverage !== undefined
        ? latestAverage < priorAverage * 0.86
        : snapshot.volatilityCompression;
    }
    case "average_range_pct": {
      const value = average(snapshot.volatilityHistorySeries?.slice(-10) ?? []);
      return value !== undefined ? Number(value.toFixed(1)) : snapshot.averageRangePct;
    }
    case "revenue_growth_yoy":
      return snapshot.revenueGrowthYoY;
    case "margin_change_pct":
      return snapshot.marginChangePct;
    case "debt_risk_level":
      return snapshot.debtRiskLevel;
    case "earnings_soon":
    case "earnings_soon_bool":
      return snapshot.earningsSoon;
    case "days_until_earnings":
      return snapshot.daysUntilEarnings;
    case "price_inside_entry_zone": {
      const low = eye.plannedEntryLow ?? snapshot.plannedEntryLow;
      const high = eye.plannedEntryHigh ?? snapshot.plannedEntryHigh;
      if (low === undefined || high === undefined) return undefined;
      return snapshot.price >= low && snapshot.price <= high;
    }
    case "price_beyond_entry_zone": {
      const low = eye.plannedEntryLow ?? snapshot.plannedEntryLow;
      const high = eye.plannedEntryHigh ?? snapshot.plannedEntryHigh;
      if (low === undefined || high === undefined) return undefined;
      return snapshot.price < low || snapshot.price > high;
    }
    case "days_since_last_review": {
      const lastReview = eye.lastReviewedAt ?? snapshot.lastThesisReviewAt;
      if (!lastReview) return undefined;
      const ms = new Date().getTime() - new Date(lastReview).getTime();
      return Math.floor(ms / (1000 * 60 * 60 * 24));
    }
    case "thesis_review_stale": {
      const lastReview = eye.lastReviewedAt ?? snapshot.lastThesisReviewAt;
      if (!lastReview) return undefined;
      const ms = new Date().getTime() - new Date(lastReview).getTime();
      const days = Math.floor(ms / (1000 * 60 * 60 * 24));
      return days >= 14;
    }
    case "rebound_from_recent_low":
    case "rebound_from_recent_low_pct": {
      const current = latest(snapshot.priceHistorySeries) ?? snapshot.price;
      const recentLow = snapshot.priceHistorySeries?.length
        ? Math.min(...snapshot.priceHistorySeries.slice(-20))
        : undefined;
      const value = pctChange(current, recentLow);
      return value !== undefined ? Number(value.toFixed(1)) : undefined;
    }
    case "manual_flag_present": {
      const expected = asString(condition.value);
      const flags = [...snapshot.riskFlags, ...(eye.manualFlags ?? [])];
      if (!expected) return flags.length > 0;
      return flags.includes(expected);
    }
    default:
      return undefined;
  }
};

const resolveMetricValue = (eye: Eye, snapshot: MockSnapshot, condition: RecipeCondition) =>
  resolveFormulaValue(eye, snapshot, condition, condition.metricKey) ??
  resolveFormulaValue(eye, snapshot, condition, condition.formulaKey);
const resolveMetricValueFromDefinition = (
  eye: Eye,
  snapshot: MockSnapshot,
  metricDefinitions: MetricDefinition[],
  condition: RecipeCondition,
) => {
  const metric = metricDefinitions.find((item) => item.key === condition.metricKey);
  if (metric?.expression && metric.parameterKeys?.length) {
    return evaluateExpression(metric.expression, metric.parameterKeys, snapshot, eye);
  }
  return resolveMetricValue(eye, snapshot, condition);
};

const compareMetricValue = (
  actualValue: string | number | boolean | undefined,
  operator: ConditionOperator | undefined,
  expectedValue: RecipeCondition["value"],
) => {
  if (actualValue === undefined || operator === undefined) return undefined;

  switch (operator) {
    case "<=":
      return asNumber(actualValue) !== undefined && asNumber(expectedValue) !== undefined
        ? asNumber(actualValue)! <= asNumber(expectedValue)!
        : undefined;
    case ">=":
      return asNumber(actualValue) !== undefined && asNumber(expectedValue) !== undefined
        ? asNumber(actualValue)! >= asNumber(expectedValue)!
        : undefined;
    case "<":
      return asNumber(actualValue) !== undefined && asNumber(expectedValue) !== undefined
        ? asNumber(actualValue)! < asNumber(expectedValue)!
        : undefined;
    case ">":
      return asNumber(actualValue) !== undefined && asNumber(expectedValue) !== undefined
        ? asNumber(actualValue)! > asNumber(expectedValue)!
        : undefined;
    case "=":
    case "is":
      return actualValue === expectedValue;
    case "contains":
      return asString(actualValue) !== undefined && asString(expectedValue) !== undefined
        ? asString(actualValue)!.includes(asString(expectedValue)!)
        : actualValue === expectedValue;
    case "between":
      return asNumber(actualValue) !== undefined &&
        Array.isArray(expectedValue) &&
        expectedValue.length === 2 &&
        typeof expectedValue[0] === "number" &&
        typeof expectedValue[1] === "number"
        ? asNumber(actualValue)! >= expectedValue[0] && asNumber(actualValue)! <= expectedValue[1]
        : undefined;
    case "within":
      return asNumber(actualValue) !== undefined && asNumber(expectedValue) !== undefined
        ? Math.abs(asNumber(actualValue)!) <= Math.abs(asNumber(expectedValue)!)
        : undefined;
    case "crosses":
      return asBoolean(actualValue) !== undefined
        ? asBoolean(actualValue)
        : asString(actualValue) !== undefined && asString(expectedValue) !== undefined
          ? asString(actualValue) === asString(expectedValue)
          : undefined;
    default:
      return undefined;
  }
};

const roleFromCondition = (condition: RecipeCondition): ConditionRole => {
  if (condition.role) return condition.role;
  switch (condition.kind) {
    case "required":
      return "Eligibility Filter";
    case "supporting":
      return "Supporting Evidence";
    case "negative":
      return "Risk Warning";
    case "disqualifier":
      return "Hard Disqualifier";
    default:
      return "Supporting Evidence";
  }
};

const describeCondition = (
  condition: RecipeCondition,
  actualValue: string | number | boolean | undefined,
  passed: boolean,
) => {
  const label = condition.humanDescription ?? condition.label;
  if (actualValue === undefined) {
    return `${label} could not be evaluated because required data is missing.`;
  }
  return `${label} ${passed ? "passed" : "did not pass"}${actualValue !== undefined ? ` (actual: ${String(actualValue)}).` : "."}`;
};

const evaluateCondition = (
  eye: Eye,
  snapshot: MockSnapshot,
  metricDefinitions: MetricDefinition[],
  condition: RecipeCondition,
): ConditionEvaluationResult => {
  const role = roleFromCondition(condition);
  const actualValue = resolveMetricValueFromDefinition(eye, snapshot, metricDefinitions, condition);
  const passed = compareMetricValue(actualValue, condition.operator, condition.value);

  return {
    conditionId: condition.id,
    role,
    passed: Boolean(passed),
    metricKey: condition.metricKey,
    formulaKey: condition.formulaKey,
    operator: condition.operator,
    expectedValue: condition.value,
    actualValue,
    explanation: describeCondition(condition, actualValue, Boolean(passed)),
    missingData: actualValue === undefined,
  };
};

const stateFromResults = (
  results: ConditionEvaluationResult[],
  recipe: Recipe,
): { currentState: EyeState; score: number; riskCount: number; hardDisqualifiers: string[] } => {
  const stateConfig = recipe.stateConfig ?? DEFAULT_STATE_CONFIG;

  const hardDisqualifiers = results
    .filter((result) => result.role === "Hard Disqualifier" && result.passed)
    .map((result) => result.explanation);
  if (hardDisqualifiers.length > 0) {
    return {
      currentState: "Thesis Broken",
      score: 0,
      riskCount: hardDisqualifiers.length,
      hardDisqualifiers,
    };
  }

  const eligibility = results.filter((result) => result.role === "Eligibility Filter");
  const supporting = results.filter((result) => result.role === "Supporting Evidence");
  const timing = results.filter((result) => result.role === "Timing Trigger");
  const riskWarnings = results.filter((result) => result.role === "Risk Warning" && result.passed);

  const eligibilityPassed = eligibility.filter((result) => result.passed).length;
  const supportingPassed = supporting.filter((result) => result.passed).length;
  const timingPassed = timing.filter((result) => result.passed).length;
  const score = eligibilityPassed * 2 + supportingPassed + timingPassed * 2 - riskWarnings.length;

  if (riskWarnings.length >= stateConfig.riskWarningThreshold && score < stateConfig.opportunityMinScore) {
    return {
      currentState: "Thesis Risk Rising",
      score,
      riskCount: riskWarnings.length,
      hardDisqualifiers,
    };
  }

  if (timingPassed > 0 && score >= stateConfig.attentionNeededMinScore) {
    return { currentState: "Attention Needed", score, riskCount: riskWarnings.length, hardDisqualifiers };
  }
  if (timingPassed > 0 && score >= stateConfig.opportunityMinScore) {
    return {
      currentState: "Opportunity Zone Forming",
      score,
      riskCount: riskWarnings.length,
      hardDisqualifiers,
    };
  }
  if (score >= stateConfig.watchMinScore) {
    return { currentState: "Watch Closely", score, riskCount: riskWarnings.length, hardDisqualifiers };
  }
  if (score >= stateConfig.becomingInterestingMinScore) {
    return {
      currentState: "Becoming Interesting",
      score,
      riskCount: riskWarnings.length,
      hardDisqualifiers,
    };
  }
  return { currentState: "Not Relevant", score, riskCount: riskWarnings.length, hardDisqualifiers };
};

export const evaluateEye = (
  eye: Eye,
  recipe: Recipe,
  snapshot: MockSnapshot,
  metricDefinitions: MetricDefinition[] = metricCatalog,
): Evaluation => {
  const previousState = eye.lastEvaluation?.currentState ?? "Not Relevant";
  const conditionResults = recipe.conditions.map((condition) =>
    evaluateCondition(eye, snapshot, metricDefinitions, condition),
  );
  const stateSummary = stateFromResults(conditionResults, recipe);

  const supportingEvidence = conditionResults
    .filter(
      (result) =>
        result.passed &&
        (result.role === "Eligibility Filter" ||
          result.role === "Supporting Evidence" ||
          result.role === "Timing Trigger"),
    )
    .map((result) => result.explanation);

  const contradictingEvidence = conditionResults
    .filter(
      (result) =>
        (result.role === "Eligibility Filter" && !result.passed) ||
        (result.role === "Supporting Evidence" && !result.passed) ||
        (result.role === "Timing Trigger" && !result.passed),
    )
    .map((result) => result.explanation);

  const riskWarnings = conditionResults
    .filter((result) => result.role === "Risk Warning" && result.passed)
    .map((result) => result.explanation);

  const missingData = conditionResults
    .filter((result) => result.missingData)
    .map((result) => {
      const metric = getMetricDefinition(result.metricKey);
      const formula = getFormulaDefinition(result.formulaKey);
      return `${metric?.name ?? result.metricKey ?? "Condition"} is missing data${formula ? ` for ${formula.name}` : ""}.`;
    });

  const staleData =
    snapshot.freshness === "Stale" || snapshot.freshness === "Partial"
      ? [`Snapshot freshness is ${snapshot.freshness.toLowerCase()}.`]
      : [];

  const stateChanged = previousState !== stateSummary.currentState;
  const whyNow = stateChanged
    ? `${recipe.name} v${recipe.version} changed from ${previousState} to ${stateSummary.currentState} because the recipe's evidence, timing, and risk roles evaluated differently on the latest snapshot.`
    : `${recipe.name} v${recipe.version} remains ${stateSummary.currentState} because the current condition mix is materially unchanged.`;

  const actionUrgency =
    stateSummary.currentState === "Attention Needed" || stateSummary.currentState === "Thesis Broken"
      ? "Actively Review"
      : stateSummary.currentState === "Opportunity Zone Forming" ||
          stateSummary.currentState === "Thesis Risk Rising"
        ? "Review Soon"
        : "Wait";

  const setupStrength =
    stateSummary.currentState === "Attention Needed" ||
    stateSummary.currentState === "Opportunity Zone Forming"
      ? "High"
      : stateSummary.currentState === "Watch Closely" ||
          stateSummary.currentState === "Thesis Risk Rising"
        ? "Medium"
        : "Low";

  const alertSuggested =
    stateChanged &&
    ["Opportunity Zone Forming", "Attention Needed", "Thesis Risk Rising", "Thesis Broken"].includes(
      stateSummary.currentState,
    );

  const recommendedAction =
    actionUrgency === "Actively Review"
      ? "Review immediately and decide whether the setup still matches the thesis."
      : actionUrgency === "Review Soon"
        ? "Review soon and check the latest evidence against risks."
        : "No immediate action. Keep monitoring.";

  const dataQualityPrefix = snapshot.isMock ? "Mock-backed" : "Provider-backed";
  const partialSuffix =
    missingData.length > 0 || staleData.length > 0 ? " Partial confidence due to missing or stale inputs." : "";

  return {
    eyeId: eye.id,
    recipeId: recipe.id,
    recipeVersion: recipe.version,
    previousState,
    currentState: stateSummary.currentState,
    stateChanged,
    whyNow,
    supportingEvidence,
    contradictingEvidence,
    riskWarnings,
    hardDisqualifiers: stateSummary.hardDisqualifiers,
    missingData,
    staleData,
    dataQuality: `${dataQualityPrefix} snapshot from ${snapshot.sourceName}.${partialSuffix}`,
    setupStrength,
    actionUrgency,
    recommendedAction,
    conditionResults,
    alertSuggested,
    alertReason: alertSuggested ? whyNow : undefined,
    alertSuppressedReason: !alertSuggested && stateChanged ? "State changed but did not cross a meaningful alert threshold." : undefined,
    evaluatedAt: snapshot.updatedAt,
  };
};
