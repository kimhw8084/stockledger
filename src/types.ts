export type EyeState =
  | "Not Relevant"
  | "Becoming Interesting"
  | "Watch Closely"
  | "Opportunity Zone Forming"
  | "Attention Needed"
  | "Thesis Risk Rising"
  | "Thesis Broken";

export type DecisionAction =
  | "Entered"
  | "Skipped"
  | "Snoozed"
  | "Revised"
  | "Rejected"
  | "Marked Thesis Broken";

export type FreshnessStatus =
  | "Fresh"
  | "Delayed"
  | "Stale"
  | "Partial"
  | "Unavailable"
  | "Mock Data";

export type ConditionVisualStatus =
  | "Passed"
  | "Failed"
  | "Warning"
  | "Blocked"
  | "Near Trigger"
  | "Partial"
  | "Unavailable"
  | "Stale"
  | "Mock";

export type MetricAvailability = "automated" | "manual" | "future";

export type ConditionRole =
  | "Eligibility Filter"
  | "Supporting Evidence"
  | "Timing Trigger"
  | "Risk Warning"
  | "Hard Disqualifier"
  | "Review Trigger"
  | "Outcome Learning Tag";

export type ConditionOperator =
  | "<="
  | ">="
  | "<"
  | ">"
  | "="
  | "is"
  | "contains"
  | "between"
  | "crosses"
  | "within";

export interface Stock {
  id: string;
  symbol: string;
  name: string;
  thesis: string;
  createdAt: string;
}

export interface RecipeCondition {
  id: string;
  label: string;
  kind: "required" | "supporting" | "negative" | "disqualifier";
  role?: ConditionRole;
  metricKey?: string;
  formulaKey?: string;
  operator?: ConditionOperator;
  value?: string | number | boolean | [number, number];
  unit?: string;
  humanDescription?: string;
  notes?: string;
  availability?: MetricAvailability;
}

export interface MetricDefinition {
  key: string;
  name: string;
  humanMeaning: string;
  formulaKey: string;
  requiredData: string[];
  freshnessExpectation: FreshnessStatus | "Near Real Time" | "Daily" | "Review Cadence";
  availability: MetricAvailability;
  exampleConditions: string[];
  exampleDisplayText: string;
  missingDataBehavior: string;
}

export interface FormulaDefinition {
  key: string;
  name: string;
  description: string;
  requiredData: string[];
  outputType: "number" | "boolean" | "string";
}

export interface RecipeStateConfig {
  attentionNeededMinScore: number;
  opportunityMinScore: number;
  watchMinScore: number;
  becomingInterestingMinScore: number;
  riskWarningThreshold: number;
}

export interface RecipeAlertConfig {
  cooldownHours: number;
  dedupeKey: "state_change" | "current_state";
  priorityOnAttention: "High" | "Medium" | "Low";
  priorityOnRisk: "High" | "Medium" | "Low";
}

export interface RecipeReviewConfig {
  cadenceDays: number;
  reviewTriggers: string[];
}

export interface RecipeOutcomeConfig {
  trackedTags: string[];
}

export interface Recipe {
  id: string;
  version: number;
  name: string;
  purpose: string;
  opportunityType?: string;
  timeHorizon: string;
  intendedUseCase: string;
  notes: string;
  conditions: RecipeCondition[];
  createdAt: string;
  stateConfig?: RecipeStateConfig;
  alertConfig?: RecipeAlertConfig;
  reviewConfig?: RecipeReviewConfig;
  outcomeConfig?: RecipeOutcomeConfig;
}

export interface MockSnapshot {
  stockId: string;
  price: number;
  drawdownPct: number;
  nearSupport?: boolean;
  stabilizationScore: number;
  movingAverage20DistancePct?: number;
  valuationDiscount?: boolean;
  analystRevisionTrend?: "improving" | "flat" | "weak";
  earningsSoon?: boolean;
  riskFlags: string[];
  movingAverage50DistancePct?: number;
  movingAverage200DistancePct?: number;
  relativeStrengthVsSpyPct?: number;
  priceReturn20dPct?: number;
  priceReturn60dPct?: number;
  volumeSpike?: boolean;
  volatilityCompression?: boolean;
  averageRangePct?: number;
  revenueGrowthYoY?: number;
  marginChangePct?: number;
  debtRiskLevel?: "low" | "medium" | "high";
  plannedEntryLow?: number;
  plannedEntryHigh?: number;
  lastThesisReviewAt?: string;
  priceHistorySeries?: number[];
  benchmarkHistorySeries?: number[];
  volumeHistorySeries?: number[];
  volatilityHistorySeries?: number[];
  updatedAt: string;
  sourceName: string;
  freshness: FreshnessStatus;
  isMock: boolean;
}

export interface ConditionEvaluationResult {
  conditionId: string;
  role: ConditionRole;
  passed: boolean;
  metricKey?: string;
  formulaKey?: string;
  operator?: ConditionOperator;
  expectedValue?: string | number | boolean | [number, number];
  actualValue?: string | number | boolean;
  explanation: string;
  missingData?: boolean;
}

