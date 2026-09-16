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
  archivedAt?: string;
  id: string;
  symbol: string;
  name: string;
  thesis: string;
  createdAt: string;
}

export interface RecipeCondition {
  lineageId?: string;
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
  expression?: string;
  parameterKeys?: string[];
  freshnessExpectation: FreshnessStatus | "Near Real Time" | "Daily" | "Review Cadence";
  availability: MetricAvailability;
  exampleConditions: string[];
  exampleDisplayText: string;
  missingDataBehavior: string;
  origin?: "starter" | "custom";
  createdAt?: string;
}

export interface FormulaDefinition {
  key: string;
  name: string;
  description: string;
  equation?: string;
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
  lineageId?: string;
  version: number;
  name: string;
  purpose: string;
  opportunityType?: string;
  timeHorizon: string;
  intendedUseCase: string;
  notes: string;
  conditions: RecipeCondition[];
  createdAt: string;
  retiredAt?: string;
  stateConfig?: RecipeStateConfig;
  alertConfig?: RecipeAlertConfig;
  reviewConfig?: RecipeReviewConfig;
  outcomeConfig?: RecipeOutcomeConfig;
}

export interface LogicRule {
  id: string;
  lineageId?: string;
  setId: string;
  setVersion: number;
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
  createdAt: string;
  updatedAt?: string;
}

export interface LogicSet {
  id: string;
  lineageId?: string;
  version: number;
  name: string;
  purpose: string;
  opportunityType?: string;
  timeHorizon: string;
  intendedUseCase: string;
  notes: string;
  createdAt: string;
  retiredAt?: string;
  reviewConfig?: RecipeReviewConfig;
  alertConfig?: RecipeAlertConfig;
  outcomeConfig?: RecipeOutcomeConfig;
}

