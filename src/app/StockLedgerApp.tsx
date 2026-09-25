import { styles } from "./styles";
import { StatusBar } from "expo-status-bar";
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { buildChartData } from "../domain/chartSeries";
import { RecoveryPanel, StockEditor } from "../features/workspace/WorkspacePanel";
import { CloudSyncPanel } from "../features/sync/CloudSyncPanel";
import { NotificationSettingsPanel } from "../features/notifications/NotificationSettingsPanel";
import { OutcomeEditor } from "../features/journal/OutcomeEditor";
import { JournalComposer, type JournalValidationSection } from "../features/journal/JournalComposer";
import { DecisionDetail } from "../features/journal/DecisionDetail";
import { EyeDetail, type EyeDetailViewModel } from "../features/eyes/EyeDetail";
import { EyeComposer } from "../features/eyes/EyeComposer";
import { EyeFlowsScreen, type EyeFlowsFilter, type EyeFlowRow } from "../features/eyes/EyeFlowsScreen";
import { RecipeBuilder, type RecipeBuilderModel, type RecipeBuilderStep } from "../features/recipes/builder/RecipeBuilder";
import { RawDataRegistry } from "../features/recipes/logic/RawDataRegistry";
import { ScannerReview, type ScannerReviewForm } from "../features/recipes/scanner/ScannerReview";
import { StockMetricDetailSheet } from "../features/watchlist/detail/StockMetricDetailSheet";
import { entryRangeFieldErrors, optionalPositiveNumber, validateEntryRange } from "../domain/inputValidation";
import { createId as createLocalId } from "../platform/identity";
import { createComposerOperationGate } from "../domain/composerOperationGate";
import { useWorkspaceNavigation } from "../hooks/useWorkspaceNavigation";
import { useSavedStringList } from "../hooks/useSavedStringList";
import { useWindowPanelFocus } from "../hooks/useWindowPanelFocus";
import { appDialog as RNAlert } from "../platform/dialog";
import { useAppModel } from "../hooks/useAppModel";
import { WindowPanel } from "../components/WindowPanel";
import { MotionSwap } from "../components/MotionSwap";
import {
  localizedAlertPriority,
  localizedAlertUsefulness,
  localizedActionUrgency,
  localizedConditionCategory,
  localizedConditionKind,
  localizedConditionRole,
  localizedDecisionAction,
  localizedEyeState,
  localizedEyesShelfFilter,
  localizedFreshness,
  localizedJournalFilter,
  localizedMetricAvailability,
  localizedOutcomeStatus,
  localizedOpportunityType,
  localizedRecipeOptionValue,
  localizedProviderStatus,
  localizedRecipeShelfFilter,
  localizedReviewDateOption,
  localizedScanRunStatus,
  localizedScannerDescription,
  localizedScannerStatus,
  localizedSetupStrength,
  localizedSnapshotMode,
  localizedSourceType,
  localizedStatus,
  localizedThesisValidity,
  localizedTimeHorizon,
  localizedTiming,
  localizedUseCase,
  recipeConditionMapCopy,
  formatLocaleDate,
  formatLocaleDateTime,
  formatLocaleNumber,
  subtitleLabel,
  t,
  tabLabel,
} from "../lib/i18n";
import { AppLanguage, loadAppLanguage, saveAppLanguage } from "../lib/preferences";
import {
  Alert,
  ConditionOperator,
  Decision,
  DecisionAction,
  Eye,
  EyeState,
  Evaluation,
  FreshnessStatus,
  MetricDefinition,
  ProviderHealthEntry,
  Recipe,
  RecipeCondition,
  ScanSignal,
  Stock,
  VisualEvidenceCard,
  VisualEvidenceGroup,
} from "../types";
import { evaluateEye } from "../lib/evaluateEye";
import {
  localizedEvaluationDataQuality,
  localizedEvaluationDiagnostics,
  localizedEvaluationWhyNow,
} from "../lib/presentationLocalization";
import {
  buildEvidenceGroups,
  buildStockVisualAnalysisGroups,
} from "../lib/visualEvidence";
import { getFormulaDefinition, getMetricDefinition, metricCatalog, formulaRegistry } from "../lib/metricCatalog";
import {
  appendExpressionToken,
  buildExpressionPreview,
  expressionParameterRegistry,
  expressionParameterKeys,
  expressionParameterRequiredData,
  functionTokenTemplates,
  referencedExpressionParameters,
  removeLastExpressionToken,
  tokenizeExpression,
  validateExpressionSyntax,
} from "../lib/expressionEngine";
import {
  Card,
  Button,
  Input,
  NumberStepper,
  DenseStat,
  MetaPill,
  HorizontalChoice,
  SectionHeader,
  LogicBlock,
  SearchableSelect,
} from "../components/common";
import { logicRoleStateEffect, logicRoleWeight } from "../lib/logicHelpers";
import { frozenScannerRules, scannerFeatureRegistry } from "../lib/frozenScannerRules";
import { L1MetricsLayer } from "../components/logic/L1MetricsLayer";
import { L15ConditionsLayer } from "../components/logic/L15ConditionsLayer";
import { L2RecipesLayer } from "../components/logic/L2RecipesLayer";
import { StockLedgerShell } from "../features/shell/StockLedgerShell";
import { TodayScreen } from "../features/today/TodayScreen";
import { WatchlistScreen, type WatchlistBoardMode, type WatchlistBenchmark, type WatchlistLookback, type WatchlistStatusFilter } from "../features/watchlist/WatchlistScreen";
import { buildWatchlistModel, stockMetricPreferenceKey } from "../features/watchlist/model";
import { RecipesScreen, type RecipeLayer } from "../features/recipes/RecipesScreen";
import { buildRecipesModel } from "../features/recipes/model";
import { AlertsScreen, type AlertsView } from "../features/alerts/AlertsScreen";
import { buildAlertsModel } from "../features/alerts/model";
import { JournalScreen } from "../features/journal/JournalScreen";
import { buildJournalEntries } from "../features/journal/model";
import { SettingsScreen } from "../features/settings/SettingsScreen";
import { buildSettingsModel } from "../features/settings/model";
import { WorkspaceSettingsPanel } from "../features/settings/WorkspaceSettingsPanel";
import { cloud } from "../features/sync/client";

type TabKey = "Home" | "Stocks" | "Logic Lab" | "Eyes" | "Alerts" | "Journal" | "Settings";
type AlertWorkspaceTab = "Current" | "History" | "Detail";
type ConditionKind = RecipeCondition["kind"];
type AnalysisBenchmark = WatchlistBenchmark;
type AnalysisLookback = WatchlistLookback;
type AnalysisStatusFilter = WatchlistStatusFilter;
type StockBoardMode = WatchlistBoardMode;
type HomeBucket = "All" | "Review Now" | "Forming" | "Review Soon";
type RecipeShelfFilter = "All" | "Starter" | "Custom" | "Recent";
type EyesShelfFilter = EyeFlowsFilter;
type JournalFilter = "All" | "Entered" | "Skipped" | "Risky";
type LogicLabLayer = RecipeLayer;
type LogicInfoTarget = "Raw Data" | "Processed Features" | "Frozen Rules" | "Signals";

type StockRouteTarget = "Stocks" | "Alerts" | "Eyes" | "Journal";
type MetricDraftForm = {
  name: string;
  humanMeaning: string;
  builderMode: "raw" | "equation";
  selectedRawFields: string[];
  rawParameterKey: string;
  expression: string;
  availability: MetricDefinition["availability"];
  freshnessExpectation: MetricDefinition["freshnessExpectation"];
  exampleDisplayText: string;
  missingDataBehavior: string;
};

interface ConditionTemplate {
  id: string;
  category: string;
  title: string;
  description: string;
  metricKey: string;
  formulaKey: string;
  defaultKind: ConditionKind;
  complexity: "Simple" | "Layered" | "Advanced";
  metricLabel: string;
  defaultOperator: ConditionOperator;
  defaultValue: string;
  control:
    | {
        type: "number";
        step: number;
        min: number;
        max: number;
        unit?: string;
      }
    | {
        type: "enum";
        options: readonly string[];
      };
}

type ConditionBuilderState = {
  metricKey: string;
  role: NonNullable<RecipeCondition["role"]>;
  operator: ConditionOperator;
  threshold: string;
  note: string;
};

const tabs: TabKey[] = ["Home", "Stocks", "Logic Lab", "Journal"];
const recipeBuilderSteps: RecipeBuilderStep[] = ["Purpose", "Logic", "Risk & Alerts", "Review & Outcome"];
const analysisBenchmarks: AnalysisBenchmark[] = ["SPY", "QQQ", "Sector ETF"];
const analysisLookbacks: AnalysisLookback[] = ["20D", "3M", "6M"];
const analysisStatusFilters: AnalysisStatusFilter[] = [
  "All Statuses",
  "Passed",
  "Near Trigger",
  "Warning",
  "Blocked",
  "Needs Review",
];
const stockBoardModes: StockBoardMode[] = ["Pinned First", "Status", "Family"];
const defaultAnalysisBenchmark: AnalysisBenchmark = "SPY";
const defaultAnalysisLookback: AnalysisLookback = "3M";
const defaultAnalysisStatusFilter: AnalysisStatusFilter = "All Statuses";
const defaultStockBoardMode: StockBoardMode = "Pinned First";
const homeBuckets: HomeBucket[] = ["All", "Review Now", "Forming", "Review Soon"];
const recipeShelfFilters: RecipeShelfFilter[] = ["All", "Starter", "Custom", "Recent"];
const eyesShelfFilters: EyesShelfFilter[] = ["All", "Needs Review", "Quiet"];
const journalFilters: JournalFilter[] = ["All", "Entered", "Skipped", "Risky"];
const languageOptions: AppLanguage[] = ["en", "ko"];
const starterRecipeNames = [
  "Temporary Bargain Sale",
  "Leader Pullback",
  "Reset Recovery",
  "Thesis Risk Monitor",
];
const opportunityTypes = [
  "Temporary Mispricing",
  "Leader Pullback",
  "Recovery Setup",
  "Risk Monitoring",
] as const;
const timeHorizons = ["1 to 2 weeks", "1 to 3 months", "3 to 12 months", "Multi-year"] as const;
const useCaseOptions = [
  "Watchlist Triage",
  "Position Building",
  "Thesis Protection",
] as const;
const reviewCadenceOptions = [3, 7, 14, 30, 60] as const;
const alertCooldownOptions = [6, 12, 24, 48, 72] as const;
const manualFlagOptions = [
  "회계 이슈",
  "규제 리스크",
  "가이던스 압박",
  "경영진 신뢰 훼손",
  "심한 희석 위험",
] as const;
const reviewDateOptions = [
  { label: "Today", daysAgo: 0 },
  { label: "3D", daysAgo: 3 },
  { label: "7D", daysAgo: 7 },
  { label: "14D", daysAgo: 14 },
  { label: "30D", daysAgo: 30 },
] as const;
const decisionActions: DecisionAction[] = [
  "Entered",
  "Skipped",
  "Snoozed",
  "Revised",
  "Rejected",
  "Marked Thesis Broken",
];
const thesisValidityOptions = ["Yes", "Partly", "No"] as const;
const timingOptions = ["Early", "On Time", "Late"] as const;
const conditionKinds: ConditionKind[] = ["required", "supporting", "negative", "disqualifier"];
const conditionRoleOptions: NonNullable<RecipeCondition["role"]>[] = [
  "Eligibility Filter",
  "Supporting Evidence",
  "Timing Trigger",
  "Risk Warning",
  "Hard Disqualifier",
  "Review Trigger",
  "Outcome Learning Tag",
];

const fontFamily = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: "system-ui",
});

const statePriority: EyeState[] = [
  "Attention Needed",
  "Thesis Risk Rising",
  "Opportunity Zone Forming",
  "Watch Closely",
  "Becoming Interesting",
  "Not Relevant",
  "Thesis Broken",
];

const conditionLibrary: ConditionTemplate[] = [
  {
    id: "price-drawdown",
    category: "Technical",
    title: "Price drawdown from high",
    description: "Require a meaningful discount from the recent high before attention rises.",
    metricKey: "drawdown_from_recent_high",
    formulaKey: "drawdown_pct",
    defaultKind: "required",
    complexity: "Simple",
    metricLabel: "drawdown %",
    defaultOperator: "<=",
    defaultValue: "-25",
    control: { type: "number", step: 5, min: -80, max: -5, unit: "%" },
  },
  {
    id: "support-hold",
    category: "Technical",
    title: "Prior support is holding",
    description: "Look for price behavior that is stabilizing around a prior support zone.",
    metricKey: "near_support",
    formulaKey: "near_support_bool",
    defaultKind: "required",
    complexity: "Layered",
    metricLabel: "support zone",
    defaultOperator: "is",
    defaultValue: "true",
    control: { type: "enum", options: ["true", "false"] },
  },
  {
    id: "moving-average-recovery",
    category: "Technical",
    title: "Moving average recovery",
    description: "Capture a reclaim or hold above an important moving average.",
    metricKey: "distance_from_ma_50",
    formulaKey: "distance_from_ma_50_pct",
    defaultKind: "supporting",
    complexity: "Layered",
    metricLabel: "moving average",
    defaultOperator: ">=",
    defaultValue: "0",
    control: { type: "number", step: 1, min: -25, max: 25, unit: "%" },
  },
  {
    id: "valuation-discount",
    category: "Valuation",
    title: "Valuation discount vs history",
    description: "Express when the stock looks attractively priced versus its own recent baseline.",
    metricKey: "valuation_discount",
    formulaKey: "valuation_discount_bool",
    defaultKind: "supporting",
    complexity: "Layered",
    metricLabel: "valuation gap",
    defaultOperator: "is",
    defaultValue: "true",
    control: { type: "enum", options: ["true", "false"] },
  },
  {
    id: "revenue-stability",
    category: "Business Quality",
    title: "Revenue stability",
    description: "Avoid bargain setups where the business is already deteriorating.",
    metricKey: "revenue_growth_yoy",
    formulaKey: "revenue_growth_yoy",
    defaultKind: "required",
    complexity: "Layered",
    metricLabel: "revenue trend",
    defaultOperator: ">=",
    defaultValue: "0",
    control: { type: "number", step: 5, min: -50, max: 80, unit: "%" },
  },
  {
    id: "margin-deterioration",
    category: "Business Quality",
    title: "Margin deterioration",
    description: "Track when profitability weakens enough to matter to the thesis.",
    metricKey: "margin_change_pct",
    formulaKey: "margin_change_pct",
    defaultKind: "negative",
    complexity: "Advanced",
    metricLabel: "margin trend",
    defaultOperator: "<=",
    defaultValue: "-5",
    control: { type: "number", step: 1, min: -25, max: 15, unit: "pts" },
  },
  {
    id: "negative-news-cluster",
    category: "News",
    title: "Negative news cluster",
    description: "Group repeated headlines around legal, product, or demand issues.",
    metricKey: "manual_flag_present",
    formulaKey: "manual_flag_present",
    defaultKind: "negative",
    complexity: "Advanced",
    metricLabel: "headline cluster",
    defaultOperator: "contains",
    defaultValue: "regulatory risk",
    control: { type: "enum", options: manualFlagOptions },
  },
  {
    id: "earnings-proximity",
    category: "News",
    title: "Earnings proximity",
    description: "Account for the added uncertainty of an upcoming earnings event.",
    metricKey: "earnings_soon",
    formulaKey: "earnings_soon_bool",
    defaultKind: "negative",
    complexity: "Simple",
    metricLabel: "days to earnings",
    defaultOperator: "is",
    defaultValue: "true",
    control: { type: "enum", options: ["true", "false"] },
  },
  {
    id: "debt-risk",
    category: "Risk",
    title: "Debt stress",
    description: "Hard-stop the setup if leverage or refinancing risk becomes too severe.",
    metricKey: "debt_risk_level",
    formulaKey: "debt_risk_level",
    defaultKind: "disqualifier",
    complexity: "Advanced",
    metricLabel: "debt coverage",
    defaultOperator: "is",
    defaultValue: "high",
    control: { type: "enum", options: ["low", "medium", "high"] },
  },
  {
    id: "management-credibility",
    category: "Risk",
    title: "Management credibility damage",
    description: "Represent when trust in management falls enough to break the thesis.",
    metricKey: "manual_flag_present",
    formulaKey: "manual_flag_present",
    defaultKind: "disqualifier",
    complexity: "Advanced",
    metricLabel: "credibility event",
    defaultOperator: "contains",
    defaultValue: "guidance cut",
    control: { type: "enum", options: manualFlagOptions },
  },
];


const isoDateDaysAgo = (daysAgo: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
};

const roleFromBuilderKind = (kind: ConditionKind): RecipeCondition["role"] => {
  switch (kind) {
    case "required":
      return "Eligibility Filter";
    case "supporting":
      return "Supporting Evidence";
    case "negative":
      return "Risk Warning";
    default:
      return "Hard Disqualifier";
  }
};

const kindFromConditionRole = (role: RecipeCondition["role"]): ConditionKind => {
  switch (role) {
    case "Eligibility Filter":
      return "required";
    case "Supporting Evidence":
    case "Timing Trigger":
    case "Review Trigger":
    case "Outcome Learning Tag":
      return "supporting";
    case "Risk Warning":
      return "negative";
    case "Hard Disqualifier":
      return "disqualifier";
    default:
      return "supporting";
  }
};

const metricControlConfig = (metric?: MetricDefinition, formula?: { outputType: "number" | "boolean" | "string" }) => {
  if (!metric || !formula) {
    return { type: "number" as const, step: 1, min: -100, max: 100, unit: "" };
  }
  if (formula.outputType === "boolean") {
    return { type: "enum" as const, options: ["true", "false"] };
  }
  if (metric.key === "debt_risk_level") {
    return { type: "enum" as const, options: ["low", "medium", "high"] };
  }
  if (metric.key === "manual_flag_present") {
    return { type: "enum" as const, options: [...manualFlagOptions] };
  }
  const numberConfigMap: Record<string, { step: number; min: number; max: number; unit?: string }> = {
    drawdown_from_recent_high: { step: 5, min: -80, max: -5, unit: "%" },
    relative_strength_vs_spy: { step: 1, min: -25, max: 25, unit: "%" },
    distance_from_ma_20: { step: 1, min: -25, max: 25, unit: "%" },
    distance_from_ma_50: { step: 1, min: -25, max: 25, unit: "%" },
    distance_from_ma_200: { step: 1, min: -40, max: 40, unit: "%" },
    rebound_from_recent_low: { step: 1, min: 0, max: 80, unit: "%" },
    revenue_growth_yoy: { step: 5, min: -50, max: 80, unit: "%" },
    margin_change_pct: { step: 1, min: -25, max: 15, unit: "pts" },
    days_until_earnings: { step: 1, min: 0, max: 90, unit: "d" },
    days_since_last_review: { step: 1, min: 0, max: 180, unit: "d" },
  };
  const config = numberConfigMap[metric.key] ?? { step: 1, min: -100, max: 100, unit: "" };
  return { type: "number" as const, ...config };
};

const operatorOptionsForMetric = (
  metric?: MetricDefinition,
  formula?: { outputType: "number" | "boolean" | "string" },
): readonly ConditionOperator[] => {
  if (!metric || !formula) return [">=", "<=", ">", "<"];
  if (formula.outputType === "number") return [">=", "<=", ">", "<"];
  if (metric.key === "manual_flag_present") return ["contains", "is"];
  return ["is"];
};

const formatMetricThreshold = (
  metric: MetricDefinition | undefined,
  threshold: string,
  language: AppLanguage,
  formula?: { outputType: "number" | "boolean" | "string" },
) => {
  const control = metricControlConfig(metric, formula);
  if (control.type === "number") {
    return `${threshold}${control.unit ? ` ${control.unit}` : ""}`;
  }
  if (threshold === "true") return t(language, "common.yes");
  if (threshold === "false") return t(language, "common.no");
  return threshold;
};

const parseThresholdValue = (
  rawValue: string,
  metric: MetricDefinition | undefined,
  formula?: { outputType: "number" | "boolean" | "string" },
) => {
  const control = metricControlConfig(metric, formula);
  if (control.type === "number") return Number(rawValue);
  if (rawValue === "true") return true;
  if (rawValue === "false") return false;
  return rawValue;
};

const defaultRecipeDraftForm = (): RecipeDraftForm => ({
  name: "",
  purpose: "",
  opportunityType: opportunityTypes[0],
  timeHorizon: timeHorizons[1],
  intendedUseCase: useCaseOptions[0],
  notes: "",
  reviewCadenceDays: reviewCadenceOptions[2],
  alertCooldownHours: alertCooldownOptions[2],
});

const defaultMetricDraftForm = (): MetricDraftForm => ({
  name: "",
  humanMeaning: "",
  builderMode: "raw",
  selectedRawFields: [],
  rawParameterKey: expressionParameterRegistry[0].key,
  expression: expressionParameterRegistry[0].key,
  availability: "automated",
  freshnessExpectation: "Daily",
  exampleDisplayText: "",
  missingDataBehavior: "",
});

const slugMetricKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);

const stockSearchScore = (query: string, item: { stock: Stock }) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return 0;

  const symbol = item.stock.symbol.toLowerCase();
  const name = item.stock.name.toLowerCase();
  const thesis = item.stock.thesis.toLowerCase();

  if (symbol === normalizedQuery) return 100;
  if (symbol.startsWith(normalizedQuery)) return 80;
  if (name.startsWith(normalizedQuery)) return 60;
  if (symbol.includes(normalizedQuery)) return 45;
  if (name.includes(normalizedQuery)) return 30;
  if (thesis.includes(normalizedQuery)) return 10;
  return 0;
};

const stockMetricFamilyOrder = [
  "Price Damage",
  "Trend & Stabilization",
  "Relative Strength",
  "Volume & Volatility",
  "Valuation",
  "Financial Quality",
  "Debt / Balance Sheet Risk",
  "Earnings & Events",
  "News & Thesis Risk",
  "Sector & Market Context",
  "User Thesis Match",
  "Recipe Condition Map",
] as const;

const stockMetricStatusRank = (status: VisualEvidenceCard["status"]) => {
  switch (status) {
    case "Blocked":
      return 0;
    case "Warning":
      return 1;
    case "Near Trigger":
      return 2;
    case "Passed":
      return 3;
    case "Stale":
      return 4;
    case "Partial":
      return 5;
    case "Mock":
      return 6;
    case "Unavailable":
      return 7;
    default:
      return 8;
  }
};

const stockMetricFamilyRank = (family: string) => {
  const index = stockMetricFamilyOrder.indexOf(family as (typeof stockMetricFamilyOrder)[number]);
  return index >= 0 ? index : stockMetricFamilyOrder.length;
};

const compactStatusLabel = (status: VisualEvidenceCard["status"]) => {
  switch (status) {
    case "Near Trigger":
      return "Near";
    case "Unavailable":
      return "No Data";
    default:
      return status;
  }
};

const analysisStatusFilterLabel = (filter: AnalysisStatusFilter) => {
  switch (filter) {
    case "All Statuses":
      return "All";
    case "Needs Review":
      return "Needs Review";
    case "Near Trigger":
      return "Near";
    default:
      return filter;
  }
};

const rawLogicFieldLabel = (language: AppLanguage, field: string) => {
  const labels: Record<string, { ko: string; en: string }> = {
    priceHistorySeries: { ko: "가격 시계열", en: "Price history series" },
    volumeHistorySeries: { ko: "거래량 시계열", en: "Volume history series" },
    volatilityHistorySeries: { ko: "변동폭 시계열", en: "Volatility range series" },
    benchmarkHistorySeries: { ko: "벤치마크 시계열", en: "Benchmark history series" },
    financialStatementSnapshot: { ko: "재무 스냅샷", en: "Financial statement snapshot" },
    valuationSnapshot: { ko: "밸류에이션 스냅샷", en: "Valuation snapshot" },
    eventCalendar: { ko: "이벤트 캘린더", en: "Event calendar" },
    newsRiskFlags: { ko: "뉴스·위험 플래그", en: "News risk flags" },
    thesisText: { ko: "투자 논리 원문", en: "Thesis text" },
    plannedEntryRange: { ko: "계획 진입 구간", en: "Planned entry range" },
    invalidationRule: { ko: "무효화 기준", en: "Invalidation rule" },
    lastThesisReviewAt: { ko: "마지막 논리 검토 시점", en: "Last thesis review time" },
    manualRiskFlags: { ko: "수동 위험 플래그", en: "Manual risk flags" },
  };
  return labels[field]?.[language] ?? field;
};

const recipeLineageKey = (recipe: Recipe) => recipe.lineageId ?? recipe.id;
const logicRuleRefKey = (recipeId: string, conditionId: string) => `${recipeId}:${conditionId}`;

const logicInfoContent = (language: AppLanguage, target: LogicInfoTarget) => {
  const content = {
    "Raw Data": {
      title: language === "ko" ? "원천 데이터" : "Raw Data",
      body:
        language === "ko"
          ? "원천 데이터는 스캐너의 출발점입니다. 완성된 일봉 OHLCV, SPY, 섹터 ETF, 구성종목/섹터 맵, 그리고 필요한 수동 입력만 둡니다. 이 팝업에서는 데이터 정의, 프로바이더/API, 갱신 빈도, 어떤 처리 피처가 여기에 의존하는지만 확인합니다."
          : "Raw Data is the scanner starting layer. It holds only completed daily OHLCV bars, SPY, sector ETFs, universe membership data, and required manual inputs. Use this view to inspect definitions, providers/APIs, freshness, and which processed features depend on each source.",
    },
    "Processed Features": {
      title: language === "ko" ? "처리 피처" : "Processed Features",
      body:
        language === "ko"
          ? "처리 피처는 원천 일봉 데이터에서 계산된 중간 결과입니다. 이동평균, 126일 하락폭, SPY 대비 초과수익, 거래량 배수처럼 규칙 평가 전에 필요한 파생값만 보여줍니다. 여기서는 직접 식을 만드는 것이 아니라, 스캐너가 실제로 계산한 값을 점검합니다."
          : "Processed Features are the derived columns computed from archived daily data. They include moving averages, 126-day drawdown, excess return versus SPY, volume spike, and other explicit intermediate values required before rule evaluation. This view is for inspection, not custom formula editing.",
    },
    "Frozen Rules": {
      title: language === "ko" ? "고정 규칙" : "Frozen Rules",
      body:
        language === "ko"
          ? "고정 규칙은 이번 앱의 핵심 연구 규칙 여섯 개입니다. 규칙 ID, 서명 해시, 섹터 범위, 조건 토큰, 파라미터, 과거 증거 요약이 모두 중앙 레지스트리에 고정되어 있습니다. 여기서는 바꾸는 것이 아니라 읽고 검증합니다."
          : "Frozen Rules are the six central research rules. Their ids, signature hashes, sector scope, condition tokens, parameters, and proof snapshots are fixed in a central registry. This view is for inspection and verification, not mutation.",
    },
    Signals: {
      title: language === "ko" ? "신호" : "Signals",
      body:
        language === "ko"
          ? "신호는 하루 스캔 결과입니다. MATCHED, NEAR_MATCH, BLOCKED만 노출하고, 어떤 조건이 통과/실패/누락됐는지와 함께 사람 검토 기록을 남깁니다. 매수·매도 명령이 아니라 검토 대상을 압축하는 출력 레이어입니다."
          : "Signals are the daily scan outputs. Only MATCHED, NEAR_MATCH, and BLOCKED results are surfaced, along with the passed, failed, and missing conditions and the manual review log. This is an inspection layer, not a trading instruction layer.",
    },
  } as const;
  return content[target];
};

const buildLogicSetVersionDiff = (recipe: Recipe, previous?: Recipe) => {
  if (!previous) {
    return { added: recipe.conditions.length, removed: 0, changed: 0, metaChanged: 0 };
  }
  const previousMap = new Map(previous.conditions.map((condition) => [condition.id, condition]));
  const nextMap = new Map(recipe.conditions.map((condition) => [condition.id, condition]));
  const added = recipe.conditions.filter((condition) => !previousMap.has(condition.id)).length;
  const removed = previous.conditions.filter((condition) => !nextMap.has(condition.id)).length;
  const changed = recipe.conditions.filter((condition) => {
    const old = previousMap.get(condition.id);
    if (!old) return false;
    return (
      old.metricKey !== condition.metricKey ||
      old.formulaKey !== condition.formulaKey ||
      old.operator !== condition.operator ||
      JSON.stringify(old.value) !== JSON.stringify(condition.value) ||
      old.role !== condition.role
    );
  }).length;
  const metaChanged = Number(previous.name !== recipe.name) + Number(previous.purpose !== recipe.purpose);
  return { added, removed, changed, metaChanged };
};

const stockBoardModeLabel = (mode: StockBoardMode) => {
  switch (mode) {
    case "Pinned First":
      return "Pinned";
    default:
      return mode;
  }
};

const homeBucketLabel = (language: AppLanguage, bucket: HomeBucket) => {
  switch (bucket) {
    case "All":
      return t(language, "common.all");
    case "Review Now":
      return t(language, "home.bucket.reviewNow");
    case "Forming":
      return t(language, "home.bucket.forming");
    case "Review Soon":
      return t(language, "home.bucket.reviewSoon");
    default:
      return bucket;
  }
};

const recipeShelfFilterLabel = (language: AppLanguage, filter: RecipeShelfFilter) =>
  localizedRecipeShelfFilter(language, filter);

const eyesShelfFilterLabel = (language: AppLanguage, filter: EyesShelfFilter) =>
  localizedEyesShelfFilter(language, filter);

const journalFilterLabel = (language: AppLanguage, filter: JournalFilter) =>
  localizedJournalFilter(language, filter);

const compactMetricContextLabel = (card: VisualEvidenceCard) => {
  const label = card.metric.thresholdLabel ?? card.metric.comparisonLabel ?? card.role;
  return label
    .replace(/^Need\s+/i, "")
    .replace(/^Context only$/i, "Context")
    .replace(/^Compared with\s+/i, "")
    .trim();
};