export interface VisualEvidenceMetric {
  currentLabel: string;
  thresholdLabel?: string;
  comparisonLabel?: string;
}

export interface VisualEvidenceVisual {
  kind:
    | "threshold_bar"
    | "comparison_bar"
    | "entry_zone"
    | "binary"
    | "freshness"
    | "mini_trend"
    | "checklist"
    | "risk_gauge"
    | "event_countdown";
  min?: number;
  max?: number;
  current?: number;
  threshold?: number;
  low?: number;
  high?: number;
  markerLabel?: string;
  series?: number[];
  secondarySeries?: number[];
  tertiarySeries?: number[];
  items?: Array<{
    label: string;
    tone: "good" | "neutral" | "warning" | "danger";
  }>;
  countdownDays?: number;
  countdownLabel?: string;
}

export interface VisualEvidenceCard {
  id: string;
  family:
    | "Price Damage"
    | "Trend & Stabilization"
    | "Relative Strength"
    | "Volume & Volatility"
    | "Valuation"
    | "Financial Quality"
    | "Debt / Balance Sheet Risk"
    | "Earnings & Events"
    | "News & Thesis Risk"
    | "Sector & Market Context"
    | "Macro Context"
    | "User Thesis Match"
    | "Recipe Condition Map"
    | "Data Quality"
    | "Risk Controls";
  title: string;
  role: ConditionRole | "Data Quality";
  status: ConditionVisualStatus;
  summary: string;
  effect: string;
  whyItMatters: string;
  freshness: FreshnessStatus;
  sourceType: "Mock Adapter" | "Provider Adapter" | "Manual Input";
  relatedConditionLabel?: string;
  metric: VisualEvidenceMetric;
  formulaName?: string;
  formulaDescription?: string;
  formulaInputs?: string[];
  visual: VisualEvidenceVisual;
}

export interface VisualEvidenceGroup {
  key: string;
  title: string;
  note: string;
  cards: VisualEvidenceCard[];
}

export interface Evaluation {
  eyeId: string;
  recipeId?: string;
  recipeVersion?: number;
  previousState: EyeState;
  currentState: EyeState;
  stateChanged: boolean;
  whyNow: string;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  riskWarnings?: string[];
  hardDisqualifiers?: string[];
  missingData: string[];
  staleData: string[];
  dataQuality: string;
  setupStrength: "Low" | "Medium" | "High";
  actionUrgency: "Wait" | "Review Soon" | "Actively Review";
  recommendedAction?: string;
  conditionResults?: ConditionEvaluationResult[];
  alertSuggested: boolean;
  alertReason?: string;
  alertSuppressedReason?: string;
  evaluatedAt: string;
}

export interface Eye {
  id: string;
  stockId: string;
  recipeId: string;
  createdAt: string;
  thesisSnapshot: string;
  recipeVersionAtCreation?: number;
  plannedEntryLow?: number;
  plannedEntryHigh?: number;
  invalidationRule?: string;
  manualFlags?: string[];
  lastReviewedAt?: string;
  lastEvaluation?: Evaluation;
}

export interface Alert {
  id: string;
  eyeId: string;
  recipeId?: string;
  recipeVersion?: number;
  title: string;
  stateChange: string;
  whyNow: string;
  supportingEvidence: string[];
  risks: string[];
  dataQuality: string;
  evaluationContext?: {
    currentState: EyeState;
    conditionResults?: ConditionEvaluationResult[];
    staleData?: string[];
    missingData?: string[];
  };
  priority: "Low" | "Medium" | "High";
  createdAt: string;
  reviewed: boolean;
  snoozedUntil?: string;
  usefulness?: "Useful" | "Not Useful";
}

export interface Decision {
  id: string;
  eyeId: string;
  alertId?: string;
  recipeId?: string;
  recipeVersion?: number;
  stateAtDecision?: EyeState;
  conditionResults?: ConditionEvaluationResult[];
  dataQuality?: string;
  action: DecisionAction;
  note: string;
  concern: string;
  thesisValid: "Yes" | "Partly" | "No";
  timing: "Early" | "On Time" | "Late";
  createdAt: string;
}

export interface Outcome {
  id: string;
  decisionId: string;
  recipeId?: string;
  recipeVersion?: number;
  reviewWindow: string;
  status?: "Pending" | "Reviewed";
  priceChangeNote: string;
  maxRunupNote: string;
  maxDrawdownNote: string;
  lesson: string;
  recipeSuggestion: string;
  createdAt: string;
}

export interface AppData {
  stocks: Stock[];
  recipes: Recipe[];
  eyes: Eye[];
  alerts: Alert[];
  decisions: Decision[];
  outcomes: Outcome[];
  snapshots: MockSnapshot[];
}

export interface ProviderHealthEntry {
  provider: "Stooq" | "Alpha Vantage" | "Twelve Data" | "Marketaux";
  configured: boolean;
  status: "Healthy" | "Unconfigured" | "Plan Limited" | "Error";
  mode: "Background" | "On Demand" | "Disabled";
  note: string;
  endpoint?: string;
  lastCheckedAt?: string;
}