export interface SnapshotProvenance {
  schemaVersion: 2;
  origin: "provider" | "import" | "demo";
  observedDate: string;
  retrievedAt: string;
  currency: "USD";
  adjustment: "adjusted" | "unadjusted" | "unknown";
  datasetId: string;
}
/** Historical name retained for import compatibility; isMock/provenance identify origin. */
export interface MockSnapshot {
  provenance?: SnapshotProvenance;
  historyDates?: string[];
  benchmarkDates?: string[];
  benchmarkSymbol?: string;
  stockId: string;
  price: number;
  drawdownPct: number;
  nearSupport?: boolean;
  stabilizationScore: number;
  movingAverage20DistancePct?: number;
  valuationDiscount?: boolean;
  earningsSoon?: boolean;
  daysUntilEarnings?: number;
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
  truth?: "true" | "false" | "unknown";
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
  id?: string;
  inputHash?: string;
  engineVersion?: string;
  eligibilityMet?: boolean;
  qualityBlocked?: boolean;
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
  archivedAt?: string;
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
  evaluationId?: string;
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
  evaluationId?: string;
  archivedAt?: string;
  amendments?: Array<{ amendedAt: string; action: DecisionAction; note: string; concern: string; thesisValid: "Yes" | "Partly" | "No"; timing: "Early" | "On Time" | "Late" }>;
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

export type UniverseMode = "dynamic_current_universe" | "frozen_research_universe";

export type UniverseSourceStatus =
  | "dynamic_current_universe"
  | "frozen_import_fallback"
  | "current_universe_unavailable";

export type SignalStatus =
  | "MATCHED"
  | "NEAR_MATCH"
  | "FAILED"
  | "BLOCKED_OR_INCOMPLETE_DATA";

export type RawDataValidationStatus = "valid" | "invalid" | "partial";

export interface RawBarRecord {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface RawBarArchiveBatch {
  id: string;
  provider: string;
  downloadedAtUtc: string;
  symbols: string[];
  startDate: string;
  endDate: string;
  rowCount: number;
  adjustedStatus?: "adjusted" | "unadjusted" | "unknown";
  validationStatus: RawDataValidationStatus;
  archiveVersion: number;
  schemaVersion: string;
  bars: RawBarRecord[];
  supersededByBatchId?: string;
}

export interface UniverseSectorSnapshot {
  sector: string;
  tickers: string[];
}

export interface UniverseSnapshot {
  id: string;
  universeMode: UniverseMode;
  universeSource: string;
  universeSourceStatus: UniverseSourceStatus;
  snapshotDate: string;
  snapshotHash: string;
  fetchedAtUtc: string;
  sectorSnapshots: UniverseSectorSnapshot[];
  addedTickers?: string[];
  removedTickers?: string[];
  warning?: string;
}

export interface ProcessedFeatureRecord {
  id: string;
  symbol: string;
  asOfDate: string;
  sector: string;
  sectorEtf: string;
  featureSemanticsVersion: string;
  computedAtUtc: string;
  featureValues: Record<string, number | boolean | string | null>;
  featureMeta: Record<
    string,
    {
      formula: string;
      rawInputs: string[];
      lookbackDays: number;
      warmupDays: number;
      pointInTimeSafe: boolean;
      computedAfterCloseOnly: boolean;
      featureVersion: string;
    }
  >;
}

export interface ScanRun {
  id: string;
  scanDate: string;
  latestExpectedTradingDate: string;
  startedAtUtc: string;
  completedAtUtc?: string;
  universeMode: UniverseMode;
  universeSource: string;
  universeSnapshotDate?: string;
  universeSnapshotHash?: string;
  providerName: string;
  sourceStatus: UniverseSourceStatus;
  status: "completed" | "blocked" | "partial";
  warnings: string[];
  blockedReason?: string;
}

export interface FrozenRuleProofSummary {
  discoveryMedian30: number;
  holdoutMedian30: number;
  lockboxMedian30: number;
  latestEraStatus: "pass" | "fail" | "unknown";
}

export interface ScanSignal {
  signalId: string;
  scanRunId: string;
  scanDate: string;
  signalDate: string;
  ticker: string;
  sector: string;
  ruleId: string;
  ruleSignatureHash: string;
  family: string;
  classificationAtSignal: string;
  appPriority: string;
  status: SignalStatus;
  matchedConditionsJson: string[];
  failedConditionsJson: string[];
  missingConditionsJson: string[];
  featureValuesJson: Record<string, number | boolean | string | null>;
  closePriceAtSignal?: number;
  spyClose?: number;
  sectorEtf: string;
  sectorEtfClose?: number;
  proofSummarySnapshot: FrozenRuleProofSummary;
  riskWarningsSnapshot: string[];
  survivorshipBiasLabel: string;
  forwardProofRequired: boolean;
  universeMode: UniverseMode;
  universeSource: string;
  universeSnapshotDate?: string;
  universeSnapshotHash?: string;
  sectorMemberCount: number;
  createdAtUtc: string;
}

export interface ReviewLog {
  id: string;
  signalId: string;
  reviewedAt: string;
  userDecision: "watch" | "ignore" | "bought" | "skipped" | "sold" | "other";
  manualReason: string;
  convictionScoreOptional?: number;
  notes?: string;
  entryPriceOptional?: number;
  exitPriceOptional?: number;
  resultNotes?: string;
}

export interface ForwardProofLedger {
  id: string;
  signalId: string;
  ret5?: number;
  ret10?: number;
  ret20?: number;
  ret30?: number;
  spyRet5?: number;
  spyRet10?: number;
  spyRet20?: number;
  spyRet30?: number;
  sectorRet5?: number;
  sectorRet10?: number;
  sectorRet20?: number;
  sectorRet30?: number;
  beatSpy5?: boolean;
  beatSpy10?: boolean;
  beatSpy20?: boolean;
  beatSpy30?: boolean;
  beatSector5?: boolean;
  beatSector10?: boolean;
  beatSector20?: boolean;
  beatSector30?: boolean;
  mfe30?: number;
  mae30?: number;
  completed5d: boolean;
  completed10d: boolean;
  completed20d: boolean;
  completed30d: boolean;
  lastUpdatedAtUtc: string;
}

export interface ScannerSettings {
  universeMode: UniverseMode;
  fallbackToFrozenUniverse: boolean;
  providerDelayMinutesAfterClose: number;
  notifyNearMatches: boolean;
  frozenUniverseBySector?: Record<string, string[]>;
}

export interface AppData {
  workspaceId?: string;
  evaluations?: Evaluation[];
  stocks: Stock[];
  recipes: Recipe[];
  customMetrics: MetricDefinition[];
  logicRules: LogicRule[];
  logicSets: LogicSet[];
  eyes: Eye[];
  alerts: Alert[];
  decisions: Decision[];
  outcomes: Outcome[];
  snapshots: MockSnapshot[];
  rawBarArchives: RawBarArchiveBatch[];
  universeSnapshots: UniverseSnapshot[];
  processedFeatures: ProcessedFeatureRecord[];
  scanRuns: ScanRun[];
  scanSignals: ScanSignal[];
  reviewLogs: ReviewLog[];
  forwardProofLedger: ForwardProofLedger[];
  scannerSettings: ScannerSettings;
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