const compactStatusAccentColor = (status: VisualEvidenceCard["status"]) => {
  switch (status) {
    case "Passed":
      return "#22c55e";
    case "Near Trigger":
      return "#f59e0b";
    case "Warning":
      return "#f59e0b";
    case "Blocked":
      return "#ef4444";
    case "Stale":
      return "#94a3b8";
    case "Partial":
      return "#a855f7";
    case "Mock":
      return "#3b82f6";
    case "Unavailable":
      return "#9ca3af";
    default:
      return "#64748b";
  }
};

const formatDate = (language: AppLanguage, value: string) => formatLocaleDateTime(language, value);
const formatShortDate = (language: AppLanguage, value: string) => formatLocaleDate(language, value);

const urgencyWeight = (value?: string) => {
  switch (value) {
    case "Actively Review":
      return 0;
    case "Review Soon":
      return 1;
    default:
      return 2;
  }
};

const stockLabel = (stocks: Stock[], stockId: string) =>
  stocks.find((stock) => stock.id === stockId)?.symbol ?? "Unknown";

const recipeLabel = (recipes: Recipe[], recipeId: string) =>
  recipes.find((recipe) => recipe.id === recipeId)?.name ?? "Unknown";

const eyeLine = (eye: Eye, stocks: Stock[], recipes: Recipe[]) =>
  `${stockLabel(stocks, eye.stockId)} · ${recipeLabel(recipes, eye.recipeId)}`;

const decisionTitle = (eyeId: string, eyes: Eye[], stocks: Stock[], recipes: Recipe[]) => {
  const eye = eyes.find((item) => item.id === eyeId);
  return eye ? eyeLine(eye, stocks, recipes) : "Unknown Eye";
};

const topReason = (eye: Eye) =>
  eye.lastEvaluation?.supportingEvidence[0] ??
  eye.lastEvaluation?.contradictingEvidence[0] ??
  eye.lastEvaluation?.whyNow ??
  "No evaluation yet.";

const stateTone = (state?: string) => {
  switch (state) {
    case "Attention Needed":
      return [styles.statusBadge, styles.statusNear];
    case "Opportunity Zone Forming":
      return [styles.statusBadge, styles.statusPassed];
    case "Thesis Risk Rising":
      return [styles.statusBadge, styles.statusWarning];
    case "Thesis Broken":
      return [styles.statusBadge, styles.statusBlocked];
    case "Watch Closely":
      return [styles.statusBadge, styles.statusNear];
    case "Becoming Interesting":
      return [styles.statusBadge, styles.statusNear];
    default:
      return [styles.statusBadge, styles.statusFailed];
  }
};

const eyeBadgeTone = (state?: EyeState): EyeFlowRow["stateTone"] => {
  switch (state) {
    case "Opportunity Zone Forming": return "positive";
    case "Attention Needed":
    case "Thesis Risk Rising": return "warning";
    case "Thesis Broken": return "negative";
    case "Watch Closely":
    case "Becoming Interesting": return "info";
    default: return "neutral";
  }
};

const priorityTone = (priority: Alert["priority"]) => {
  switch (priority) {
    case "High":
      return [styles.statusBadge, styles.statusBlocked];
    case "Medium":
      return [styles.statusBadge, styles.statusWarning];
    default:
      return [styles.statusBadge, styles.statusPassed];
  }
};

const providerHealthTone = (entry: ProviderHealthEntry) => {
  switch (entry.status) {
    case "Healthy":
      return [styles.statusBadge, styles.statusPassed];
    case "Plan Limited":
      return [styles.statusBadge, styles.statusWarning];
    case "Unconfigured":
      return [styles.statusBadge, styles.statusPartial];
    default:
      return [styles.statusBadge, styles.statusBlocked];
  }
};

const conditionKindTone = (kind: ConditionKind) => {
  switch (kind) {
    case "required":
      return styles.conditionRequired;
    case "supporting":
      return styles.conditionSupporting;
    case "negative":
      return styles.conditionNegative;
    default:
      return styles.conditionDisqualifier;
  }
};

const buildChartSeries = (price: number, drawdownPct: number, stabilizationScore: number) => {
  const values = Array.from({ length: 16 }, (_, index) => {
    const wave = Math.sin((index + 1) * 0.7) * 0.045;
    const trend = (index / 15) * 0.09;
    const reset = Math.abs(drawdownPct) / 240;
    const stability = stabilizationScore / 650;
    return price * (0.9 + wave - reset + trend + stability);
  });

  const min = Math.min(...values);
  const max = Math.max(...values);
  return values.map((value) => ((value - min) / Math.max(max - min, 1)) * 100);
};

const normalizeSeries = (series: number[], bounds?: { min: number; max: number }) => {
  if (series.length === 0) return [];
  const min = bounds?.min ?? Math.min(...series);
  const max = bounds?.max ?? Math.max(...series);
  const range = Math.max(max - min, 1);
  return series.map((value) => ((value - min) / range) * 100);
};

const statusTone = (status: VisualEvidenceCard["status"]) => {
  switch (status) {
    case "Passed":
      return [styles.statusBadge, styles.statusPassed];
    case "Near Trigger":
      return [styles.statusBadge, styles.statusNear];
    case "Warning":
      return [styles.statusBadge, styles.statusWarning];
    case "Blocked":
      return [styles.statusBadge, styles.statusBlocked];
    case "Partial":
      return [styles.statusBadge, styles.statusPartial];
    case "Unavailable":
      return [styles.statusBadge, styles.statusUnavailable];
    case "Stale":
      return [styles.statusBadge, styles.statusStale];
    case "Mock":
      return [styles.statusBadge, styles.statusMock];
    default:
      return [styles.statusBadge, styles.statusFailed];
  }
};

const matchesAnalysisStatus = (
  status: VisualEvidenceCard["status"],
  filter: AnalysisStatusFilter,
) => {
  if (filter === "All Statuses") return true;
  if (filter === "Needs Review") {
    return ["Warning", "Blocked", "Stale", "Partial", "Unavailable", "Mock"].includes(status);
  }
  return status === filter;
};

const freshnessTone = (freshness: FreshnessStatus) => {
  switch (freshness) {
    case "Fresh":
      return [styles.freshnessBadge, styles.freshnessFresh];
    case "Delayed":
      return [styles.freshnessBadge, styles.freshnessDelayed];
    case "Partial":
      return [styles.freshnessBadge, styles.freshnessPartial];
    case "Unavailable":
      return [styles.freshnessBadge, styles.freshnessUnavailable];
    case "Stale":
      return [styles.freshnessBadge, styles.freshnessStale];
    default:
      return [styles.freshnessBadge, styles.freshnessMock];
  }
};

const sourceTypeLabel = (language: AppLanguage, sourceType: VisualEvidenceCard["sourceType"]) =>
  localizedSourceType(language, sourceType);

const stockSnapshotModeLabel = (language: AppLanguage, snapshot?: { isMock: boolean } | null) =>
  localizedSnapshotMode(language, snapshot?.isMock);

const ThresholdBar = ({ card, language = "en" }: { card: VisualEvidenceCard; language?: AppLanguage }) => {
  const { visual } = card;
  if (visual.kind === "freshness") {
    return (
      <View style={styles.freshnessVisual}>
        <View style={styles.freshnessTrack} />
        <Text style={styles.freshnessVisualText}>{card.freshness}</Text>
      </View>
    );
  }

  if (visual.kind === "binary") {
    const active = (visual.current ?? 0) > 0;
    return (
      <View style={styles.binaryVisual}>
        <View style={[styles.binaryDot, active ? styles.binaryDotActive : styles.binaryDotMuted]} />
        <Text style={styles.binaryVisualText}>{active ? t(language, "stocks.visual.active") : t(language, "stocks.visual.inactive")}</Text>
      </View>
    );
  }

  if (visual.kind === "checklist") {
    return (
      <View style={styles.checklistVisual}>
        {(visual.items ?? []).map((item) => (
          <View key={item.label} style={styles.checklistItem}>
            <View
              style={[
                styles.checklistDot,
                item.tone === "good"
                  ? styles.checklistDotGood
                  : item.tone === "warning"
                    ? styles.checklistDotWarning
                    : item.tone === "danger"
                      ? styles.checklistDotDanger
                      : styles.checklistDotNeutral,
              ]}
            />
            <Text style={styles.checklistText}>{item.label}</Text>
          </View>
        ))}
      </View>
    );
  }

  if (visual.kind === "event_countdown") {
    const days = visual.countdownDays ?? 0;
    return (
      <View style={styles.eventCountdown}>
        <View style={[styles.eventCountdownBadge, days <= 7 ? styles.eventCountdownUrgent : styles.eventCountdownCalm]}>
          <Text style={styles.eventCountdownValue}>{days}D</Text>
        </View>
        <View style={styles.flexOne}>
          <Text style={styles.eventCountdownLabel}>{visual.countdownLabel ?? t(language, "stocks.visual.eventTiming")}</Text>
          <Text style={styles.eventCountdownMeta}>
            {days <= 7 ? t(language, "stocks.visual.eventRiskClose") : t(language, "stocks.visual.noEventPressure")}
          </Text>
        </View>
      </View>
    );
  }

  if (visual.kind === "risk_gauge") {
    const min = visual.min ?? 0;
    const max = visual.max ?? 100;
    const current = visual.current ?? min;
    const threshold = visual.threshold ?? max;
    const currentPct = ((current - min) / Math.max(max - min, 1)) * 100;
    const thresholdPct = ((threshold - min) / Math.max(max - min, 1)) * 100;

    return (
      <View style={styles.thresholdWrap}>
        <View style={styles.riskGaugeTrack}>
          <View style={styles.riskGaugeSafe} />
          <View style={styles.riskGaugeWarn} />
          <View style={styles.riskGaugeDanger} />
          <View style={[styles.thresholdMarkerThreshold, { left: `${Math.max(0, Math.min(100, thresholdPct))}%` }]} />
          <View style={[styles.thresholdMarkerCurrent, { left: `${Math.max(0, Math.min(100, currentPct))}%` }]} />
        </View>
        <View style={styles.thresholdLegend}>
          <Text style={styles.thresholdLegendText}>{t(language, "stocks.detail.lowerRisk")}</Text>
          <Text style={styles.thresholdLegendText}>{card.metric.currentLabel}</Text>
          <Text style={styles.thresholdLegendText}>{t(language, "stocks.detail.higherRisk")}</Text>
        </View>
      </View>
    );
  }

  if (visual.kind === "mini_trend") {
    return (
      <View style={styles.miniTrendVisual}>
        <View style={styles.miniTrendBars}>
          {(visual.series ?? []).map((point, index) => (
            <View
              key={`${card.id}-mini-${index}`}
              style={[
                styles.miniTrendBar,
                { height: 14 + point * 0.4 },
                index === (visual.series ?? []).length - 1 ? styles.miniTrendBarActive : null,
              ]}
            />
          ))}
        </View>
        <View style={styles.thresholdLegend}>
          <Text style={styles.thresholdLegendText}>{visual.markerLabel ?? t(language, "stocks.visual.trend")}</Text>
          <Text style={styles.thresholdLegendText}>
            {t(language, "stocks.visual.need")} {card.metric.thresholdLabel ?? t(language, "stocks.visual.context")}
          </Text>
        </View>
      </View>
    );
  }

  if (visual.kind === "entry_zone") {
    const low = visual.low ?? 0;
    const high = visual.high ?? low;
    const current = visual.current ?? low;
    const min = Math.max(0, low * 0.92);
    const max = high * 1.08 || 1;
    const start = ((low - min) / Math.max(max - min, 1)) * 100;
    const width = ((high - low) / Math.max(max - min, 1)) * 100;
    const marker = ((current - min) / Math.max(max - min, 1)) * 100;

    return (
      <View style={styles.thresholdWrap}>
        <View style={styles.thresholdTrack}>
          <View style={[styles.entryZoneBand, { left: `${Math.max(0, start)}%`, width: `${Math.max(width, 4)}%` }]} />
          <View style={[styles.thresholdMarkerCurrent, { left: `${Math.max(0, Math.min(100, marker))}%` }]} />
        </View>
        <View style={styles.thresholdLegend}>
          <Text style={styles.thresholdLegendText}>{`${t(language, "stocks.detail.plannedZone")} $${formatLocaleNumber(language, low, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</Text>
          <Text style={styles.thresholdLegendText}>{`${t(language, "stocks.evidence.current")} $${formatLocaleNumber(language, current, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</Text>
          <Text style={styles.thresholdLegendText}>{`${t(language, "stocks.detail.plannedZone")} $${formatLocaleNumber(language, high, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</Text>
        </View>
      </View>
    );
  }

  const min = visual.min ?? 0;
  const max = visual.max ?? 100;
  const current = visual.current ?? min;
  const threshold = visual.threshold ?? min;
  const currentPct = ((current - min) / Math.max(max - min, 1)) * 100;
  const thresholdPct = ((threshold - min) / Math.max(max - min, 1)) * 100;

  return (
    <View style={styles.thresholdWrap}>
      <View style={styles.thresholdTrack}>
        <View style={[styles.thresholdMarkerThreshold, { left: `${Math.max(0, Math.min(100, thresholdPct))}%` }]} />
        <View style={[styles.thresholdMarkerCurrent, { left: `${Math.max(0, Math.min(100, currentPct))}%` }]} />
      </View>
      {visual.series && visual.series.length > 0 ? (
        <View style={styles.sparklineOverlay}>
          {visual.series.map((point, index) => (
            <View
              key={`${card.id}-series-${index}`}
              style={[
                styles.sparklineBar,
                { height: 10 + point * 0.26 },
                index === visual.series!.length - 1 ? styles.sparklineBarActive : null,
              ]}
            />
          ))}
          {(visual.secondarySeries ?? []).map((point, index) => (
            <View
              key={`${card.id}-secondary-${index}`}
              style={[
                styles.sparklineLine,
                {
                  left: `${(index / Math.max((visual.secondarySeries ?? []).length - 1, 1)) * 100}%`,
                  bottom: `${8 + point * 0.22}%`,
                },
              ]}
            />
          ))}
          {(visual.tertiarySeries ?? []).map((point, index) => (
            <View
              key={`${card.id}-tertiary-${index}`}
              style={[
                styles.sparklineLineMuted,
                {
                  left: `${(index / Math.max((visual.tertiarySeries ?? []).length - 1, 1)) * 100}%`,
                  bottom: `${8 + point * 0.22}%`,
                },
              ]}
            />
          ))}
        </View>
      ) : null}
      <View style={styles.thresholdLegend}>
        <Text style={styles.thresholdLegendText}>{min}</Text>
        <Text style={styles.thresholdLegendText}>{t(language, "stocks.visual.need")} {card.metric.thresholdLabel ?? "-"}</Text>
        <Text style={styles.thresholdLegendText}>{max}</Text>
      </View>
    </View>
  );
};

const WhyNowPanel = ({
  title,
  body,
  state,
  recipeVersion,
  language = "en",
}: {
  title: string;
  body: string;
  state: string;
  recipeVersion: string;
  language?: AppLanguage;
}) => (
  <View style={styles.card}>
    <View style={styles.inlineBetween}>
      <View style={styles.flexOne}>
        <Text style={styles.inputLabel}>{title}</Text>
        <Text style={[styles.cardBody, { fontWeight: "700" }]}>{body}</Text>
      </View>
      <View style={styles.panelBadges}>
        <Text style={stateTone(state)}>{localizedEyeState(language, state)}</Text>
        <MetaPill label={recipeVersion} />
      </View>
    </View>
  </View>
);

const WhatChangedPanel = ({ title, items }: { title: string; items: string[] }) => (
  <View style={styles.card}>
    <Text style={styles.inputLabel}>{title}</Text>
    <View style={styles.stack}>
      {items.map((item) => (
        <Text key={item} style={[styles.cardBody, { marginTop: 4 }]}>
          • {item}
        </Text>
      ))}
    </View>
  </View>
);

const StatusShape = ({ status, size = 12 }: { status: VisualEvidenceCard["status"]; size?: number }) => {
  const tone = statusTone(status);
  const color = (tone as any[]).find((s: any) => s?.backgroundColor)?.backgroundColor || "#64748b";

  if (status === "Blocked") {
    return (
      <View
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          borderRadius: 2,
          transform: [{ rotate: "45deg" }],
        }}
      />
    );
  }
  if (status === "Warning" || status === "Near Trigger") {
    return (
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: size / 2,
          borderRightWidth: size / 2,
          borderBottomWidth: size,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: color,
        }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: status === "Passed" ? size / 2 : 2,
      }}
    />
  );
};

const EvidenceCardView = ({
  card,
  compact = false,
  onOpen,
  pinned = false,
  dense = false,
  hideFreshness = false,
  language = "en",
}: {
  card: VisualEvidenceCard;
  compact?: boolean;
  onOpen?: () => void;
  pinned?: boolean;
  dense?: boolean;
  hideFreshness?: boolean;
  language?: AppLanguage;
}) => {
  const [expanded, setExpanded] = useState(false);
  const handlePress = () => {
    if (compact && onOpen) {
      onOpen();
      return;
    }
    setExpanded((current) => !current);
  };
  const compactCardTone =
    compact && card.status === "Blocked"
      ? styles.evidenceCardCompactBlocked
      : compact && card.status === "Warning"
        ? styles.evidenceCardCompactWarning
        : compact && card.status === "Near Trigger"
          ? styles.evidenceCardCompactNear
          : compact && card.status === "Passed"
            ? styles.evidenceCardCompactPassed
            : compact && card.status === "Stale"
              ? styles.evidenceCardCompactStale
              : compact && card.status === "Partial"
                ? styles.evidenceCardCompactPartial
                : compact && card.status === "Mock"
                  ? styles.evidenceCardCompactMock
                  : compact && card.status === "Unavailable"
                    ? styles.evidenceCardCompactUnavailable
                    : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={card.title}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.evidenceCard,
        compact ? styles.evidenceCardCompact : null,
        compact && dense ? styles.evidenceCardCompactDense : null,
        compact ? compactCardTone : null,
        compact ? styles.evidenceCardInteractive : null,
        pressed && compact ? styles.evidenceCardPressed : null,
      ]}
    >
      {compact ? (
        <View
          style={[
            styles.evidenceCompactAccent,
            { backgroundColor: compactStatusAccentColor(card.status) },
          ]}
        />
      ) : null}
      <View style={styles.inlineBetween}>
        <View style={styles.flexOne}>
          {compact ? (
            <View style={styles.evidenceCompactHeaderRow}>
              <Text
                style={[styles.evidenceCardFamilyCompact, dense ? styles.evidenceCardFamilyCompactDense : null]}
                numberOfLines={1}
              >
                {card.family}
              </Text>
              {pinned ? <Text style={styles.evidencePinnedMark}>{t(language, "stocks.evidence.pinned")}</Text> : null}
            </View>
          ) : null}
          <Text
            style={[
              styles.evidenceCardTitle,
              compact ? styles.evidenceCardTitleCompact : null,
              compact && dense ? styles.evidenceCardTitleCompactDense : null,
            ]}
            numberOfLines={compact ? 2 : 1}
          >
            {card.title}
          </Text>
          {!compact ? <Text style={styles.evidenceRole}>{card.role}</Text> : null}
        </View>
        <View style={styles.evidenceCardHeaderMeta}>
          {compact ? (
            <View style={[statusTone(card.status), styles.compactStatusBadge, dense ? styles.compactStatusBadgeDense : null]}>
              <Text style={[styles.compactEvidenceStatusText, dense ? styles.compactEvidenceStatusTextDense : null]} numberOfLines={1}>
                {localizedStatus(language, card.status)}
              </Text>
            </View>
          ) : (
            <>
              {pinned ? <Text style={styles.evidencePinnedMark}>{t(language, "stocks.evidence.pinned")}</Text> : null}
              <StatusShape status={card.status} size={14} />
            </>
          )}
        </View>
      </View>

      {!compact ? <Text style={styles.evidenceSummary}>{card.summary}</Text> : null}

      <View style={compact ? styles.compactVisualContainer : styles.visualContainer}>
        <ThresholdBar card={card} language={language} />
      </View>

      {compact ? (
        <>
          <View style={styles.compactEvidenceFooter}>
            <Text style={[styles.compactEvidenceValue, dense ? styles.compactEvidenceValueDense : null]}>{card.metric.currentLabel}</Text>
            <Text style={[styles.compactEvidenceThreshold, dense ? styles.compactEvidenceThresholdDense : null]} numberOfLines={1}>
              {compactMetricContextLabel(card)}
            </Text>
          </View>
          <View style={styles.compactEvidenceMetaRow}>
            <Text style={[styles.compactEvidenceEffect, dense ? styles.compactEvidenceEffectDense : null]} numberOfLines={1}>
              {card.effect}
            </Text>
            {!hideFreshness ? (
              <View style={styles.compactFreshnessWrap}>
                <View style={freshnessTone(card.freshness)}>
                  <View style={styles.freshnessDot} />
                </View>
                <Text style={[styles.compactFreshnessText, dense ? styles.compactFreshnessTextDense : null]} numberOfLines={1}>
                  {card.freshness === "Unavailable"
                    ? t(language, "stocks.data.noData")
                    : localizedFreshness(language, card.freshness)}
                </Text>
              </View>
            ) : null}
          </View>
        </>
      ) : (
        <>
          <View style={styles.evidenceMetricsRow}>
            <DenseStat label={t(language, "stocks.evidence.current")} value={card.metric.currentLabel} tone="strong" />
            <DenseStat
              label={t(language, "stocks.evidence.threshold")}
              value={card.metric.thresholdLabel ?? t(language, "stocks.evidence.contextOnly")}
            />
          </View>

          {card.relatedConditionLabel ? (
            <Text style={styles.evidenceRelated}>{t(language, "stocks.evidence.recipeLink", { label: card.relatedConditionLabel })}</Text>
          ) : null}

          <Text style={styles.evidenceEffect}>{t(language, "stocks.evidence.effect", { label: card.effect })}</Text>
          <Text style={styles.evidenceWhy}>{t(language, "stocks.evidence.why", { label: card.whyItMatters })}</Text>

          {!hideFreshness ? (
            <View style={styles.metaRow}>
              <MetaPill label={sourceTypeLabel(language, card.sourceType)} />
              {card.metric.comparisonLabel ? <MetaPill label={card.metric.comparisonLabel} /> : null}
            </View>
          ) : null}
        </>
      )}

      {!compact ? (
        <Text style={styles.formulaToggleText}>
          {expanded ? t(language, "stocks.evidence.hideDetails") : t(language, "stocks.evidence.showDetails")}
        </Text>
      ) : null}

      {expanded && !onOpen ? (
        <View style={styles.formulaPanel}>
          <Text style={styles.evidenceRole}>{card.role}</Text>
          <Text style={styles.evidenceSummary}>{card.summary}</Text>
          {card.relatedConditionLabel ? <Text style={styles.evidenceRelated}>{t(language, "stocks.evidence.recipeLink", { label: card.relatedConditionLabel })}</Text> : null}
          <Text style={styles.evidenceEffect}>{t(language, "stocks.evidence.effect", { label: card.effect })}</Text>
          <Text style={styles.evidenceWhy}>{t(language, "stocks.evidence.why", { label: card.whyItMatters })}</Text>
          {!hideFreshness ? (
            <View style={styles.metaRow}>
              <MetaPill label={sourceTypeLabel(language, card.sourceType)} />
              <MetaPill label={localizedFreshness(language, card.freshness)} />
              {card.metric.comparisonLabel ? <MetaPill label={card.metric.comparisonLabel} /> : null}
            </View>
          ) : null}
          <Text style={styles.formulaTitle}>{card.formulaName ?? t(language, "stocks.evidence.formulaDetail")}</Text>
          <Text style={styles.formulaBody}>{card.formulaDescription ?? t(language, "stocks.evidence.formulaMissing")}</Text>
          <Text style={styles.formulaMeta}>
            {t(language, "stocks.evidence.inputs", {
              inputs: card.formulaInputs?.join(", ") ?? t(language, "stocks.evidence.noInputs"),
            })}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
};

const EvidenceGroupView = ({
  group,
  layout = "stack",
  defaultExpanded = true,
  language = "en",
}: {
  group: VisualEvidenceGroup;
  layout?: "stack" | "grid";
  defaultExpanded?: boolean;
  language?: AppLanguage;
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View style={styles.evidenceGroup}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={group.title}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((current) => !current)}
        style={styles.groupHeaderButton}
      >
        <View style={styles.flexOne}>
          <Text style={styles.sectionTitle}>{group.title}</Text>
          <Text style={styles.sectionNote}>{group.note}</Text>
        </View>
        <Text style={styles.groupHeaderToggle}>{expanded ? t(language, "common.hide") : t(language, "common.show")}</Text>
      </Pressable>
      {expanded ? (
        <View style={layout === "grid" ? styles.evidenceGrid : styles.stack}>
          {group.cards.map((card) => (
            <View key={card.id} style={layout === "grid" ? styles.evidenceGridItem : undefined}>
              <EvidenceCardView card={card} compact={layout === "grid"} language={language} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const RecipeConditionMapCard = ({
  eye,
  recipe,
  stock,
  language = "en",
}: {
  eye: Eye;
  recipe: Recipe;
  stock: Stock;
  language?: AppLanguage;
}) => {
  const evaluation = eye.lastEvaluation;
  const [expanded, setExpanded] = useState(false);
  if (!evaluation) return null;

  const passed = (evaluation.conditionResults ?? []).filter((item) => item.passed);
  const failed = (evaluation.conditionResults ?? []).filter((item) => !item.passed && !item.missingData);
  const warnings = (evaluation.conditionResults ?? []).filter((item) => item.role === "Risk Warning" && item.passed);
  const blockers = (evaluation.conditionResults ?? []).filter((item) => item.role === "Hard Disqualifier" && item.passed);
  const nextTrigger =
    failed.find((item) => item.role === "Timing Trigger") ??
    failed.find((item) => item.role === "Eligibility Filter") ??
    failed[0];
  const copy = recipeConditionMapCopy(language);

  return (
    <View style={styles.card}>
      <View style={styles.inlineBetween}>
        <View style={styles.flexOne}>
          <Text style={styles.evidenceCardTitle}>{recipe.name}</Text>
          <Text style={styles.evidenceRole}>
            {stock.symbol} · v{recipe.version}
          </Text>
        </View>
        <View style={styles.panelBadges}>
          <Text style={stateTone(evaluation.currentState)}>{localizedEyeState(language, evaluation.currentState)}</Text>
        </View>
      </View>

      <Text style={[styles.cardBody, { fontWeight: "700" }]}>{evaluation.whyNow}</Text>

      <View style={styles.homeStatsGrid}>
        <DenseStat label={copy.passed} value={`${passed.length}`} tone="strong" />
        <DenseStat label={copy.failed} value={`${failed.length}`} />
        <DenseStat label={copy.warnings} value={`${warnings.length}`} tone={warnings.length > 0 ? "risk" : "neutral"} />
        <DenseStat label={copy.blockers} value={`${blockers.length}`} tone={blockers.length > 0 ? "risk" : "neutral"} />
      </View>

      <View style={styles.analysisGrid}>
        <View style={[styles.analysisGridItem, styles.evidenceCard]}>
          <Text style={styles.inputLabel}>{copy.support}</Text>
          {(evaluation.supportingEvidence ?? []).slice(0, 3).map((item) => (
            <Text key={item} style={[styles.cardBody, { color: "#047857", fontSize: 11, marginTop: 4 }]}>
              + {item}
            </Text>
          ))}
        </View>
        <View style={[styles.analysisGridItem, styles.evidenceCard]}>
          <Text style={styles.inputLabel}>{copy.risks}</Text>
          {[
            ...(evaluation.contradictingEvidence ?? []),
            ...(evaluation.riskWarnings ?? []),
            ...(evaluation.hardDisqualifiers ?? []),
          ]
            .slice(0, 3)
            .map((item) => (
              <Text key={item} style={[styles.cardBody, { color: "#b91c1c", fontSize: 11, marginTop: 4 }]}>
                - {item}
              </Text>
            ))}
        </View>
      </View>

      <View style={styles.metaRow}>
        <MetaPill label={copy.state(evaluation.stateChanged ? copy.stateChanged : copy.stateStable)} />
        <MetaPill label={copy.urgency(evaluation.actionUrgency)} />
        <MetaPill label={localizedSetupStrength(language, evaluation.setupStrength)} />
      </View>

      {nextTrigger ? (
        <Text style={[styles.cardBody, { color: "#111827", fontSize: 12 }]}>{copy.nextTrigger(nextTrigger.explanation)}</Text>
      ) : null}

      {evaluation.missingData.length > 0 || evaluation.staleData.length > 0 ? (
        <Text style={[styles.cardBody, { color: "#92400e", fontSize: 11 }]}>
          {copy.dataIssues([...evaluation.missingData, ...evaluation.staleData].slice(0, 2).join(" | "))}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={expanded ? t(language, "common.hide") : t(language, "common.show")}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((current) => !current)}
        style={styles.actionRow}
      >
        <Text style={styles.buttonPrimaryText}>{expanded ? copy.hideMatrix : copy.showMatrix}</Text>
      </Pressable>

      {expanded ? (
        <View style={[styles.stack, { marginTop: 12 }]}>
          {(evaluation.conditionResults ?? []).map((item) => (
            <View key={item.conditionId} style={styles.inlineBetween}>
              <StatusShape status={item.missingData ? "Partial" : item.passed ? "Passed" : item.role === "Hard Disqualifier" ? "Blocked" : item.role === "Risk Warning" ? "Warning" : "Failed"} size={8} />
              <View style={[styles.flexOne, { marginLeft: 10 }]}>
                <Text style={[styles.evidenceCardTitle, { fontSize: 13 }]}>{item.metricKey ?? copy.condition}</Text>
                <Text style={[styles.cardBody, { fontSize: 12, marginTop: 2 }]}>{item.explanation}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const StockTriageCard = ({
  item,
  recipes,
  onOpenStock,
  onOpenAlerts,
  onOpenJournal,
  onReview,
  language = "en",
}: {
  item: {
    stock: Stock;
    eyes: Eye[];
    decisions: Decision[];
    snapshot?: {
      price: number;
      drawdownPct: number;
      updatedAt: string;
      freshness: FreshnessStatus;
      isMock: boolean;
    };
    openAlerts: Alert[];
    dominantEye?: Eye;
  };
  recipes: Recipe[];
  onOpenStock: () => void;
  onOpenAlerts?: () => void;
  onOpenJournal?: () => void;
  onReview?: () => void;
  language?: AppLanguage;
}) => {
  const [expanded, setExpanded] = useState(false);
  const evaluation = item.dominantEye?.lastEvaluation;
  const topSupport = evaluation?.supportingEvidence?.[0] ?? evaluation?.whyNow ?? t(language, "review.noStrongChange");
  const topRisk =
    evaluation?.hardDisqualifiers?.[0] ??
    evaluation?.riskWarnings?.[0] ??
    evaluation?.contradictingEvidence?.[0] ??
    t(language, "review.noImmediateRisk");

  return (
    <Card highlighted={Boolean(item.openAlerts.length)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.stock.symbol} ${item.stock.name}`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((current) => !current)}
        style={styles.stockTriageHeader}
      >
        <View style={styles.inlineBetween}>
          <View style={styles.flexOne}>
            <Text style={styles.cardEyebrow}>{item.stock.name}</Text>
            <View style={styles.stockTriageTitleRow}>
              <Text style={styles.alertTitle}>{item.stock.symbol}</Text>
              <Text style={styles.stockTriageToggle}>{expanded ? t(language, "common.hide") : t(language, "common.open")}</Text>
            </View>
          </View>
          <Text style={stateTone(evaluation?.currentState)}>{localizedEyeState(language, evaluation?.currentState)}</Text>
        </View>

        <View style={styles.stockTriageSummaryRow}>
          <Text style={styles.stockTriagePrimaryMetric}>
            {item.snapshot ? `$${formatLocaleNumber(language, item.snapshot.price, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "--"}
          </Text>
          <Text style={styles.stockTriageSecondaryMetric}>
            {item.snapshot ? t(language, "stocks.hero.drawdown", { value: `${formatLocaleNumber(language, item.snapshot.drawdownPct)}%` }) : "--"}
          </Text>
          <Text style={styles.stockTriageSecondaryMetric}>{item.openAlerts.length} {t(language, "common.alerts")}</Text>
          <Text style={styles.stockTriageSecondaryMetric}>{localizedFreshness(language, item.snapshot?.freshness ?? "Unavailable")}</Text>
        </View>

        <Text style={styles.stockGroupSummary} numberOfLines={expanded ? 3 : 1}>
          {topSupport}
        </Text>
      </Pressable>

      {expanded ? (
        <View style={styles.stack}>
          <View style={styles.metaRow}>
            <MetaPill label={`${item.eyes.length} ${t(language, "common.eyes")}`} />
            <MetaPill label={`${item.openAlerts.length} ${t(language, "common.alerts")}`} />
            <MetaPill label={localizedFreshness(language, item.snapshot?.freshness ?? "Unavailable")} />
            {item.snapshot ? <MetaPill label={item.snapshot.isMock ? t(language, "stocks.data.dummy") : t(language, "stocks.data.provider")} /> : null}
          </View>

          <View style={styles.detailCallout}>
            <Text style={styles.detailCalloutLabel}>{t(language, "review.topSupport")}</Text>
            <Text style={styles.detailCalloutBody}>{topSupport}</Text>
          </View>
          <View style={styles.detailCallout}>
            <Text style={styles.detailCalloutLabel}>{t(language, "review.topRisk")}</Text>
            <Text style={styles.detailCalloutBody}>{topRisk}</Text>
          </View>

          {item.decisions.length > 0 ? (
            <View style={styles.detailCallout}>
              <Text style={styles.detailCalloutLabel}>{t(language, "review.latestDecision")}</Text>
              <Text style={styles.detailCalloutBody}>
                {localizedDecisionAction(language, item.decisions[0].action)} · {formatShortDate(language, item.decisions[0].createdAt)}
              </Text>
            </View>
          ) : null}

          <View style={styles.metaRow}>
            {item.eyes.slice(0, 3).map((eye) => (
              <MetaPill key={eye.id} label={recipeLabel(recipes, eye.recipeId)} />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <Button label={expanded ? t(language, "common.collapse") : t(language, "common.expand")} tone="secondary" onPress={() => setExpanded((current) => !current)} />
        {onReview ? <Button label={t(language, "common.review")} tone="ghost" onPress={onReview} /> : null}
        {onOpenAlerts ? <Button label={t(language, "common.alerts")} tone="ghost" onPress={onOpenAlerts} /> : null}
        {onOpenJournal && item.decisions.length > 0 ? <Button label={t(language, "common.journal")} tone="ghost" onPress={onOpenJournal} /> : null}
        <Button label={t(language, "common.stock")} onPress={onOpenStock} />
      </View>
    </Card>
  );
};


interface RecipeDraftForm {
  name: string;
  purpose: string;
  opportunityType: string;
  timeHorizon: string;
  intendedUseCase: string;
  notes: string;
  reviewCadenceDays: number;
  alertCooldownHours: number;
}

interface EyeDraftForm {
  stockId: string;
  recipeId: string;
  thesisSnapshot: string;
  plannedEntryLow: string;
  plannedEntryHigh: string;
  invalidationRule: string;
  lastReviewedDaysAgo: number;
}

export default function App() {
  const { data, loading, error, saving, scanning, providerHealth, providerHealthLoading, actions } = useAppModel();
  const [stockEditor, setStockEditor] = useState<string | null>(null);
  const [language, setLanguage] = useState<AppLanguage>("en");
  const [tab, setTab, route] = useWorkspaceNavigation();
  const [routeNotice, setRouteNotice] = useState("");
  const [recipeBuilderStep, setRecipeBuilderStep] = useState<RecipeBuilderStep>("Purpose");
  const [recipeValidationStep, setRecipeValidationStep] = useState<RecipeBuilderStep | "">("");
  const [alertWorkspaceTab, setAlertWorkspaceTab] = useState<Exclude<AlertWorkspaceTab, "Detail">>("Current");
  const [analysisBenchmark, setAnalysisBenchmark] = useState<AnalysisBenchmark>(defaultAnalysisBenchmark);
  const [analysisLookback, setAnalysisLookback] = useState<AnalysisLookback>(defaultAnalysisLookback);
  const [analysisStatusFilter, setAnalysisStatusFilter] = useState<AnalysisStatusFilter>(defaultAnalysisStatusFilter);
  const [stockBoardMode, setStockBoardMode] = useState<StockBoardMode>(defaultStockBoardMode);
  const [homeBucket, setHomeBucket] = useState<HomeBucket>("All");
  const [recipeShelfFilter, setRecipeShelfFilter] = useState<RecipeShelfFilter>("All");
  const [eyesShelfFilter, setEyesShelfFilter] = useState<EyesShelfFilter>("All");
  const [journalFilter, setJournalFilter] = useState<JournalFilter>("All");
  const [logicLabLayer, setLogicLabLayer] = useState<LogicLabLayer>("Sets");

  const [recipeForm, setRecipeForm] = useState<RecipeDraftForm>(defaultRecipeDraftForm());
  const [metricForm, setMetricForm] = useState<MetricDraftForm>(defaultMetricDraftForm());
  const [eyeForm, setEyeForm] = useState<EyeDraftForm>({
    stockId: "",
    recipeId: "",
    thesisSnapshot: "",
    plannedEntryLow: "",
    plannedEntryHigh: "",
    invalidationRule: "",
    lastReviewedDaysAgo: reviewDateOptions[2].daysAgo,
  });
  const [decisionForm, setDecisionForm] = useState({
    eyeId: "",
    alertId: "",
    action: "" as DecisionAction | "",
    note: "",
    concern: "",
    thesisValid: "" as "" | (typeof thesisValidityOptions)[number],
    timing: "" as "" | (typeof timingOptions)[number],
  });
  const [conditionBuilder, setConditionBuilder] = useState<ConditionBuilderState>({
    metricKey: metricCatalog[0].key,
    role: "Eligibility Filter",
    operator: "<=",
    threshold: "-25",
    note: "",
  });
  const [draftConditions, setDraftConditions] = useState<RecipeCondition[]>([]);
  const [selectedEyeId, setSelectedEyeId] = useState("");
  const [selectedAlertId, setSelectedAlertId] = useState("");
  const [selectedStockId, setSelectedStockId] = useState("");
  const [previewStockId, setPreviewStockId] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [visibleStocks, setVisibleStocks] = useState(24);
  const [recentStockIds, setRecentStockIds, recentError] = useSavedStringList("recent", 6);
  const [pinnedMetricKeys, setPinnedMetricKeys, pinError] = useSavedStringList("pinned", 500);
  const [selectedEvidenceCard, setSelectedEvidenceCard] = useState<VisualEvidenceCard | null>(null);
  const [selectedHeroPointIndex, setSelectedHeroPointIndex] = useState(0);
  const [recipeBuilderOpen, setRecipeBuilderOpen] = useState(false);
  const recipeBuilderOperationGate = useRef(createComposerOperationGate()).current;
  const [recipeBuilderEditingId, setRecipeBuilderEditingId] = useState("");
  const [logicSetBuilderOpen, setLogicSetBuilderOpen] = useState(false);
  const [logicSetBuilderEditingId, setLogicSetBuilderEditingId] = useState("");
  const [logicSetForm, setLogicSetForm] = useState<RecipeDraftForm>(defaultRecipeDraftForm());
  const [logicSetSelectedRuleRefs, setLogicSetSelectedRuleRefs] = useState<string[]>([]);
  const [logicSetFormAttempted, setLogicSetFormAttempted] = useState(false);
  const [metricBuilderOpen, setMetricBuilderOpen] = useState(false);
  const [conditionBuilderOpen, setConditionBuilderOpen] = useState(false);
  const [logicL0RegistryOpen, setLogicL0RegistryOpen] = useState(false);
  const [logicInfoTarget, setLogicInfoTarget] = useState<LogicInfoTarget | "">("");
  const [logicVersionsRecipeId, setLogicVersionsRecipeId] = useState("");
  const [metricNumberToken, setMetricNumberToken] = useState("");
  const [metricInsertRawField, setMetricInsertRawField] = useState(expressionParameterRegistry[0].key);
  const [metricFunctionKey, setMetricFunctionKey] = useState("ABS");
  const [metricFunctionArgMode1, setMetricFunctionArgMode1] = useState<"parameter" | "number">("parameter");
  const [metricFunctionArgMode2, setMetricFunctionArgMode2] = useState<"parameter" | "number">("parameter");
  const [metricFunctionArgMode3, setMetricFunctionArgMode3] = useState<"parameter" | "number">("parameter");
  const [metricFunctionArgParameter1, setMetricFunctionArgParameter1] = useState(expressionParameterRegistry[0].key);
  const [metricFunctionArgParameter2, setMetricFunctionArgParameter2] = useState(expressionParameterRegistry[1]?.key ?? expressionParameterRegistry[0].key);
  const [metricFunctionArgParameter3, setMetricFunctionArgParameter3] = useState(expressionParameterRegistry[2]?.key ?? expressionParameterRegistry[0].key);
  const [metricFunctionArgNumber1, setMetricFunctionArgNumber1] = useState("");
  const [metricFunctionArgNumber2, setMetricFunctionArgNumber2] = useState("");
  const [metricFunctionArgNumber3, setMetricFunctionArgNumber3] = useState("");
  const [metricBuilderEditingKey, setMetricBuilderEditingKey] = useState("");
  const [recipeDetailId, setRecipeDetailId] = useState("");
  const [conditionBuilderRecipeId, setConditionBuilderRecipeId] = useState("");
  const [logicRuleEditingContext, setLogicRuleEditingContext] = useState<{ recipeId: string; conditionId?: string } | null>(null);
  const [selectedDecisionId, setSelectedDecisionId] = useState("");
  const [eyeDetailOpen, setEyeDetailOpen] = useState(false);
  const [eyeComposerOpen, setEyeComposerOpen] = useState(false);
  const eyeComposerOperationGate = useRef(createComposerOperationGate()).current;
  const [eyeComposerEditingId, setEyeComposerEditingId] = useState("");
  const [eyeComposerFallbackRef, setEyeComposerFallbackRef] = useState<React.RefObject<any>>();
  const [journalComposerOpen, setJournalComposerOpen] = useState(false);
  const journalComposerOperationGate = useRef(createComposerOperationGate()).current;
  const [journalComposerEditingId, setJournalComposerEditingId] = useState("");
  const journalComposerNewButtonRef = useRef<any>(null);
  const journalSurfaceFallbackRef = useRef<any>(null);
  const homeSurfaceFallbackRef = useRef<any>(null);
  const stocksSurfaceFallbackRef = useRef<any>(null);
  const logicSurfaceFallbackRef = useRef<any>(null);
  const eyesSurfaceFallbackRef = useRef<any>(null);
  const alertsSurfaceFallbackRef = useRef<any>(null);
  const settingsSurfaceFallbackRef = useRef<any>(null);
  const [alertDetailOpen, setAlertDetailOpen] = useState(false);
  const [scannerSignalReviewId, setScannerSignalReviewId] = useState("");
  const [scannerReviewForm, setScannerReviewForm] = useState<ScannerReviewForm>({
    userDecision: "",
    manualReason: "",
    convictionScoreOptional: "",
    notes: "",
    entryPriceOptional: "",
    exitPriceOptional: "",
    resultNotes: "",
  });
  const [metricFormAttempted, setMetricFormAttempted] = useState(false);
  const [eyeFormAttempted, setEyeFormAttempted] = useState(false);
  const [journalValidationSection, setJournalValidationSection] = useState<JournalValidationSection>("");
  const stockEditorFocus = useWindowPanelFocus(stocksSurfaceFallbackRef);
  const conditionBuilderFocus = useWindowPanelFocus(logicSurfaceFallbackRef);
  const logicRegistryFocus = useWindowPanelFocus(logicSurfaceFallbackRef);
  const logicVersionFocus = useWindowPanelFocus(logicSurfaceFallbackRef);
  const logicInfoFocus = useWindowPanelFocus(logicSurfaceFallbackRef);
  const metricBuilderFocus = useWindowPanelFocus(logicSurfaceFallbackRef);
  const logicSetBuilderFocus = useWindowPanelFocus(logicSurfaceFallbackRef);
  const recipeBuilderFocus = useWindowPanelFocus(logicSurfaceFallbackRef);
  const recipeDetailFocus = useWindowPanelFocus(logicSurfaceFallbackRef);
  const eyeDetailFocus = useWindowPanelFocus(eyesSurfaceFallbackRef);
  const eyeComposerFocus = useWindowPanelFocus();
  const alertDetailFocus = useWindowPanelFocus(alertsSurfaceFallbackRef);
  const journalComposerFocus = useWindowPanelFocus(journalSurfaceFallbackRef);
  const decisionDetailFocus = useWindowPanelFocus(journalSurfaceFallbackRef);
  const decisionReturnRouteRef = useRef<{ tab: "Journal" | "Eyes" | "Stocks"; params: Record<string, string> }>({ tab: "Journal", params: {} });
  const scannerReviewFocus = useWindowPanelFocus(logicSurfaceFallbackRef);
  const metricDetailFocus = useWindowPanelFocus(stocksSurfaceFallbackRef);
  const deferredStockSearch = useDeferredValue(stockSearch);
  const { width: viewportWidth } = useWindowDimensions();
  const isCompactPhone = viewportWidth < 390;
  const isVeryCompactPhone = viewportWidth < 360;
  const logicLabMetricCatalog = useMemo(
    () =>
      ([...metricCatalog, ...(data?.customMetrics ?? [])].map((metric) =>
        metric.origin === "custom" ? { ...metric, origin: "custom" as const } : metric,
      ) as MetricDefinition[]),
    [data?.customMetrics],
  );
  const logicMetricKeySet = useMemo(
    () => new Set(logicLabMetricCatalog.map((metric) => metric.key)),
    [logicLabMetricCatalog],
  );
  const logicLabCompatibleRecipes = useMemo(
    () =>
      (data?.recipes ?? []).filter((recipe) =>
        recipe.conditions.every(
          (condition) => !condition.metricKey || logicMetricKeySet.has(condition.metricKey),
        ),
      ),
    [data?.recipes, logicMetricKeySet],
  );

  useEffect(() => {
    loadAppLanguage().then(setLanguage);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const style = document.createElement("style");
    style.setAttribute("data-stockledger-focus", "true");
    style.textContent = `
      #stockledger-root [tabindex="0"]:focus-visible,
      #stockledger-root input:focus-visible,
      #stockledger-root textarea:focus-visible {
        outline: 3px solid #2563eb;
        outline-offset: 2px;
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  const eyesSorted = useMemo(
    () =>
      [...(data?.eyes ?? [])].filter(eye => !eye.archivedAt && !data?.stocks.find(stock => stock.id === eye.stockId)?.archivedAt).sort((a, b) => {
        const stateDelta =
          statePriority.indexOf(a.lastEvaluation?.currentState ?? "Not Relevant") -
          statePriority.indexOf(b.lastEvaluation?.currentState ?? "Not Relevant");
        return stateDelta !== 0
          ? stateDelta
          : urgencyWeight(a.lastEvaluation?.actionUrgency) - urgencyWeight(b.lastEvaluation?.actionUrgency);
      }),
    [data?.eyes],
  );

  const alertQueue = useMemo(
    () =>
      [...(data?.alerts ?? [])].sort(
        (a, b) => Number(a.reviewed) - Number(b.reviewed) || b.createdAt.localeCompare(a.createdAt),
      ),
    [data?.alerts],
  );
  const snoozedAlerts = useMemo(
    () =>
      alertQueue.filter(
        (alert) => Boolean(alert.snoozedUntil) && new Date(alert.snoozedUntil!).getTime() > Date.now(),
      ),
    [alertQueue],
  );
  const alertHistory = useMemo(
    () =>
      alertQueue.filter(
        (alert) =>
          alert.reviewed || (Boolean(alert.snoozedUntil) && new Date(alert.snoozedUntil!).getTime() > Date.now()),
      ),
    [alertQueue],
  );
  const latestScanRun = data?.scanRuns?.[0];
  const latestScanSignals = useMemo(
    () =>
      data?.scanSignals.filter((signal) => signal.scanRunId === latestScanRun?.id) ?? [],
    [data?.scanSignals, latestScanRun?.id],
  );
  const latestProcessedFeatureDate =
    latestScanRun?.latestExpectedTradingDate ??
    (data?.processedFeatures ?? []).reduce<string>(
      (latest, feature) => (feature.asOfDate > latest ? feature.asOfDate : latest),
      "",
    );
  const latestProcessedFeatures = useMemo(
    () =>
      latestProcessedFeatureDate
        ? (data?.processedFeatures ?? []).filter((feature) => feature.asOfDate === latestProcessedFeatureDate)
        : [],
    [data?.processedFeatures, latestProcessedFeatureDate],
  );
  const matchedScannerSignals = useMemo(
    () => latestScanSignals.filter((signal) => signal.status === "MATCHED"),
    [latestScanSignals],
  );
  const nearScannerSignals = useMemo(
    () => latestScanSignals.filter((signal) => signal.status === "NEAR_MATCH"),
    [latestScanSignals],
  );
  const blockedScannerSignals = useMemo(
    () => latestScanSignals.filter((signal) => signal.status === "BLOCKED_OR_INCOMPLETE_DATA"),
    [latestScanSignals],
  );
  const scannerReviewLogsBySignal = useMemo(
    () =>
      new Map((data?.reviewLogs ?? []).map((entry) => [entry.signalId, entry] as const)),
    [data?.reviewLogs],
  );

  const stockDirectory = useMemo(() => {
    if (!data) return [];
    const now = Date.now();
    return data.stocks
      .filter(stock => !stock.archivedAt)
      .map((stock) => {
        const eyes = data.eyes.filter((eye) => eye.stockId === stock.id && !eye.archivedAt);
        const snapshot = data.snapshots.find((item) => item.stockId === stock.id);
        const openAlerts = data.alerts.filter(
          (alert) =>
            !alert.reviewed &&
            (!alert.snoozedUntil || new Date(alert.snoozedUntil).getTime() <= now) &&
            eyes.some((eye) => eye.id === alert.eyeId),
        );
        const dominantEye = [...eyes].sort((a, b) => {
          const stateDelta =
            statePriority.indexOf(a.lastEvaluation?.currentState ?? "Not Relevant") -
            statePriority.indexOf(b.lastEvaluation?.currentState ?? "Not Relevant");
          return stateDelta !== 0
            ? stateDelta
            : urgencyWeight(a.lastEvaluation?.actionUrgency) - urgencyWeight(b.lastEvaluation?.actionUrgency);
        })[0];

        return {
          stock,
          eyes,
          snapshot,
          openAlerts,
          dominantEye,
          decisions: data.decisions.filter((decision) =>
            eyes.some((eye) => eye.id === decision.eyeId),
          ),
        };
      })
      .sort((a, b) => {
        const left = a.dominantEye?.lastEvaluation?.currentState ?? "Not Relevant";
        const right = b.dominantEye?.lastEvaluation?.currentState ?? "Not Relevant";
        const stateDelta = statePriority.indexOf(left) - statePriority.indexOf(right);
        return stateDelta !== 0 ? stateDelta : a.stock.symbol.localeCompare(b.stock.symbol);
      });
  }, [data]);

  const filteredStockDirectory = useMemo(() => {
    const normalizedQuery = deferredStockSearch.trim().toLowerCase();
    const matches = stockDirectory.filter((item) => {
      if (!normalizedQuery) return true;
      return stockSearchScore(normalizedQuery, item) > 0;
    });

    if (!normalizedQuery) return matches;

    return [...matches].sort((left, right) => {
      const scoreDelta = stockSearchScore(normalizedQuery, right) - stockSearchScore(normalizedQuery, left);
      return scoreDelta !== 0 ? scoreDelta : left.stock.symbol.localeCompare(right.stock.symbol);
    });
  }, [deferredStockSearch, stockDirectory]);

  useEffect(() => {
    if (route.params.eyeId) {
      if (selectedEyeId && !eyesSorted.some((eye) => eye.id === selectedEyeId)) setSelectedEyeId("");
      return;
    }
    if (!selectedEyeId && eyesSorted[0]) {
      setSelectedEyeId(eyesSorted[0].id);
      return;
    }
    if (selectedEyeId && !eyesSorted.some((eye) => eye.id === selectedEyeId)) {
      setSelectedEyeId(eyesSorted[0]?.id ?? "");
    }
  }, [eyesSorted, route.params.eyeId, selectedEyeId]);

  useEffect(() => {
    if (selectedStockId && !stockDirectory.some((item) => item.stock.id === selectedStockId)) {
      setSelectedStockId("");
    }
  }, [selectedStockId, stockDirectory]);

  useEffect(() => {
    if (!selectedStockId) {
      setSelectedEvidenceCard(null);
    }
  }, [selectedStockId]);

  useEffect(() => {
    if (!selectedStockId) {
      setSelectedHeroPointIndex(0);
    }
  }, [selectedStockId]);

  useEffect(() => {
    if (route.params.alertId) {
      if (selectedAlertId && !data?.alerts.some((alert) => alert.id === selectedAlertId)) {
        setSelectedAlertId("");
      }
      return;
    }
    if (!selectedAlertId && alertQueue[0]) {
      setSelectedAlertId(alertQueue[0].id);
      return;
    }
    if (selectedAlertId && !alertQueue.some((alert) => alert.id === selectedAlertId)) {
      setSelectedAlertId(alertQueue[0]?.id ?? "");
    }
  }, [alertQueue, data?.alerts, route.params.alertId, selectedAlertId]);

  useEffect(() => {
    if (!previewStockId && data?.stocks[0]) {
      setPreviewStockId(data.stocks[0].id);
      return;
    }
    if (previewStockId && !data?.stocks.some((stock) => stock.id === previewStockId)) {
      setPreviewStockId(data?.stocks[0]?.id ?? "");
    }
  }, [data?.stocks, previewStockId]);

  useEffect(() => {
    if (!data) return;
    const { params } = route;
    let unavailable = false;
    const markUnavailable = () => { unavailable = true; };

    if (params.stockId) {
      const stock = data.stocks.find((item) => item.id === params.stockId);
      if (!stock || stock.archivedAt) markUnavailable();
      else {
        setSelectedStockId(stock.id);
        setStockSearch("");
      }
      if (!stock || stock.archivedAt) {
        setSelectedStockId("");
        setStockSearch("");
      }
    }
    if (params.metricId && (!params.stockId || !data.stocks.some((item) => item.id === params.stockId && !item.archivedAt))) {
      markUnavailable();
    }

    if (route.tab === "Eyes" && params.eyeId) {
      const eye = data.eyes.find((item) => item.id === params.eyeId);
      const stock = eye ? data.stocks.find((item) => item.id === eye.stockId) : undefined;
      if (!eye || eye.archivedAt || !stock || stock.archivedAt) markUnavailable();
      else {
        setSelectedEyeId(eye.id);
        setEyeDetailOpen(true);
      }
      if (!eye || eye.archivedAt || !stock || stock.archivedAt) {
        setSelectedEyeId("");
        setEyeDetailOpen(false);
      }
    } else if (!params.eyeId) {
      setEyeDetailOpen(false);
    }

    if (route.tab === "Alerts" && params.alertId) {
      const alert = data.alerts.find((item) => item.id === params.alertId);
      if (!alert) markUnavailable();
      else {
        setSelectedAlertId(alert.id);
        setAlertWorkspaceTab(alert.reviewed ? "History" : "Current");
        setAlertDetailOpen(true);
      }
      if (!alert) {
        setSelectedAlertId("");
        setAlertDetailOpen(false);
      }
    } else if (!params.alertId) {
      setAlertDetailOpen(false);
    }

    const decisionId = params.decisionId ?? (params.outcomeId
      ? data.outcomes.find((outcome) => outcome.id === params.outcomeId)?.decisionId
      : undefined);
    if (route.tab === "Journal" && decisionId) {
      const decision = data.decisions.find((item) => item.id === decisionId);
      const eye = decision ? data.eyes.find((item) => item.id === decision.eyeId) : undefined;
      const stock = eye ? data.stocks.find((item) => item.id === eye.stockId) : undefined;
      if (!decision || decision.archivedAt || !eye || eye.archivedAt || !stock || stock.archivedAt) markUnavailable();
      else setSelectedDecisionId(decision.id);
      if (!decision || decision.archivedAt || !eye || eye.archivedAt || !stock || stock.archivedAt) {
        setSelectedDecisionId("");
      }
    } else if (!params.decisionId && !params.outcomeId) {
      setSelectedDecisionId("");
    }

    if (route.tab === "Logic Lab" && params.recipeId) {
      const recipe = data.recipes.find((item) => item.id === params.recipeId);
      if (!recipe || recipe.retiredAt) markUnavailable();
      else setRecipeDetailId(recipe.id);
      if (!recipe || recipe.retiredAt) setRecipeDetailId("");
    } else if (!params.recipeId) {
      setRecipeDetailId("");
    }

    if (!params.metricId) setSelectedEvidenceCard(null);

    setRouteNotice(unavailable ? t(language, "route.entityUnavailable") : "");
  }, [data, language, route]);

  useEffect(() => {
    if (!conditionBuilderRecipeId && logicLabCompatibleRecipes[0]) {
      setConditionBuilderRecipeId(logicLabCompatibleRecipes[0].id);
      return;
    }
    if (conditionBuilderRecipeId && !logicLabCompatibleRecipes.some((recipe) => recipe.id === conditionBuilderRecipeId)) {
      setConditionBuilderRecipeId(logicLabCompatibleRecipes[0]?.id ?? "");
    }
  }, [conditionBuilderRecipeId, logicLabCompatibleRecipes]);


  useEffect(() => {
    const nextMetric =
      logicLabMetricCatalog.find((metric) => metric.key === conditionBuilder.metricKey) ?? logicLabMetricCatalog[0];
    const nextFormula = getFormulaDefinition(nextMetric?.formulaKey ?? "");
    if (!nextMetric || !nextFormula) return;
    const allowedOperators = operatorOptionsForMetric(nextMetric, nextFormula);
    const control = metricControlConfig(nextMetric, nextFormula);
    setConditionBuilder((current) => {
      let threshold = current.threshold;
      if (control.type === "enum" && !control.options.includes(current.threshold)) {
        threshold = control.options[0];
      }
      if (control.type === "number" && Number.isNaN(Number(current.threshold))) {
        threshold = String(control.min);
      }
      return {
        ...current,
        operator: allowedOperators.includes(current.operator) ? current.operator : allowedOperators[0],
        threshold,
      };
    });
  }, [conditionBuilder.metricKey, logicLabMetricCatalog]);

  useEffect(() => {
    if (metricForm.builderMode !== "raw") return;
    if (!metricForm.rawParameterKey) return;
    setMetricForm((current) =>
      current.expression === current.rawParameterKey
        ? current
        : {
            ...current,
            expression: current.rawParameterKey,
          },
    );
  }, [metricForm.builderMode, metricForm.rawParameterKey]);

  useEffect(() => {
    if (metricForm.builderMode !== "equation") return;
    const referenced = referencedExpressionParameters(metricForm.expression);
    setMetricForm((current) => {
      const same =
        referenced.length === current.selectedRawFields.length &&
        referenced.every((key, index) => key === current.selectedRawFields[index]);
      return same
        ? current
        : {
            ...current,
            selectedRawFields: referenced,
          };
    });
  }, [metricForm.builderMode, metricForm.expression]);

  const preSelectedStockSummary =
    filteredStockDirectory.find((item) => item.stock.id === selectedStockId) ??
    stockDirectory.find((item) => item.stock.id === selectedStockId);
  const preSelectedStockAnalysisGroups =
    preSelectedStockSummary?.snapshot
      ? buildStockVisualAnalysisGroups({
          stock: preSelectedStockSummary.stock,
          snapshot: preSelectedStockSummary.snapshot,
          eyes: preSelectedStockSummary.eyes,
          recipes: data?.recipes ?? [],
          benchmark: analysisBenchmark,
          lookbackLabel: analysisLookback,
          language,
        }).map((group) => ({
          ...group,
          cards: group.cards.filter((card) => matchesAnalysisStatus(card.status, analysisStatusFilter)),
        }))
      : [];
  const preSelectedStockAnalysisCards = preSelectedStockAnalysisGroups.flatMap((group) =>
    group.cards.map((card) => ({
      ...card,
      title: card.title,
    })),
  );
  const preSortedSelectedStockAnalysisCards = !preSelectedStockSummary
    ? preSelectedStockAnalysisCards
    : [...preSelectedStockAnalysisCards].sort((left, right) => {
        const leftPinned = pinnedMetricKeys.includes(
          stockMetricPreferenceKey(preSelectedStockSummary.stock.id, left.id),
        );
        const rightPinned = pinnedMetricKeys.includes(
          stockMetricPreferenceKey(preSelectedStockSummary.stock.id, right.id),
        );

        if (stockBoardMode === "Pinned First" && leftPinned !== rightPinned) {
          return Number(rightPinned) - Number(leftPinned);
        }

        if (stockBoardMode === "Status") {
          const statusDelta = stockMetricStatusRank(left.status) - stockMetricStatusRank(right.status);
          if (statusDelta !== 0) return statusDelta;
        }

        if (stockBoardMode === "Family") {
          const familyDelta = stockMetricFamilyRank(left.family) - stockMetricFamilyRank(right.family);
          if (familyDelta !== 0) return familyDelta;
        }

        if (leftPinned !== rightPinned) {
          return Number(rightPinned) - Number(leftPinned);
        }

        const statusDelta = stockMetricStatusRank(left.status) - stockMetricStatusRank(right.status);
        if (statusDelta !== 0) return statusDelta;

        const familyDelta = stockMetricFamilyRank(left.family) - stockMetricFamilyRank(right.family);
        if (familyDelta !== 0) return familyDelta;

        return left.title.localeCompare(right.title);
      });
  const preSelectedEvidenceIndex = selectedEvidenceCard
    ? preSortedSelectedStockAnalysisCards.findIndex((card) => card.id === selectedEvidenceCard.id)
    : -1;
  const preSelectedStockTrendSeries = preSelectedStockSummary?.snapshot?.priceHistorySeries ?? [];

  useEffect(() => {
    if (!route.params.metricId || !route.params.stockId || preSelectedStockSummary?.stock.id !== route.params.stockId) {
      if (!route.params.metricId) setSelectedEvidenceCard(null);
      return;
    }
    const card = preSortedSelectedStockAnalysisCards.find((item) => item.id === route.params.metricId);
    if (card) {
      setSelectedEvidenceCard((current) => current?.id === card.id ? current : card);
      return;
    }
    setSelectedEvidenceCard(null);
    if (preSelectedStockSummary) setRouteNotice(t(language, "route.metricUnavailable"));
  }, [language, preSelectedStockAnalysisCards, preSelectedStockSummary, preSortedSelectedStockAnalysisCards, route.params.metricId]);

  useEffect(() => {
    if (!selectedEvidenceCard) return;
    if (preSelectedEvidenceIndex >= 0) return;
    setSelectedEvidenceCard(null);
  }, [selectedEvidenceCard, preSelectedEvidenceIndex]);

  useEffect(() => {
    if (preSelectedStockTrendSeries.length === 0) {
      setSelectedHeroPointIndex(0);
      return;
    }
    setSelectedHeroPointIndex(preSelectedStockTrendSeries.length - 1);
  }, [selectedStockId, analysisLookback, analysisBenchmark, preSelectedStockTrendSeries.length]);

  if (!loading && !data && error) return <RecoveryPanel error={error} retry={actions.retryLoad} actions={actions} language={language} />;

  if (loading || !data) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <Text style={styles.loadingText}>{t(language, "common.loading")}</Text>
      </View>
    );
  }

  const selectedEye = eyesSorted.find((eye) => eye.id === selectedEyeId) ?? (route.params.eyeId ? undefined : eyesSorted[0]);
  const selectedEyeStock = selectedEye
    ? data.stocks.find((stock) => stock.id === selectedEye.stockId)
    : undefined;
  const selectedEyeRecipe = selectedEye
    ? data.recipes.find((recipe) => recipe.id === selectedEye.recipeId)
    : undefined;
  const selectedStockSummary =
    filteredStockDirectory.find((item) => item.stock.id === selectedStockId) ??
    stockDirectory.find((item) => item.stock.id === selectedStockId);
  const selectedConditionMetric =
    logicLabMetricCatalog.find((metric) => metric.key === conditionBuilder.metricKey) ?? logicLabMetricCatalog[0];
  const selectedConditionFormula = getFormulaDefinition(selectedConditionMetric?.formulaKey ?? "");
  const selectedOperatorOptions = operatorOptionsForMetric(selectedConditionMetric, selectedConditionFormula);
  const selectedConditionControl = metricControlConfig(selectedConditionMetric, selectedConditionFormula);
  const selectedAlert = data.alerts.find((alert) => alert.id === selectedAlertId) ?? (route.params.alertId ? undefined : alertQueue[0]);
  const openAlerts = data.alerts.filter(
    (alert) => !alert.reviewed && (!alert.snoozedUntil || new Date(alert.snoozedUntil).getTime() <= Date.now()),
  ).length;
  const reviewedAlerts = data.alerts.filter((alert) => alert.reviewed);
  const criticalEyes = data.eyes.filter((eye) =>
    ["Attention Needed", "Thesis Risk Rising", "Thesis Broken"].includes(
      eye.lastEvaluation?.currentState ?? "",
    ),
  ).length;
  const opportunityEyes = data.eyes.filter(
    (eye) => eye.lastEvaluation?.currentState === "Opportunity Zone Forming",
  ).length;

  const selectedAlertEye = selectedAlert
    ? data.eyes.find((eye) => eye.id === selectedAlert.eyeId)
    : undefined;
  const selectedAlertRecipe = selectedAlertEye
    ? data.recipes.find((recipe) => recipe.id === (selectedAlert?.recipeId ?? selectedAlertEye.recipeId))
    : undefined;
  const selectedAlertEvaluation = data.evaluations?.find(evaluation => evaluation.id === selectedAlert?.evaluationId);
  const selectedAlertDecision = selectedAlert
    ? data.decisions.find((decision) => decision.alertId === selectedAlert.id)
    : undefined;
  const selectedStockEyes = selectedStockSummary?.eyes ?? [];
  const selectedStockAnalysisGroups =
    selectedStockSummary?.snapshot
      ? buildStockVisualAnalysisGroups({
          stock: selectedStockSummary.stock,
          snapshot: selectedStockSummary.snapshot,
          eyes: selectedStockSummary.eyes,
          recipes: data.recipes,
          benchmark: analysisBenchmark,
          lookbackLabel: analysisLookback,
          language,
        }).map((group) => ({
          ...group,
          cards: group.cards.filter((card) => matchesAnalysisStatus(card.status, analysisStatusFilter)),
        }))
      : [];
  const selectedStockAnalysisCards = selectedStockAnalysisGroups.flatMap((group) =>
    group.cards.map((card) => ({
      ...card,
      title: card.title,
    })),
  );
  const sortedSelectedStockAnalysisCards = !selectedStockSummary
    ? selectedStockAnalysisCards
    : [...selectedStockAnalysisCards].sort((left, right) => {
        const leftPinned = pinnedMetricKeys.includes(
          stockMetricPreferenceKey(selectedStockSummary.stock.id, left.id),
        );
        const rightPinned = pinnedMetricKeys.includes(
          stockMetricPreferenceKey(selectedStockSummary.stock.id, right.id),
        );

        if (stockBoardMode === "Pinned First" && leftPinned !== rightPinned) {
          return Number(rightPinned) - Number(leftPinned);
        }

        if (stockBoardMode === "Status") {
          const statusDelta = stockMetricStatusRank(left.status) - stockMetricStatusRank(right.status);
          if (statusDelta !== 0) return statusDelta;
        }

        if (stockBoardMode === "Family") {
          const familyDelta = stockMetricFamilyRank(left.family) - stockMetricFamilyRank(right.family);
          if (familyDelta !== 0) return familyDelta;
        }

        if (leftPinned !== rightPinned) {
          return Number(rightPinned) - Number(leftPinned);
        }

        const statusDelta = stockMetricStatusRank(left.status) - stockMetricStatusRank(right.status);
        if (statusDelta !== 0) return statusDelta;

        const familyDelta = stockMetricFamilyRank(left.family) - stockMetricFamilyRank(right.family);
        if (familyDelta !== 0) return familyDelta;

        return left.title.localeCompare(right.title);
      });
  const selectedEvidenceIndex = selectedEvidenceCard
    ? sortedSelectedStockAnalysisCards.findIndex((card) => card.id === selectedEvidenceCard.id)
    : -1;
  const chartData = buildChartData(selectedStockSummary?.snapshot, analysisLookback, analysisBenchmark);
  const selectedStockTrendSeries = chartData.prices;
  const selectedStockBenchmarkSeries = chartData.benchmarkPrices;
  const chartReturns = [...chartData.returns, ...chartData.benchmarkReturns];
  const selectedStockChartBounds = chartReturns.length ? { min: Math.min(...chartReturns), max: Math.max(...chartReturns) } : undefined;
  const selectedStockTrendDisplaySeries = normalizeSeries(chartData.returns, selectedStockChartBounds);
  const selectedStockBenchmarkDisplaySeries = normalizeSeries(chartData.benchmarkReturns, selectedStockChartBounds);
  const selectedStockHeroRange = selectedStockTrendSeries.length
    ? {
        low: Math.min(...selectedStockTrendSeries),
        high: Math.max(...selectedStockTrendSeries),
        latest: selectedStockTrendSeries[selectedStockTrendSeries.length - 1],
      }
    : null;
  const safeSelectedHeroPointIndex =
    selectedStockTrendSeries.length > 0
      ? Math.max(0, Math.min(selectedHeroPointIndex, selectedStockTrendSeries.length - 1))
      : 0;
  const selectedHeroPrice = selectedStockTrendSeries[safeSelectedHeroPointIndex];
  const selectedHeroBenchmark = selectedStockBenchmarkSeries[safeSelectedHeroPointIndex];
  const selectedHeroPointLabel = chartData.dates[safeSelectedHeroPointIndex]
    ? formatLocaleDate(language, chartData.dates[safeSelectedHeroPointIndex])
    : t(language, "stocks.hero.noCompletedHistory");
  const selectedHeroBenchmarkDelta = chartData.returns[safeSelectedHeroPointIndex] !== undefined && chartData.benchmarkReturns[safeSelectedHeroPointIndex] !== undefined
    ? chartData.returns[safeSelectedHeroPointIndex] - chartData.benchmarkReturns[safeSelectedHeroPointIndex] : undefined;
  const recentStocks = recentStockIds
    .map((id) => stockDirectory.find((item) => item.stock.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const hasStockQuery = deferredStockSearch.trim().length > 0;
  const stockCandidates = hasStockQuery ? filteredStockDirectory : [...recentStocks, ...stockDirectory.filter(item => !recentStockIds.includes(item.stock.id))];
  const stockSuggestions = stockCandidates.slice(0, visibleStocks);
  const topSuggestionId = hasStockQuery ? stockSuggestions[0]?.stock.id : "";
  const pinnedCountForSelectedStock = selectedStockSummary
    ? pinnedMetricKeys.filter((key) => key.startsWith(`${selectedStockSummary.stock.id}:`)).length
    : 0;
  const stockControlsDirty =
    analysisBenchmark !== defaultAnalysisBenchmark ||
    analysisLookback !== defaultAnalysisLookback ||
    analysisStatusFilter !== defaultAnalysisStatusFilter ||
    stockBoardMode !== defaultStockBoardMode;

  const eyeReviewCadenceElapsed = (eye: Eye) => {
    if (!eye.lastReviewedAt) return false;
    const reviewedAt = new Date(eye.lastReviewedAt).getTime();
    const cadenceDays = data.recipes.find((recipe) => recipe.id === eye.recipeId)?.reviewConfig?.cadenceDays;
    return typeof cadenceDays === "number" && Number.isFinite(reviewedAt) && Date.now() - reviewedAt >= cadenceDays * 24 * 60 * 60 * 1000;
  };
  const eyeNeedsReview = (eye: Eye) => {
    const stateNeedsReview = !eye.lastEvaluation || ["Attention Needed", "Opportunity Zone Forming", "Watch Closely"].includes(eye.lastEvaluation.currentState);
    if (stateNeedsReview) return true;
    if (!eye.lastReviewedAt) return true;
    if (!Number.isFinite(new Date(eye.lastReviewedAt).getTime())) return true;
    return eyeReviewCadenceElapsed(eye);
  };
  const eyeIsQuiet = (eye: Eye) => Boolean(eye.lastEvaluation && ["Not Relevant", "Thesis Broken"].includes(eye.lastEvaluation.currentState));
  const activeEyesInventory = eyesSorted.filter((eye) => !eyeIsQuiet(eye) || eyeNeedsReview(eye));
  const inactiveEyesInventory = eyesSorted.filter((eye) => eyeIsQuiet(eye) && !eyeNeedsReview(eye));
  const filteredActiveEyesInventory = activeEyesInventory.filter((eye) => {
    if (eyesShelfFilter === "All") return true;
    if (eyesShelfFilter === "Needs Review") return eyeNeedsReview(eye);
    return eye.lastEvaluation?.currentState === "Not Relevant" || eye.lastEvaluation?.currentState === "Thesis Broken";
  });
  const filteredInactiveEyesInventory = inactiveEyesInventory.filter((eye) => {
    if (eyesShelfFilter === "All") return true;
    if (eyesShelfFilter === "Quiet") return true;
    return false;
  });
  const toEyeFlowRow = (eye: Eye): EyeFlowRow => {
    const state = eye.lastEvaluation?.currentState;
    const eyeRecipe = data.recipes.find((recipe) => recipe.id === eye.recipeId);
    return {
      id: eye.id,
      stockId: eye.stockId,
      recipeId: eye.recipeId,
      stockLabel: stockLabel(data.stocks, eye.stockId),
      recipeLabel: recipeLabel(data.recipes, eye.recipeId),
      thesisSnapshot: eye.thesisSnapshot,
      currentState: state ? localizedEyeState(language, state) : t(language, "eyes.notEvaluated"),
      stateTone: eyeBadgeTone(state),
      whyNow: eyeReviewCadenceElapsed(eye)
        ? t(language, "eyes.detail.cadenceElapsed")
        : localizedEvaluationWhyNow(language, eye.lastEvaluation, eyeRecipe) || t(language, "eyes.detail.noSummary"),
      urgency: localizedActionUrgency(language, eye.lastEvaluation?.actionUrgency ?? t(language, "eyes.meta.wait")),
      recipeVersion: eye.recipeVersionAtCreation ?? eye.lastEvaluation?.recipeVersion
        ? `v${eye.recipeVersionAtCreation ?? eye.lastEvaluation?.recipeVersion}`
        : t(language, "eyes.detail.noVersion"),
      lastReview: eye.lastReviewedAt ? formatShortDate(language, eye.lastReviewedAt) : t(language, "eyes.meta.reviewDue"),
      dataQuality: eye.lastEvaluation
        ? localizedEvaluationDataQuality(language, eye.lastEvaluation.dataQuality)
        : t(language, "eyes.notEvaluated"),
      needsReview: eyeNeedsReview(eye),
    };
  };
  const activeEyeFlowRows = filteredActiveEyesInventory.map(toEyeFlowRow);
  const quietEyeFlowRows = filteredInactiveEyesInventory.map(toEyeFlowRow);
  const selectedRecipe = data.recipes.find((recipe) => recipe.id === recipeDetailId);
  const selectedRecipeLinkedEyes = selectedRecipe
    ? data.eyes.filter((eye) => eye.recipeId === selectedRecipe.id)
    : [];
  const selectedRecipeWatchedStocks = selectedRecipe
    ? new Set(selectedRecipeLinkedEyes.map((eye) => eye.stockId)).size
    : 0;
  const filteredRecipes = data.recipes.filter((recipe) => {
    if (recipeShelfFilter === "All") return true;
    if (recipeShelfFilter === "Starter") return starterRecipeNames.includes(recipe.name);
    if (recipeShelfFilter === "Custom") return !starterRecipeNames.includes(recipe.name);
    return new Date(recipe.createdAt).getTime() >= Date.now() - 1000 * 60 * 60 * 24 * 14;
  });
  const logicLabRecipes = [...logicLabCompatibleRecipes]
    .sort((left, right) => {
    const lineageDelta = recipeLineageKey(left).localeCompare(recipeLineageKey(right));
    if (lineageDelta !== 0) return lineageDelta;
    return right.version - left.version;
  });
  const selectedLogicVersionRecipe = logicVersionsRecipeId
    ? data.recipes.find((recipe) => recipe.id === logicVersionsRecipeId)
    : undefined;
  const selectedLogicVersionLineage = selectedLogicVersionRecipe
    ? [...data.recipes]
        .filter((recipe) => recipeLineageKey(recipe) === recipeLineageKey(selectedLogicVersionRecipe))
        .sort((left, right) => right.version - left.version)
    : [];
  const journalHistory = data.decisions.filter(decision => !decision.archivedAt).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const filteredJournalHistory = journalHistory.filter((decision) => {
    if (journalFilter === "All") return true;
    if (journalFilter === "Entered") return decision.action === "Entered";
    if (journalFilter === "Skipped") return decision.action === "Skipped";
    return decision.thesisValid !== "Yes" || decision.action === "Marked Thesis Broken";
  });
  const selectedDecision = data.decisions.find((decision) => decision.id === selectedDecisionId);
  const selectedDecisionOutcome = selectedDecision
    ? data.outcomes.find((outcome) => outcome.decisionId === selectedDecision.id)
    : undefined;
  const selectedDecisionDetail = selectedDecision ? {
    action: localizedDecisionAction(language, selectedDecision.action),
    linkedContext: decisionTitle(selectedDecision.eyeId, data.eyes, data.stocks, data.recipes),
    recordedAt: formatLocaleDateTime(language, selectedDecision.createdAt),
    recordedState: selectedDecision.stateAtDecision ? localizedEyeState(language, selectedDecision.stateAtDecision) : t(language, "journal.detail.noState"),
    dataQuality: selectedDecision.dataQuality || t(language, "journal.detail.noData"),
    thesisTiming: t(language, "journal.detail.thesisTiming", {
      thesis: localizedThesisValidity(language, selectedDecision.thesisValid),
      timing: localizedTiming(language, selectedDecision.timing),
    }),
    note: selectedDecision.note || t(language, "journal.detail.noNote"),
    concern: selectedDecision.concern || t(language, "journal.detail.noConcern"),
    outcome: selectedDecisionOutcome ? {
      status: localizedOutcomeStatus(language, selectedDecisionOutcome.status ?? "Pending"),
      isReviewed: selectedDecisionOutcome.status === "Reviewed",
      lesson: selectedDecisionOutcome.lesson,
      recipeSuggestion: selectedDecisionOutcome.recipeSuggestion,
      reviewWindow: selectedDecisionOutcome.reviewWindow,
      priceChangeNote: selectedDecisionOutcome.priceChangeNote,
    } : undefined,
    amendments: selectedDecision.amendments?.map((amendment) => ({
      amendedAt: formatLocaleDateTime(language, amendment.amendedAt),
      action: localizedDecisionAction(language, amendment.action),
      note: amendment.note,
    })) ?? [],
  } : null;

  const groupedAlertQueue = stockDirectory
    .map((item) => ({
      ...item,
      openAlerts: item.openAlerts.filter(
        (alert) => !alert.snoozedUntil || new Date(alert.snoozedUntil).getTime() <= Date.now(),
      ),
    }))
    .filter((item) => item.openAlerts.length > 0)
    .map((item) => {
      const groupedByRecipe = item.openAlerts.reduce<Record<string, Alert[]>>((accumulator, alert) => {
        const eye = item.eyes.find((candidate) => candidate.id === alert.eyeId);
        const recipeName = eye ? recipeLabel(data.recipes, eye.recipeId) : "Unknown Recipe";
        accumulator[recipeName] = [...(accumulator[recipeName] ?? []), alert];
        return accumulator;
      }, {});
      return {
        ...item,
        groupedAlerts: groupedByRecipe,
        highestPriority: (item.openAlerts.some((alert) => alert.priority === "High") ? "High" : "Medium") as
          | "High"
          | "Medium",
      };
    })
    .sort(
      (left, right) =>
        Number(right.highestPriority === "High") - Number(left.highestPriority === "High") ||
        right.openAlerts.length - left.openAlerts.length,
    );
  const homeUrgentStocks = stockDirectory.filter((item) =>
    ["Attention Needed", "Thesis Risk Rising", "Thesis Broken"].includes(
      item.dominantEye?.lastEvaluation?.currentState ?? "",
    ),
  );
  const homeOpportunityStocks = stockDirectory.filter(
    (item) => item.dominantEye?.lastEvaluation?.currentState === "Opportunity Zone Forming",
  );
  const homeStaleReviewStocks = stockDirectory.filter((item) =>
    item.eyes.some((eye) => {
      if (!eye.lastReviewedAt) return true;
      const reviewedAt = new Date(eye.lastReviewedAt).getTime();
      return Date.now() - reviewedAt > 1000 * 60 * 60 * 24 * 14;
    }),
  );
  const selectedEyeLinkedAlerts = selectedEye
    ? data.alerts.filter((alert) => alert.eyeId === selectedEye.id)
    : [];
  const selectedEyeLinkedDecisions = selectedEye
    ? data.decisions.filter((decision) => decision.eyeId === selectedEye.id)
    : [];
  const selectedEyeDetail: EyeDetailViewModel | null = selectedEye ? {
    stockLabel: stockLabel(data.stocks, selectedEye.stockId),
    stockSymbol: selectedEyeStock?.symbol,
    recipeLabel: selectedEyeRecipe?.name ?? t(language, "eyes.detail.unknownRecipe"),
    recipeVersion: selectedEye.recipeVersionAtCreation ?? selectedEye.lastEvaluation?.recipeVersion
      ? `v${selectedEye.recipeVersionAtCreation ?? selectedEye.lastEvaluation?.recipeVersion}`
      : t(language, "eyes.detail.noVersion"),
    state: selectedEye.lastEvaluation?.currentState ? localizedEyeState(language, selectedEye.lastEvaluation.currentState) : t(language, "eyes.notEvaluated"),
    stateTone: eyeBadgeTone(selectedEye.lastEvaluation?.currentState),
    whyNow: localizedEvaluationWhyNow(
      language,
      selectedEye.lastEvaluation,
      selectedEyeRecipe,
    ) || t(language, "eyes.detail.noSummary"),
    urgency: localizedActionUrgency(language, selectedEye.lastEvaluation?.actionUrgency ?? t(language, "eyes.meta.wait")),
    evaluatedAt: selectedEye.lastEvaluation ? formatLocaleDateTime(language, selectedEye.lastEvaluation.evaluatedAt) : t(language, "eyes.notEvaluated"),
    dataQuality: selectedEye.lastEvaluation
      ? localizedEvaluationDataQuality(language, selectedEye.lastEvaluation.dataQuality)
      : t(language, "eyes.notEvaluated"),
    staleInputs: localizedEvaluationDiagnostics(language, selectedEye.lastEvaluation).staleData,
    missingInputs: localizedEvaluationDiagnostics(language, selectedEye.lastEvaluation).missingData,
    lastReviewed: selectedEye.lastReviewedAt ? formatShortDate(language, selectedEye.lastReviewedAt) : t(language, "eyes.detail.due"),
    thesisSnapshot: selectedEye.thesisSnapshot,
    invalidationRule: selectedEye.invalidationRule || t(language, "eyes.detail.noInvalidation"),
    entryLow: selectedEye.plannedEntryLow ? `$${formatLocaleNumber(language, selectedEye.plannedEntryLow, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : t(language, "eyes.detail.unset"),
    entryHigh: selectedEye.plannedEntryHigh ? `$${formatLocaleNumber(language, selectedEye.plannedEntryHigh, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : t(language, "eyes.detail.unset"),
    alertCount: `${selectedEyeLinkedAlerts.length}`,
    decisionCount: `${selectedEyeLinkedDecisions.length}`,
    lastDecision: selectedEyeLinkedDecisions[0]
      ? `${localizedDecisionAction(language, selectedEyeLinkedDecisions[0].action)} · ${formatShortDate(language, selectedEyeLinkedDecisions[0].createdAt)}`
      : undefined,
  } : null;
  const logicLabConditionCount = data.logicRules.length;
  const logicLabRuleLibrary = data.logicRules
    .map((rule) => {
      const set = logicLabRecipes.find((recipe) => recipe.id === rule.setId);
      if (!set) return null;
      return {
        recipeId: set.id,
        recipeName: set.name,
        recipeVersion: set.version,
        condition: {
          id: rule.id,
          label: rule.label,
          kind: rule.kind,
          role: rule.role,
          metricKey: rule.metricKey,
          formulaKey: rule.formulaKey,
          operator: rule.operator,
          value: rule.value,
          unit: rule.unit,
          humanDescription: rule.humanDescription,
          notes: rule.notes,
          availability: rule.availability,
        },
      };
    })
    .filter(Boolean) as Array<{
      recipeId: string;
      recipeName: string;
      recipeVersion: number;
      condition: RecipeCondition;
    }>;
  const selectedLogicSetRuleTemplates = logicLabRuleLibrary.filter((row) =>
    logicSetSelectedRuleRefs.includes(logicRuleRefKey(row.recipeId, row.condition.id)),
  );
  const logicSetRulesByRole = selectedLogicSetRuleTemplates.reduce<Record<string, typeof selectedLogicSetRuleTemplates>>(
    (groups, row) => {
      const role = row.condition.role ?? "Supporting Evidence";
      groups[role] = groups[role] ? [...groups[role], row] : [row];
      return groups;
    },
    {},
  );
  const scannerFeatureRefs = (names: readonly string[]) =>
    scannerFeatureRegistry
      .filter((name) => names.includes(name))
      .map((name) => ({ name }));
  const logicLabDataSources = [
    {
      key: "market",
      title: language === "ko" ? "시세·추세 원천 데이터" : "Price / trend source data",
      status: language === "ko" ? "사용 가능" : "Available",
      freshnessLabel: language === "ko" ? "일간" : "Daily",
      reliability: language === "ko" ? "가장 핵심이 되는 시세 원천 계층" : "Primary market source layer",
      mode: language === "ko" ? "자동" : "Automated",
      provider: "Stooq daily history",
      api: language === "ko" ? "무키 시세 CSV 원천" : "Keyless CSV price source",
      fields: ["priceHistorySeries", "ohlcBarSeries", "dividendSplitEvents"],
      metrics: scannerFeatureRefs(["MA10", "MA20", "MA50", "DD_126", "RET_20_STOCK"]),
    },
    {
      key: "volume-volatility",
      title: language === "ko" ? "거래량·변동성 원천 데이터" : "Volume / volatility source data",
      status: language === "ko" ? "사용 가능" : "Available",
      freshnessLabel: language === "ko" ? "일간" : "Daily",
      reliability: language === "ko" ? "거래량·변동폭 원천 시계열" : "Volume and volatility source series",
      mode: language === "ko" ? "자동" : "Automated",
      provider: "Stooq volume history",
      api: language === "ko" ? "시세 파생 원천" : "Derived from price history source",
      fields: ["volumeHistorySeries", "volatilityHistorySeries"],
      metrics: scannerFeatureRefs(["VOL_SPIKE_20"]),
    },
    {
      key: "benchmark-sector",
      title: language === "ko" ? "지수·벤치마크 원천 데이터" : "Benchmark / index source data",
      status: language === "ko" ? "사용 가능" : "Available",
      freshnessLabel: language === "ko" ? "일간" : "Daily",
      reliability: language === "ko" ? "지수·벤치마크 비교 원천 계층" : "Benchmark comparison source layer",
      mode: language === "ko" ? "자동" : "Automated",
      provider: "SPY / sector ETF history",
      api: language === "ko" ? "벤치마크 시계열 원천" : "Benchmark series source",
      fields: ["benchmarkHistorySeries", "sectorBenchmarkSeries"],
      metrics: scannerFeatureRefs(["RET_20_SPY", "RET_20_SECTOR", "EXRET_20_SPY", "EXRET_20_SECTOR", "RS_SERIES_SPY", "RS_IMPROVE_5", "SECTOR_ABOVE_MA50"]),
    },
    {
      key: "fundamental",
      title: language === "ko" ? "사업·재무 데이터" : "Business / financial data",
      status: language === "ko" ? "부분 사용 가능" : "Partial",
      freshnessLabel: language === "ko" ? "분기" : "Quarterly",
      reliability: language === "ko" ? "재무제표 원천 스냅샷" : "Financial statement source snapshot",
      mode: language === "ko" ? "혼합" : "Mixed",
      provider: "Twelve Data fundamentals",
      api: language === "ko" ? "재무 API 원천" : "Fundamentals API source",
      fields: ["financialStatementSnapshot", "incomeStatementSnapshot", "balanceSheetSnapshot", "cashFlowSnapshot"],
      metrics: [],
    },
    {
      key: "valuation",
      title: language === "ko" ? "밸류에이션 스냅샷 데이터" : "Valuation snapshot data",
      status: language === "ko" ? "부분 사용 가능" : "Partial",
      freshnessLabel: language === "ko" ? "주기적 스냅샷" : "Periodic snapshot",
      reliability: language === "ko" ? "밸류에이션 비교 원천값" : "Valuation comparison inputs",
      mode: language === "ko" ? "반자동" : "Semi-automated",
      provider: "Alpha Vantage / manual baseline",
      api: language === "ko" ? "멀티플 비교 원천" : "Valuation baseline source",
      fields: ["valuationSnapshot", "valuationHistorySeries"],
      metrics: [],
    },
    {
      key: "events-news",
      title: language === "ko" ? "이벤트·뉴스 데이터" : "Events / news data",
      status: language === "ko" ? "부분 사용 가능" : "Partial",
      freshnessLabel: language === "ko" ? "이벤트 기준" : "Event-driven",
      reliability:
        language === "ko" ? "이벤트 일정과 위험 태그 원천값" : "Event schedule and risk-tag inputs",
      mode: language === "ko" ? "혼합" : "Mixed",
      provider: "Twelve Data + Marketaux",
      api: language === "ko" ? "이벤트/뉴스 API 원천" : "Events / news API source",
      fields: ["eventCalendar", "guidanceEvents", "newsRiskFlags", "shortInterestSnapshot", "ownershipSnapshot"],
      metrics: [],
    },
    {
      key: "thesis",
      title: language === "ko" ? "사용자 논리·검토 데이터" : "User thesis data",
      status: language === "ko" ? "수동 입력" : "Manual",
      freshnessLabel: language === "ko" ? "검토 시 갱신" : "Updated on review",
      reliability: language === "ko" ? "사용자 입력 원문" : "Manual source inputs",
      mode: language === "ko" ? "수동" : "Manual",
      provider: language === "ko" ? "사용자 입력 레지스트리" : "User input registry",
      api: language === "ko" ? "앱 내부 저장값" : "In-app stored fields",
      fields: ["thesisText", "plannedEntryRange", "invalidationRule", "lastThesisReviewAt", "manualRiskFlags"],
      metrics: [],
    },
  ] as const;
  const previewRecipe =
    draftConditions.length === 0
      ? undefined
      : {
          id: "preview-recipe",
          version: 1,
          name: recipeForm.name.trim() || (language === "ko" ? "미리보기 레시피" : "Draft Recipe"),
          purpose:
            recipeForm.purpose.trim() ||
            (language === "ko"
              ? "저장 전에 이 초안 논리가 어떻게 작동하는지 미리 확인합니다."
              : "Preview how this draft logic behaves before saving it."),
          opportunityType: recipeForm.opportunityType,
          timeHorizon: recipeForm.timeHorizon,
          intendedUseCase: recipeForm.intendedUseCase,
          notes: recipeForm.notes,
          createdAt: new Date().toISOString(),
          conditions: draftConditions,
          reviewConfig: {
            cadenceDays: recipeForm.reviewCadenceDays,
            reviewTriggers: ["manual_preview"],
          },
          alertConfig: {
            cooldownHours: recipeForm.alertCooldownHours,
            dedupeKey: "state_change" as const,
            priorityOnAttention: "High" as const,
            priorityOnRisk: "High" as const,
          },
        };
  const availableRawFieldOptions = expressionParameterRegistry.map((parameter) => ({
    key: parameter.key,
    label: parameter.label,
    description: parameter.description,
  }));
  const selectedMetricRequiredData = expressionParameterRequiredData(
    metricForm.builderMode === "raw"
      ? [metricForm.rawParameterKey]
      : metricForm.selectedRawFields,
  );
  const selectedMetricExpressionPreview = buildExpressionPreview(
    metricForm.builderMode === "raw" ? metricForm.rawParameterKey : metricForm.expression,
    metricForm.builderMode === "raw" ? [metricForm.rawParameterKey] : metricForm.selectedRawFields,
  );
  const metricExpressionValidity =
    metricForm.builderMode === "raw"
      ? { valid: true as const, reason: "ok" as const }
      : validateExpressionSyntax(metricForm.expression, referencedExpressionParameters(metricForm.expression));

  const previewStock = data.stocks.find((stock) => stock.id === previewStockId) ?? data.stocks[0];
  const previewSnapshot = previewStock
    ? data.snapshots.find((snapshot) => snapshot.stockId === previewStock.id)
    : undefined;
  const previewEye = previewStock
    ? {
        id: "preview-eye",
        stockId: previewStock.id,
        recipeId: previewRecipe?.id ?? "preview-recipe",
        thesisSnapshot: eyeForm.thesisSnapshot.trim() || previewStock.thesis,
        plannedEntryLow: Number(eyeForm.plannedEntryLow) || previewSnapshot?.plannedEntryLow,
        plannedEntryHigh: Number(eyeForm.plannedEntryHigh) || previewSnapshot?.plannedEntryHigh,
        invalidationRule: eyeForm.invalidationRule.trim() || (language === "ko" ? "미리보기 전용" : "Preview only."),
        lastReviewedAt: isoDateDaysAgo(eyeForm.lastReviewedDaysAgo),
        createdAt: new Date().toISOString(),
      }
    : undefined;
  const previewEvaluation =
    previewRecipe && previewEye && previewSnapshot
      ? evaluateEye(
          previewEye,
          previewRecipe,
          previewSnapshot,
          logicLabMetricCatalog,
          new Date(previewSnapshot.updatedAt),
        )
      : undefined;
  const recipeStepReadiness = [
    {
      step: "Purpose" as const,
      ready: recipeForm.name.trim().length > 0 && recipeForm.purpose.trim().length > 0,
    },
    {
      step: "Logic" as const,
      ready: draftConditions.length > 0,
    },
    {
      step: "Risk & Alerts" as const,
      ready: recipeForm.alertCooldownHours > 0,
    },
    {
      step: "Review & Outcome" as const,
      ready: recipeForm.reviewCadenceDays > 0 && draftConditions.length > 0,
    },
  ];
  const recipeBuilderModel: RecipeBuilderModel = {
    step: recipeBuilderStep,
    validationStep: recipeValidationStep,
    form: recipeForm,
    conditionDraft: conditionBuilder,
    opportunityTypes,
    timeHorizons,
    useCases: useCaseOptions,
    reviewCadences: reviewCadenceOptions,
    cooldowns: alertCooldownOptions,
    metrics: logicLabMetricCatalog.map((metric) => ({ key: metric.key, name: metric.name, meaning: metric.humanMeaning })),
    conditionRoles: conditionRoleOptions.map((value) => ({ value, label: localizedConditionRole(language, value) })),
    operators: selectedOperatorOptions,
    thresholdControl: selectedConditionControl,
    selectedMetric: selectedConditionMetric ? { name: selectedConditionMetric.name, meaning: selectedConditionMetric.humanMeaning } : undefined,
    conditionPreview: `${selectedConditionMetric?.name ?? "--"} ${conditionBuilder.operator} ${formatMetricThreshold(selectedConditionMetric, conditionBuilder.threshold, language, selectedConditionFormula)}`,
    conditions: draftConditions.map((condition) => ({ id: condition.id, kindLabel: localizedConditionKind(language, condition.kind), label: condition.label })),
    riskRuleCount: draftConditions.filter((condition) => condition.kind === "negative" || condition.kind === "disqualifier").length,
    readiness: recipeStepReadiness,
    previewStocks: data.stocks.map((stock) => ({ id: stock.id, symbol: stock.symbol, name: stock.name })),
    previewStockId,
    preview: previewRecipe && previewEvaluation && previewStock ? {
      body: localizedEvaluationWhyNow(language, previewEvaluation, previewRecipe) || previewEvaluation.whyNow,
      state: localizedEyeState(language, previewEvaluation.currentState),
      recipeVersion: `${previewRecipe.name} v${previewRecipe.version}`,
    } : undefined,
  };
  const tabLabels: Record<TabKey, string> = {
    Home: language === "ko" ? "오늘" : "Today",
    Stocks: language === "ko" ? "관심 종목" : "Watchlist",
    "Logic Lab": language === "ko" ? "레시피" : "Recipes",
    Eyes: tabLabel(language, "Eyes"),
    Alerts: tabLabel(language, "Alerts"),
    Journal: tabLabel(language, "Journal"),
    Settings: tabLabel(language, "Settings"),
  };
  const topBarSubtitle =
    tab === "Home"
      ? language === "ko"
        ? `긴급 ${homeUrgentStocks.length}개 · 열림 알림 ${openAlerts}개`
        : `${homeUrgentStocks.length} urgent · ${openAlerts} open alerts`
      : tab === "Stocks"
        ? selectedStockSummary
          ? language === "ko"
            ? `${selectedStockSummary.stock.symbol} · 지표 ${sortedSelectedStockAnalysisCards.length}개`
            : `${selectedStockSummary.stock.symbol} · ${sortedSelectedStockAnalysisCards.length} metrics`
          : language === "ko"
            ? "종목을 검색해 전체 분석 보드를 확인하세요"
            : "Search any stock and inspect the full board"
        : tab === "Logic Lab"
          ? language === "ko"
            ? "수식, 규칙, 세트를 한 흐름으로 구성합니다"
            : "Build formulas, rules, and sets in one flow"
          : tab === "Eyes"
            ? language === "ko"
              ? `활성 모니터 ${filteredActiveEyesInventory.length}개`
              : `${filteredActiveEyesInventory.length} active eyes`
            : tab === "Alerts"
              ? language === "ko"
                ? `열린 알림 종목 ${groupedAlertQueue.length}개`
                : `${groupedAlertQueue.length} stocks with open alerts`
              : tab === "Journal"
                ? language === "ko"
                  ? `기록 ${filteredJournalHistory.length}개`
                  : `${filteredJournalHistory.length} journal entries in view`
                : language === "ko"
                  ? `정상 제공자 ${providerHealth.filter((entry) => entry.status === "Healthy").length}개`
                  : `${providerHealth.filter((entry) => entry.status === "Healthy").length} healthy providers`;
  const previewEvidenceGroups =
    previewRecipe && previewEye && previewSnapshot && previewEvaluation
      ? buildEvidenceGroups({
          eye: previewEye,
          recipe: previewRecipe,
          snapshot: previewSnapshot,
          evaluation: previewEvaluation,
        })
      : [];

  const openStockEditor = (stockId: string, invoker?: unknown) => {
    stockEditorFocus.captureInvoker(invoker);
    setStockEditor(stockId);
  };

  const openStockContext = ({
    stockId,
    eyeId,
    alertId,
    target = "Stocks",
    invoker,
  }: {
    stockId: string;
    eyeId?: string;
    alertId?: string;
    target?: StockRouteTarget;
    invoker?: unknown;
  }) => {
    setSelectedStockId(stockId);
    setStockSearch("");
    if (eyeId) setSelectedEyeId(eyeId);
    if (alertId) setSelectedAlertId(alertId);
    setRecentStockIds((current) => [stockId, ...current.filter((id) => id !== stockId)].slice(0, 6));
    setEyeDetailOpen(false);
    setAlertDetailOpen(false);

    if (target === "Stocks") {
      setTab("Stocks", { stockId });
      return;
    }
    if (target === "Alerts") {
      setAlertWorkspaceTab("Current");
      alertDetailFocus.captureInvoker(invoker);
      setAlertDetailOpen(Boolean(alertId));
      setTab("Alerts", { stockId, ...(alertId ? { alertId } : {}) });
      return;
    }
    if (target === "Eyes") {
      setTab("Eyes", { stockId, ...(eyeId ? { eyeId } : {}) });
      return;
    }
    setTab("Journal", { stockId });
  };

  const openEyeDetail = (eyeId: string, invoker?: unknown) => {
    const eye = data?.eyes.find((item) => item.id === eyeId);
    if (!eye) return;
    eyeDetailFocus.captureInvoker(invoker);
    setSelectedEyeId(eyeId);
    setEyeDetailOpen(true);
    setTab("Eyes", { stockId: eye.stockId, eyeId });
  };

  const openAlertDetail = (alertId: string, invoker?: unknown) => {
    const alert = data?.alerts.find((item) => item.id === alertId);
    if (!alert) return;
    alertDetailFocus.captureInvoker(invoker);
    setSelectedAlertId(alertId);
    setAlertDetailOpen(true);
    setAlertWorkspaceTab(alert.reviewed ? "History" : "Current");
    setTab("Alerts", { alertId });
  };

  const openDecisionDetail = (
    decisionId: string,
    invoker?: unknown,
    returnRoute: { tab: "Journal" | "Eyes" | "Stocks"; params: Record<string, string> } = { tab: "Journal", params: {} },
  ) => {
    const decision = data?.decisions.find((item) => item.id === decisionId);
    if (!decision) return;
    decisionReturnRouteRef.current = returnRoute;
    decisionDetailFocus.captureInvoker(invoker);
    setSelectedDecisionId(decisionId);
    setTab("Journal", { decisionId });
  };

  const openRecipeDetail = (recipeId: string, invoker?: unknown) => {
    if (!data?.recipes.some((recipe) => recipe.id === recipeId)) return;
    recipeDetailFocus.captureInvoker(invoker);
    setRecipeDetailId(recipeId);
    setTab("Logic Lab", { recipeId });
  };

  const openMetricDetail = (card: VisualEvidenceCard, invoker?: unknown) => {
    if (!selectedStockSummary) return;
    metricDetailFocus.captureInvoker(invoker);
    setSelectedEvidenceCard(card);
    setTab("Stocks", { stockId: selectedStockSummary.stock.id, metricId: card.id });
  };

  const closeEntityRoute = (destination: "Stocks" | "Eyes" | "Alerts" | "Journal" | "Logic Lab") => {
    setTab(destination, {}, { replace: true });
  };

  const closeDecisionDetail = () => {
    const returnRoute = decisionReturnRouteRef.current;
    decisionReturnRouteRef.current = { tab: "Journal", params: {} };
    setTab(returnRoute.tab, returnRoute.params, { replace: true });
  };

  const cycleEvidenceCard = (direction: 1 | -1) => {
    if (!selectedEvidenceCard || sortedSelectedStockAnalysisCards.length === 0) return;
    const currentIndex = sortedSelectedStockAnalysisCards.findIndex((card) => card.id === selectedEvidenceCard.id);
    if (currentIndex < 0) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= sortedSelectedStockAnalysisCards.length) return;
    const nextCard = sortedSelectedStockAnalysisCards[nextIndex];
    setSelectedEvidenceCard(nextCard);
    if (selectedStockSummary) setTab("Stocks", { stockId: selectedStockSummary.stock.id, metricId: nextCard.id });
  };

  const togglePinnedMetric = (card: VisualEvidenceCard) => {
    if (!selectedStockSummary) return;
    const key = stockMetricPreferenceKey(selectedStockSummary.stock.id, card.id);
    setPinnedMetricKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  };

  const openJournalComposer = (invoker?: unknown) => {
    journalComposerOperationGate.beginSession();
    setJournalValidationSection("");
    journalComposerFocus.captureInvoker(invoker);
    setJournalComposerOpen(true);
  };

  const openEyeComposer = (invoker?: unknown) => {
    eyeComposerOperationGate.beginSession();
    const fallbackRef = tab === "Logic Lab"
      ? logicSurfaceFallbackRef
      : tab === "Stocks"
        ? stocksSurfaceFallbackRef
        : eyesSurfaceFallbackRef;
    setEyeComposerFallbackRef(fallbackRef);
    eyeComposerFocus.captureInvoker(invoker);
    setEyeComposerOpen(true);
  };

  const openRecipeBuilder = (invoker?: unknown) => {
    recipeBuilderOperationGate.beginSession();
    setRecipeValidationStep("");
    recipeBuilderFocus.captureInvoker(invoker);
    setRecipeBuilderOpen(true);
  };

  const openLogicInfo = (target: LogicInfoTarget, invoker?: unknown) => {
    logicInfoFocus.captureInvoker(invoker);
    setLogicInfoTarget(target);
  };

  const openLogicRegistry = (invoker?: unknown) => {
    logicRegistryFocus.captureInvoker(invoker);
    setLogicL0RegistryOpen(true);
  };

  const quickDecision = (alert: Alert, action: DecisionAction, invoker?: unknown) => {
    setDecisionForm({ eyeId: alert.eyeId, alertId: alert.id, action, note: "", concern: "", thesisValid: "", timing: "" });
    setJournalComposerEditingId(""); setJournalValidationSection(""); openJournalComposer(invoker);
  };

  const acknowledgeAlertGroup = async (alerts: Alert[]) => {
    await actions.markAlertsReviewed(alerts.map(alert => alert.id));
  };

  const addDraftCondition = () => {
    if (!selectedConditionMetric || !selectedConditionFormula) return;
    const noteSuffix = conditionBuilder.note.trim()
      ? language === "ko"
        ? ` 메모: ${conditionBuilder.note.trim()}.`
        : ` Notes: ${conditionBuilder.note.trim()}.`
      : "";
    const label = `${selectedConditionMetric.name}: ${conditionBuilder.operator} ${formatMetricThreshold(
      selectedConditionMetric,
      conditionBuilder.threshold,
      language,
      selectedConditionFormula,
    )}.${noteSuffix}`;
    setDraftConditions((current) => [
      {
        id: createLocalId("condition"),
        kind: kindFromConditionRole(conditionBuilder.role),
        role: conditionBuilder.role,
        metricKey: selectedConditionMetric.key,
        formulaKey: selectedConditionFormula.key,
        operator: conditionBuilder.operator,
        value: parseThresholdValue(conditionBuilder.threshold, selectedConditionMetric, selectedConditionFormula),
        humanDescription: label,
        notes: conditionBuilder.note.trim(),
        availability: selectedConditionMetric.availability,
        label,
      },
      ...current,
    ]);
    setConditionBuilder((current) => ({
      ...current,
      note: "",
    }));
  };

  const resetRecipeBuilderDraft = () => {
    setRecipeForm(defaultRecipeDraftForm());
    setDraftConditions([]);
    setRecipeBuilderStep("Purpose");
    setRecipeBuilderEditingId("");
    setRecipeValidationStep("");
    setConditionBuilder({
      metricKey: metricCatalog[0].key,
      role: "Eligibility Filter",
      operator: "<=",
      threshold: "-25",
      note: "",
    });
  };

  const resetMetricBuilderDraft = () => {
    setMetricForm(defaultMetricDraftForm());
    setMetricBuilderEditingKey("");
    setMetricFormAttempted(false);
    setMetricNumberToken("");
    setMetricInsertRawField(expressionParameterRegistry[0].key);
    setMetricFunctionKey("ABS");
    setMetricFunctionArgMode1("parameter");
    setMetricFunctionArgMode2("parameter");
    setMetricFunctionArgMode3("parameter");
    setMetricFunctionArgParameter1(expressionParameterRegistry[0].key);
    setMetricFunctionArgParameter2(expressionParameterRegistry[1]?.key ?? expressionParameterRegistry[0].key);
    setMetricFunctionArgParameter3(expressionParameterRegistry[2]?.key ?? expressionParameterRegistry[0].key);
    setMetricFunctionArgNumber1("");
    setMetricFunctionArgNumber2("");
    setMetricFunctionArgNumber3("");
  };

  const resetLogicSetBuilderDraft = () => {
    setLogicSetForm(defaultRecipeDraftForm());
    setLogicSetSelectedRuleRefs([]);
    setLogicSetBuilderEditingId("");
    setLogicSetFormAttempted(false);
  };

  const resetEyeComposerDraft = () => {
    setEyeForm({
      stockId: "",
      recipeId: "",
      thesisSnapshot: "",
      plannedEntryLow: "",
      plannedEntryHigh: "",
      invalidationRule: "",
      lastReviewedDaysAgo: reviewDateOptions[2].daysAgo,
    });
    setEyeComposerEditingId("");
    setEyeFormAttempted(false);
  };

  const resetJournalComposerDraft = () => {
    setDecisionForm({
      eyeId: "",
      alertId: "",
      action: "",
      note: "",
      concern: "",
      thesisValid: "",
      timing: "",
    });
    setJournalComposerEditingId("");
    setJournalValidationSection("");
  };

  const resetLogicRuleBuilderDraft = () => {
    setConditionBuilder({
      metricKey: logicLabMetricCatalog[0]?.key ?? metricCatalog[0].key,
      role: "Eligibility Filter",
      operator: "<=",
      threshold: "-25",
      note: "",
    });
    setLogicRuleEditingContext(null);
    setConditionBuilderRecipeId(logicLabCompatibleRecipes[0]?.id ?? "");
  };

  const openLogicSetBuilder = (recipe?: Recipe, invoker?: unknown) => {
    logicSetBuilderFocus.captureInvoker(invoker);
    if (!recipe) {
      resetLogicSetBuilderDraft();
      setLogicSetBuilderOpen(true);
      return;
    }
    setLogicSetForm({
      name: recipe.name,
      purpose: recipe.purpose,
      opportunityType: opportunityTypes.includes(recipe.opportunityType as (typeof opportunityTypes)[number])
        ? (recipe.opportunityType as (typeof opportunityTypes)[number])
        : opportunityTypes[0],
      timeHorizon: timeHorizons.includes(recipe.timeHorizon as (typeof timeHorizons)[number])
        ? (recipe.timeHorizon as (typeof timeHorizons)[number])
        : timeHorizons[1],
      intendedUseCase: useCaseOptions.includes(recipe.intendedUseCase as (typeof useCaseOptions)[number])
        ? (recipe.intendedUseCase as (typeof useCaseOptions)[number])
        : useCaseOptions[0],
      notes: recipe.notes ?? "",
      reviewCadenceDays: recipe.reviewConfig?.cadenceDays ?? reviewCadenceOptions[2],
      alertCooldownHours: recipe.alertConfig?.cooldownHours ?? alertCooldownOptions[2],
    });
    setLogicSetSelectedRuleRefs(recipe.conditions.map((condition) => logicRuleRefKey(recipe.id, condition.id)));
    setLogicSetBuilderEditingId(recipe.id);
    setLogicSetFormAttempted(false);
    setLogicSetBuilderOpen(true);
  };

  const buildRuleFromConditionBuilder = () => {
    if (!selectedConditionMetric || !selectedConditionFormula) return null;
    const noteSuffix = conditionBuilder.note.trim()
      ? language === "ko"
        ? ` 메모: ${conditionBuilder.note.trim()}.`
        : ` Notes: ${conditionBuilder.note.trim()}.`
      : "";
    const label = `${selectedConditionMetric.name}: ${conditionBuilder.operator} ${formatMetricThreshold(
      selectedConditionMetric,
      conditionBuilder.threshold,
      language,
      selectedConditionFormula,
    )}.${noteSuffix}`;

    return {
      id: logicRuleEditingContext?.conditionId ?? createLocalId("condition"),
      kind: kindFromConditionRole(conditionBuilder.role),
      role: conditionBuilder.role,
      metricKey: selectedConditionMetric.key,
      formulaKey: selectedConditionFormula.key,
      operator: conditionBuilder.operator,
      value: parseThresholdValue(conditionBuilder.threshold, selectedConditionMetric, selectedConditionFormula),
      humanDescription: label,
      notes: conditionBuilder.note.trim(),
      availability: selectedConditionMetric.availability,
      label,
    } satisfies RecipeCondition;
  };

  const openConditionBuilder = (row?: { recipeId?: string; condition?: RecipeCondition }, invoker?: unknown) => {
    conditionBuilderFocus.captureInvoker(invoker);
    if (row?.condition) {
      const metric = logicLabMetricCatalog.find((item) => item.key === row.condition?.metricKey);
      const formula = getFormulaDefinition(row.condition.formulaKey ?? metric?.formulaKey ?? "");
      setConditionBuilder({
        metricKey: row.condition.metricKey ?? logicLabMetricCatalog[0]?.key ?? metricCatalog[0].key,
        role: row.condition.role ?? "Supporting Evidence",
        operator: row.condition.operator ?? operatorOptionsForMetric(metric, formula)[0],
        threshold: Array.isArray(row.condition.value)
          ? String(row.condition.value[0] ?? "")
          : String(row.condition.value ?? ""),
        note: row.condition.notes ?? "",
      });
      setConditionBuilderRecipeId(row.recipeId ?? "");
      setLogicRuleEditingContext({ recipeId: row.recipeId ?? "", conditionId: row.condition.id });
    } else {
      resetLogicRuleBuilderDraft();
    }
    setConditionBuilderOpen(true);
  };

  const deleteLogicRule = async (recipeId: string, conditionId: string) => {
    const recipe = data.recipes.find((item) => item.id === recipeId);
    if (!recipe) return;
    RNAlert.alert(
      language === "ko" ? "L1.5 규칙 삭제" : "Delete L1.5 Rule",
      language === "ko"
        ? "이 규칙을 삭제하면 연결된 L2 세트에서 바로 빠집니다."
        : "Deleting this rule removes it from its linked L2 set immediately.",
      [
        { text: language === "ko" ? "취소" : "Cancel", style: "cancel" },
        {
          text: language === "ko" ? "삭제" : "Delete",
          style: "destructive",
          onPress: async () => {
            await actions.updateRecipe(recipeId, {
              name: recipe.name,
              purpose: recipe.purpose,
              opportunityType: recipe.opportunityType ?? opportunityTypes[0],
              timeHorizon: recipe.timeHorizon,
              intendedUseCase: recipe.intendedUseCase,
              notes: recipe.notes,
              reviewCadenceDays: recipe.reviewConfig?.cadenceDays ?? reviewCadenceOptions[2],
              alertCooldownHours: recipe.alertConfig?.cooldownHours ?? alertCooldownOptions[2],
              conditions: recipe.conditions.filter((condition) => condition.id !== conditionId),
            });
            if (logicRuleEditingContext?.recipeId === recipeId && logicRuleEditingContext.conditionId === conditionId) {
              resetLogicRuleBuilderDraft();
            }
          },
        },
      ],
    );
  };

  const duplicateLogicRule = (recipeId: string, condition: RecipeCondition) => {
    const metric = logicLabMetricCatalog.find((item) => item.key === condition.metricKey);
    const formula = getFormulaDefinition(condition.formulaKey ?? metric?.formulaKey ?? "");
    setConditionBuilder({
      metricKey: condition.metricKey ?? logicLabMetricCatalog[0]?.key ?? metricCatalog[0].key,
      role: condition.role ?? "Supporting Evidence",
      operator: condition.operator ?? operatorOptionsForMetric(metric, formula)[0],
      threshold: Array.isArray(condition.value)
        ? String(condition.value[0] ?? "")
        : String(condition.value ?? ""),
      note: condition.notes ?? "",
    });
    setConditionBuilderRecipeId(recipeId);
    setLogicRuleEditingContext(null);
    setConditionBuilderOpen(true);
  };

  const deleteLogicSet = async (recipeId: string) => {
    const recipe = data.recipes.find((item) => item.id === recipeId);
    if (!recipe) return;
    const linkedEyes = data.eyes.filter((eye) => eye.recipeId === recipeId).length;
    RNAlert.alert(
      language === "ko" ? "L2 세트 삭제" : "Delete L2 Set",
      linkedEyes > 0
        ? language === "ko"
          ? `"${recipe.name}" 세트는 ${linkedEyes}개의 Eye와 연결되어 있어 삭제할 수 없습니다. 먼저 연결을 해제하세요.`
          : `"${recipe.name}" is linked to ${linkedEyes} Eyes, so it cannot be deleted. Remove those links first.`
        : language === "ko"
          ? `"${recipe.name}" 세트를 삭제하면 이 세트의 규칙과 버전 기록도 함께 제거됩니다.`
          : `Deleting "${recipe.name}" removes this set along with its rule and version record.`,
      linkedEyes > 0
        ? [{ text: language === "ko" ? "확인" : "OK", style: "default" }]
        : [
            { text: language === "ko" ? "취소" : "Cancel", style: "cancel" },
            {
              text: language === "ko" ? "삭제" : "Delete",
              style: "destructive",
              onPress: async () => {
                const removed = await actions.deleteRecipe(recipeId);
                if (!removed) {
                  RNAlert.alert(
                    language === "ko" ? "삭제 불가" : "Cannot Delete",
                    language === "ko"
                      ? "이미 연결된 기록이나 의사결정이 있어 삭제할 수 없습니다."
                      : "This set still has linked history or decisions, so it cannot be deleted.",
                  );
                  return;
                }
                if (logicVersionsRecipeId === recipeId) {
                  setLogicVersionsRecipeId("");
                }
              },
            },
          ],
    );
  };

  const openHomeJournalComposer = (eyeId: string, alertId?: string, invoker?: unknown) => {
    setDecisionForm({
      eyeId,
      alertId: alertId ?? "",
      action: "Entered",
      note: "",
      concern: "",
      thesisValid: "",
      timing: "",
    });
    setJournalComposerEditingId("");
    setJournalValidationSection("");
    openJournalComposer(invoker);
  };

  const selectedScannerSignal = scannerSignalReviewId
    ? data?.scanSignals.find((signal) => signal.signalId === scannerSignalReviewId)
    : undefined;
  const selectedScannerRun = selectedScannerSignal
    ? data?.scanRuns.find((run) => run.id === selectedScannerSignal.scanRunId)
    : undefined;

  const openScannerReview = (signal: ScanSignal, invoker?: unknown) => {
    scannerReviewFocus.captureInvoker(invoker);
    setScannerSignalReviewId(signal.signalId);
    setScannerReviewForm({
      userDecision: "",
      manualReason: "",
      convictionScoreOptional: "",
      notes: "",
      entryPriceOptional: "",
      exitPriceOptional: "",
      resultNotes: "",
    });
  };

  const submitScannerReview = async (close: () => void) => {
    if (!selectedScannerSignal || !scannerReviewForm.userDecision || !scannerReviewForm.manualReason.trim()) return;
    await actions.addSignalReviewLog({
      signalId: selectedScannerSignal.signalId,
      userDecision: scannerReviewForm.userDecision,
      manualReason: scannerReviewForm.manualReason.trim(),
      convictionScoreOptional:
        scannerReviewForm.convictionScoreOptional.trim() !== ""
          ? Number(scannerReviewForm.convictionScoreOptional)
          : undefined,
      notes: scannerReviewForm.notes.trim() || undefined,
      entryPriceOptional:
        scannerReviewForm.entryPriceOptional.trim() !== ""
          ? Number(scannerReviewForm.entryPriceOptional)
          : undefined,
      exitPriceOptional:
        scannerReviewForm.exitPriceOptional.trim() !== ""
          ? Number(scannerReviewForm.exitPriceOptional)
          : undefined,
      resultNotes: scannerReviewForm.resultNotes.trim() || undefined,
    });
    close();
  };

  const saveLogicRule = async () => {
    const recipe = data.recipes.find((item) => item.id === conditionBuilderRecipeId);
    const nextRule = buildRuleFromConditionBuilder();
    if (!recipe || !nextRule) return;

    const nextConditions = logicRuleEditingContext?.conditionId
      ? recipe.conditions.map((condition) =>
          condition.id === logicRuleEditingContext.conditionId ? nextRule : condition,
        )
      : [nextRule, ...recipe.conditions];

    await actions.updateRecipe(recipe.id, {
      name: recipe.name,
      purpose: recipe.purpose,
      opportunityType: recipe.opportunityType ?? opportunityTypes[0],
      timeHorizon: recipe.timeHorizon,
      intendedUseCase: recipe.intendedUseCase,
      notes: recipe.notes,
      reviewCadenceDays: recipe.reviewConfig?.cadenceDays ?? reviewCadenceOptions[2],
      alertCooldownHours: recipe.alertConfig?.cooldownHours ?? alertCooldownOptions[2],
      conditions: nextConditions,
    });
    setConditionBuilderOpen(false);
    resetLogicRuleBuilderDraft();
  };

  const openMetricBuilder = (metric?: MetricDefinition, invoker?: unknown) => {
    metricBuilderFocus.captureInvoker(invoker);
    if (!metric) {
      resetMetricBuilderDraft();
      setMetricBuilderOpen(true);
      return;
    }

    setMetricForm({
      name:
        metric.origin === "custom"
          ? metric.name
          : language === "ko"
            ? `${metric.name} 사용자 버전`
            : `${metric.name} Custom`,
      humanMeaning: metric.humanMeaning,
      builderMode: metric.formulaKey === "custom_expression" ? "equation" : "raw",
      selectedRawFields: [...(metric.parameterKeys ?? metric.requiredData)],
      rawParameterKey: metric.parameterKeys?.[0] ?? metric.requiredData[0] ?? expressionParameterRegistry[0].key,
      expression: metric.expression ?? metric.parameterKeys?.[0] ?? metric.requiredData[0] ?? expressionParameterRegistry[0].key,
      availability: metric.availability,
      freshnessExpectation: metric.freshnessExpectation,
      exampleDisplayText: metric.exampleDisplayText,
      missingDataBehavior: metric.missingDataBehavior,
    });
    setMetricBuilderEditingKey(metric.origin === "custom" && !data.recipes.some(recipe => recipe.conditions.some(condition => condition.metricKey === metric.key)) ? metric.key : "");
    setMetricFormAttempted(false);
    setMetricInsertRawField(metric.parameterKeys?.[0] ?? metric.requiredData[0] ?? expressionParameterRegistry[0].key);
    setMetricNumberToken("");
    setMetricFunctionKey("ABS");
    setMetricFunctionArgMode1("parameter");
    setMetricFunctionArgMode2("parameter");
    setMetricFunctionArgMode3("parameter");
    setMetricFunctionArgParameter1(metric.parameterKeys?.[0] ?? expressionParameterRegistry[0].key);
    setMetricFunctionArgParameter2(metric.parameterKeys?.[1] ?? expressionParameterRegistry[1]?.key ?? expressionParameterRegistry[0].key);
    setMetricFunctionArgParameter3(metric.parameterKeys?.[2] ?? expressionParameterRegistry[2]?.key ?? expressionParameterRegistry[0].key);
    setMetricFunctionArgNumber1("");
    setMetricFunctionArgNumber2("");
    setMetricFunctionArgNumber3("");
    setMetricBuilderOpen(true);
  };

  const duplicateMetric = (metric: MetricDefinition, invoker?: unknown) => {
    metricBuilderFocus.captureInvoker(invoker);
    setMetricForm({
      name: language === "ko" ? `${metric.name} 사본` : `${metric.name} Copy`,
      humanMeaning: metric.humanMeaning,
      builderMode: metric.formulaKey === "custom_expression" ? "equation" : "raw",
      selectedRawFields: [...(metric.parameterKeys ?? metric.requiredData)],
      rawParameterKey: metric.parameterKeys?.[0] ?? metric.requiredData[0] ?? expressionParameterRegistry[0].key,
      expression: metric.expression ?? metric.parameterKeys?.[0] ?? metric.requiredData[0] ?? expressionParameterRegistry[0].key,
      availability: metric.availability,
      freshnessExpectation: metric.freshnessExpectation,
      exampleDisplayText: metric.exampleDisplayText,
      missingDataBehavior: metric.missingDataBehavior,
    });
    setMetricBuilderEditingKey("");
    setMetricFormAttempted(false);
    setMetricInsertRawField(metric.parameterKeys?.[0] ?? metric.requiredData[0] ?? expressionParameterRegistry[0].key);
    setMetricNumberToken("");
    setMetricBuilderOpen(true);
  };

  const deleteMetric = async (metric: MetricDefinition) => {
    RNAlert.alert(
      language === "ko" ? "L1 수식 삭제" : "Delete L1 Formula",
      language === "ko"
        ? `"${metric.name}" 수식을 삭제하면 연결된 Logic Lab 규칙과 세트에서 제외됩니다.`
        : `Deleting "${metric.name}" removes it from linked Logic Lab rules and sets.`,
      [
        { text: language === "ko" ? "취소" : "Cancel", style: "cancel" },
        {
          text: language === "ko" ? "삭제" : "Delete",
          style: "destructive",
          onPress: async () => {
            const removed = await actions.deleteMetric(metric.key);
            if (removed && metricBuilderEditingKey === metric.key) {
              resetMetricBuilderDraft();
            }
          },
        },
      ],
    );
  };

  const appendMetricExpressionToken = (token: string) => {
    setMetricForm((current) => ({
      ...current,
      expression: appendExpressionToken(current.expression, token),
    }));
  };

  const removeMetricExpressionToken = () => {
    setMetricForm((current) => ({
      ...current,
      expression: removeLastExpressionToken(current.expression),
    }));
  };

  const buildMetricFunctionToken = () => {
    const takeArg = (
      mode: "parameter" | "number",
      parameterKey: string,
      numberValue: string,
    ) => (mode === "parameter" ? parameterKey : numberValue.trim());

    const arg1 = takeArg(metricFunctionArgMode1, metricFunctionArgParameter1, metricFunctionArgNumber1);
    const arg2 = takeArg(metricFunctionArgMode2, metricFunctionArgParameter2, metricFunctionArgNumber2);
    const arg3 = takeArg(metricFunctionArgMode3, metricFunctionArgParameter3, metricFunctionArgNumber3);

    if (!arg1) return null;

    switch (metricFunctionKey) {
      case "ABS":
        return `ABS ( ${arg1} )`;
      case "PCT_CHANGE":
      case "AVG":
      case "MIN":
      case "MAX":
        return arg2 ? `${metricFunctionKey} ( ${arg1} , ${arg2} )` : null;
      case "CLAMP":
        return arg2 && arg3 ? `CLAMP ( ${arg1} , ${arg2} , ${arg3} )` : null;
      default:
        return null;
    }
  };

  const saveMetric = async () => {
    setMetricFormAttempted(true);
    const activeParameterKeys =
      metricForm.builderMode === "raw" ? [metricForm.rawParameterKey] : metricForm.selectedRawFields;
    const expression =
      metricForm.builderMode === "raw" ? metricForm.rawParameterKey : metricForm.expression.trim();
    if (
      !metricForm.name.trim() ||
      !metricForm.humanMeaning.trim() ||
      activeParameterKeys.length === 0 ||
      !expression ||
      (metricForm.builderMode === "equation" && !metricExpressionValidity.valid)
    )
      return;

    const candidateKey = metricBuilderEditingKey || `metric_${slugMetricKey(metricForm.name)}`;
    let resolvedKey = candidateKey;
    let suffix = 2;
    while (
      logicMetricKeySet.has(resolvedKey) &&
      (!metricBuilderEditingKey || resolvedKey !== metricBuilderEditingKey)
    ) {
      resolvedKey = `${candidateKey}_${suffix}`;
      suffix += 1;
    }

    const nextMetric: MetricDefinition = {
      key: resolvedKey,
      name: metricForm.name.trim(),
      humanMeaning: metricForm.humanMeaning.trim(),
      formulaKey: metricForm.builderMode === "raw" ? "raw_passthrough" : "custom_expression",
      requiredData: expressionParameterRequiredData(activeParameterKeys),
      expression,
      parameterKeys: activeParameterKeys,
      freshnessExpectation: metricForm.freshnessExpectation,
      availability: metricForm.availability,
      exampleConditions: [],
      exampleDisplayText:
        metricForm.exampleDisplayText.trim() ||
        (language === "ko"
          ? "이 지표는 선택한 수식이 산출하는 대표 예시를 보여줍니다."
          : "This metric exposes the representative output produced by the selected formula."),
      missingDataBehavior:
        metricForm.missingDataBehavior.trim() ||
        (language === "ko"
          ? "필요한 L0 원천값이 비어 있으면 지표를 확정하지 않고 검토 필요 상태로 남깁니다."
          : "If required L0 inputs are missing, the metric remains unresolved and marked for review."),
      origin: "custom",
    };

    await actions.addMetric(nextMetric);
    setMetricBuilderOpen(false);
    resetMetricBuilderDraft();
  };

  const saveLogicSet = async () => {
    setLogicSetFormAttempted(true);
    if (!logicSetForm.name.trim() || !logicSetForm.purpose.trim() || selectedLogicSetRuleTemplates.length === 0) {
      return;
    }

    const editingRecipe = logicSetBuilderEditingId
      ? data.recipes.find((recipe) => recipe.id === logicSetBuilderEditingId)
      : undefined;

    const nextConditions = selectedLogicSetRuleTemplates.map((row) => {
      if (row.recipeId === logicSetBuilderEditingId) {
        return row.condition;
      }
      return {
        ...row.condition,
        id: createLocalId("condition"),
      };
    });

    const nextPayload = {
      ...logicSetForm,
      conditions: nextConditions,
    };

    if (editingRecipe) {
      await actions.updateRecipe(editingRecipe.id, nextPayload);
    } else {
      await actions.addRecipe(nextPayload);
    }

    setLogicSetBuilderOpen(false);
    resetLogicSetBuilderDraft();
  };

  const saveRecipe = async () => {
    if (!recipeForm.name.trim() || !recipeForm.purpose.trim()) {
      setRecipeBuilderStep("Purpose");
      setRecipeValidationStep("Purpose");
      return;
    }
    if (draftConditions.length === 0) {
      setRecipeBuilderStep("Logic");
      setRecipeValidationStep("Logic");
      return;
    }
    if (recipeForm.alertCooldownHours <= 0) {
      setRecipeBuilderStep("Risk & Alerts");
      setRecipeValidationStep("Risk & Alerts");
      return;
    }
    if (recipeForm.reviewCadenceDays <= 0) {
      setRecipeBuilderStep("Review & Outcome");
      setRecipeValidationStep("Review & Outcome");
      return;
    }
    const operation = recipeBuilderOperationGate.beginOperation();
    if (operation === null) return;
    try {
      let savedRecipeId = "";
      if (recipeBuilderEditingId) {
        savedRecipeId = (await actions.updateRecipe(recipeBuilderEditingId, {
          ...recipeForm,
          conditions: draftConditions,
        })) ?? "";
      } else {
        await actions.addRecipe({
          ...recipeForm,
          conditions: draftConditions,
        });
      }
      if (!recipeBuilderOperationGate.isCurrent(operation)) return;
      resetRecipeBuilderDraft();
      setRecipeBuilderOpen(false);
      recipeBuilderOperationGate.endSession();
      if (savedRecipeId) {
        setRecipeDetailId(savedRecipeId);
        setTab("Logic Lab", { recipeId: savedRecipeId });
      }
    } finally {
      recipeBuilderOperationGate.endOperation();
    }
  };

  const continueRecipeBuilder = () => {
    const ready = recipeBuilderStep === "Purpose"
      ? Boolean(recipeForm.name.trim() && recipeForm.purpose.trim())
      : recipeBuilderStep === "Logic"
        ? draftConditions.length > 0
        : recipeBuilderStep === "Risk & Alerts"
          ? recipeForm.alertCooldownHours > 0
          : recipeForm.reviewCadenceDays > 0 && draftConditions.length > 0;
    if (!ready) {
      setRecipeValidationStep(recipeBuilderStep);
      return;
    }
    setRecipeValidationStep("");
    setRecipeBuilderStep(recipeBuilderSteps[Math.min(recipeBuilderSteps.indexOf(recipeBuilderStep) + 1, recipeBuilderSteps.length - 1)]);
  };

  const previousRecipeBuilderStep = () => {
    setRecipeValidationStep("");
    setRecipeBuilderStep(recipeBuilderSteps[Math.max(recipeBuilderSteps.indexOf(recipeBuilderStep) - 1, 0)]);
  };

  const saveEye = async () => {
    setEyeFormAttempted(true);
    if (!eyeForm.stockId || !eyeForm.recipeId || !eyeForm.thesisSnapshot.trim()) return;
    if (Object.keys(entryRangeFieldErrors(eyeForm.plannedEntryLow, eyeForm.plannedEntryHigh)).length > 0) return;

    const stock = data?.stocks.find(s => s.id === eyeForm.stockId);
    if (!stock) return;
    const plannedEntryLow = optionalPositiveNumber(eyeForm.plannedEntryLow, "Entry low");
    const plannedEntryHigh = optionalPositiveNumber(eyeForm.plannedEntryHigh, "Entry high");
    validateEntryRange(plannedEntryLow, plannedEntryHigh);

    const operation = eyeComposerOperationGate.beginOperation();
    if (operation === null) return;
    try {
      if (eyeComposerEditingId) {
        await actions.updateEye(eyeComposerEditingId, {
          recipeId: eyeForm.recipeId,
          thesisSnapshot: eyeForm.thesisSnapshot,
          plannedEntryLow,
          plannedEntryHigh,
          invalidationRule: eyeForm.invalidationRule,
          lastReviewedAt: isoDateDaysAgo(eyeForm.lastReviewedDaysAgo),
        });
      } else {
        await actions.addEye({
          symbol: stock.symbol,
          name: stock.name,
          thesis: eyeForm.thesisSnapshot,
          recipeId: eyeForm.recipeId,
          plannedEntryLow,
          plannedEntryHigh,
          invalidationRule: eyeForm.invalidationRule,
          lastReviewedAt: isoDateDaysAgo(eyeForm.lastReviewedDaysAgo),
        });
      }
      if (!eyeComposerOperationGate.isCurrent(operation)) return;
      resetEyeComposerDraft();
      setEyeComposerOpen(false);
      eyeComposerOperationGate.endSession();
    } finally {
      eyeComposerOperationGate.endOperation();
    }
  };

  const saveDecision = async () => {
    if (!decisionForm.eyeId) { setJournalValidationSection("context"); return; }
    if (!decisionForm.action) { setJournalValidationSection("action"); return; }
    if (!decisionForm.note.trim()) { setJournalValidationSection("note"); return; }
    if (!decisionForm.thesisValid) { setJournalValidationSection("thesis"); return; }
    if (!decisionForm.timing) { setJournalValidationSection("timing"); return; }
    setJournalValidationSection("");
    const input = { ...decisionForm, action: decisionForm.action as DecisionAction, thesisValid: decisionForm.thesisValid, timing: decisionForm.timing };
    const operation = journalComposerOperationGate.beginOperation();
    if (operation === null) return;
    try {
      let savedDecisionId = journalComposerEditingId;
      if (journalComposerEditingId) {
        await actions.updateDecision(journalComposerEditingId, input);
      } else {
        const decisionId = await actions.logDecision(input);
        savedDecisionId = decisionId ?? "";
      }
      if (!journalComposerOperationGate.isCurrent(operation)) return;
      resetJournalComposerDraft();
      setJournalComposerOpen(false);
      journalComposerOperationGate.endSession();
      if (savedDecisionId) {
        setSelectedDecisionId(savedDecisionId);
        setTab("Journal", { decisionId: savedDecisionId });
      }
    } finally {
      journalComposerOperationGate.endOperation();
    }
  };

  const watchlistModel = buildWatchlistModel({
    language,
    recentStocks,
    stockSuggestions,
    selectedStock: selectedStockSummary,
    decisions: data.decisions,
    eyes: data.eyes,
    recipes: data.recipes,
    evidenceCards: sortedSelectedStockAnalysisCards,
    pinnedMetricKeys,
  });
  const recipesModel = buildRecipesModel({
    language,
    sources: logicLabDataSources,
    metrics: logicLabMetricCatalog,
    rules: logicLabRuleLibrary,
    sets: logicLabRecipes,
    signals: [...matchedScannerSignals, ...nearScannerSignals, ...blockedScannerSignals],
    reviewLogsBySignal: scannerReviewLogsBySignal,
    latestScanRun,
    matchedCount: matchedScannerSignals.length,
    nearCount: nearScannerSignals.length,
    blockedCount: blockedScannerSignals.length,
    scannerRuleCount: frozenScannerRules.length,
    scannerRunning: scanning,
    rawFieldLabel: rawLogicFieldLabel,
  });
  const alertsModel = buildAlertsModel({
    language,
    groups: groupedAlertQueue,
    history: alertHistory,
    stockSnapshots: stockDirectory,
    eyes: data.eyes,
    decisions: data.decisions,
  });
  const journalEntryViews = buildJournalEntries({
    language,
    decisions: filteredJournalHistory,
    eyes: data.eyes,
    outcomes: data.outcomes,
    stocks: data.stocks,
    recipes: data.recipes,
    instrumentLabel: (eyeId) => decisionTitle(eyeId, data.eyes, data.stocks, data.recipes),
  });
  const settingsModel = buildSettingsModel({
    language,
    data,
    providerHealth,
    cloudConfigured: Boolean(cloud),
  });

  return (
    <View nativeID="stockledger-root" style={styles.screen}>
      <StatusBar style="dark" />
      {stockEditor !== null ? <StockEditor
        stock={data.stocks.find(stock => stock.id === stockEditor)}
        onClose={() => setStockEditor(null)}
        actions={actions}
        onSaved={id => { setSelectedStockId(id); setTab("Stocks", { stockId: id }); }}
        language={language}
        returnFocusRef={stockEditorFocus.returnFocusRef}
        fallbackFocusRef={stockEditorFocus.fallbackFocusRef}
      /> : null}
      <StockLedgerShell
        language={language}
        tab={tab}
        tabLabels={tabLabels}
        subtitle={topBarSubtitle}
        openAlerts={openAlerts}
        onSelect={setTab}
        onOpenAlerts={() => {
          setAlertWorkspaceTab("Current");
          setTab("Alerts");
        }}
        onOpenSettings={() => setTab("Settings")}
        navigationFocusRefs={{
          Home: homeSurfaceFallbackRef,
          Stocks: stocksSurfaceFallbackRef,
          "Logic Lab": logicSurfaceFallbackRef,
          Journal: journalSurfaceFallbackRef,
        }}
        alertsRef={alertsSurfaceFallbackRef}
        settingsRef={settingsSurfaceFallbackRef}
      >
        {routeNotice ? (
          <View style={styles.routeNotice} accessibilityRole="alert" accessibilityLiveRegion="assertive">
            <Text style={styles.routeNoticeTitle}>{t(language, "route.unavailableTitle")}</Text>
            <Text style={styles.routeNoticeBody}>{routeNotice}</Text>
            <Button label={t(language, "route.returnToDestination")} tone="secondary" onPress={() => setTab(route.tab, {}, { replace: true })} />
          </View>
        ) : null}
        {recentError || pinError ? <Text accessibilityRole="alert" style={{ padding: 12 }}>{recentError || pinError}</Text> : null}
        {error ? <View style={{ padding: 12, backgroundColor: "#fff0ec" }}><Text accessibilityRole="alert" selectable>{error}</Text><Button label={t(language, "common.dismiss")} tone="ghost" onPress={actions.dismissError} /></View> : null}
        {saving || scanning ? <Text accessibilityLiveRegion="polite" style={{ padding: 8 }}>{saving ? t(language, "common.saving") : t(language, "common.scanning")}</Text> : null}
          {data.stocks.length === 0 ? <Card>
            <Text style={styles.cardTitle}>{t(language, "home.onboarding.title")}</Text>
            <Text style={styles.cardBody}>{t(language, "home.onboarding.body")}</Text>
            <Button label={t(language, "home.onboarding.addStock")} onPress={() => openStockEditor("")} />
            <Button label={t(language, "home.onboarding.addRecipes")} tone="secondary" onPress={() => actions.addStarterRecipes()} />
            <Button label={t(language, "home.onboarding.exploreSample")} tone="ghost" onPress={() => actions.resetToSeed()} />
          </Card> : null}
          {data.snapshots.some(snapshot => snapshot.isMock) ? <Text style={{ padding: 10, color: "#6d4b16", fontSize: 14 }}>{t(language, "home.sampleNotice")}</Text> : null}
          {tab === "Home" && data.stocks.length > 0 ? (
            <TodayScreen
              language={language}
              stockDirectory={stockDirectory}
              urgentStocks={homeUrgentStocks}
              opportunityStocks={homeOpportunityStocks}
              staleReviewStocks={homeStaleReviewStocks}
              openAlertsCount={openAlerts}
              outcomes={data.outcomes}
              latestScanRun={latestScanRun}
              providerHealth={providerHealth}
              providerHealthLoading={providerHealthLoading}
              onSelectStock={(stockId, eyeId) => openStockContext({ stockId, eyeId })}
              onOpenAlerts={() => setTab("Alerts")}
              onOpenRecipes={() => setTab("Logic Lab")}
              onOpenJournal={(eyeId, alertId) => {
                if (eyeId) openHomeJournalComposer(eyeId, alertId);
                else setTab("Journal");
              }}
              fallbackFocusRef={homeSurfaceFallbackRef}
            />
          ) : null}

          {tab === "Stocks" ? (
            <WatchlistScreen
              language={language}
              query={stockSearch}
              onQueryChange={setStockSearch}
              candidates={watchlistModel.candidates}
              recent={watchlistModel.recent}
              available={watchlistModel.available}
              hasMore={stockCandidates.length > visibleStocks}
              onShowMore={() => setVisibleStocks((count) => count + 24)}
              selected={watchlistModel.selected}
              queryHasResults={stockSuggestions.length > 0}
              searchHasQuery={hasStockQuery}
              onSelectStock={(stockId) => openStockContext({ stockId })}
              onClearRecent={() => setRecentStockIds([])}
              onAddStock={() => openStockEditor("")}
              onEditStock={() => openStockEditor(selectedStockSummary?.stock.id ?? "")}
              onArchiveStock={async () => {
                if (!selectedStockSummary) return;
                await actions.archiveStock(selectedStockSummary.stock.id);
                setSelectedStockId("");
                closeEntityRoute("Stocks");
              }}
              onClearSelection={() => {
                setSelectedStockId("");
                setStockSearch("");
                closeEntityRoute("Stocks");
              }}
              onRegisterEye={() => {
                if (!selectedStockSummary) return;
                setEyeForm((current) => ({ ...current, stockId: selectedStockSummary.stock.id }));
                openEyeComposer();
              }}
              onManageEyes={() => selectedStockSummary
                ? openStockContext({ stockId: selectedStockSummary.stock.id, target: "Eyes" })
                : setTab("Eyes")}
              onOpenMetric={(metricId, invoker) => {
                const card = sortedSelectedStockAnalysisCards.find((item) => item.id === metricId);
                if (card) openMetricDetail(card, invoker);
              }}
              onOpenDecision={(decisionId, invoker) => selectedStockSummary && openDecisionDetail(
                decisionId,
                invoker,
                { tab: "Stocks", params: { stockId: selectedStockSummary.stock.id } },
              )}
              statusFilter={analysisStatusFilter}
              statusChoices={watchlistModel.statusChoices}
              onStatusFilterChange={setAnalysisStatusFilter}
              boardMode={stockBoardMode}
              boardChoices={watchlistModel.boardChoices}
              onBoardModeChange={setStockBoardMode}
              lookback={analysisLookback}
              lookbackChoices={watchlistModel.lookbackChoices}
              onLookbackChange={setAnalysisLookback}
              benchmark={analysisBenchmark}
              benchmarkChoices={watchlistModel.benchmarkChoices}
              onBenchmarkChange={setAnalysisBenchmark}
              controlsDirty={stockControlsDirty}
              onResetControls={() => {
                setAnalysisBenchmark(defaultAnalysisBenchmark);
                setAnalysisLookback(defaultAnalysisLookback);
                setAnalysisStatusFilter(defaultAnalysisStatusFilter);
                setStockBoardMode(defaultStockBoardMode);
              }}
            />
          ) : null}

          {tab === "Logic Lab" ? (
            <RecipesScreen
              language={language}
              layer={logicLabLayer}
              layerChoices={recipesModel.layerChoices}
              onLayerChange={setLogicLabLayer}
              rawSources={recipesModel.rawSources}
              formulas={recipesModel.formulas}
              rules={recipesModel.rules}
              sets={recipesModel.sets}
              signals={recipesModel.signals}
              scanner={recipesModel.scanner}
              onRunScanner={() => { void actions.runDailyScanner(); }}
              onOpenRawRegistry={() => openLogicRegistry()}
              onOpenFormula={(metricId) => {
                const metric = logicLabMetricCatalog.find((item) => item.key === metricId);
                if (metric) openMetricBuilder(metric);
              }}
              onCreateFormula={() => openMetricBuilder()}
              onOpenRule={(recipeId, ruleId) => {
                const row = logicLabRuleLibrary.find((item) => item.recipeId === recipeId && item.condition.id === ruleId);
                if (row) openConditionBuilder(row);
              }}
              onOpenSet={(recipeId) => openRecipeDetail(recipeId)}
              onOpenSetVersions={(recipeId) => {
                logicVersionFocus.captureInvoker();
                setLogicVersionsRecipeId(recipeId);
              }}
              onCreateRecipe={() => {
                resetRecipeBuilderDraft();
                openRecipeBuilder();
              }}
              onCreateSet={() => openLogicSetBuilder()}
              onOpenSignalReview={(signalId) => {
                const signal = latestScanSignals.find((item) => item.signalId === signalId);
                if (signal) openScannerReview(signal);
              }}
            />
          ) : null}

          {tab === "Eyes" ? (
            <EyeFlowsScreen
              language={language}
              filter={eyesShelfFilter}
              onFilterChange={setEyesShelfFilter}
              activeRows={activeEyeFlowRows}
              quietRows={quietEyeFlowRows}
              activeCount={activeEyesInventory.length}
              quietCount={inactiveEyesInventory.length}
              selectedEyeId={selectedEye?.id}
              focusRestoreRef={eyeDetailFocus.returnFocusRef}
              fallbackFocusRef={eyesSurfaceFallbackRef}
              onCreate={() => {
                resetEyeComposerDraft();
                openEyeComposer();
              }}
              onOpenEye={(eyeId, invoker) => openEyeDetail(eyeId, invoker)}
            />
          ) : null}

          {tab === "Alerts" ? (
            <AlertsScreen
              language={language}
              view={alertWorkspaceTab as AlertsView}
              onViewChange={(view) => setAlertWorkspaceTab(view)}
              groups={alertsModel.groups}
              history={alertsModel.history}
              snoozedCount={snoozedAlerts.length}
              reviewedCount={reviewedAlerts.length}
              onOpenDetail={(alertId) => openAlertDetail(alertId)}
              onOpenStock={(stockId, alertId) => {
                if (alertId) openStockContext({ stockId, alertId, target: "Alerts" });
                else openStockContext({ stockId });
              }}
              onQuickDecision={(alertId, action) => {
                const alert = data.alerts.find((item) => item.id === alertId);
                if (alert) quickDecision(alert, action);
              }}
              onSnooze={(alertId) => { void actions.snoozeAlert(alertId, 24); }}
              onUnsnooze={(alertId) => { void actions.snoozeAlert(alertId, -1); }}
              onReviewed={(alertId) => { void actions.markAlertReviewed(alertId); }}
              onAcknowledgeGroup={(stockId) => {
                const group = groupedAlertQueue.find((item) => item.stock.id === stockId);
                if (group) void acknowledgeAlertGroup(group.openAlerts);
              }}
            />
          ) : null}

          {tab === "Journal" ? (
            <JournalScreen
              language={language}
              entries={journalEntryViews}
              totalCount={journalHistory.length}
              pendingOutcomeCount={data.outcomes.filter((outcome) => outcome.status === "Pending").length}
              filter={journalFilter}
              filterChoices={journalFilters.map((filter) => ({ value: filter, label: localizedJournalFilter(language, filter) }))}
              onFilterChange={setJournalFilter}
              onOpenDecision={(decisionId) => openDecisionDetail(decisionId)}
              onOpenStock={(stockId, eyeId) => openStockContext({ stockId, eyeId })}
              onOpenAlert={(alertId) => openAlertDetail(alertId)}
              onNew={() => openJournalComposer()}
            />
          ) : null}

          {tab === "Settings" ? (
            <SettingsScreen
              language={language}
              providers={settingsModel.providers}
              healthyCount={settingsModel.healthyCount}
              limitedCount={settingsModel.limitedCount}
              unconfiguredCount={settingsModel.unconfiguredCount}
              unavailableCount={settingsModel.unavailableCount}
              trackedStocks={data.stocks.filter((stock) => !stock.archivedAt).length}
              sampleData={data.snapshots.some((snapshot) => snapshot.isMock)}
              lastSnapshotUpdate={settingsModel.lastSnapshotUpdate}
              notificationSummary={settingsModel.notificationSummary}
              notificationTone={settingsModel.notificationTone}
              syncSummary={settingsModel.syncSummary}
              providerCheckPending={providerHealthLoading}
              scanPending={scanning}
              cloudConfigured={Boolean(cloud)}
              workspacePanel={<WorkspaceSettingsPanel data={data} actions={actions} language={language} />}
              notificationPanel={<NotificationSettingsPanel data={data} actions={actions} language={language} fallbackFocusRef={settingsSurfaceFallbackRef} />}
              syncPanel={<CloudSyncPanel data={data} actions={actions} language={language} />}
              onLanguageChange={(next) => {
                setLanguage(next);
                void saveAppLanguage(next);
              }}
              onCheckProviders={() => { void actions.refreshProviderHealth(); }}
              onRefreshSnapshots={() => actions.refreshMarketData()}
              onRunScan={() => actions.runDailyScanner()}
            />
          ) : null}
        {conditionBuilderOpen ? (
          <WindowPanel
            title={
              logicRuleEditingContext?.conditionId
                ? language === "ko"
                  ? "L1.5 규칙 수정"
                  : "Edit L1.5 Rule"
                : language === "ko"
                  ? "L1.5 규칙 빌더"
                  : "L1.5 Rule Builder"
            }
            subtitle={
              language === "ko"
                ? "L1 수식 하나를 선택하고, 수학 조건과 역할을 붙여 L1.5 규칙을 만듭니다."
                : "Pick one L1 formula, attach a mathematical condition and role, and save it as an L1.5 rule."
            }
            onClose={() => {
              setConditionBuilderOpen(false);
              resetLogicRuleBuilderDraft();
            }}
            closeLabel={t(language, "common.done")}
            returnFocusRef={conditionBuilderFocus.returnFocusRef}
            fallbackFocusRef={conditionBuilderFocus.fallbackFocusRef}
          >
            <Card style={styles.logicBuilderCompactCard}>
              <View style={styles.metricBuilderSectionHeader}>
                <Text style={styles.metricBuilderSectionTitle}>{language === "ko" ? "규칙 구성" : "Rule Composition"}</Text>
                <MetaPill label={language === "ko" ? "L1 → L1.5" : "L1 → L1.5"} tone="info" />
              </View>
              <View style={styles.metricBuilderCompactRow}>
                <View style={styles.metricBuilderSelectorField}>
                  <Text style={styles.metricBuilderMiniLabel}>{language === "ko" ? "L1 수식" : "L1 Formula"}</Text>
                  <SearchableSelect
                    label=""
                    options={logicLabMetricCatalog.map((metric) => ({
                      id: metric.key,
                      label: metric.name,
                      sublabel: metric.humanMeaning,
                    }))}
                    value={conditionBuilder.metricKey}
                    onSelect={(option: any) =>
                      setConditionBuilder((current) => ({ ...current, metricKey: option.id }))
                    }
                    placeholder={language === "ko" ? "수식 선택" : "Select formula"}
                  />
                </View>
                <View style={styles.metricBuilderSelectorField}>
                  <Text style={styles.metricBuilderMiniLabel}>{language === "ko" ? "대상 L2" : "Target L2"}</Text>
                  <SearchableSelect
                    label=""
                    options={logicLabRecipes.map((recipe) => ({
                      id: recipe.id,
                      label: recipe.name,
                      sublabel: `v${recipe.version} · ${localizedTimeHorizon(language, recipe.timeHorizon)}`,
                    }))}
                    value={conditionBuilderRecipeId}
                    onSelect={(option: any) => setConditionBuilderRecipeId(option.id)}
                    placeholder={language === "ko" ? "세트 선택" : "Choose set"}
                  />
                </View>
              </View>
            </Card>
            {selectedConditionMetric ? (
              <Card style={styles.logicBuilderCompactCard}>
                <View style={styles.navigatorHeader}>
                  <Text style={styles.navigatorEyebrow}>L1 FORMULA</Text>
                  <Text style={styles.navigatorBody}>{selectedConditionMetric.name}</Text>
                  <Text style={styles.previewDisclosure}>{selectedConditionMetric.humanMeaning}</Text>
                </View>
                <View style={styles.metaRow}>
                  {selectedConditionMetric.requiredData.map((field) => (
                    <MetaPill key={`condition-builder-field-${field}`} label={`L0 · ${rawLogicFieldLabel(language, field)}`} />
                  ))}
                </View>
              </Card>
            ) : null}
            <Card style={styles.logicBuilderCompactCard}>
              <Text style={styles.metricBuilderMiniLabel}>{language === "ko" ? "연산자" : "Operator"}</Text>
              <HorizontalChoice
                options={selectedOperatorOptions}
                value={conditionBuilder.operator}
                onSelect={(operator) => setConditionBuilder((current) => ({ ...current, operator }))}
              />
              <Text style={styles.metricBuilderMiniLabel}>{language === "ko" ? "기준값" : "Threshold"}</Text>
              {selectedConditionControl.type === "number" ? (
                <NumberStepper
                  label={language === "ko" ? "기준값 조정" : "Adjust threshold"}
                  value={Number(conditionBuilder.threshold)}
                  onChange={(next) => setConditionBuilder((current) => ({ ...current, threshold: String(next) }))}
                  step={selectedConditionControl.step}
                  min={selectedConditionControl.min}
                  max={selectedConditionControl.max}
                  unit={selectedConditionControl.unit}
                />
              ) : (
                <HorizontalChoice
                  options={selectedConditionControl.options}
                  value={conditionBuilder.threshold}
                  onSelect={(value) => setConditionBuilder((current) => ({ ...current, threshold: value }))}
                  labelForOption={(value) => localizedRecipeOptionValue(language, value)}
                />
              )}
              <Text style={styles.metricBuilderMiniLabel}>{language === "ko" ? "역할" : "Role"}</Text>
              <HorizontalChoice
                options={conditionRoleOptions as readonly string[]}
                value={conditionBuilder.role}
                onSelect={(role) =>
                  setConditionBuilder((current) => ({ ...current, role: role as NonNullable<RecipeCondition["role"]> }))
                }
                labelForOption={(role) => localizedConditionRole(language, role)}
              />
            </Card>
            <View style={styles.formulaPanel}>
              <Text style={styles.previewLabel}>{language === "ko" ? "실시간 규칙 미리보기" : "Live Rule Preview"}</Text>
              <Text style={styles.formulaTitle}>
                {selectedConditionMetric?.name ?? "--"} {conditionBuilder.operator}{" "}
                {formatMetricThreshold(selectedConditionMetric, conditionBuilder.threshold, language, selectedConditionFormula)}
              </Text>
              <Text style={styles.formulaBody}>
                {localizedConditionRole(language, conditionBuilder.role)} · {logicRoleStateEffect(language, conditionBuilder.role)}
              </Text>
            </View>
            <Input
              value={conditionBuilder.note}
              onChangeText={(note) => setConditionBuilder((current) => ({ ...current, note }))}
              placeholder={language === "ko" ? "선택 이유나 주의 메모를 짧게 적으세요." : "Add a short rationale or warning note."}
              multiline
            />
            <View style={styles.actionRow}>
              <Button
                label={logicRuleEditingContext?.conditionId ? (language === "ko" ? "규칙 저장" : "Save Rule") : language === "ko" ? "L1.5 규칙 추가" : "Add L1.5 Rule"}
                onPress={() => saveLogicRule()}
              />
              <Button
                label={language === "ko" ? "초기화" : "Reset"}
                tone="ghost"
                onPress={resetLogicRuleBuilderDraft}
              />
            </View>
          </WindowPanel>
        ) : null}

        {logicL0RegistryOpen ? (
          <WindowPanel
            title={language === "ko" ? "원천 데이터 레지스트리" : "Raw Data Registry"}
            subtitle={
              language === "ko"
                ? "여기서는 원천 데이터만 봅니다. 정의, 중요도, 연결된 처리 피처, 소스, API 원천을 확인하세요."
                : "This is the raw-data registry only. Review the definitions, importance, linked processed features, sources, and API origins here."
            }
            subtitleNumberOfLines={8}
            onClose={() => setLogicL0RegistryOpen(false)}
            closeLabel={t(language, "common.done")}
            returnFocusRef={logicRegistryFocus.returnFocusRef}
            fallbackFocusRef={logicRegistryFocus.fallbackFocusRef}
          >
            <RawDataRegistry
              language={language}
              dataSources={logicLabDataSources}
              rules={frozenScannerRules}
            />
          </WindowPanel>
        ) : null}

        {selectedLogicVersionRecipe ? (
          <WindowPanel
            title={language === "ko" ? "L2 버전 이력" : "L2 Version History"}
            subtitle={
              language === "ko"
                ? `"${selectedLogicVersionRecipe.name}" 세트가 언제 어떻게 바뀌었는지 비교합니다.`
                : `Review when and how "${selectedLogicVersionRecipe.name}" changed over time.`
            }
            onClose={() => setLogicVersionsRecipeId("")}
            closeLabel={t(language, "common.done")}
            returnFocusRef={logicVersionFocus.returnFocusRef}
            fallbackFocusRef={logicVersionFocus.fallbackFocusRef}
          >
            <View style={styles.versionHistoryStack}>
              {selectedLogicVersionLineage.map((recipe, index) => {
                const previous = selectedLogicVersionLineage[index + 1];
                const diff = buildLogicSetVersionDiff(recipe, previous);
                return (
                  <Card key={`logic-version-${recipe.id}`} style={styles.versionHistoryCard}>
                    <View style={styles.versionHistoryHeader}>
                      <View style={styles.versionHistoryTitleWrap}>
                        <Text style={styles.versionHistoryTitle}>
                          {recipe.name} · v{recipe.version}
                        </Text>
                        <Text style={styles.versionHistorySubtitle}>
                          {recipe.createdAt.slice(0, 16).replace("T", " ")}
                        </Text>
                      </View>
                      <MetaPill label={recipe.retiredAt ? (language === "ko" ? "은퇴" : "Retired") : language === "ko" ? "활성" : "Active"} tone={recipe.retiredAt ? "risk" : "success"} />
                    </View>
                    <View style={styles.versionHistoryMetaRow}>
                      <MetaPill label={language === "ko" ? `추가 ${diff.added}` : `Added ${diff.added}`} tone="info" />
                      <MetaPill label={language === "ko" ? `변경 ${diff.changed}` : `Changed ${diff.changed}`} tone="info" />
                      <MetaPill label={language === "ko" ? `삭제 ${diff.removed}` : `Removed ${diff.removed}`} tone="info" />
                      <MetaPill label={language === "ko" ? `메타 ${diff.metaChanged}` : `Meta ${diff.metaChanged}`} />
                    </View>
                    <Text style={styles.versionHistoryBody}>
                      {language === "ko"
                        ? `${recipe.conditions.length}개의 L1.5 규칙으로 구성된 세트입니다.`
                        : `This set version contains ${recipe.conditions.length} L1.5 rules.`}
                    </Text>
                    <View style={styles.versionHistoryActionRow}>
                      <Button
                        label={language === "ko" ? "이 버전으로 복원" : "Restore This Version"}
                        tone="secondary"
                        onPress={async () => {
                          const nextId = await actions.restoreRecipeVersion(recipe.id);
                          setLogicVersionsRecipeId(nextId ?? recipe.id);
                        }}
                        style={styles.versionHistoryActionButton}
                      />
                      <Button
                        label={language === "ko" ? "새 버전 생성" : "New Version"}
                        onPress={async () => {
                          const nextId = await actions.createRecipeVersion(recipe.id);
                          setLogicVersionsRecipeId(nextId ?? recipe.id);
                        }}
                        style={styles.versionHistoryActionButton}
                      />
                    </View>
                  </Card>
                );
              })}
            </View>
          </WindowPanel>
        ) : null}

        {logicInfoTarget ? (
          <WindowPanel
            title={logicInfoContent(language, logicInfoTarget).title}
            subtitle={language === "ko" ? "이 레벨이 맡는 역할과 입력, 출력, 연결 구조를 설명합니다." : "This explains the role, input, output, and connection model of the selected level."}
            onClose={() => setLogicInfoTarget("")}
            closeLabel={t(language, "common.done")}
            returnFocusRef={logicInfoFocus.returnFocusRef}
            fallbackFocusRef={logicInfoFocus.fallbackFocusRef}
          >
            <Card style={styles.logicInfoCard}>
              <Text style={styles.logicInfoBody}>{logicInfoContent(language, logicInfoTarget).body}</Text>
            </Card>
          </WindowPanel>
        ) : null}

        {metricBuilderOpen ? (
          <WindowPanel
            title={metricBuilderEditingKey ? (language === "ko" ? "L1 지표 수정" : "Edit L1 Metric") : language === "ko" ? "L1 지표 빌더" : "L1 Metric Builder"}
            subtitle={
              metricBuilderEditingKey
                ? language === "ko"
                  ? "기존 사용자 정의 지표를 같은 수식 체계 안에서 수정합니다."
                  : "Update the existing custom metric inside the same formula pipeline."
                : language === "ko"
                ? "L0 원천값과 수식을 명시적으로 연결해 새 지표를 정의합니다."
                : "Define a new metric by explicitly connecting raw L0 inputs to a formula."
            }
            onClose={() => {
              setMetricBuilderOpen(false);
              resetMetricBuilderDraft();
            }}
            closeLabel={t(language, "common.done")}
            returnFocusRef={metricBuilderFocus.returnFocusRef}
            fallbackFocusRef={metricBuilderFocus.fallbackFocusRef}
          >
            <Card style={styles.metricBuilderSectionCard}>
              <View style={styles.metricBuilderMetaGrid}>
                <View style={styles.metricBuilderMetaField}>
                  <Text style={styles.metricBuilderMiniLabel}>{language === "ko" ? "이름" : "Name"}</Text>
                  <Input
                    value={metricForm.name}
                    onChangeText={(name) => setMetricForm((current) => ({ ...current, name }))}
                    placeholder={language === "ko" ? "예: 조정 후 안정화 강도" : "Example: Post-pullback stabilization strength"}
                    invalid={metricFormAttempted && !metricForm.name.trim()}
                  />
                </View>
                <View style={styles.metricBuilderMetaField}>
                  <Text style={styles.metricBuilderMiniLabel}>{language === "ko" ? "의미" : "Meaning"}</Text>
                  <Input
                    value={metricForm.humanMeaning}
                    onChangeText={(humanMeaning) => setMetricForm((current) => ({ ...current, humanMeaning }))}
                    placeholder={
                      language === "ko"
                        ? "무엇을 측정하는지 한 줄로"
                        : "What the metric measures"
                    }
                    multiline
                    invalid={metricFormAttempted && !metricForm.humanMeaning.trim()}
                  />
                </View>
              </View>
              {metricFormAttempted && (!metricForm.name.trim() || !metricForm.humanMeaning.trim()) ? (
                <Text style={styles.validationText}>
                  {language === "ko"
                    ? "이름과 의미를 모두 채워야 합니다."
                    : "Name and meaning are both required."}
                </Text>
              ) : null}
            </Card>

            <Card style={styles.metricBuilderSectionCard}>
              <View style={styles.metricBuilderSectionHeader}>
                <Text style={styles.metricBuilderSectionTitle}>{language === "ko" ? "L1 계산기" : "L1 Calculator"}</Text>
                <MetaPill
                  label={
                    metricForm.builderMode === "raw"
                      ? language === "ko"
                        ? "L0 그대로"
                        : "Direct L0"
                      : language === "ko"
                        ? "수학식"
                        : "Equation"
                  }
                  tone={metricExpressionValidity.valid || metricForm.builderMode === "raw" ? "info" : "risk"}
                />
              </View>

              <HorizontalChoice
                options={["raw", "equation"]}
                value={metricForm.builderMode}
                onSelect={(builderMode) =>
                  setMetricForm((current) => ({
                    ...current,
                    builderMode: builderMode as "raw" | "equation",
                    selectedRawFields:
                      builderMode === "equation"
                        ? current.selectedRawFields.length > 0
                          ? current.selectedRawFields
                          : [current.rawParameterKey]
                        : current.selectedRawFields,
                  }))
                }
                labelForOption={(value) =>
                  language === "ko"
                    ? value === "raw"
                      ? "L0 그대로"
                      : "수학식 조합"
                    : value === "raw"
                      ? "Direct L0"
                      : "Equation"
                }
              />

              <View style={styles.metricBuilderCompactRow}>
                <View style={styles.metricBuilderSelectorField}>
                  <Text style={styles.metricBuilderMiniLabel}>{language === "ko" ? "L0 입력" : "L0 Input"}</Text>
                  <SearchableSelect
                    label=""
                    options={availableRawFieldOptions.map((field) => ({
                      id: field.key,
                      label: field.label,
                      sublabel: field.description,
                    }))}
                    value={metricInsertRawField}
                    onSelect={(option: any) => setMetricInsertRawField(option.id)}
                    placeholder={language === "ko" ? "원천값 선택" : "Choose raw input"}
                  />
                </View>
                <Button
                  label={language === "ko" ? "추가" : "Add"}
                  tone="secondary"
                  onPress={() => {
                    if (metricForm.builderMode === "raw") {
                      setMetricForm((current) => ({
                        ...current,
                        rawParameterKey: metricInsertRawField,
                        expression: metricInsertRawField,
                      }));
                      return;
                    }
                    appendMetricExpressionToken(metricInsertRawField);
                  }}
                  style={styles.metricCalculatorAction}
                />
              </View>

              <View
                style={[
                  styles.formulaCanvas,
                  metricForm.builderMode === "equation" && metricFormAttempted && !metricExpressionValidity.valid
                    ? styles.formulaCanvasInvalid
                    : null,
                ]}
              >
                {tokenizeExpression(metricForm.expression).length > 0 ? (
                  tokenizeExpression(metricForm.expression).map((token, index) => (
                    <Pressable
                      key={`expression-token-${token}-${index}`}
                      onPress={() =>
                        setMetricForm((current) => ({
                          ...current,
                          expression: tokenizeExpression(current.expression)
                            .filter((_, tokenIndex) => tokenIndex !== index)
                            .join(" "),
                        }))
                      }
                      style={[
                        styles.formulaToken,
                        /^[+\-*/()%,]+$/.test(token)
                          ? styles.formulaTokenOperator
                          : /^\d+(\.\d+)?$/.test(token)
                            ? styles.formulaTokenNumber
                            : styles.formulaTokenVariable,
                      ]}
                    >
                      <Text style={styles.formulaTokenText}>
                        {/^[A-Z_]+$/.test(token) ? buildExpressionPreview(token, [token]) : token}
                      </Text>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.previewDisclosure}>
                    {language === "ko" ? "L0와 연산자를 눌러 L1 수식을 조립하세요." : "Tap L0 inputs and operators to compose the L1 formula."}
                  </Text>
                )}
              </View>
              <View style={styles.metricBuilderStatusRow}>
                <View style={styles.metaRow}>
                  {(metricForm.builderMode === "raw" ? [metricForm.rawParameterKey] : metricForm.selectedRawFields).map((fieldKey) => (
                    <MetaPill
                      key={`metric-selected-field-${fieldKey}`}
                      label={availableRawFieldOptions.find((field) => field.key === fieldKey)?.label ?? fieldKey}
                      tone="info"
                    />
                  ))}
                </View>
                {metricForm.builderMode === "equation" ? (
                  <Text
                    style={[
                      styles.metricBuilderStatusText,
                      metricExpressionValidity.valid ? styles.metricBuilderStatusTextValid : styles.metricBuilderStatusTextInvalid,
                    ]}
                  >
                    {metricExpressionValidity.valid
                      ? language === "ko"
                        ? "수식 유효"
                        : "Valid"
                      : metricExpressionValidity.reason === "empty"
                        ? language === "ko"
                          ? "수식 비어 있음"
                          : "Empty formula"
                        : metricExpressionValidity.reason === "characters"
                          ? language === "ko"
                            ? "지원되지 않는 토큰"
                            : "Unsupported token"
                          : language === "ko"
                            ? "괄호/함수 오류"
                            : "Function / bracket error"}
                  </Text>
                ) : null}
              </View>
              {metricFormAttempted &&
              ((metricForm.builderMode === "raw" && !metricForm.rawParameterKey) ||
                (metricForm.builderMode === "equation" && metricForm.selectedRawFields.length === 0)) ? (
                <Text style={styles.validationText}>
                  {language === "ko" ? "최소 한 개의 L0 원천값이 필요합니다." : "At least one L0 input is required."}
                </Text>
              ) : null}

              {metricForm.builderMode === "equation" ? (
                <View style={styles.metricCalculatorGrid}>
                  <View style={styles.metricCalculatorColumn}>
                    <Text style={styles.metricBuilderMiniLabel}>{language === "ko" ? "연산자" : "Operators"}</Text>
                    <View style={styles.metricCalculatorPad}>
                      {["+", "-", "*", "/", "(", ")"].map((token) => (
                        <Pressable
                          key={`metric-op-${token}`}
                          onPress={() => appendMetricExpressionToken(token)}
                          style={styles.operatorChip}
                        >
                          <Text style={styles.operatorChipText}>{token}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.metricBuilderMiniLabel}>{language === "ko" ? "숫자" : "Number"}</Text>
                    <View style={styles.metricBuilderCompactRow}>
                      <View style={styles.metricBuilderSelectorField}>
                        <Input
                          value={metricNumberToken}
                          onChangeText={setMetricNumberToken}
                          placeholder={language === "ko" ? "예: 14, -25, 0.85" : "Example: 14, -25, 0.85"}
                          keyboardType="numeric"
                        />
                      </View>
                      <Button
                        label={language === "ko" ? "숫자" : "Number"}
                        tone="secondary"
                        onPress={() => {
                          if (!metricNumberToken.trim()) return;
                          appendMetricExpressionToken(metricNumberToken.trim());
                          setMetricNumberToken("");
                        }}
                        style={styles.metricCalculatorAction}
                      />
                    </View>
                  </View>

                  <View style={styles.metricCalculatorColumn}>
                    <Text style={styles.metricBuilderMiniLabel}>{language === "ko" ? "함수" : "Function"}</Text>
                    <SearchableSelect
                      label=""
                      options={functionTokenTemplates.map((template) => ({
                        id: template.split(" ")[0],
                        label: template.split(" ")[0],
                        sublabel: template,
                      }))}
                      value={metricFunctionKey}
                      onSelect={(option: any) => setMetricFunctionKey(option.id)}
                      placeholder={language === "ko" ? "함수 선택" : "Choose function"}
                    />
                    <View style={styles.metricFunctionArgsCard}>
                      <View style={styles.metricFunctionArgBlock}>
                        <HorizontalChoice
                          options={["parameter", "number"]}
                          value={metricFunctionArgMode1}
                          onSelect={(value) => setMetricFunctionArgMode1(value as "parameter" | "number")}
                          labelForOption={(value) =>
                            language === "ko"
                              ? value === "parameter"
                                ? "L0"
                                : "숫자"
                              : value === "parameter"
                                ? "L0"
                                : "Number"
                          }
                        />
                        {metricFunctionArgMode1 === "parameter" ? (
                          <SearchableSelect
                            label=""
                            options={availableRawFieldOptions.map((field) => ({
                              id: field.key,
                              label: field.label,
                              sublabel: field.description,
                            }))}
                            value={metricFunctionArgParameter1}
                            onSelect={(option: any) => setMetricFunctionArgParameter1(option.id)}
                            placeholder={language === "ko" ? "인자 1" : "Arg 1"}
                          />
                        ) : (
                          <Input
                            value={metricFunctionArgNumber1}
                            onChangeText={setMetricFunctionArgNumber1}
                            placeholder={language === "ko" ? "인자 1 숫자" : "Arg 1 number"}
                            keyboardType="numeric"
                          />
                        )}
                      </View>

                      {["PCT_CHANGE", "AVG", "MIN", "MAX", "CLAMP"].includes(metricFunctionKey) ? (
                        <View style={styles.metricFunctionArgBlock}>
                          <HorizontalChoice
                            options={["parameter", "number"]}
                            value={metricFunctionArgMode2}
                            onSelect={(value) => setMetricFunctionArgMode2(value as "parameter" | "number")}
                            labelForOption={(value) =>
                              language === "ko"
                                ? value === "parameter"
                                  ? "L0"
                                  : "숫자"
                                : value === "parameter"
                                  ? "L0"
                                  : "Number"
                            }
                          />
                          {metricFunctionArgMode2 === "parameter" ? (
                            <SearchableSelect
                              label=""
                              options={availableRawFieldOptions.map((field) => ({
                                id: field.key,
                                label: field.label,
                                sublabel: field.description,
                              }))}
                              value={metricFunctionArgParameter2}
                              onSelect={(option: any) => setMetricFunctionArgParameter2(option.id)}
                              placeholder={language === "ko" ? "인자 2" : "Arg 2"}
                            />
                          ) : (
                            <Input
                              value={metricFunctionArgNumber2}
                              onChangeText={setMetricFunctionArgNumber2}
                              placeholder={language === "ko" ? "인자 2 숫자" : "Arg 2 number"}
                              keyboardType="numeric"
                            />
                          )}
                        </View>
                      ) : null}

                      {metricFunctionKey === "CLAMP" ? (
                        <View style={styles.metricFunctionArgBlock}>
                          <HorizontalChoice
                            options={["parameter", "number"]}
                            value={metricFunctionArgMode3}
                            onSelect={(value) => setMetricFunctionArgMode3(value as "parameter" | "number")}
                            labelForOption={(value) =>
                              language === "ko"
                                ? value === "parameter"
                                  ? "L0"
                                  : "숫자"
                                : value === "parameter"
                                  ? "L0"
                                  : "Number"
                            }
                          />
                          {metricFunctionArgMode3 === "parameter" ? (
                            <SearchableSelect
                              label=""
                              options={availableRawFieldOptions.map((field) => ({
                                id: field.key,
                                label: field.label,
                                sublabel: field.description,
                              }))}
                              value={metricFunctionArgParameter3}
                              onSelect={(option: any) => setMetricFunctionArgParameter3(option.id)}
                              placeholder={language === "ko" ? "인자 3" : "Arg 3"}
                            />
                          ) : (
                            <Input
                              value={metricFunctionArgNumber3}
                              onChangeText={setMetricFunctionArgNumber3}
                              placeholder={language === "ko" ? "인자 3 숫자" : "Arg 3 number"}
                              keyboardType="numeric"
                            />
                          )}
                        </View>
                      ) : null}
                      <Button
                        label={language === "ko" ? "함수 추가" : "Add function"}
                        tone="secondary"
                        onPress={() => {
                          const token = buildMetricFunctionToken();
                          if (!token) return;
                          appendMetricExpressionToken(token);
                        }}
                      />
                    </View>
                  </View>
                </View>
              ) : null}

              <View style={styles.actionRow}>
                <Button
                  label={language === "ko" ? "마지막 토큰" : "Undo Token"}
                  tone="secondary"
                  onPress={removeMetricExpressionToken}
                />
                <Button
                  label={language === "ko" ? "전체 지우기" : "Clear"}
                  tone="ghost"
                  onPress={() => setMetricForm((current) => ({ ...current, expression: "" }))}
                />
              </View>
            </Card>

            {selectedMetricRequiredData.length > 0 ? (
              <Card style={styles.logicNavigatorCard}>
                <View style={styles.navigatorHeader}>
                  <Text style={styles.navigatorEyebrow}>{language === "ko" ? "L0 DEPENDENCY" : "L0 DEPENDENCY"}</Text>
                  <Text style={styles.navigatorBody}>
                    {language === "ko"
                      ? `${selectedMetricRequiredData.length}개 원천값 연결`
                      : `${selectedMetricRequiredData.length} raw inputs linked`}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  {selectedMetricRequiredData.map((field) => (
                    <MetaPill key={`metric-formula-field-${field}`} label={`L0 · ${rawLogicFieldLabel(language, field)}`} />
                  ))}
                </View>
              </Card>
            ) : null}

            <Text style={styles.inputLabel}>{language === "ko" ? "가용성" : "Availability"}</Text>
            <HorizontalChoice
              options={["automated", "manual", "future"]}
              value={metricForm.availability}
              onSelect={(availability) =>
                setMetricForm((current) => ({
                  ...current,
                  availability: availability as MetricDefinition["availability"],
                }))
              }
              labelForOption={(value) => localizedMetricAvailability(language, value)}
            />

            <Text style={styles.inputLabel}>{language === "ko" ? "신선도 기대치" : "Freshness expectation"}</Text>
            <HorizontalChoice
              options={["Daily", "Near Real Time", "Review Cadence"]}
              value={metricForm.freshnessExpectation}
              onSelect={(freshnessExpectation) =>
                setMetricForm((current) => ({
                  ...current,
                  freshnessExpectation: freshnessExpectation as MetricDefinition["freshnessExpectation"],
                }))
              }
              labelForOption={(value) =>
                language === "ko"
                  ? value === "Daily"
                    ? "일간"
                    : value === "Near Real Time"
                      ? "준실시간"
                      : "검토 주기"
                  : value
              }
            />

            <Text style={styles.inputLabel}>{language === "ko" ? "예시 출력 설명" : "Example output description"}</Text>
            <Input
              value={metricForm.exampleDisplayText}
              onChangeText={(exampleDisplayText) => setMetricForm((current) => ({ ...current, exampleDisplayText }))}
              placeholder={
                language === "ko"
                  ? "이 수식이 어떤 출력값을 보여주는지 설명하세요."
                  : "Describe the representative output this formula produces."
              }
              multiline
            />

            <Text style={styles.inputLabel}>{language === "ko" ? "결측 처리 방식" : "Missing-data behavior"}</Text>
            <Input
              value={metricForm.missingDataBehavior}
              onChangeText={(missingDataBehavior) => setMetricForm((current) => ({ ...current, missingDataBehavior }))}
              placeholder={
                language === "ko"
                  ? "필요한 L0 값이 비면 어떻게 처리할지 적으세요."
                  : "Explain what happens if one or more L0 inputs are unavailable."
              }
              multiline
            />

            <View style={styles.actionRow}>
              <Button label={metricBuilderEditingKey ? (language === "ko" ? "수정 저장" : "Save Changes") : language === "ko" ? "저장" : "Save Metric"} onPress={saveMetric} />
              <Button
                label={language === "ko" ? "초기화" : "Reset"}
                tone="ghost"
                onPress={resetMetricBuilderDraft}
              />
            </View>
          </WindowPanel>
        ) : null}

        {logicSetBuilderOpen ? (
          <WindowPanel
            title={
              logicSetBuilderEditingId
                ? language === "ko"
                  ? "L2 세트 수정"
                  : "Edit L2 Set"
                : language === "ko"
                  ? "L2 세트 빌더"
                  : "L2 Set Builder"
            }
            subtitle={
              language === "ko"
                ? "L2는 L1.5 규칙의 집합입니다. 세트 이름을 정하고 재사용할 규칙을 고른 뒤 버전 세트로 저장합니다."
                : "L2 is a set of L1.5 rules. Name the set, choose the reusable rules, and save the versioned set."
            }
            onClose={() => {
              setLogicSetBuilderOpen(false);
              resetLogicSetBuilderDraft();
            }}
            closeLabel={t(language, "common.done")}
            returnFocusRef={logicSetBuilderFocus.returnFocusRef}
            fallbackFocusRef={logicSetBuilderFocus.fallbackFocusRef}
          >
            <Card style={styles.logicBuilderCompactCard}>
              <View style={styles.metricBuilderSectionHeader}>
                <Text style={styles.metricBuilderSectionTitle}>{language === "ko" ? "L2 세트 정의" : "L2 Set Definition"}</Text>
                <MetaPill label={language === "ko" ? "L1.5 → L2" : "L1.5 → L2"} tone="info" />
              </View>
              <View style={styles.metricBuilderMetaGrid}>
                <View style={styles.metricBuilderMetaField}>
                  <Text style={styles.metricBuilderMiniLabel}>{language === "ko" ? "세트 이름" : "Set name"}</Text>
                  <Input
                    value={logicSetForm.name}
                    onChangeText={(name) => setLogicSetForm((current) => ({ ...current, name }))}
                    placeholder={language === "ko" ? "예: 리셋 회복 세트" : "Example: Reset recovery set"}
                    invalid={logicSetFormAttempted && !logicSetForm.name.trim()}
                  />
                </View>
                <View style={styles.metricBuilderMetaField}>
                  <Text style={styles.metricBuilderMiniLabel}>{language === "ko" ? "세트 목적" : "Set purpose"}</Text>
                  <Input
                    value={logicSetForm.purpose}
                    onChangeText={(purpose) => setLogicSetForm((current) => ({ ...current, purpose }))}
                    placeholder={
                      language === "ko"
                        ? "이 세트가 포착하려는 상황"
                        : "What this set is meant to capture"
                    }
                    multiline
                    invalid={logicSetFormAttempted && !logicSetForm.purpose.trim()}
                  />
                </View>
              </View>
              {(logicSetFormAttempted && (!logicSetForm.name.trim() || !logicSetForm.purpose.trim())) ? (
                <Text style={styles.validationText}>
                  {language === "ko" ? "세트 이름과 목적을 모두 채워야 합니다." : "Name and purpose are both required."}
                </Text>
              ) : null}
              <View style={styles.dualDenseGrid}>
                <DenseStat label={language === "ko" ? "선택 규칙" : "Selected rules"} value={`${selectedLogicSetRuleTemplates.length}`} tone={selectedLogicSetRuleTemplates.length > 0 ? "strong" : "neutral"} />
                <DenseStat label={language === "ko" ? "검토 주기" : "Review cadence"} value={`${logicSetForm.reviewCadenceDays}d`} />
              </View>
              <Text style={styles.metricBuilderMiniLabel}>{language === "ko" ? "세트 시간축" : "Time horizon"}</Text>
              <HorizontalChoice
                options={timeHorizons}
                value={logicSetForm.timeHorizon}
                onSelect={(timeHorizon) => setLogicSetForm((current) => ({ ...current, timeHorizon }))}
                labelForOption={(value) => localizedTimeHorizon(language, value)}
              />
              <Text style={styles.metricBuilderMiniLabel}>{language === "ko" ? "주 사용 용도" : "Primary use case"}</Text>
              <HorizontalChoice
                options={useCaseOptions}
                value={logicSetForm.intendedUseCase}
                onSelect={(intendedUseCase) => setLogicSetForm((current) => ({ ...current, intendedUseCase }))}
                labelForOption={(value) => localizedUseCase(language, value)}
              />
            </Card>

            <Text style={styles.metricBuilderMiniLabel}>{language === "ko" ? "재사용할 L1.5 규칙" : "Reusable L1.5 Rules"}</Text>
            <View style={styles.stack}>
              {logicLabRuleLibrary.map((row) => {
                const metric = logicLabMetricCatalog.find((item) => item.key === row.condition.metricKey);
                const formula = row.condition.formulaKey
                  ? getFormulaDefinition(row.condition.formulaKey)
                  : undefined;
                const threshold = formatMetricThreshold(
                  metric,
                  String(row.condition.value ?? ""),
                  language,
                  formula,
                );
                const ruleRef = logicRuleRefKey(row.recipeId, row.condition.id);
                const selected = logicSetSelectedRuleRefs.includes(ruleRef);
                return (
                  <Pressable
                    key={`logic-set-rule-${ruleRef}`}
                    onPress={() =>
                      setLogicSetSelectedRuleRefs((current) =>
                        current.includes(ruleRef)
                          ? current.filter((item) => item !== ruleRef)
                          : [...current, ruleRef],
                      )
                    }
                    style={[
                      styles.logicRuleSelectCard,
                      selected ? styles.logicRuleSelectCardActive : null,
                    ]}
                  >
                    <View style={styles.inlineBetween}>
                      <View style={styles.flexOne}>
                        <Text style={styles.logicRuleSelectTitle} numberOfLines={2}>
                          {(metric?.name ?? row.condition.label)} {row.condition.operator ?? ""} {threshold}
                        </Text>
                        <Text style={styles.logicRuleSelectMeta} numberOfLines={2}>
                          {localizedConditionRole(language, row.condition.role ?? "Supporting Evidence")} · {row.recipeName} · v{row.recipeVersion}
                        </Text>
                      </View>
                      <View style={[styles.logicRuleSelectToggle, selected ? styles.logicRuleSelectToggleActive : null]}>
                        <Text style={[styles.logicRuleSelectToggleText, selected ? styles.logicRuleSelectToggleTextActive : null]}>
                          {selected ? (language === "ko" ? "선택됨" : "Added") : language === "ko" ? "추가" : "Add"}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {logicSetFormAttempted && selectedLogicSetRuleTemplates.length === 0 ? (
              <Text style={styles.validationText}>
                {language === "ko" ? "최소 한 개의 L1.5 규칙을 선택해야 합니다." : "Select at least one L1.5 rule."}
              </Text>
            ) : null}

            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>{language === "ko" ? "현재 L2 구성" : "Current L2 composition"}</Text>
              <Text style={styles.previewText}>
                {logicSetForm.name.trim() || (language === "ko" ? "이름 없는 세트" : "Untitled set")} · {selectedLogicSetRuleTemplates.length}
                {language === "ko" ? "개 규칙" : " rules"}
              </Text>
              {Object.entries(logicSetRulesByRole).map(([role, rows]) => (
                <Text key={`logic-set-role-${role}`} style={styles.previewDisclosure}>
                  {localizedConditionRole(language, role)} · {rows.length}
                </Text>
              ))}
            </View>

            <View style={styles.actionRow}>
              <Button
                label={logicSetBuilderEditingId ? (language === "ko" ? "세트 저장" : "Save Set") : language === "ko" ? "L2 세트 저장" : "Save L2 Set"}
                onPress={() => saveLogicSet()}
              />
              <Button
                label={language === "ko" ? "초기화" : "Reset"}
                tone="ghost"
                onPress={resetLogicSetBuilderDraft}
              />
            </View>
          </WindowPanel>
        ) : null}

        {selectedRecipe ? (
          <WindowPanel
            title={selectedRecipe.name}
            subtitle={`${t(language, "recipes.card.version", { version: selectedRecipe.version })} · ${localizedTimeHorizon(language, selectedRecipe.timeHorizon)}`}
            onClose={() => closeEntityRoute("Logic Lab")}
            closeLabel={t(language, "common.done")}
            returnFocusRef={recipeDetailFocus.returnFocusRef}
            fallbackFocusRef={recipeDetailFocus.fallbackFocusRef}
          >
            <Text style={styles.cardBody}>{selectedRecipe.purpose}</Text>
            <View style={styles.dualDenseGrid}>
              <DenseStat label={t(language, "recipes.detail.type")} value={localizedOpportunityType(language, selectedRecipe.opportunityType ?? t(language, "recipes.detail.general"))} tone="strong" />
              <DenseStat label={t(language, "recipes.detail.useCase")} value={localizedUseCase(language, selectedRecipe.intendedUseCase || t(language, "recipes.detail.unset"))} />
              <DenseStat label={t(language, "recipes.detail.cadence")} value={`${selectedRecipe.reviewConfig?.cadenceDays ?? 14}d`} />
              <DenseStat label={t(language, "recipes.detail.cooldown")} value={`${selectedRecipe.alertConfig?.cooldownHours ?? 24}h`} />
              <DenseStat label={t(language, "recipes.detail.eyes")} value={`${selectedRecipeLinkedEyes.length}`} />
              <DenseStat label={t(language, "recipes.detail.stocks")} value={`${selectedRecipeWatchedStocks}`} />
            </View>
            <View style={styles.metaRow}>
              <MetaPill label={starterRecipeNames.includes(selectedRecipe.name) ? t(language, "recipes.detail.starter") : t(language, "recipes.detail.custom")} />
              <MetaPill label={t(language, "recipes.detail.conditions", { count: selectedRecipe.conditions.length })} />
              {selectedRecipe.notes ? <MetaPill label={t(language, "recipes.detail.hasNotes")} /> : null}
            </View>
            {selectedRecipeLinkedEyes.length > 0 ? (
              <View style={styles.detailCallout}>
                <Text style={styles.detailCalloutLabel}>{t(language, "recipes.detail.trackedStocks")}</Text>
                <View style={styles.metaRow}>
                  {selectedRecipeLinkedEyes.slice(0, 6).map((eye) => (
                    <MetaPill key={`recipe-stock-${eye.id}`} label={stockLabel(data.stocks, eye.stockId)} />
                  ))}
                </View>
              </View>
            ) : null}
            <View style={styles.actionRow}>
              <Button
                label={t(language, "recipes.detail.useForEye")}
                onPress={() => {
                setEyeForm((current) => ({ ...current, recipeId: selectedRecipe.id }));
                  openEyeComposer();
                }}
              />
              <Button
                label={t(language, "recipes.detail.openBuilder")}
                tone="secondary"
                onPress={() => {
                  setRecipeBuilderEditingId(selectedRecipe.id);
                  setRecipeForm({
                    name: selectedRecipe.name,
                    purpose: selectedRecipe.purpose,
                    opportunityType: opportunityTypes.includes(
                      selectedRecipe.opportunityType as (typeof opportunityTypes)[number],
                    )
                      ? (selectedRecipe.opportunityType as (typeof opportunityTypes)[number])
                      : opportunityTypes[0],
                    timeHorizon: timeHorizons.includes(
                      selectedRecipe.timeHorizon as (typeof timeHorizons)[number],
                    )
                      ? (selectedRecipe.timeHorizon as (typeof timeHorizons)[number])
                      : timeHorizons[1],
                    intendedUseCase: useCaseOptions.includes(
                      selectedRecipe.intendedUseCase as (typeof useCaseOptions)[number],
                    )
                      ? (selectedRecipe.intendedUseCase as (typeof useCaseOptions)[number])
                      : useCaseOptions[0],
                    notes: selectedRecipe.notes || "",
                    reviewCadenceDays: selectedRecipe.reviewConfig?.cadenceDays ?? reviewCadenceOptions[2],
                    alertCooldownHours: selectedRecipe.alertConfig?.cooldownHours ?? alertCooldownOptions[2],
                  });
                  setDraftConditions(selectedRecipe.conditions);
                  setRecipeBuilderStep("Purpose");
                  openRecipeBuilder();
                }}
              />
            </View>
            {selectedRecipe.notes ? (
              <View style={styles.detailCallout}>
                <Text style={styles.detailCalloutLabel}>{t(language, "recipes.detail.builderNotes")}</Text>
                <Text style={styles.detailCalloutBody}>{selectedRecipe.notes}</Text>
              </View>
            ) : null}
            <View style={styles.stack}>
              {selectedRecipe.conditions.map((condition) => (
                <Card key={`recipe-condition-${condition.id}`}>
                  <Text style={[styles.kindPill, conditionKindTone(condition.kind)]}>{localizedConditionKind(language, condition.kind)}</Text>
                  <Text style={styles.cardBody}>{condition.label}</Text>
                </Card>
              ))}
            </View>
          </WindowPanel>
        ) : null}

        {recipeBuilderOpen ? (
          <RecipeBuilder
            language={language}
            editing={Boolean(recipeBuilderEditingId)}
            model={recipeBuilderModel}
            saving={saving}
            onFormChange={(change) => setRecipeForm((current) => ({
              ...current,
              ...change,
              opportunityType: change.opportunityType ? change.opportunityType as typeof current.opportunityType : current.opportunityType,
              timeHorizon: change.timeHorizon ? change.timeHorizon as typeof current.timeHorizon : current.timeHorizon,
              intendedUseCase: change.intendedUseCase ? change.intendedUseCase as typeof current.intendedUseCase : current.intendedUseCase,
            }))}
            onConditionChange={(change) => setConditionBuilder((current) => ({ ...current, ...change }))}
            onAddCondition={addDraftCondition}
            onClearConditions={() => setDraftConditions([])}
            onRemoveCondition={(conditionId) => setDraftConditions((current) => current.filter((condition) => condition.id !== conditionId))}
            onPreviewStock={setPreviewStockId}
            onContinue={continueRecipeBuilder}
            onBack={previousRecipeBuilderStep}
            onSave={() => void saveRecipe()}
            onCancel={() => {
              recipeBuilderOperationGate.endSession();
              setRecipeBuilderOpen(false);
              resetRecipeBuilderDraft();
            }}
            returnFocusRef={recipeBuilderFocus.returnFocusRef}
            fallbackFocusRef={recipeBuilderFocus.fallbackFocusRef}
          />
        ) : null}

        {eyeDetailOpen && selectedEye && selectedEyeDetail ? (
          <WindowPanel
            title={selectedEyeDetail.stockLabel}
            subtitle={`${selectedEyeDetail.recipeLabel} · ${selectedEyeDetail.state}`}
            onClose={() => closeEntityRoute("Eyes")}
            closeLabel={t(language, "common.done")}
            returnFocusRef={eyeDetailFocus.returnFocusRef}
            fallbackFocusRef={eyeDetailFocus.fallbackFocusRef}
          >
            <EyeDetail
              language={language}
              eye={selectedEyeDetail}
              onOpenStock={() => openStockContext({ stockId: selectedEye.stockId, eyeId: selectedEye.id })}
              onMarkReviewed={() => actions.markEyesReviewed({ stockId: selectedEye.stockId, recipeId: selectedEye.recipeId })}
              onAddJournal={() => {
                resetJournalComposerDraft();
                setDecisionForm((current) => ({ ...current, eyeId: selectedEye.id }));
                openJournalComposer();
              }}
              onEdit={() => {
                setEyeComposerEditingId(selectedEye.id);
                setEyeForm({
                  stockId: selectedEye.stockId,
                  recipeId: selectedEye.recipeId,
                  thesisSnapshot: selectedEye.thesisSnapshot,
                  plannedEntryLow: selectedEye.plannedEntryLow ? selectedEye.plannedEntryLow.toFixed(2) : "",
                  plannedEntryHigh: selectedEye.plannedEntryHigh ? selectedEye.plannedEntryHigh.toFixed(2) : "",
                  invalidationRule: selectedEye.invalidationRule ?? "",
                  lastReviewedDaysAgo: selectedEye.lastReviewedAt
                    ? Math.max(0, Math.round((Date.now() - new Date(selectedEye.lastReviewedAt).getTime()) / (1000 * 60 * 60 * 24)))
                    : reviewDateOptions[2].daysAgo,
                });
                openEyeComposer();
              }}
              onOpenDecision={selectedEyeLinkedDecisions[0] ? (invoker) => openDecisionDetail(
                selectedEyeLinkedDecisions[0].id,
                invoker,
                { tab: "Eyes", params: { eyeId: selectedEye.id } },
              ) : undefined}
              onArchive={async () => {
                await actions.deleteEye(selectedEye.id);
                closeEntityRoute("Eyes");
              }}
            />
          </WindowPanel>
        ) : null}

        {eyeComposerOpen ? (
          <EyeComposer
            language={language}
            editing={Boolean(eyeComposerEditingId)}
            draft={eyeForm}
            stocks={data.stocks}
            recipes={data.recipes}
            reviewDates={reviewDateOptions}
            attempted={eyeFormAttempted}
            saving={saving}
            onChange={(change) => setEyeForm((current) => ({ ...current, ...change }))}
            onSave={() => void saveEye()}
            onCancel={() => {
              eyeComposerOperationGate.endSession();
              setEyeComposerOpen(false);
              resetEyeComposerDraft();
            }}
            returnFocusRef={eyeComposerFocus.returnFocusRef}
            fallbackFocusRef={eyeComposerFallbackRef}
          />
        ) : null}

        {alertDetailOpen && selectedAlert && selectedAlertEye && selectedAlertRecipe ? (
          <WindowPanel
            title={selectedAlert.title}
            subtitle={`${stockLabel(data.stocks, selectedAlertEye.stockId)} · ${localizedAlertPriority(language, selectedAlert.priority)}`}
            onClose={() => closeEntityRoute("Alerts")}
            closeLabel={t(language, "common.done")}
            returnFocusRef={alertDetailFocus.returnFocusRef}
            fallbackFocusRef={alertDetailFocus.fallbackFocusRef}
          >
            <WhyNowPanel language={language} title={t(language, "alerts.detail.whatHappened")} body={selectedAlert.whyNow} state={selectedAlertEvaluation?.currentState ?? selectedAlert.evaluationContext?.currentState ?? t(language, "common.notCaptured")} recipeVersion={`${selectedAlertRecipe.name} v${selectedAlertRecipe.version}`} />
            <View style={styles.detailMetricStrip}>
              <DenseStat label={t(language, "alerts.detail.priority")} value={localizedAlertPriority(language, selectedAlert.priority)} tone={selectedAlert.priority === "High" ? "risk" : "strong"} />
              <DenseStat label={t(language, "alerts.detail.state")} value={selectedAlertEvaluation?.currentState ? localizedEyeState(language, selectedAlertEvaluation.currentState) : selectedAlert.evaluationContext?.currentState ?? t(language, "common.notCaptured")} />
              <DenseStat label={t(language, "alerts.detail.urgency")} value={selectedAlertEvaluation?.actionUrgency ? localizedActionUrgency(language, selectedAlertEvaluation.actionUrgency) : t(language, "common.notCaptured")} />
              <DenseStat label={t(language, "alerts.detail.data")} value={selectedAlert.dataQuality} tone={selectedAlert.dataQuality.includes("Mock") ? "risk" : "neutral"} />
            </View>
            <View style={styles.dualColumn}>
              <View style={styles.evidenceColumn}>
                <Text style={styles.columnTitle}>{t(language, "alerts.detail.biggestSupport")}</Text>
                <Text style={styles.listLine}>+ {selectedAlert.supportingEvidence[0] ?? t(language, "alerts.detail.noStrongSupport")}</Text>
              </View>
              <View style={styles.evidenceColumn}>
                <Text style={styles.columnTitle}>{t(language, "alerts.detail.biggestRisk")}</Text>
                <Text style={styles.listLine}>- {selectedAlert.risks[0] ?? t(language, "alerts.detail.noMajorRisk")}</Text>
              </View>
            </View>
            <WhatChangedPanel
              title={t(language, "alerts.detail.reviewFast")}
              items={
                [
                  t(language, "alerts.detail.item.priority", { value: localizedAlertPriority(language, selectedAlert.priority) }),
                  t(language, "alerts.detail.item.stateChange", { value: selectedAlert.stateChange }),
                  selectedAlert.dataQuality,
                ]
              }
            />
            <View style={styles.metaRow}>
              <MetaPill label={selectedAlert.reviewed ? t(language, "alerts.history.acknowledged") : t(language, "alerts.detail.open")} />
              <MetaPill label={selectedAlert.dataQuality} />
              {selectedAlert.usefulness ? <MetaPill label={localizedAlertUsefulness(language, selectedAlert.usefulness)} /> : null}
            </View>
            <View style={styles.analysisActionRow}>
              <Button
                label={t(language, "common.stock")}
                tone="secondary"
                onPress={() => {
                  openStockContext({ stockId: selectedAlertEye.stockId, eyeId: selectedAlertEye.id, alertId: selectedAlert.id, target: "Stocks" });
                }}
              />
              <Button label={t(language, "alerts.action.acknowledge")} onPress={() => actions.markAlertReviewed(selectedAlert.id)} />
              <Button label={t(language, "alerts.action.snooze24h")} tone="secondary" onPress={() => actions.snoozeAlert(selectedAlert.id, 24)} />
              <Button label={t(language, "alerts.action.useful")} tone="ghost" onPress={() => actions.setAlertFeedback(selectedAlert.id, "Useful")} />
              <Button label={t(language, "alerts.action.notUseful")} tone="ghost" onPress={() => actions.setAlertFeedback(selectedAlert.id, "Not Useful")} />
              {selectedAlertDecision ? (
                <Button
                  label={t(language, "common.journal")}
                  tone="ghost"
                  onPress={() => openDecisionDetail(selectedAlertDecision.id)}
                />
              ) : null}
            </View>
            <View style={styles.stack}>
              <Text style={styles.cardTitle}>{t(language, "alerts.detail.evidenceRecorded")}</Text>
              {(selectedAlertEvaluation?.conditionResults ?? selectedAlert.evaluationContext?.conditionResults ?? []).map(result => <Text selectable style={styles.cardBody} key={result.conditionId}>{result.role}: {result.explanation}</Text>)}
              {!selectedAlertEvaluation && !selectedAlert.evaluationContext ? <Text style={styles.cardBody}>{t(language, "alerts.detail.olderEvidence")}</Text> : null}
            </View>
          </WindowPanel>
        ) : null}

        {selectedDecision && selectedDecisionDetail ? (
          <WindowPanel
            title={selectedDecisionDetail.action}
            subtitle={selectedDecisionDetail.linkedContext}
            onClose={closeDecisionDetail}
            closeLabel={t(language, "common.done")}
            returnFocusRef={decisionDetailFocus.returnFocusRef}
            fallbackFocusRef={decisionReturnRouteRef.current.tab === "Stocks"
              ? stocksSurfaceFallbackRef
              : decisionReturnRouteRef.current.tab === "Eyes"
                ? eyesSurfaceFallbackRef
                : journalSurfaceFallbackRef}
          >
            <DecisionDetail
              language={language}
              decision={selectedDecisionDetail}
              outcomeEditor={selectedDecisionOutcome ? <OutcomeEditor key={selectedDecisionOutcome.id} outcome={selectedDecisionOutcome} actions={actions} language={language} /> : undefined}
              onOpenStock={data.eyes.some((eye) => eye.id === selectedDecision.eyeId) ? () => {
                const linkedEye = data.eyes.find((eye) => eye.id === selectedDecision.eyeId);
                if (!linkedEye) return;
                openStockContext({ stockId: linkedEye.stockId, eyeId: linkedEye.id });
              } : undefined}
              onOpenAlert={selectedDecision.alertId ? () => {
                setSelectedAlertId(selectedDecision.alertId ?? "");
                openAlertDetail(selectedDecision.alertId ?? "");
              } : undefined}
              onEdit={() => {
                setJournalComposerEditingId(selectedDecision.id);
                setDecisionForm({
                  eyeId: selectedDecision.eyeId,
                  alertId: selectedDecision.alertId ?? "",
                  action: selectedDecision.action,
                  note: selectedDecision.note,
                  concern: selectedDecision.concern,
                  thesisValid: selectedDecision.thesisValid,
                  timing: selectedDecision.timing,
                });
                openJournalComposer();
              }}
              onArchive={async () => {
                await actions.deleteDecision(selectedDecision.id);
                closeEntityRoute("Journal");
              }}
              onToggleOutcome={selectedDecisionOutcome ? () => actions.setOutcomeStatus(
                selectedDecisionOutcome.id,
                selectedDecisionOutcome.status === "Reviewed" ? "Pending" : "Reviewed",
              ) : undefined}
            />
          </WindowPanel>
        ) : null}

        {journalComposerOpen ? (
          <JournalComposer
            language={language}
            editing={Boolean(journalComposerEditingId)}
            draft={decisionForm}
            eyes={data.eyes.map((eye) => ({
              id: eye.id,
              label: stockLabel(data.stocks, eye.stockId),
              detail: recipeLabel(data.recipes, eye.recipeId),
            }))}
            actionOptions={decisionActions}
            thesisOptions={thesisValidityOptions}
            timingOptions={timingOptions}
            validationSection={journalValidationSection}
            saving={saving}
            onChange={(change) => setDecisionForm((current) => ({ ...current, ...change }))}
            onSave={() => void saveDecision()}
            onCancel={() => {
              journalComposerOperationGate.endSession();
              setJournalComposerOpen(false);
              resetJournalComposerDraft();
            }}
            returnFocusRef={journalComposerFocus.returnFocusRef}
            fallbackFocusRef={journalComposerFocus.fallbackFocusRef}
          />
        ) : null}

        {selectedScannerSignal ? (
          <WindowPanel
            title={t(language, "logic.scanner.reviewTitle")}
            subtitle={`${selectedScannerSignal.ticker} · ${selectedScannerSignal.ruleId}`}
            onClose={() => setScannerSignalReviewId("")}
            closeLabel={t(language, "common.done")}
            returnFocusRef={scannerReviewFocus.returnFocusRef}
            fallbackFocusRef={scannerReviewFocus.fallbackFocusRef}
          >
            {(close) => (
              <ScannerReview
                language={language}
                signal={{
                  ticker: selectedScannerSignal.ticker,
                  ruleId: selectedScannerSignal.ruleId,
                  status: localizedScannerStatus(language, selectedScannerSignal.status),
                  blocked: selectedScannerSignal.status === "BLOCKED_OR_INCOMPLETE_DATA",
                  reason: localizedScannerDescription(language, selectedScannerSignal.status) || t(language, "logic.scanner.incompleteBody"),
                  signalDate: formatLocaleDate(language, selectedScannerSignal.signalDate),
                  scanDate: formatLocaleDate(language, selectedScannerSignal.scanDate),
                  sourceContext: selectedScannerSignal.universeMode === "dynamic_current_universe"
                    ? language === "ko" ? "현재 동적 종목 범위" : "Dynamic current-universe scan"
                    : language === "ko" ? "고정 연구 종목 범위" : "Frozen research-universe scan",
                  providerName: selectedScannerRun?.providerName ?? (language === "ko" ? "제공자 기록 없음" : "Provider not recorded"),
                  runStatus: selectedScannerRun
                    ? localizedScanRunStatus(language, selectedScannerRun.status)
                    : language === "ko" ? "실행 상태 미기록" : "Run status not recorded",
                  matchedConditions: selectedScannerSignal.matchedConditionsJson,
                  missingConditions: selectedScannerSignal.missingConditionsJson,
                  failedConditions: selectedScannerSignal.failedConditionsJson,
                }}
                form={scannerReviewForm}
                onFormChange={setScannerReviewForm}
                onSave={() => { void submitScannerReview(close); }}
              />
            )}
          </WindowPanel>
        ) : null}

        {selectedEvidenceCard ? (
          <WindowPanel
            title={selectedEvidenceCard.title}
            subtitle={`${selectedStockSummary?.stock.symbol ?? (language === "ko" ? "종목" : "Stock")} · ${sourceTypeLabel(language, selectedEvidenceCard.sourceType)} · ${
              localizedFreshness(language, selectedEvidenceCard.freshness)
            }${
              selectedEvidenceIndex >= 0
                ? language === "ko"
                  ? ` · ${sortedSelectedStockAnalysisCards.length}개 중 ${selectedEvidenceIndex + 1}번째`
                  : ` · ${selectedEvidenceIndex + 1} of ${sortedSelectedStockAnalysisCards.length}`
                : ""
            }`}
            onClose={() => closeEntityRoute("Stocks")}
            closeLabel={t(language, "common.done")}
            returnFocusRef={metricDetailFocus.returnFocusRef}
            fallbackFocusRef={metricDetailFocus.fallbackFocusRef}
          >
            <MotionSwap
              swapKey={`metric-sheet-${selectedEvidenceCard.id}-${selectedEvidenceIndex}`}
              y={12}
              scaleFrom={0.992}
            >
            <StockMetricDetailSheet
              card={selectedEvidenceCard}
              language={language}
              selectedEvidenceIndex={selectedEvidenceIndex}
              total={sortedSelectedStockAnalysisCards.length}
              sortedCards={sortedSelectedStockAnalysisCards}
              isPinned={
                !!selectedStockSummary &&
                pinnedMetricKeys.includes(stockMetricPreferenceKey(selectedStockSummary.stock.id, selectedEvidenceCard.id))
              }
              onPrevious={() => cycleEvidenceCard(-1)}
              onNext={() => cycleEvidenceCard(1)}
              onTogglePin={() => togglePinnedMetric(selectedEvidenceCard)}
              onSelectCard={(card) => {
                setSelectedEvidenceCard(card);
                if (selectedStockSummary) setTab("Stocks", { stockId: selectedStockSummary.stock.id, metricId: card.id });
              }}
            />
            </MotionSwap>
          </WindowPanel>
        ) : null}
      </StockLedgerShell>
    </View>
  );
}
