import { StatusBar } from "expo-status-bar";
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { useAppModel } from "./src/hooks/useAppModel";
import { BottomNav } from "./src/components/BottomNav";
import { WindowPanel } from "./src/components/WindowPanel";
import {
  Alert,
  ConditionOperator,
  Decision,
  DecisionAction,
  Eye,
  EyeState,
  FreshnessStatus,
  ProviderHealthEntry,
  Recipe,
  RecipeCondition,
  Stock,
  VisualEvidenceCard,
  VisualEvidenceGroup,
} from "./src/types";
import { evaluateEye } from "./src/lib/evaluateEye";
import {
  buildEvidenceGroups,
  buildStockVisualAnalysisGroups,
} from "./src/lib/visualEvidence";

type TabKey = "Home" | "Stocks" | "Recipes" | "Eyes" | "Alerts" | "Journal" | "Settings";
type AlertWorkspaceTab = "Current" | "History" | "Detail";
type ConditionKind = RecipeCondition["kind"];
type AnalysisBenchmark = "SPY" | "QQQ" | "Sector ETF";
type AnalysisLookback = "20D" | "3M" | "6M";
type AnalysisStatusFilter =
  | "All Statuses"
  | "Passed"
  | "Near Trigger"
  | "Warning"
  | "Blocked"
  | "Needs Review";
type StockBoardMode = "Pinned First" | "Status" | "Family";
type HomeBucket = "All" | "Review Now" | "Forming" | "Review Soon";
type RecipeShelfFilter = "All" | "Starter" | "Custom" | "Recent";
type EyesShelfFilter = "All" | "Needs Review" | "Quiet";
type JournalFilter = "All" | "Entered" | "Skipped" | "Risky";

type StockRouteTarget = "Stocks" | "Alerts" | "Eyes" | "Journal";
type RecipeBuilderStep = "Purpose" | "Logic" | "Risk & Alerts" | "Review & Outcome";

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

const tabs: TabKey[] = ["Home", "Stocks", "Recipes", "Eyes", "Alerts", "Journal", "Settings"];
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
const starterRecipeNames = [
  "Temporary Bargain Sale",
  "Sector Leader Pullback",
  "Bad News Overreaction",
  "Earnings Reset Recovery",
];
const opportunityTypes = [
  "Temporary Mispricing",
  "Leader Pullback",
  "Recovery Setup",
  "Event Reset",
  "Risk Monitoring",
] as const;
const timeHorizons = ["1 to 2 weeks", "1 to 3 months", "3 to 12 months", "Multi-year"] as const;
const useCaseOptions = [
  "Watchlist Triage",
  "Position Building",
  "Post-Earnings Review",
  "Thesis Protection",
] as const;
const reviewCadenceOptions = [3, 7, 14, 30, 60] as const;
const alertCooldownOptions = [6, 12, 24, 48, 72] as const;
const manualFlagOptions = [
  "accounting issue",
  "regulatory risk",
  "guidance cut",
  "management credibility damage",
  "severe dilution risk",
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
const conditionCategories = [
  "Technical",
  "Valuation",
  "Business Quality",
  "News",
  "Macro",
  "Risk",
  "Sentiment",
] as const;

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
    id: "market-stress",
    category: "Macro",
    title: "Broad market stress",
    description: "Adapt recipe behavior when the wider market is under pressure.",
    metricKey: "relative_strength_vs_spy",
    formulaKey: "relative_strength_vs_spy_pct",
    defaultKind: "negative",
    complexity: "Layered",
    metricLabel: "market regime",
    defaultOperator: "<=",
    defaultValue: "-5",
    control: { type: "number", step: 1, min: -25, max: 25, unit: "%" },
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
  {
    id: "analyst-revisions",
    category: "Sentiment",
    title: "Analyst revision trend",
    description: "Track whether revisions are improving, flat, or weakening.",
    metricKey: "analyst_revision_trend",
    formulaKey: "analyst_revision_trend",
    defaultKind: "negative",
    complexity: "Simple",
    metricLabel: "revision trend",
    defaultOperator: "is",
    defaultValue: "weak",
    control: { type: "enum", options: ["improving", "flat", "weak"] },
  },
];

const createLocalId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const isoDateDaysAgo = (daysAgo: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
};

const parseThresholdValue = (rawValue: string, template: ConditionTemplate) => {
  if (template.control.type === "number") {
    return Number(rawValue);
  }
  if (rawValue === "true") return true;
  if (rawValue === "false") return false;
  return rawValue;
};

const operatorOptionsForTemplate = (template: ConditionTemplate): readonly ConditionOperator[] =>
  template.control.type === "number" ? [">=", "<=", ">", "<"] : template.defaultOperator === "contains" ? ["contains", "is"] : ["is"];

const formatMetricThreshold = (template: ConditionTemplate, threshold: string) => {
  if (template.control.type === "number") {
    return `${threshold}${template.control.unit ? ` ${template.control.unit}` : ""}`;
  }
  return threshold === "true" ? "Yes" : threshold === "false" ? "No" : threshold;
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

const stockMetricPreferenceKey = (stockId: string, cardId: string) => `${stockId}:${cardId}`;

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
  "Macro Context",
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

const stockBoardModeLabel = (mode: StockBoardMode) => {
  switch (mode) {
    case "Pinned First":
      return "Pinned";
    default:
      return mode;
  }
};

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

const formatDate = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const formatShortDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

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

const Reveal = ({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 240,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
};

const Card = ({
  children,
  highlighted,
}: {
  children: React.ReactNode;
  highlighted?: boolean;
}) => <View style={[styles.card, highlighted ? styles.cardHighlighted : null]}>{children}</View>;

const Button = ({
  label,
  onPress,
  tone = "primary",
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
}) => (
  <Pressable
    onPress={disabled ? undefined : onPress}
    style={({ pressed }) => [
      styles.button,
      tone === "primary"
        ? styles.buttonPrimary
        : tone === "secondary"
          ? styles.buttonSecondary
          : styles.buttonGhost,
      pressed && !disabled ? styles.buttonPressed : null,
      disabled ? styles.buttonDisabled : null,
    ]}
  >
    <Text
      style={[
        styles.buttonText,
        tone === "primary"
          ? styles.buttonPrimaryText
          : tone === "secondary"
          ? styles.buttonSecondaryText
          : styles.buttonGhostText,
        disabled ? styles.buttonDisabledText : null,
      ]}
      numberOfLines={1}
    >
      {label}
    </Text>
  </Pressable>
);

const Input = ({
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize,
  onSubmitEditing,
  returnKeyType,
  invalid,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: "default" | "numeric";
  autoCapitalize?: "none" | "sentences" | "characters";
  onSubmitEditing?: () => void;
  returnKeyType?: "done" | "go" | "next" | "search";
  invalid?: boolean;
}) => (
  <TextInput
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor="#8da0b7"
    multiline={multiline}
    keyboardType={keyboardType}
    autoCapitalize={autoCapitalize}
    onSubmitEditing={onSubmitEditing}
    returnKeyType={returnKeyType}
    style={[styles.input, invalid ? styles.inputInvalid : null, multiline ? styles.textArea : null]}
  />
);

const NumberStepper = ({
  label,
  value,
  onChange,
  step,
  min,
  max,
  unit,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  step: number;
  min: number;
  max: number;
  unit?: string;
}) => (
  <View style={styles.stepper}>
    <Text style={styles.stepperLabel}>{label}</Text>
    <View style={styles.stepperTrack}>
      <Pressable onPress={() => onChange(Math.max(min, Number((value - step).toFixed(2))))} style={styles.stepperButton}>
        <Text style={styles.stepperButtonText}>-</Text>
      </Pressable>
      <View style={styles.stepperValueWrap}>
        <Text style={styles.stepperValue}>
          {value}
          {unit ? ` ${unit}` : ""}
        </Text>
      </View>
      <Pressable onPress={() => onChange(Math.min(max, Number((value + step).toFixed(2))))} style={styles.stepperButton}>
        <Text style={styles.stepperButtonText}>+</Text>
      </Pressable>
    </View>
  </View>
);

const DenseStat = ({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "strong" | "risk" }) => (
  <View style={[styles.denseStat, tone === "strong" ? styles.denseStatStrong : tone === "risk" ? styles.denseStatRisk : null]}>
    <Text style={styles.denseStatLabel} numberOfLines={1}>
      {label}
    </Text>
    <Text style={styles.denseStatValue} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

const MetaPill = ({ label }: { label: string }) => (
  <View style={styles.metaPill}>
    <Text style={styles.metaPillText} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

const HorizontalChoice = <T extends string>({
  options,
  value,
  onSelect,
  variant = "chip",
  labelForOption,
}: {
  options: readonly T[];
  value: T;
  onSelect: (next: T) => void;
  variant?: "chip" | "segmented";
  labelForOption?: (option: T) => string;
}) => {
  if (variant === "segmented") {
    return (
      <View style={styles.segmentedChoice}>
        {options.map((option, index) => (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            style={({ pressed }) => [
              styles.segmentedChoiceItem,
              option === value ? styles.segmentedChoiceItemActive : null,
              index > 0 ? styles.segmentedChoiceItemDivider : null,
              pressed ? styles.choiceChipPressed : null,
            ]}
          >
            <Text
              style={[
                styles.segmentedChoiceText,
                option === value ? styles.segmentedChoiceTextActive : null,
              ]}
              numberOfLines={1}
            >
              {labelForOption ? labelForOption(option) : option}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>
      {options.map((option) => (
        <Pressable
          key={option}
          onPress={() => onSelect(option)}
          style={({ pressed }) => [
            styles.choiceChip,
            option === value ? styles.choiceChipActive : null,
            pressed ? styles.choiceChipPressed : null,
          ]}
        >
          <Text style={[styles.choiceChipText, option === value ? styles.choiceChipTextActive : null]} numberOfLines={1}>
            {labelForOption ? labelForOption(option) : option}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
};

const StepFlow = ({
  steps,
  current,
  onSelect,
}: {
  steps: readonly RecipeBuilderStep[];
  current: RecipeBuilderStep;
  onSelect: (step: RecipeBuilderStep) => void;
}) => {
  const currentIndex = steps.indexOf(current);

  return (
    <View style={styles.stepFlow}>
      {steps.map((step, index) => {
        const active = step === current;
        const complete = index < currentIndex;

        return (
          <React.Fragment key={step}>
            {index > 0 ? (
              <View style={[styles.stepConnector, complete ? styles.stepConnectorActive : null]} />
            ) : null}
            <Pressable onPress={() => onSelect(step)} style={styles.stepNode}>
              <View
                style={[
                  styles.stepDot,
                  active ? styles.stepDotActive : null,
                  complete ? styles.stepDotComplete : null,
                ]}
              >
                <Text
                  style={[
                    styles.stepDotText,
                    active || complete ? styles.stepDotTextActive : null,
                  ]}
                >
                  {index + 1}
                </Text>
              </View>
              <Text style={[styles.stepLabel, active ? styles.stepLabelActive : null]} numberOfLines={1}>
                {step}
              </Text>
            </Pressable>
          </React.Fragment>
        );
      })}
    </View>
  );
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

const ThresholdBar = ({ card }: { card: VisualEvidenceCard }) => {
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
        <Text style={styles.binaryVisualText}>{active ? "Active now" : "Inactive now"}</Text>
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
          <Text style={styles.eventCountdownLabel}>{visual.countdownLabel ?? "Event timing"}</Text>
          <Text style={styles.eventCountdownMeta}>
            {days <= 7 ? "Event risk is close enough to demand a fresh review." : "No major event pressure inside the near window."}
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
          <Text style={styles.thresholdLegendText}>Lower risk</Text>
          <Text style={styles.thresholdLegendText}>{card.metric.currentLabel}</Text>
          <Text style={styles.thresholdLegendText}>Higher risk</Text>
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
          <Text style={styles.thresholdLegendText}>{visual.markerLabel ?? "Trend"}</Text>
          <Text style={styles.thresholdLegendText}>
            Need {card.metric.thresholdLabel ?? "context"}
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
          <Text style={styles.thresholdLegendText}>Zone ${low.toFixed(2)}</Text>
          <Text style={styles.thresholdLegendText}>Now ${current.toFixed(2)}</Text>
          <Text style={styles.thresholdLegendText}>Zone ${high.toFixed(2)}</Text>
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
        <Text style={styles.thresholdLegendText}>Need {card.metric.thresholdLabel ?? "-"}</Text>
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
}: {
  title: string;
  body: string;
  state: string;
  recipeVersion: string;
}) => (
  <View style={styles.card}>
    <View style={styles.inlineBetween}>
      <View style={styles.flexOne}>
        <Text style={styles.inputLabel}>{title}</Text>
        <Text style={[styles.cardBody, { fontWeight: "700" }]}>{body}</Text>
      </View>
      <View style={styles.panelBadges}>
        <Text style={stateTone(state)}>{state}</Text>
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
}: {
  card: VisualEvidenceCard;
  compact?: boolean;
  onOpen?: () => void;
  pinned?: boolean;
  dense?: boolean;
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
              {pinned ? <Text style={styles.evidencePinnedMark}>Pinned</Text> : null}
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
                {compactStatusLabel(card.status)}
              </Text>
            </View>
          ) : (
            <>
              {pinned ? <Text style={styles.evidencePinnedMark}>Pinned</Text> : null}
              <StatusShape status={card.status} size={14} />
            </>
          )}
        </View>
      </View>

      {!compact ? <Text style={styles.evidenceSummary}>{card.summary}</Text> : null}
      
      <View style={compact ? styles.compactVisualContainer : styles.visualContainer}>
        <ThresholdBar card={card} />
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
            <View style={styles.compactFreshnessWrap}>
              <View style={freshnessTone(card.freshness)}>
                <View style={styles.freshnessDot} />
              </View>
              <Text style={[styles.compactFreshnessText, dense ? styles.compactFreshnessTextDense : null]} numberOfLines={1}>
                {card.freshness}
              </Text>
            </View>
          </View>
        </>
      ) : (
        <>
          <View style={styles.evidenceMetricsRow}>
            <DenseStat label="Current" value={card.metric.currentLabel} tone="strong" />
            <DenseStat label="Threshold" value={card.metric.thresholdLabel ?? "Context only"} />
          </View>

          {card.relatedConditionLabel ? (
            <Text style={styles.evidenceRelated}>Recipe link: {card.relatedConditionLabel}</Text>
          ) : null}

          <Text style={styles.evidenceEffect}>Effect: {card.effect}</Text>
          <Text style={styles.evidenceWhy}>Why it matters: {card.whyItMatters}</Text>

          <View style={styles.metaRow}>
            <MetaPill label={card.sourceType} />
            {card.metric.comparisonLabel ? <MetaPill label={card.metric.comparisonLabel} /> : null}
          </View>
        </>
      )}

      {!compact ? (
        <Text style={styles.formulaToggleText}>
          {expanded ? "Hide details" : "Show formula details"}
        </Text>
      ) : null}

      {expanded && !onOpen ? (
        <View style={styles.formulaPanel}>
          <Text style={styles.evidenceRole}>{card.role}</Text>
          <Text style={styles.evidenceSummary}>{card.summary}</Text>
          {card.relatedConditionLabel ? <Text style={styles.evidenceRelated}>Recipe link: {card.relatedConditionLabel}</Text> : null}
          <Text style={styles.evidenceEffect}>Effect: {card.effect}</Text>
          <Text style={styles.evidenceWhy}>Why it matters: {card.whyItMatters}</Text>
          <View style={styles.metaRow}>
            <MetaPill label={card.sourceType} />
            <MetaPill label={card.freshness} />
            {card.metric.comparisonLabel ? <MetaPill label={card.metric.comparisonLabel} /> : null}
          </View>
          <Text style={styles.formulaTitle}>{card.formulaName ?? "Formula detail"}</Text>
          <Text style={styles.formulaBody}>{card.formulaDescription ?? "No extra formula detail available."}</Text>
          <Text style={styles.formulaMeta}>
            Inputs: {card.formulaInputs?.join(", ") ?? "No explicit inputs recorded"}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
};

const DetailedVisualHero = ({
  card,
  compactLayout = false,
}: {
  card: VisualEvidenceCard;
  compactLayout?: boolean;
}) => {
  const visual = card.visual;
  const primarySeries = visual.series ?? [];
  const secondarySeries = visual.secondarySeries ?? [];
  const tertiarySeries = visual.tertiarySeries ?? [];
  const [selectedPoint, setSelectedPoint] = useState<number>(Math.max(primarySeries.length - 1, 0));

  useEffect(() => {
    setSelectedPoint(Math.max(primarySeries.length - 1, 0));
  }, [card.id, primarySeries.length]);

  if (visual.kind === "checklist") {
    return (
      <View style={[styles.detailHeroCard, compactLayout ? styles.detailHeroCardCompact : null]}>
        <View style={[styles.detailHeroHeader, compactLayout ? styles.detailHeroHeaderCompact : null]}>
          <Text style={styles.detailHeroEyebrow}>{card.family}</Text>
          <Text style={[styles.detailHeroValue, compactLayout ? styles.detailHeroValueCompact : null]}>{card.metric.currentLabel}</Text>
        </View>
        <View style={styles.detailChecklistStack}>
          {(visual.items ?? []).map((item) => (
            <View key={item.label} style={styles.detailChecklistRow}>
              <View
                style={[
                  styles.detailChecklistMarker,
                  item.tone === "good"
                    ? styles.detailChecklistMarkerGood
                    : item.tone === "warning"
                      ? styles.detailChecklistMarkerWarning
                      : item.tone === "danger"
                        ? styles.detailChecklistMarkerDanger
                        : styles.detailChecklistMarkerNeutral,
                ]}
              />
              <Text style={styles.detailChecklistLabel} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.detailHeroFootnote}>{card.metric.thresholdLabel ?? "Context"}</Text>
      </View>
    );
  }

  if (visual.kind === "event_countdown") {
    return (
      <View style={[styles.detailHeroCard, compactLayout ? styles.detailHeroCardCompact : null]}>
        <View style={[styles.detailHeroHeader, compactLayout ? styles.detailHeroHeaderCompact : null]}>
          <Text style={styles.detailHeroEyebrow}>{card.family}</Text>
          <Text style={[styles.detailHeroValue, compactLayout ? styles.detailHeroValueCompact : null]}>
            {visual.countdownLabel ?? card.metric.currentLabel}
          </Text>
        </View>
        <View style={styles.detailCountdownWrap}>
          <Text style={styles.detailCountdownDays}>{visual.countdownDays ?? "--"}</Text>
          <Text style={styles.detailCountdownUnit}>days</Text>
        </View>
        <Text style={styles.detailHeroFootnote}>{card.summary}</Text>
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
      <View style={[styles.detailHeroCard, compactLayout ? styles.detailHeroCardCompact : null]}>
        <View style={[styles.detailHeroHeader, compactLayout ? styles.detailHeroHeaderCompact : null]}>
          <Text style={styles.detailHeroEyebrow}>{card.family}</Text>
          <Text style={[styles.detailHeroValue, compactLayout ? styles.detailHeroValueCompact : null]}>{card.metric.currentLabel}</Text>
        </View>
        <View style={styles.detailGaugeTrack}>
          <View style={styles.detailGaugeSafe} />
          <View style={styles.detailGaugeWarn} />
          <View style={styles.detailGaugeDanger} />
          <View style={[styles.detailGaugeThreshold, { left: `${Math.max(0, Math.min(100, thresholdPct))}%` }]} />
          <View style={[styles.detailGaugeCurrent, { left: `${Math.max(0, Math.min(100, currentPct))}%` }]} />
        </View>
        <View style={[styles.detailHeroLegend, compactLayout ? styles.detailHeroLegendCompact : null]}>
          <Text style={styles.detailHeroLegendText}>Lower risk</Text>
          <Text style={styles.detailHeroLegendText}>Higher risk</Text>
        </View>
        <Text style={styles.detailHeroFootnote}>{card.metric.thresholdLabel ?? "Context"}</Text>
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
      <View style={[styles.detailHeroCard, compactLayout ? styles.detailHeroCardCompact : null]}>
        <View style={[styles.detailHeroHeader, compactLayout ? styles.detailHeroHeaderCompact : null]}>
          <Text style={styles.detailHeroEyebrow}>{card.family}</Text>
          <Text style={[styles.detailHeroValue, compactLayout ? styles.detailHeroValueCompact : null]}>{card.metric.currentLabel}</Text>
        </View>
        <View style={styles.detailZoneTrack}>
          <View style={[styles.detailZoneBand, { left: `${Math.max(0, start)}%`, width: `${Math.max(width, 6)}%` }]} />
          <View style={[styles.detailZoneMarker, { left: `${Math.max(0, Math.min(100, marker))}%` }]} />
        </View>
        <View style={[styles.detailHeroLegend, compactLayout ? styles.detailHeroLegendCompact : null]}>
          <Text style={styles.detailHeroLegendText}>${low.toFixed(2)}</Text>
          <Text style={styles.detailHeroLegendText}>${current.toFixed(2)}</Text>
          <Text style={styles.detailHeroLegendText}>${high.toFixed(2)}</Text>
        </View>
        <Text style={styles.detailHeroFootnote}>{card.metric.thresholdLabel ?? "Planned zone"}</Text>
      </View>
    );
  }

  const displaySeries = primarySeries.length > 0 ? primarySeries : [25, 32, 28, 36, 42, 40, 48, 54];
  const selectedValue = displaySeries[Math.max(0, Math.min(selectedPoint, displaySeries.length - 1))] ?? displaySeries[displaySeries.length - 1];
  const min = visual.min ?? Math.min(...displaySeries);
  const max = visual.max ?? Math.max(...displaySeries);
  const threshold = visual.threshold ?? min;
  const thresholdPct = ((threshold - min) / Math.max(max - min, 1)) * 100;
  const currentPct = ((selectedValue - min) / Math.max(max - min, 1)) * 100;
  const currentLabel =
    displaySeries.length > 1 && selectedPoint !== displaySeries.length - 1
      ? `Point ${selectedPoint + 1}`
      : "Latest";

  return (
    <View style={[styles.detailHeroCard, compactLayout ? styles.detailHeroCardCompact : null]}>
      <View style={[styles.detailHeroHeader, compactLayout ? styles.detailHeroHeaderCompact : null]}>
        <View style={styles.flexOne}>
          <Text style={styles.detailHeroEyebrow}>{card.family}</Text>
          <Text style={[styles.detailHeroValue, compactLayout ? styles.detailHeroValueCompact : null]}>{card.metric.currentLabel}</Text>
        </View>
        <View style={styles.detailHeroBadge}>
          <Text style={styles.detailHeroBadgeText}>{currentLabel}</Text>
        </View>
      </View>
      <View style={[styles.detailHeroChart, compactLayout ? styles.detailHeroChartCompact : null]}>
        <View style={styles.detailHeroGrid}>
          <View style={styles.detailHeroGridLine} />
          <View style={styles.detailHeroGridLine} />
          <View style={styles.detailHeroGridLine} />
        </View>
        <View style={[styles.detailHeroThresholdLine, { bottom: `${Math.max(0, Math.min(100, thresholdPct))}%` }]} />
        <View style={[styles.detailHeroCurrentLine, { bottom: `${Math.max(0, Math.min(100, currentPct))}%` }]} />
        <View style={styles.detailHeroBarsRow}>
          {displaySeries.map((point, index) => {
            const pointPct = ((point - min) / Math.max(max - min, 1)) * 100;
            const seriesActive = index === selectedPoint;
            return (
              <Pressable
                key={`${card.id}-detail-series-${index}`}
                onPress={() => setSelectedPoint(index)}
                style={[
                  styles.detailHeroBarHit,
                  seriesActive ? styles.detailHeroBarHitActive : null,
                ]}
              >
                <View
                  style={[
                    styles.detailHeroBar,
                    { height: `${Math.max(12, pointPct)}%` },
                    seriesActive ? styles.detailHeroBarActive : null,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
        {secondarySeries.length > 0 ? (
          <View pointerEvents="none" style={styles.detailHeroLineOverlay}>
            {secondarySeries.map((point, index) => {
              const pointPct = ((point - min) / Math.max(max - min, 1)) * 100;
              return (
                <View
                  key={`${card.id}-detail-secondary-${index}`}
                  style={[
                    styles.detailHeroLineDot,
                    {
                      left: `${(index / Math.max(secondarySeries.length - 1, 1)) * 100}%`,
                      bottom: `${Math.max(0, Math.min(100, pointPct))}%`,
                    },
                  ]}
                />
              );
            })}
          </View>
        ) : null}
        {tertiarySeries.length > 0 ? (
          <View pointerEvents="none" style={styles.detailHeroLineOverlay}>
            {tertiarySeries.map((point, index) => {
              const pointPct = ((point - min) / Math.max(max - min, 1)) * 100;
              return (
                <View
                  key={`${card.id}-detail-tertiary-${index}`}
                  style={[
                    styles.detailHeroLineDotMuted,
                    {
                      left: `${(index / Math.max(tertiarySeries.length - 1, 1)) * 100}%`,
                      bottom: `${Math.max(0, Math.min(100, pointPct))}%`,
                    },
                  ]}
                />
              );
            })}
          </View>
        ) : null}
      </View>
      <View style={[styles.detailHeroLegend, compactLayout ? styles.detailHeroLegendCompact : null]}>
        <Text style={styles.detailHeroLegendText}>{card.metric.thresholdLabel ?? "Threshold"}</Text>
        <Text style={styles.detailHeroLegendText}>{visual.markerLabel ?? card.metric.comparisonLabel ?? "Series"}</Text>
      </View>
      <Text style={styles.detailHeroFootnote}>
        Tap the chart bars to inspect earlier points without leaving the stock metric sheet.
      </Text>
    </View>
  );
};

const StockMetricDetailContent = ({
  card,
  selectedEvidenceIndex,
  total,
  sortedCards,
  isPinned,
  onPrevious,
  onNext,
  onTogglePin,
  onSelectCard,
  compactLayout = false,
}: {
  card: VisualEvidenceCard;
  selectedEvidenceIndex: number;
  total: number;
  sortedCards: VisualEvidenceCard[];
  isPinned: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onTogglePin: () => void;
  onSelectCard: (next: VisualEvidenceCard) => void;
  compactLayout?: boolean;
}) => {
  const [showFormulaDetails, setShowFormulaDetails] = useState(false);

  return (
    <>
      <DetailedVisualHero card={card} compactLayout={compactLayout} />
      <View style={[styles.detailNarrativePanel, compactLayout ? styles.detailNarrativePanelCompact : null]}>
        <View style={[styles.detailNarrativeHeader, compactLayout ? styles.detailNarrativeHeaderCompact : null]}>
          <Text style={styles.formulaTitle}>What stands out now</Text>
          <MetaPill label={`${selectedEvidenceIndex >= 0 ? selectedEvidenceIndex + 1 : 1} of ${total}`} />
        </View>
        <Text style={styles.detailNarrativeLead}>{card.summary}</Text>
        <View style={[styles.detailNarrativeSplit, compactLayout ? styles.detailNarrativeSplitCompact : null]}>
          <View style={styles.detailNarrativeBlock}>
            <Text style={styles.detailNarrativeLabel}>Effect</Text>
            <Text style={styles.formulaMeta}>{card.effect}</Text>
          </View>
          <View style={styles.detailNarrativeBlock}>
            <Text style={styles.detailNarrativeLabel}>Why it matters</Text>
            <Text style={styles.formulaMeta}>{card.whyItMatters}</Text>
          </View>
        </View>
        {card.relatedConditionLabel ? <MetaPill label={`Recipe: ${card.relatedConditionLabel}`} /> : null}
      </View>
      <View style={[styles.detailMetricStrip, compactLayout ? styles.detailMetricStripCompact : null]}>
        <DenseStat label="Current" value={card.metric.currentLabel} tone="strong" />
        <DenseStat label="Threshold" value={card.metric.thresholdLabel ?? "Context"} />
        <DenseStat label="Freshness" value={card.freshness} tone={card.freshness === "Fresh" ? "strong" : "neutral"} />
        <DenseStat label="Source" value={card.sourceType} />
      </View>
      <View style={[styles.detailSheetActionRow, compactLayout ? styles.detailSheetActionRowCompact : null]}>
        <Button label={compactLayout ? "Prev" : "Previous"} tone="secondary" onPress={onPrevious} disabled={selectedEvidenceIndex <= 0} />
        <Button label={isPinned ? "Unpin" : "Pin"} tone="ghost" onPress={onTogglePin} />
        <Button label="Next" tone="secondary" onPress={onNext} disabled={selectedEvidenceIndex < 0 || selectedEvidenceIndex >= total - 1} />
      </View>
      <View style={[styles.detailJumpSection, compactLayout ? styles.detailJumpSectionCompact : null]}>
        <Text style={styles.detailJumpTitle}>Browse more metrics</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.detailJumpRow}>
          {sortedCards.map((jumpCard) => (
            <Pressable
              key={`jump-${jumpCard.id}`}
              onPress={() => onSelectCard(jumpCard)}
              style={[
                styles.metricJumpChip,
                card.id === jumpCard.id ? styles.metricJumpChipActive : null,
              ]}
            >
              <Text
                style={[
                  styles.metricJumpChipText,
                  card.id === jumpCard.id ? styles.metricJumpChipTextActive : null,
                ]}
                numberOfLines={1}
              >
                {jumpCard.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <Pressable onPress={() => setShowFormulaDetails((current) => !current)} style={styles.detailDisclosurePanel}>
        <View style={styles.flexOne}>
          <Text style={styles.formulaTitle}>{showFormulaDetails ? "Hide formula detail" : "Show formula detail"}</Text>
          <Text style={styles.formulaMeta} numberOfLines={showFormulaDetails ? undefined : 1}>
            {card.formulaName ?? "How this metric is calculated"}
          </Text>
        </View>
        <Text style={styles.groupHeaderToggle}>{showFormulaDetails ? "Hide" : "Show"}</Text>
      </Pressable>
      {showFormulaDetails ? (
        <View style={styles.formulaPanel}>
          <Text style={styles.formulaTitle}>{card.formulaName ?? "Formula detail"}</Text>
          <Text style={styles.formulaBody}>
            {card.formulaDescription ?? "No extra formula detail available."}
          </Text>
          <Text style={styles.formulaMeta}>
            Inputs: {card.formulaInputs?.join(", ") ?? "No explicit inputs recorded"}
          </Text>
        </View>
      ) : null}
    </>
  );
};

const EvidenceGroupView = ({
  group,
  layout = "stack",
  defaultExpanded = true,
}: {
  group: VisualEvidenceGroup;
  layout?: "stack" | "grid";
  defaultExpanded?: boolean;
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View style={styles.evidenceGroup}>
      <Pressable onPress={() => setExpanded((current) => !current)} style={styles.groupHeaderButton}>
        <View style={styles.flexOne}>
          <Text style={styles.sectionTitle}>{group.title}</Text>
          <Text style={styles.sectionNote}>{group.note}</Text>
        </View>
        <Text style={styles.groupHeaderToggle}>{expanded ? "Hide" : "Show"}</Text>
      </Pressable>
      {expanded ? (
        <View style={layout === "grid" ? styles.evidenceGrid : styles.stack}>
          {group.cards.map((card) => (
            <View key={card.id} style={layout === "grid" ? styles.evidenceGridItem : undefined}>
              <EvidenceCardView card={card} compact={layout === "grid"} />
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
}: {
  eye: Eye;
  recipe: Recipe;
  stock: Stock;
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
          <Text style={stateTone(evaluation.currentState)}>{evaluation.currentState}</Text>
        </View>
      </View>

      <Text style={[styles.cardBody, { fontWeight: "700" }]}>{evaluation.whyNow}</Text>

      <View style={styles.homeStatsGrid}>
        <DenseStat label="Passed" value={`${passed.length}`} tone="strong" />
        <DenseStat label="Failed" value={`${failed.length}`} />
        <DenseStat label="Warnings" value={`${warnings.length}`} tone={warnings.length > 0 ? "risk" : "neutral"} />
        <DenseStat label="Blockers" value={`${blockers.length}`} tone={blockers.length > 0 ? "risk" : "neutral"} />
      </View>

      <View style={styles.analysisGrid}>
        <View style={[styles.analysisGridItem, styles.evidenceCard]}>
          <Text style={styles.inputLabel}>Support</Text>
          {(evaluation.supportingEvidence ?? []).slice(0, 3).map((item) => (
            <Text key={item} style={[styles.cardBody, { color: "#047857", fontSize: 11, marginTop: 4 }]}>
              + {item}
            </Text>
          ))}
        </View>
        <View style={[styles.analysisGridItem, styles.evidenceCard]}>
          <Text style={styles.inputLabel}>Risks</Text>
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
        <MetaPill label={`State: ${evaluation.stateChanged ? "Changed" : "Stable"}`} />
        <MetaPill label={`Urgency: ${evaluation.actionUrgency}`} />
        <MetaPill label={evaluation.setupStrength} />
      </View>

      {nextTrigger ? (
        <Text style={[styles.cardBody, { color: "#111827", fontSize: 12 }]}>Next trigger: {nextTrigger.explanation}</Text>
      ) : null}

      {evaluation.missingData.length > 0 || evaluation.staleData.length > 0 ? (
        <Text style={[styles.cardBody, { color: "#92400e", fontSize: 11 }]}>
          Data issues: {[...evaluation.missingData, ...evaluation.staleData].slice(0, 2).join(" | ")}
        </Text>
      ) : null}

      <Pressable onPress={() => setExpanded((current) => !current)} style={styles.actionRow}>
        <Text style={styles.buttonPrimaryText}>{expanded ? "Hide matrix" : "Show matrix"}</Text>
      </Pressable>

      {expanded ? (
        <View style={[styles.stack, { marginTop: 12 }]}>
          {(evaluation.conditionResults ?? []).map((item) => (
            <View key={item.conditionId} style={styles.inlineBetween}>
              <StatusShape status={item.missingData ? "Partial" : item.passed ? "Passed" : item.role === "Hard Disqualifier" ? "Blocked" : item.role === "Risk Warning" ? "Warning" : "Failed"} size={8} />
              <View style={[styles.flexOne, { marginLeft: 10 }]}>
                <Text style={[styles.evidenceCardTitle, { fontSize: 13 }]}>{item.metricKey ?? "Condition"}</Text>
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
}) => {
  const [expanded, setExpanded] = useState(false);
  const evaluation = item.dominantEye?.lastEvaluation;
  const topSupport = evaluation?.supportingEvidence?.[0] ?? evaluation?.whyNow ?? "No strong change recorded.";
  const topRisk =
    evaluation?.hardDisqualifiers?.[0] ??
    evaluation?.riskWarnings?.[0] ??
    evaluation?.contradictingEvidence?.[0] ??
    "No immediate risk surfaced.";

  return (
    <Card highlighted={Boolean(item.openAlerts.length)}>
      <Pressable onPress={() => setExpanded((current) => !current)} style={styles.stockTriageHeader}>
        <View style={styles.inlineBetween}>
          <View style={styles.flexOne}>
            <Text style={styles.cardEyebrow}>{item.stock.name}</Text>
            <View style={styles.stockTriageTitleRow}>
              <Text style={styles.alertTitle}>{item.stock.symbol}</Text>
              <Text style={styles.stockTriageToggle}>{expanded ? "Hide" : "Open"}</Text>
            </View>
          </View>
          <Text style={stateTone(evaluation?.currentState)}>{evaluation?.currentState ?? "Unwatched"}</Text>
        </View>

        <View style={styles.stockTriageSummaryRow}>
          <Text style={styles.stockTriagePrimaryMetric}>
            {item.snapshot ? `$${item.snapshot.price.toFixed(2)}` : "No feed"}
          </Text>
          <Text style={styles.stockTriageSecondaryMetric}>
            {item.snapshot ? `${item.snapshot.drawdownPct}% drawdown` : "No drawdown"}
          </Text>
          <Text style={styles.stockTriageSecondaryMetric}>{item.openAlerts.length} alerts</Text>
          <Text style={styles.stockTriageSecondaryMetric}>{item.snapshot?.freshness ?? "Unavailable"}</Text>
        </View>

        <Text style={styles.stockGroupSummary} numberOfLines={expanded ? 3 : 1}>
          {topSupport}
        </Text>
      </Pressable>

      {expanded ? (
        <View style={styles.stack}>
          <View style={styles.metaRow}>
            <MetaPill label={`${item.eyes.length} eyes`} />
            <MetaPill label={`${item.openAlerts.length} alerts`} />
            <MetaPill label={item.snapshot?.freshness ?? "Unavailable"} />
            {item.snapshot ? <MetaPill label={item.snapshot.isMock ? "Mock" : "Provider"} /> : null}
          </View>

          <View style={styles.detailCallout}>
            <Text style={styles.detailCalloutLabel}>Top support</Text>
            <Text style={styles.detailCalloutBody}>{topSupport}</Text>
          </View>
          <View style={styles.detailCallout}>
            <Text style={styles.detailCalloutLabel}>Top risk</Text>
            <Text style={styles.detailCalloutBody}>{topRisk}</Text>
          </View>

          {item.decisions.length > 0 ? (
            <View style={styles.detailCallout}>
              <Text style={styles.detailCalloutLabel}>Latest decision</Text>
              <Text style={styles.detailCalloutBody}>
                {item.decisions[0].action} · {formatShortDate(item.decisions[0].createdAt)}
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
        <Button label={expanded ? "Collapse" : "Expand"} tone="secondary" onPress={() => setExpanded((current) => !current)} />
        {onReview ? <Button label="Review" tone="ghost" onPress={onReview} /> : null}
        {onOpenAlerts ? <Button label="Alerts" tone="ghost" onPress={onOpenAlerts} /> : null}
        {onOpenJournal && item.decisions.length > 0 ? <Button label="Journal" tone="ghost" onPress={onOpenJournal} /> : null}
        <Button label="Stock" onPress={onOpenStock} />
      </View>
    </Card>
  );
};

const AlertClusterCard = ({
  group,
  selectedStockId,
  onOpenStock,
  onOpenDetail,
  onQuickDecision,
  onSnooze,
  onReviewed,
  onAcknowledgeAll,
}: {
  group: {
    stock: Stock;
    eyes: Eye[];
    openAlerts: Alert[];
    dominantEye?: Eye;
    groupedAlerts: Record<string, Alert[]>;
    highestPriority: "High" | "Medium";
  };
  selectedStockId: string;
  onOpenStock: () => void;
  onOpenDetail: (alertId: string) => void;
  onQuickDecision: (alert: Alert, action: DecisionAction) => void;
  onSnooze: (alertId: string) => void;
  onReviewed: (alertId: string) => void;
  onAcknowledgeAll: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const leadAlert = group.openAlerts[0];
  const nextAlert = group.openAlerts[1];
  const supportLine = group.dominantEye?.lastEvaluation?.whyNow ?? leadAlert?.whyNow ?? "Review grouped signals on this stock.";

  return (
    <Card highlighted={selectedStockId === group.stock.id}>
      <Pressable onPress={() => setExpanded((current) => !current)} style={styles.alertClusterHeader}>
        <View style={styles.inlineBetween}>
          <View style={styles.flexOne}>
            <Text style={styles.cardEyebrow}>{group.stock.name}</Text>
            <View style={styles.stockTriageTitleRow}>
              <Text style={styles.cardTitle}>{group.stock.symbol}</Text>
              <Text style={styles.stockTriageToggle}>{expanded ? "Hide" : "Open"}</Text>
            </View>
          </View>
          <View style={styles.priorityStack}>
            <View style={priorityTone(group.highestPriority)}>
              <Text style={styles.priorityBadgeText}>{group.highestPriority}</Text>
            </View>
            <Text style={styles.timestampText}>{group.openAlerts.length} alerts</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          {Object.entries(group.groupedAlerts)
            .slice(0, expanded ? undefined : 2)
            .map(([recipeName, alerts]) => (
              <MetaPill key={`${group.stock.id}-${recipeName}`} label={`${recipeName} · ${alerts.length}`} />
            ))}
        </View>

        <Text style={styles.stockGroupSummary} numberOfLines={expanded ? 3 : 1}>
          {supportLine}
        </Text>

        {!expanded && nextAlert ? (
          <Text style={styles.alertClusterPreview} numberOfLines={1}>
            Next: {nextAlert.title}
          </Text>
        ) : null}
      </Pressable>

      {expanded ? (
        <View style={styles.stack}>
          {group.openAlerts.map((alert) => (
            <Pressable key={alert.id} onPress={() => onOpenDetail(alert.id)} style={styles.alertClusterItem}>
              <View style={styles.inlineBetween}>
                <View style={styles.flexOne}>
                  <Text style={styles.alertMiniTitle}>{alert.title}</Text>
                  <Text style={styles.alertMiniBody} numberOfLines={2}>{alert.whyNow}</Text>
                </View>
                <View style={styles.priorityStack}>
                  <View style={priorityTone(alert.priority)}>
                    <Text style={styles.priorityBadgeText}>{alert.priority}</Text>
                  </View>
                  <Text style={styles.timestampText}>{formatDate(alert.createdAt)}</Text>
                </View>
              </View>
              <View style={styles.alertClusterActions}>
                <Button label="Entered" onPress={() => onQuickDecision(alert, "Entered")} />
                <Button label="Skip" tone="secondary" onPress={() => onQuickDecision(alert, "Skipped")} />
                <Button label="Snooze" tone="secondary" onPress={() => onSnooze(alert.id)} />
                <Button label="Done" tone="ghost" onPress={() => onReviewed(alert.id)} />
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.analysisActionRow}>
        <Button label="Open Stock" onPress={onOpenStock} />
        <Button label="Acknowledge All" tone="ghost" onPress={onAcknowledgeAll} />
        {leadAlert ? (
          <Button label={expanded ? "Lead Detail" : "Open Detail"} tone="secondary" onPress={() => onOpenDetail(leadAlert.id)} />
        ) : null}
      </View>
    </Card>
  );
};

interface RecipeDraftForm {
  name: string;
  purpose: string;
  opportunityType: (typeof opportunityTypes)[number];
  timeHorizon: (typeof timeHorizons)[number];
  intendedUseCase: (typeof useCaseOptions)[number];
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
  const { data, loading, providerHealth, providerHealthLoading, actions } = useAppModel();
  const [tab, setTab] = useState<TabKey>("Home");
  const [recipeBuilderStep, setRecipeBuilderStep] = useState<RecipeBuilderStep>("Purpose");
  const [alertWorkspaceTab, setAlertWorkspaceTab] = useState<Exclude<AlertWorkspaceTab, "Detail">>("Current");
  const [analysisBenchmark, setAnalysisBenchmark] = useState<AnalysisBenchmark>(defaultAnalysisBenchmark);
  const [analysisLookback, setAnalysisLookback] = useState<AnalysisLookback>(defaultAnalysisLookback);
  const [analysisStatusFilter, setAnalysisStatusFilter] = useState<AnalysisStatusFilter>(defaultAnalysisStatusFilter);
  const [stockBoardMode, setStockBoardMode] = useState<StockBoardMode>(defaultStockBoardMode);
  const [homeBucket, setHomeBucket] = useState<HomeBucket>("All");
  const [recipeShelfFilter, setRecipeShelfFilter] = useState<RecipeShelfFilter>("All");
  const [eyesShelfFilter, setEyesShelfFilter] = useState<EyesShelfFilter>("All");
  const [journalFilter, setJournalFilter] = useState<JournalFilter>("All");

  const [stockForm, setStockForm] = useState({ symbol: "", name: "", thesis: "" });
  const [recipeForm, setRecipeForm] = useState<RecipeDraftForm>({
    name: "",
    purpose: "",
    opportunityType: opportunityTypes[0],
    timeHorizon: timeHorizons[1],
    intendedUseCase: useCaseOptions[0],
    notes: "",
    reviewCadenceDays: reviewCadenceOptions[2],
    alertCooldownHours: alertCooldownOptions[2],
  });
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
    action: "Entered" as DecisionAction,
    note: "",
    concern: "",
    thesisValid: "Yes" as (typeof thesisValidityOptions)[number],
    timing: "On Time" as (typeof timingOptions)[number],
  });
  const [conditionBuilder, setConditionBuilder] = useState({
    category: "Technical",
    templateId: conditionLibrary[0].id,
    kind: conditionLibrary[0].defaultKind,
    operator: conditionLibrary[0].defaultOperator as ConditionOperator,
    threshold: conditionLibrary[0].defaultValue,
    note: "",
  });
  const [draftConditions, setDraftConditions] = useState<RecipeCondition[]>([]);
  const [selectedEyeId, setSelectedEyeId] = useState("");
  const [selectedAlertId, setSelectedAlertId] = useState("");
  const [selectedStockId, setSelectedStockId] = useState("");
  const [previewStockId, setPreviewStockId] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [recentStockIds, setRecentStockIds] = useState<string[]>([]);
  const [pinnedMetricKeys, setPinnedMetricKeys] = useState<string[]>([]);
  const [stockComposerOpen, setStockComposerOpen] = useState(false);
  const [selectedEvidenceCard, setSelectedEvidenceCard] = useState<VisualEvidenceCard | null>(null);
  const [selectedHeroPointIndex, setSelectedHeroPointIndex] = useState(0);
  const [recipeBuilderOpen, setRecipeBuilderOpen] = useState(false);
  const [recipeDetailId, setRecipeDetailId] = useState("");
  const [selectedDecisionId, setSelectedDecisionId] = useState("");
  const [eyeDetailOpen, setEyeDetailOpen] = useState(false);
  const [eyeComposerOpen, setEyeComposerOpen] = useState(false);
  const [journalComposerOpen, setJournalComposerOpen] = useState(false);
  const [alertDetailOpen, setAlertDetailOpen] = useState(false);
  const [recipeFormAttempted, setRecipeFormAttempted] = useState(false);
  const [eyeFormAttempted, setEyeFormAttempted] = useState(false);
  const [journalFormAttempted, setJournalFormAttempted] = useState(false);
  const [stockFormAttempted, setStockFormAttempted] = useState(false);
  const deferredStockSearch = useDeferredValue(stockSearch);
  const { width: viewportWidth } = useWindowDimensions();
  const isCompactPhone = viewportWidth < 390;
  const isVeryCompactPhone = viewportWidth < 360;

  const eyesSorted = useMemo(
    () =>
      [...(data?.eyes ?? [])].sort((a, b) => {
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

  const stockDirectory = useMemo(() => {
    if (!data) return [];
    const now = Date.now();
    return data.stocks
      .map((stock) => {
        const eyes = data.eyes.filter((eye) => eye.stockId === stock.id);
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
    if (!selectedEyeId && eyesSorted[0]) {
      setSelectedEyeId(eyesSorted[0].id);
      return;
    }
    if (selectedEyeId && !eyesSorted.some((eye) => eye.id === selectedEyeId)) {
      setSelectedEyeId(eyesSorted[0]?.id ?? "");
    }
  }, [eyesSorted, selectedEyeId]);

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
    if (!selectedAlertId && alertQueue[0]) {
      setSelectedAlertId(alertQueue[0].id);
      return;
    }
    if (selectedAlertId && !alertQueue.some((alert) => alert.id === selectedAlertId)) {
      setSelectedAlertId(alertQueue[0]?.id ?? "");
    }
  }, [alertQueue, selectedAlertId]);

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
    const template =
      conditionLibrary.find((item) => item.id === conditionBuilder.templateId) ?? conditionLibrary[0];
    setConditionBuilder((current) => ({
      ...current,
      kind: template.defaultKind,
      operator: template.defaultOperator,
      threshold: template.defaultValue,
    }));
  }, [conditionBuilder.templateId]);

  useEffect(() => {
    if (!eyeForm.stockId || !data) return;
    const snapshot = data.snapshots.find((item) => item.stockId === eyeForm.stockId);
    if (!snapshot) return;

    setEyeForm((current) => {
      if (current.stockId !== eyeForm.stockId) return current;
      if (current.plannedEntryLow && current.plannedEntryHigh) return current;
      const low = (snapshot.price * 0.97).toFixed(2);
      const high = snapshot.price.toFixed(2);
      return {
        ...current,
        plannedEntryLow: current.plannedEntryLow || low,
        plannedEntryHigh: current.plannedEntryHigh || high,
      };
    });
  }, [data, eyeForm.stockId]);

  const preSelectedStockSummary =
    filteredStockDirectory.find((item) => item.stock.id === selectedStockId) ??
    stockDirectory.find((item) => item.stock.id === selectedStockId);
  const preSelectedStockAnalysisGroups =
    preSelectedStockSummary?.snapshot
      ? buildStockVisualAnalysisGroups({
          stock: preSelectedStockSummary.stock,
          snapshot: preSelectedStockSummary.snapshot,
          eyes: [],
          recipes: data?.recipes ?? [],
          benchmark: analysisBenchmark,
          lookbackLabel: analysisLookback,
        }).map((group) => ({
          ...group,
          cards: group.cards.filter(
            (card) =>
              card.family !== "User Thesis Match" && matchesAnalysisStatus(card.status, analysisStatusFilter),
          ),
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
  const preSelectedStockTrendSeries = preSelectedStockSummary?.snapshot
    ? preSelectedStockSummary.snapshot.priceHistorySeries ??
      buildChartSeries(
        preSelectedStockSummary.snapshot.price,
        preSelectedStockSummary.snapshot.drawdownPct,
        preSelectedStockSummary.snapshot.stabilizationScore ?? 50,
      )
    : [];

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

  if (loading || !data) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <Text style={styles.loadingText}>Loading StockLedger...</Text>
      </SafeAreaView>
    );
  }

  const selectedEye = eyesSorted.find((eye) => eye.id === selectedEyeId) ?? eyesSorted[0];
  const selectedEyeStock = selectedEye
    ? data.stocks.find((stock) => stock.id === selectedEye.stockId)
    : undefined;
  const selectedEyeRecipe = selectedEye
    ? data.recipes.find((recipe) => recipe.id === selectedEye.recipeId)
    : undefined;
  const selectedStockSummary =
    filteredStockDirectory.find((item) => item.stock.id === selectedStockId) ??
    stockDirectory.find((item) => item.stock.id === selectedStockId);
  const selectedTemplate =
    conditionLibrary.find((item) => item.id === conditionBuilder.templateId) ?? conditionLibrary[0];
  const selectedOperatorOptions = operatorOptionsForTemplate(selectedTemplate);
  const selectedAlert = alertQueue.find((alert) => alert.id === selectedAlertId) ?? alertQueue[0];
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
    ? data.recipes.find((recipe) => recipe.id === selectedAlertEye.recipeId)
    : undefined;
  const selectedAlertSnapshot = selectedAlertEye
    ? data.snapshots.find((snapshot) => snapshot.stockId === selectedAlertEye.stockId)
    : undefined;
  const selectedAlertEvaluation = selectedAlertEye?.lastEvaluation;
  const selectedAlertDecision = selectedAlert
    ? data.decisions.find((decision) => decision.alertId === selectedAlert.id)
    : undefined;
  const selectedAlertEvidenceGroups =
    selectedAlertEye && selectedAlertRecipe && selectedAlertSnapshot && selectedAlertEvaluation
      ? buildEvidenceGroups({
          eye: selectedAlertEye,
          recipe: selectedAlertRecipe,
          snapshot: selectedAlertSnapshot,
          evaluation: selectedAlertEvaluation,
        })
      : [];

  const selectedStockEyes = selectedStockSummary?.eyes ?? [];
  const selectedStockAnalysisGroups =
    selectedStockSummary?.snapshot
      ? buildStockVisualAnalysisGroups({
          stock: selectedStockSummary.stock,
          snapshot: selectedStockSummary.snapshot,
          eyes: [],
          recipes: data.recipes,
          benchmark: analysisBenchmark,
          lookbackLabel: analysisLookback,
        }).map((group) => ({
          ...group,
          cards: group.cards.filter(
            (card) =>
              card.family !== "User Thesis Match" && matchesAnalysisStatus(card.status, analysisStatusFilter),
          ),
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
  const selectedStockTrendSeries = selectedStockSummary?.snapshot
    ? selectedStockSummary.snapshot.priceHistorySeries ??
      buildChartSeries(
        selectedStockSummary.snapshot.price,
        selectedStockSummary.snapshot.drawdownPct,
        selectedStockSummary.snapshot.stabilizationScore ?? 50,
      )
    : [];
  const selectedStockBenchmarkSeries = selectedStockSummary?.snapshot?.benchmarkHistorySeries ?? [];
  const selectedStockChartBounds =
    selectedStockTrendSeries.length > 0 || selectedStockBenchmarkSeries.length > 0
      ? {
          min: Math.min(...[...selectedStockTrendSeries, ...selectedStockBenchmarkSeries]),
          max: Math.max(...[...selectedStockTrendSeries, ...selectedStockBenchmarkSeries]),
        }
      : undefined;
  const selectedStockTrendDisplaySeries = normalizeSeries(selectedStockTrendSeries, selectedStockChartBounds);
  const selectedStockBenchmarkDisplaySeries = normalizeSeries(
    selectedStockBenchmarkSeries,
    selectedStockChartBounds,
  );
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
  const selectedHeroPointLabel =
    selectedStockTrendSeries.length > 1 && safeSelectedHeroPointIndex !== selectedStockTrendSeries.length - 1
      ? `Point ${safeSelectedHeroPointIndex + 1}`
      : "Latest";
  const selectedHeroBenchmarkDelta =
    selectedHeroPrice !== undefined && selectedHeroBenchmark !== undefined
      ? selectedHeroPrice - selectedHeroBenchmark
      : undefined;
  const recentStocks = recentStockIds
    .map((id) => stockDirectory.find((item) => item.stock.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const hasStockQuery = deferredStockSearch.trim().length > 0;
  const stockSuggestions = (hasStockQuery ? filteredStockDirectory : recentStocks).slice(0, 6);
  const topSuggestionId = hasStockQuery ? stockSuggestions[0]?.stock.id : "";
  const pinnedCountForSelectedStock = selectedStockSummary
    ? pinnedMetricKeys.filter((key) => key.startsWith(`${selectedStockSummary.stock.id}:`)).length
    : 0;
  const stockControlsDirty =
    analysisBenchmark !== defaultAnalysisBenchmark ||
    analysisLookback !== defaultAnalysisLookback ||
    analysisStatusFilter !== defaultAnalysisStatusFilter ||
    stockBoardMode !== defaultStockBoardMode;

  const activeEyesInventory = eyesSorted.filter(
    (eye) => !["Not Relevant", "Thesis Broken"].includes(eye.lastEvaluation?.currentState ?? "Not Relevant"),
  );
  const inactiveEyesInventory = eyesSorted.filter(
    (eye) => ["Not Relevant", "Thesis Broken"].includes(eye.lastEvaluation?.currentState ?? "Not Relevant"),
  );
  const filteredActiveEyesInventory = activeEyesInventory.filter((eye) => {
    if (eyesShelfFilter === "All") return true;
    if (eyesShelfFilter === "Needs Review") {
      return ["Attention Needed", "Opportunity Zone Forming", "Watch Closely"].includes(
        eye.lastEvaluation?.currentState ?? "",
      );
    }
    return eye.lastEvaluation?.currentState === "Not Relevant" || eye.lastEvaluation?.currentState === "Thesis Broken";
  });
  const filteredInactiveEyesInventory = inactiveEyesInventory.filter((eye) => {
    if (eyesShelfFilter === "All") return true;
    if (eyesShelfFilter === "Quiet") return true;
    return false;
  });
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
  const journalHistory = [...data.decisions].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
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
  const snapshotDiagnostics = {
    provider: data.snapshots.filter((snapshot) => !snapshot.isMock).length,
    mock: data.snapshots.filter((snapshot) => snapshot.isMock).length,
    partial: data.snapshots.filter((snapshot) => snapshot.freshness === "Partial").length,
    delayed: data.snapshots.filter((snapshot) => snapshot.freshness === "Delayed").length,
    stale: data.snapshots.filter((snapshot) => snapshot.freshness === "Stale").length,
    unavailable: data.snapshots.filter((snapshot) => snapshot.freshness === "Unavailable").length,
  };

  const previewRecipe =
    draftConditions.length === 0
      ? undefined
      : {
          id: "preview-recipe",
          version: 1,
          name: recipeForm.name.trim() || "Draft Recipe",
          purpose: recipeForm.purpose.trim() || "Preview how this draft logic behaves before saving it.",
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
        invalidationRule: eyeForm.invalidationRule.trim() || "Preview only.",
        lastReviewedAt: isoDateDaysAgo(eyeForm.lastReviewedDaysAgo),
        createdAt: new Date().toISOString(),
      }
    : undefined;
  const previewEvaluation =
    previewRecipe && previewEye && previewSnapshot
      ? evaluateEye(previewEye, previewRecipe, previewSnapshot)
      : undefined;
  const recipeStepPrompt =
    recipeBuilderStep === "Purpose"
      ? "Define what opportunity this recipe is trying to surface."
      : recipeBuilderStep === "Logic"
        ? "Translate the investment logic into concrete conditions."
        : recipeBuilderStep === "Risk & Alerts"
          ? "Set downgrade logic and alert behavior."
          : "Choose cadence and preview the recipe on a stock.";
  const canAdvanceRecipeStep =
    recipeBuilderStep === "Purpose"
      ? recipeForm.name.trim().length > 0 && recipeForm.purpose.trim().length > 0
      : recipeBuilderStep === "Logic"
        ? draftConditions.length > 0
        : recipeBuilderStep === "Risk & Alerts"
          ? recipeForm.alertCooldownHours > 0
          : recipeForm.reviewCadenceDays > 0 && draftConditions.length > 0;
  const recipeStepReadiness = [
    {
      step: "Purpose",
      ready: recipeForm.name.trim().length > 0 && recipeForm.purpose.trim().length > 0,
    },
    {
      step: "Logic",
      ready: draftConditions.length > 0,
    },
    {
      step: "Risk & Alerts",
      ready: recipeForm.alertCooldownHours > 0,
    },
    {
      step: "Review & Outcome",
      ready: recipeForm.reviewCadenceDays > 0 && draftConditions.length > 0,
    },
  ] as const;
  const topBarSubtitle =
    tab === "Home"
      ? `${homeUrgentStocks.length} urgent · ${openAlerts} open alerts`
      : tab === "Stocks"
        ? selectedStockSummary
          ? `${selectedStockSummary.stock.symbol} · ${sortedSelectedStockAnalysisCards.length} metrics`
          : "Search any stock and inspect the full board"
        : tab === "Recipes"
          ? `${filteredRecipes.length} recipes in view`
          : tab === "Eyes"
            ? `${filteredActiveEyesInventory.length} active eyes`
            : tab === "Alerts"
              ? `${groupedAlertQueue.length} stocks with open alerts`
              : tab === "Journal"
                ? `${filteredJournalHistory.length} journal entries in view`
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

  const openStockContext = ({
    stockId,
    eyeId,
    alertId,
    target = "Stocks",
  }: {
    stockId: string;
    eyeId?: string;
    alertId?: string;
    target?: StockRouteTarget;
  }) => {
    setSelectedStockId(stockId);
    setStockSearch("");
    if (eyeId) setSelectedEyeId(eyeId);
    if (alertId) setSelectedAlertId(alertId);
    setRecentStockIds((current) => [stockId, ...current.filter((id) => id !== stockId)].slice(0, 6));

    if (target === "Stocks") {
      setTab("Stocks");
      return;
    }
    if (target === "Alerts") {
      setAlertWorkspaceTab("Current");
      setAlertDetailOpen(Boolean(alertId));
      setTab("Alerts");
      return;
    }
    if (target === "Eyes") {
      setTab("Eyes");
      return;
    }
    setTab("Journal");
  };

  const cycleEvidenceCard = (direction: 1 | -1) => {
    if (!selectedEvidenceCard || sortedSelectedStockAnalysisCards.length === 0) return;
    const currentIndex = sortedSelectedStockAnalysisCards.findIndex((card) => card.id === selectedEvidenceCard.id);
    if (currentIndex < 0) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= sortedSelectedStockAnalysisCards.length) return;
    setSelectedEvidenceCard(sortedSelectedStockAnalysisCards[nextIndex]);
  };

  const togglePinnedMetric = (card: VisualEvidenceCard) => {
    if (!selectedStockSummary) return;
    const key = stockMetricPreferenceKey(selectedStockSummary.stock.id, card.id);
    setPinnedMetricKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  };

  const quickDecision = async (alert: Alert, action: DecisionAction) => {
    const eye = data.eyes.find((item) => item.id === alert.eyeId);
    if (!eye) return;

    const decisionId = await actions.logDecision({
      eyeId: eye.id,
      alertId: alert.id,
      action,
      note: `${action} after reviewing ${eyeLine(eye, data.stocks, data.recipes)}.`,
      concern:
        eye.lastEvaluation?.contradictingEvidence[0] ?? "No additional concern captured during quick review.",
      thesisValid: action === "Marked Thesis Broken" ? "No" : action === "Rejected" ? "Partly" : "Yes",
      timing: "On Time",
    });
    if (decisionId) {
      setSelectedDecisionId(decisionId);
    }
    openStockContext({
      stockId: eye.stockId,
      eyeId: eye.id,
      alertId: alert.id,
      target: "Journal",
    });
  };

  const acknowledgeAlertGroup = async (alerts: Alert[]) => {
    for (const alert of alerts) {
      await actions.markAlertReviewed(alert.id);
    }
  };

  const addDraftCondition = () => {
    const noteSuffix = conditionBuilder.note.trim() ? ` Notes: ${conditionBuilder.note.trim()}.` : "";
    const label = `${selectedTemplate.title}: ${selectedTemplate.metricLabel} ${conditionBuilder.operator} ${formatMetricThreshold(
      selectedTemplate,
      conditionBuilder.threshold,
    )}.${noteSuffix}`;
    setDraftConditions((current) => [
      {
        id: createLocalId("condition"),
        kind: conditionBuilder.kind,
        role: roleFromBuilderKind(conditionBuilder.kind),
        metricKey: selectedTemplate.metricKey,
        formulaKey: selectedTemplate.formulaKey,
        operator: conditionBuilder.operator,
        value: parseThresholdValue(conditionBuilder.threshold, selectedTemplate),
        humanDescription: label,
        notes: conditionBuilder.note.trim(),
        availability: selectedTemplate.metricKey === "manual_flag_present" ? "manual" : "automated",
        label,
      },
      ...current,
    ]);
    setConditionBuilder((current) => ({
      ...current,
      note: "",
    }));
  };

  const saveRecipe = async () => {
    setRecipeFormAttempted(true);
    if (!recipeForm.name.trim() || !recipeForm.purpose.trim() || draftConditions.length === 0) return;
    await actions.addRecipe({
      ...recipeForm,
      conditions: draftConditions,
    });
    setRecipeForm({
      name: "",
      purpose: "",
      opportunityType: opportunityTypes[0],
      timeHorizon: timeHorizons[1],
      intendedUseCase: useCaseOptions[0],
      notes: "",
      reviewCadenceDays: reviewCadenceOptions[2],
      alertCooldownHours: alertCooldownOptions[2],
    });
    setDraftConditions([]);
    setRecipeBuilderStep("Purpose");
    setRecipeBuilderOpen(false);
    setRecipeFormAttempted(false);
  };

  const saveEye = async () => {
    setEyeFormAttempted(true);
    if (!eyeForm.stockId || !eyeForm.recipeId || !eyeForm.thesisSnapshot.trim()) return;
    await actions.addEye({
      stockId: eyeForm.stockId,
      recipeId: eyeForm.recipeId,
      thesisSnapshot: eyeForm.thesisSnapshot,
      plannedEntryLow: Number(eyeForm.plannedEntryLow),
      plannedEntryHigh: Number(eyeForm.plannedEntryHigh),
      invalidationRule: eyeForm.invalidationRule,
      lastReviewedAt: isoDateDaysAgo(eyeForm.lastReviewedDaysAgo),
    });
    setEyeForm({
      stockId: "",
      recipeId: "",
      thesisSnapshot: "",
      plannedEntryLow: "",
      plannedEntryHigh: "",
      invalidationRule: "",
      lastReviewedDaysAgo: reviewDateOptions[2].daysAgo,
    });
    setEyeComposerOpen(false);
    setEyeFormAttempted(false);
  };

  const saveDecision = async () => {
    setJournalFormAttempted(true);
    if (!decisionForm.eyeId || !decisionForm.note.trim()) return;
    const decisionId = await actions.logDecision(decisionForm);
    if (decisionId) {
      setSelectedDecisionId(decisionId);
    }
    setDecisionForm({
      eyeId: "",
      alertId: "",
      action: "Entered",
      note: "",
      concern: "",
      thesisValid: "Yes",
      timing: "On Time",
    });
    setJournalComposerOpen(false);
    setJournalFormAttempted(false);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.frame}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.topBarTitle}>{tab}</Text>
            <Text style={styles.topBarSubtitle}>{topBarSubtitle}</Text>
          </View>
          <Pressable
            onPress={() => {
              setAlertWorkspaceTab("Current");
              setTab("Alerts");
            }}
            style={styles.alertBell}
          >
            <Text style={styles.alertBellIcon}>!</Text>
            {openAlerts > 0 ? (
              <View style={styles.alertBellBadge}>
                <Text style={styles.alertBellBadgeText}>{openAlerts}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.page}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {tab === "Home" ? (
            <>
              <Reveal>
                <SectionHeader note="Stock-grouped triage." />
                <View style={styles.homeSummaryStrip}>
                  <DenseStat label="Open alerts" value={`${openAlerts}`} tone={openAlerts > 0 ? "risk" : "strong"} />
                  <DenseStat label="Urgent stocks" value={`${homeUrgentStocks.length}`} tone={homeUrgentStocks.length > 0 ? "risk" : "neutral"} />
                  <DenseStat label="Opportunity" value={`${homeOpportunityStocks.length}`} />
                  <DenseStat label="Stale review" value={`${homeStaleReviewStocks.length}`} />
                </View>
                <HorizontalChoice options={homeBuckets} value={homeBucket} onSelect={setHomeBucket} />
              </Reveal>

              {(homeBucket === "All" || homeBucket === "Review Now") ? (
              <Reveal delay={40}>
                <SectionHeader title={`Review Now · ${homeUrgentStocks.length}`} note="Highest-urgency stocks first." />
                <View style={styles.stack}>
                  {homeUrgentStocks.length === 0 ? (
                    <Card>
                      <Text style={styles.cardBody}>No stocks need immediate review right now.</Text>
                    </Card>
                  ) : (
                    homeUrgentStocks.slice(0, 4).map((item) => (
                      <StockTriageCard
                        key={`urgent-${item.stock.id}`}
                        item={item}
                        recipes={data.recipes}
                        onOpenStock={() => openStockContext({ stockId: item.stock.id })}
                        onReview={() => void actions.markEyesReviewed({ stockId: item.stock.id })}
                        onOpenJournal={() => {
                          if (!item.decisions[0]) return;
                          setSelectedDecisionId(item.decisions[0].id);
                          setTab("Journal");
                        }}
                        onOpenAlerts={() => {
                          setSelectedStockId(item.stock.id);
                          setAlertWorkspaceTab("Current");
                          setTab("Alerts");
                        }}
                      />
                    ))
                  )}
                </View>
              </Reveal>
              ) : null}

              {(homeBucket === "All" || homeBucket === "Forming") ? (
              <Reveal delay={80}>
                <SectionHeader title={`Forming · ${homeOpportunityStocks.length}`} note="Stocks becoming more interesting but not yet urgent." />
                <View style={styles.stack}>
                  {homeOpportunityStocks.length === 0 ? (
                    <Card>
                      <Text style={styles.cardBody}>No stocks are forming a stronger setup right now.</Text>
                    </Card>
                  ) : (
                    homeOpportunityStocks.slice(0, 3).map((item) => (
                      <StockTriageCard
                        key={`forming-${item.stock.id}`}
                        item={item}
                        recipes={data.recipes}
                        onOpenStock={() => openStockContext({ stockId: item.stock.id })}
                        onReview={() => void actions.markEyesReviewed({ stockId: item.stock.id })}
                        onOpenJournal={() => {
                          if (!item.decisions[0]) return;
                          setSelectedDecisionId(item.decisions[0].id);
                          setTab("Journal");
                        }}
                      />
                    ))
                  )}
                </View>
              </Reveal>
              ) : null}

              {(homeBucket === "All" || homeBucket === "Review Soon") ? (
              <Reveal delay={120}>
                <SectionHeader title={`Review Soon · ${homeStaleReviewStocks.length}`} note="Eyes that need a fresh thesis check even without a new alert." />
                <View style={styles.stack}>
                  {homeStaleReviewStocks.length === 0 ? (
                    <Card>
                      <Text style={styles.cardBody}>No stale thesis reviews are flagged right now.</Text>
                    </Card>
                  ) : (
                    homeStaleReviewStocks.slice(0, 3).map((item) => (
                      <StockTriageCard
                        key={`stale-${item.stock.id}`}
                        item={item}
                        recipes={data.recipes}
                        onOpenStock={() => openStockContext({ stockId: item.stock.id })}
                        onReview={() => void actions.markEyesReviewed({ stockId: item.stock.id })}
                        onOpenJournal={() => {
                          if (!item.decisions[0]) return;
                          setSelectedDecisionId(item.decisions[0].id);
                          setTab("Journal");
                        }}
                      />
                    ))
                  )}
                </View>
              </Reveal>
              ) : null}
            </>
          ) : null}

          {tab === "Stocks" ? (
            <>
              <Reveal>
                <SectionHeader note="Search, select, inspect." />
                <View style={[styles.stockSearchShell, isCompactPhone ? styles.stockSearchShellCompact : null]}>
                  <View style={[styles.stockSearchHeader, isVeryCompactPhone ? styles.stockSearchHeaderCompact : null]}>
                    <View style={styles.flexOne}>
                      <Input
                        value={stockSearch}
                        onChangeText={setStockSearch}
                        placeholder="Search ticker or company"
                        autoCapitalize="characters"
                        returnKeyType="search"
                        onSubmitEditing={() => {
                          if (!topSuggestionId) return;
                          openStockContext({ stockId: topSuggestionId });
                        }}
                      />
                    </View>
                    {stockSearch.trim().length > 0 ? (
                      <Button label="Clear" tone="ghost" onPress={() => setStockSearch("")} />
                    ) : null}
                    <Button label={isVeryCompactPhone ? "New" : "Add"} tone="secondary" onPress={() => setStockComposerOpen(true)} />
                  </View>
                  <View style={styles.inlineBetween}>
                    <View style={styles.searchSectionMeta}>
                      <Text style={styles.suggestionLabel}>{hasStockQuery ? "Suggestions" : "Recent search"}</Text>
                      <Text style={styles.searchResultCount}>
                        {stockSuggestions.length > 0 ? `${stockSuggestions.length} shown` : hasStockQuery ? "0 shown" : "None"}
                      </Text>
                    </View>
                    {!hasStockQuery && recentStocks.length > 0 ? (
                      <Pressable onPress={() => setRecentStockIds([])} hitSlop={8}>
                        <Text style={styles.inlineUtilityText}>Clear recent</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {hasStockQuery && topSuggestionId ? (
                    <Text style={styles.searchAssistText}>Press return to open the top match immediately.</Text>
                  ) : null}
                  {stockSuggestions.length > 0 ? (
                    <View style={styles.stockSuggestionList}>
                      {stockSuggestions.map((item) => {
                        const isSelected = selectedStockSummary?.stock.id === item.stock.id;
                        const isTopMatch = hasStockQuery && topSuggestionId === item.stock.id;
                        const isExactSymbolMatch =
                          hasStockQuery &&
                          item.stock.symbol.toLowerCase() === deferredStockSearch.trim().toLowerCase();

                        return (
                          <Pressable
                            key={`suggest-${item.stock.id}`}
                            onPress={() => openStockContext({ stockId: item.stock.id })}
                            style={({ pressed }) => [
                              styles.stockSuggestionRow,
                              isCompactPhone ? styles.stockSuggestionRowCompact : null,
                              isSelected ? styles.stockSuggestionRowActive : null,
                              pressed ? styles.stockSuggestionRowPressed : null,
                            ]}
                          >
                            <View style={styles.stockSuggestionLead}>
                              <View style={styles.stockSuggestionAvatar}>
                                <Text style={styles.stockSuggestionAvatarText}>{item.stock.symbol.slice(0, 4)}</Text>
                              </View>
                              <View style={styles.flexOne}>
                                <View style={styles.stockSuggestionTitleRow}>
                                  <Text
                                    style={[styles.stockSuggestionSymbol, isSelected ? styles.stockSuggestionSymbolActive : null]}
                                    numberOfLines={1}
                                  >
                                    {item.stock.symbol}
                                  </Text>
                                  {isExactSymbolMatch ? (
                                    <Text style={styles.stockTopMatchLabel}>Exact</Text>
                                  ) : isTopMatch ? (
                                    <Text style={styles.stockTopMatchLabel}>Top match</Text>
                                  ) : !hasStockQuery ? (
                                    <Text style={styles.stockRecentLabel}>Recent</Text>
                                  ) : null}
                                </View>
                                <Text
                                  style={[styles.stockSuggestionName, isSelected ? styles.stockSuggestionNameActive : null]}
                                  numberOfLines={1}
                                >
                                  {item.stock.name}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.stockSuggestionRight}>
                              <Text style={styles.stockSuggestionPrice}>
                                {item.snapshot ? `$${item.snapshot.price.toFixed(2)}` : "--"}
                              </Text>
                              <Text style={styles.stockSuggestionMeta} numberOfLines={1}>
                                {item.snapshot?.freshness ?? "Unavailable"}
                              </Text>
                              {!hasStockQuery ? (
                                <Pressable
                                  onPress={() =>
                                    setRecentStockIds((current) =>
                                      current.filter((candidate) => candidate !== item.stock.id),
                                    )
                                  }
                                  hitSlop={8}
                                >
                                  <Text style={styles.stockSuggestionRemove}>Remove</Text>
                                </Pressable>
                              ) : null}
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={styles.emptySearchState}>
                      <Text style={styles.emptySearchTitle}>{hasStockQuery ? "No matching stocks" : "No recent searches"}</Text>
                      <Text style={styles.emptySearchBody}>
                        {hasStockQuery
                          ? "Try another ticker or company name, or clear the search to return to recent stocks."
                          : "Search a stock to open its visual analysis board."}
                      </Text>
                      {hasStockQuery ? <Button label="Clear Search" tone="secondary" onPress={() => setStockSearch("")} /> : null}
                    </View>
                  )}
                </View>
              </Reveal>

              {selectedStockSummary ? (
                <Reveal delay={40}>
                  <Card highlighted>
                    <View style={[styles.stockShellHeader, isCompactPhone ? styles.stockShellHeaderCompact : null]}>
                      <View style={styles.stockShellIdentity}>
                        <Text style={styles.stockHeroSymbol}>{selectedStockSummary.stock.symbol}</Text>
                        <Text style={styles.stockHeroName}>{selectedStockSummary.stock.name}</Text>
                        <View style={styles.stockShellMetaRow}>
                          <Text style={styles.stockBoardMetaText}>{sortedSelectedStockAnalysisCards.length} metrics</Text>
                          <Text style={styles.stockBoardMetaDivider}>•</Text>
                          <Text style={styles.stockBoardMetaText}>{selectedStockSummary.eyes.length} eyes</Text>
                          <Text style={styles.stockBoardMetaDivider}>•</Text>
                          <Text style={styles.stockBoardMetaText}>{pinnedCountForSelectedStock} pinned</Text>
                        </View>
                      </View>
                      <View style={styles.stockShellHeaderActions}>
                        <View style={freshnessTone(selectedStockSummary.snapshot?.freshness ?? "Unavailable")}>
                          <Text style={styles.freshnessBadgeText}>
                            {selectedStockSummary.snapshot?.freshness ?? "Unavailable"}
                          </Text>
                        </View>
                        <Button
                          label="Clear"
                          tone="ghost"
                          onPress={() => {
                            setSelectedStockId("");
                            setStockSearch("");
                          }}
                        />
                      </View>
                    </View>
                    <View style={[styles.stockTrendHero, isCompactPhone ? styles.stockTrendHeroCompact : null]}>
                      <View style={[styles.stockTrendHeader, isCompactPhone ? styles.stockTrendHeaderCompact : null]}>
                        <View style={styles.flexOne}>
                          <Text style={[styles.stockTrendPrice, isCompactPhone ? styles.stockTrendPriceCompact : null]}>
                            {selectedHeroPrice !== undefined ? `$${selectedHeroPrice.toFixed(2)}` : "--"}
                          </Text>
                          <Text style={styles.stockTrendCaption}>
                            {selectedHeroPointLabel} · {selectedStockSummary.snapshot?.isMock ? "Mock data" : "Provider data"}
                          </Text>
                        </View>
                        <View style={[styles.stockTrendSummaryMini, isCompactPhone ? styles.stockTrendSummaryMiniCompact : null]}>
                          <View style={[styles.stockTrendSummaryMiniBlock, isCompactPhone ? styles.stockTrendSummaryMiniBlockCompact : null]}>
                            <Text style={styles.stockTrendSummaryMiniLabel}>Range</Text>
                            <Text style={styles.stockTrendSummaryMiniValue}>
                              {selectedStockHeroRange ? `${Math.round(selectedStockHeroRange.high - selectedStockHeroRange.low)} pts` : "--"}
                            </Text>
                          </View>
                          <View style={[styles.stockTrendSummaryMiniBlock, isCompactPhone ? styles.stockTrendSummaryMiniBlockCompact : null]}>
                            <Text style={styles.stockTrendSummaryMiniLabel}>Vs {analysisBenchmark}</Text>
                            <Text style={styles.stockTrendSummaryMiniValue}>
                              {selectedHeroBenchmarkDelta !== undefined ? `${selectedHeroBenchmarkDelta >= 0 ? "+" : ""}${selectedHeroBenchmarkDelta.toFixed(2)}` : "--"}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={[styles.stockHeroControlRow, isCompactPhone ? styles.stockHeroControlRowCompact : null]}>
                        <View style={[styles.stockHeroControlBlock, isCompactPhone ? styles.stockHeroControlBlockCompact : null]}>
                          <Text style={styles.stockHeroControlLabel}>Lookback</Text>
                          <HorizontalChoice
                            options={analysisLookbacks}
                            value={analysisLookback}
                            onSelect={setAnalysisLookback}
                            variant="segmented"
                          />
                        </View>
                        <View style={[styles.stockHeroControlBlock, isCompactPhone ? styles.stockHeroControlBlockCompact : null]}>
                          <Text style={styles.stockHeroControlLabel}>Benchmark</Text>
                          <HorizontalChoice
                            options={analysisBenchmarks}
                            value={analysisBenchmark}
                            onSelect={setAnalysisBenchmark}
                            variant="segmented"
                          />
                        </View>
                      </View>
                      <View style={[styles.stockTrendChart, isCompactPhone ? styles.stockTrendChartCompact : null]}>
                        <View style={styles.stockTrendGrid}>
                          <View style={styles.stockTrendGridLine} />
                          <View style={styles.stockTrendGridLine} />
                          <View style={styles.stockTrendGridLine} />
                        </View>
                        {selectedStockTrendDisplaySeries.map((point, index) => (
                          <Pressable
                            key={`trend-${selectedStockSummary.stock.id}-${index}`}
                            onPress={() => setSelectedHeroPointIndex(index)}
                            style={[
                              styles.stockTrendBarHit,
                              index === safeSelectedHeroPointIndex ? styles.stockTrendBarHitActive : null,
                            ]}
                          >
                            <Animated.View
                              style={[
                                styles.stockTrendBar,
                                {
                                  height: `${Math.max(16, point)}%`,
                                  opacity: index === safeSelectedHeroPointIndex ? 1 : 0.52,
                                },
                                index === safeSelectedHeroPointIndex ? styles.stockTrendBarActive : null,
                              ]}
                            />
                          </Pressable>
                        ))}
                        <View style={styles.stockTrendLineOverlay}>
                          {selectedStockTrendDisplaySeries.map((point, index) => (
                            <View
                              key={`trend-dot-${selectedStockSummary.stock.id}-${index}`}
                              style={[
                                styles.stockTrendLineDot,
                                {
                                  left: `${(index / Math.max(selectedStockTrendDisplaySeries.length - 1, 1)) * 100}%`,
                                  bottom: `${Math.max(6, Math.min(96, point))}%`,
                                },
                                index === safeSelectedHeroPointIndex ? styles.stockTrendLineDotActive : null,
                              ]}
                            />
                          ))}
                          {selectedStockBenchmarkDisplaySeries.map((point, index) => (
                            <View
                              key={`benchmark-dot-${selectedStockSummary.stock.id}-${index}`}
                              style={[
                                styles.stockTrendBenchmarkDot,
                                {
                                  left: `${(index / Math.max(selectedStockBenchmarkDisplaySeries.length - 1, 1)) * 100}%`,
                                  bottom: `${Math.max(6, Math.min(96, point))}%`,
                                },
                              ]}
                            />
                          ))}
                        </View>
                        {selectedStockHeroRange ? (
                          <View
                            style={[
                              styles.stockTrendCurrentMarker,
                              {
                                bottom: `${
                                  Math.max(
                                    6,
                                    Math.min(
                                      96,
                                      selectedStockTrendDisplaySeries[safeSelectedHeroPointIndex] ?? 50,
                                    ),
                                  )
                                }%`,
                              },
                            ]}
                          />
                        ) : null}
                      </View>
                      <View style={[styles.stockTrendLegend, isCompactPhone ? styles.stockTrendLegendCompact : null]}>
                        <Text style={styles.stockTrendLegendText}>{selectedHeroPointLabel}</Text>
                        <Text style={styles.stockTrendLegendText}>
                          Drawdown {selectedStockSummary.snapshot ? `${selectedStockSummary.snapshot.drawdownPct}%` : "N/A"}
                        </Text>
                        <Text style={styles.stockTrendLegendText}>{analysisLookback} vs {analysisBenchmark}</Text>
                      </View>
                    </View>
                    <View style={[styles.stockControlsPanel, isCompactPhone ? styles.stockControlsPanelCompact : null]}>
                      <View style={styles.stockControlsHeader}>
                        <View style={styles.flexOne}>
                          <Text style={styles.stockControlsTitle}>Board controls</Text>
                          <Text style={styles.stockControlsMeta}>
                            Showing {sortedSelectedStockAnalysisCards.length} of {selectedStockAnalysisCards.length} metrics
                          </Text>
                        </View>
                        {stockControlsDirty ? (
                          <Pressable
                            onPress={() => {
                              setAnalysisBenchmark(defaultAnalysisBenchmark);
                              setAnalysisLookback(defaultAnalysisLookback);
                              setAnalysisStatusFilter(defaultAnalysisStatusFilter);
                              setStockBoardMode(defaultStockBoardMode);
                            }}
                            style={({ pressed }) => [pressed ? styles.choiceChipPressed : null]}
                          >
                            <Text style={styles.stockControlsReset}>Reset</Text>
                          </Pressable>
                        ) : null}
                      </View>
                      <View style={styles.stockControlGroup}>
                        <Text style={styles.stockControlGroupLabel}>Status</Text>
                        <HorizontalChoice
                          options={analysisStatusFilters}
                          value={analysisStatusFilter}
                          onSelect={setAnalysisStatusFilter}
                          labelForOption={analysisStatusFilterLabel}
                        />
                      </View>
                      <View style={styles.stockControlGroup}>
                        <Text style={styles.stockControlGroupLabel}>Board</Text>
                        <HorizontalChoice
                          options={stockBoardModes}
                          value={stockBoardMode}
                          onSelect={setStockBoardMode}
                          variant="segmented"
                          labelForOption={stockBoardModeLabel}
                        />
                      </View>
                    </View>
                  </Card>

                  <View style={[styles.analysisGrid, isCompactPhone ? styles.analysisGridCompact : null]}>
                    {sortedSelectedStockAnalysisCards.length > 0 ? (
                      sortedSelectedStockAnalysisCards.map((card) => (
                        <View
                          key={`stock-card-${card.id}`}
                          style={[
                            styles.analysisGridItem,
                            isCompactPhone ? styles.analysisGridItemCompact : null,
                            isVeryCompactPhone ? styles.analysisGridItemVeryCompact : null,
                          ]}
                        >
                          <EvidenceCardView
                            card={card}
                            compact={true}
                            dense={isCompactPhone}
                            pinned={Boolean(
                              selectedStockSummary &&
                                pinnedMetricKeys.includes(
                                  stockMetricPreferenceKey(selectedStockSummary.stock.id, card.id),
                                ),
                            )}
                            onOpen={() => setSelectedEvidenceCard(card)}
                          />
                        </View>
                      ))
                    ) : (
                      <Card>
                        <Text style={styles.cardBody}>No parameters match the current filters.</Text>
                      </Card>
                    )}
                  </View>
                </Reveal>
              ) : (
                <Reveal delay={40}>
                  <Card>
                    <Text style={styles.emptySearchTitle}>No stock selected</Text>
                    <Text style={styles.emptySearchBody}>
                      Search a ticker or company name, choose a suggestion, and the visual analysis board will open here.
                    </Text>
                  </Card>
                </Reveal>
              )}
            </>
          ) : null}

          {tab === "Recipes" ? (
            <>
              <Reveal>
                <SectionHeader note="Recipe inventory first." />
                <View style={styles.homeSummaryStrip}>
                  <DenseStat label="Recipes" value={`${data.recipes.length}`} tone="strong" />
                  <DenseStat label="Starter" value={`${data.recipes.filter((recipe) => starterRecipeNames.includes(recipe.name)).length}`} />
                  <DenseStat label="Custom" value={`${data.recipes.filter((recipe) => !starterRecipeNames.includes(recipe.name)).length}`} />
                  <DenseStat label="Active Eyes" value={`${data.eyes.length}`} />
                </View>
                <HorizontalChoice options={recipeShelfFilters} value={recipeShelfFilter} onSelect={setRecipeShelfFilter} />
                <View style={styles.actionRow}>
                  <Button
                    label="New"
                    onPress={() => {
                      setRecipeBuilderStep("Purpose");
                      setRecipeBuilderOpen(true);
                    }}
                  />
                </View>
              </Reveal>

              <Reveal delay={40}>
                <View style={styles.stack}>
                  {filteredRecipes.map((recipe) => (
                    <Pressable
                      key={recipe.id}
                      onPress={() => setRecipeDetailId(recipe.id)}
                      style={({ pressed }) => [styles.pressableCardWrap, pressed ? styles.pressableCardWrapPressed : null]}
                    >
                      <Card>
                        <View style={styles.inlineBetween}>
                          <View style={styles.flexOne}>
                            <Text style={styles.cardEyebrow}>Version {recipe.version}</Text>
                            <Text style={styles.cardTitle}>{recipe.name}</Text>
                          </View>
                          <Text style={styles.inventoryRowMeta}>
                            {data.eyes.filter((eye) => eye.recipeId === recipe.id).length} Eyes
                          </Text>
                        </View>
                        <Text style={styles.cardBody} numberOfLines={2}>{recipe.purpose}</Text>
                        <View style={styles.dualDenseGrid}>
                          <DenseStat label="Type" value={recipe.opportunityType ?? "General"} tone="strong" />
                          <DenseStat label="Horizon" value={recipe.timeHorizon || "Unset"} />
                          <DenseStat label="Cadence" value={`${recipe.reviewConfig?.cadenceDays ?? 14}d`} />
                          <DenseStat label="Conditions" value={String(recipe.conditions.length)} />
                        </View>
                        <View style={styles.metaRow}>
                          <MetaPill label={starterRecipeNames.includes(recipe.name) ? "Starter" : "Custom"} />
                          <MetaPill label={recipe.intendedUseCase || "Use case pending"} />
                        </View>
                        <View style={styles.analysisActionRow}>
                          <Button label="Open" tone="secondary" onPress={() => setRecipeDetailId(recipe.id)} />
                          <Button
                            label="Use for Eye"
                            onPress={() => {
                              setEyeForm((current) => ({ ...current, recipeId: recipe.id }));
                              setEyeComposerOpen(true);
                            }}
                          />
                        </View>
                      </Card>
                    </Pressable>
                  ))}
                </View>
              </Reveal>
            </>
          ) : null}

          {tab === "Eyes" ? (
            <>
              <Reveal>
                <SectionHeader note="Recipe subscriptions." />
                <View style={styles.homeSummaryStrip}>
                  <DenseStat label="Active" value={`${activeEyesInventory.length}`} tone="strong" />
                  <DenseStat label="Inactive" value={`${inactiveEyesInventory.length}`} />
                  <DenseStat label="Attention" value={`${data.eyes.filter((eye) => eye.lastEvaluation?.currentState === "Attention Needed").length}`} tone="risk" />
                  <DenseStat label="Broken" value={`${data.eyes.filter((eye) => eye.lastEvaluation?.currentState === "Thesis Broken").length}`} />
                </View>
                <HorizontalChoice options={eyesShelfFilters} value={eyesShelfFilter} onSelect={setEyesShelfFilter} />
                <View style={styles.actionRow}>
                  <Button label="New" onPress={() => setEyeComposerOpen(true)} />
                </View>
              </Reveal>

              <Reveal delay={40}>
                <SectionHeader title={`Active Eyes · ${filteredActiveEyesInventory.length}`} note="These are the recipe subscriptions currently worth monitoring." />
                <View style={styles.stack}>
                  {filteredActiveEyesInventory.length === 0 ? (
                    <Card>
                      <Text style={styles.cardBody}>No active Eyes yet.</Text>
                    </Card>
                  ) : (
                    filteredActiveEyesInventory.map((eye) => (
                      <Pressable
                        key={eye.id}
                        onPress={() => {
                          setSelectedEyeId(eye.id);
                          setEyeDetailOpen(true);
                        }}
                        style={({ pressed }) => [styles.pressableCardWrap, pressed ? styles.pressableCardWrapPressed : null]}
                      >
                      <Card highlighted={selectedEye?.id === eye.id}>
                        <View style={styles.inlineBetween}>
                          <View style={styles.flexOne}>
                            <Text style={styles.cardEyebrow}>{recipeLabel(data.recipes, eye.recipeId)}</Text>
                            <Text style={styles.alertTitle}>{stockLabel(data.stocks, eye.stockId)}</Text>
                            <Text style={styles.cardBody} numberOfLines={2}>{eye.thesisSnapshot}</Text>
                          </View>
                          <Text style={stateTone(eye.lastEvaluation?.currentState)}>
                            {eye.lastEvaluation?.currentState ?? "Not Evaluated"}
                          </Text>
                        </View>
                        <View style={styles.compactMetricRow}>
                          <Text style={styles.compactMetricText}>{eye.lastEvaluation?.whyNow ?? "Waiting for the next meaningful change."}</Text>
                        </View>
                        <View style={styles.metaRow}>
                          <MetaPill label={eye.lastEvaluation?.actionUrgency ?? "Wait"} />
                          <MetaPill label={`v${eye.recipeVersionAtCreation ?? eye.lastEvaluation?.recipeVersion ?? 1}`} />
                          <MetaPill label={eye.lastReviewedAt ? formatShortDate(eye.lastReviewedAt) : "Review due"} />
                        </View>
                        <View style={styles.analysisActionRow}>
                          <Button label="Stock" onPress={() => openStockContext({ stockId: eye.stockId, eyeId: eye.id })} />
                          <Button
                            label="Review"
                            tone="secondary"
                            onPress={() => void actions.markEyesReviewed({ stockId: eye.stockId, recipeId: eye.recipeId })}
                          />
                          <Button
                            label="Detail"
                            tone="ghost"
                            onPress={() => {
                              setSelectedEyeId(eye.id);
                              setEyeDetailOpen(true);
                            }}
                          />
                        </View>
                      </Card>
                      </Pressable>
                    ))
                  )}
                </View>
              </Reveal>

              <Reveal delay={60}>
                <SectionHeader title={`Inactive Eyes · ${filteredInactiveEyesInventory.length}`} note="Subscriptions that are quiet or thesis-broken remain here for reference." />
                <View style={styles.stack}>
                  {filteredInactiveEyesInventory.length === 0 ? (
                    <Card>
                      <Text style={styles.cardBody}>No inactive Eyes yet.</Text>
                    </Card>
                  ) : (
                    filteredInactiveEyesInventory.map((eye) => (
                      <Pressable
                        key={`inactive-${eye.id}`}
                        onPress={() => {
                          setSelectedEyeId(eye.id);
                          setEyeDetailOpen(true);
                        }}
                        style={({ pressed }) => [styles.pressableCardWrap, pressed ? styles.pressableCardWrapPressed : null]}
                      >
                      <Card>
                        <View style={styles.inlineBetween}>
                          <View style={styles.flexOne}>
                            <Text style={styles.cardEyebrow}>{recipeLabel(data.recipes, eye.recipeId)}</Text>
                            <Text style={styles.alertTitle}>{stockLabel(data.stocks, eye.stockId)}</Text>
                            <Text style={styles.cardBody} numberOfLines={2}>{eye.thesisSnapshot}</Text>
                          </View>
                          <Text style={stateTone(eye.lastEvaluation?.currentState)}>
                            {eye.lastEvaluation?.currentState ?? "Not Evaluated"}
                          </Text>
                        </View>
                        <View style={styles.metaRow}>
                          <MetaPill label={eye.lastEvaluation?.actionUrgency ?? "Wait"} />
                          <MetaPill label={eye.lastReviewedAt ? formatShortDate(eye.lastReviewedAt) : "Review due"} />
                        </View>
                        <View style={styles.analysisActionRow}>
                          <Button label="Stock" onPress={() => openStockContext({ stockId: eye.stockId, eyeId: eye.id })} />
                          <Button
                            label="Detail"
                            tone="secondary"
                            onPress={() => {
                              setSelectedEyeId(eye.id);
                              setEyeDetailOpen(true);
                            }}
                          />
                        </View>
                      </Card>
                      </Pressable>
                    ))
                  )}
                </View>
              </Reveal>
            </>
          ) : null}

          {tab === "Alerts" ? (
            <>
              <Reveal>
                <SectionHeader note="What changed and why now." />
                <View style={styles.homeSummaryStrip}>
                  <DenseStat label="Open" value={`${groupedAlertQueue.reduce((sum, item) => sum + item.openAlerts.length, 0)}`} tone="risk" />
                  <DenseStat label="Grouped Stocks" value={`${groupedAlertQueue.length}`} />
                  <DenseStat label="Snoozed" value={`${snoozedAlerts.length}`} />
                  <DenseStat label="Reviewed" value={`${reviewedAlerts.length}`} />
                </View>
                <HorizontalChoice options={["Current", "History"]} value={alertWorkspaceTab} onSelect={(value) => setAlertWorkspaceTab(value as "Current" | "History")} />
              </Reveal>

              {alertWorkspaceTab === "Current" ? (
                <Reveal delay={40}>
                  <SectionHeader title={`Current Alerts · ${groupedAlertQueue.length}`} note="Alerts are grouped by stock first so related signals stay together." />
                  <View style={styles.stack}>
                    {groupedAlertQueue.length === 0 ? (
                      <Card>
                        <Text style={styles.cardBody}>No open alerts right now.</Text>
                      </Card>
                  ) : (
                      groupedAlertQueue.map((group) => (
                        <AlertClusterCard
                          key={`alert-group-${group.stock.id}`}
                          group={group}
                          selectedStockId={selectedStockId}
                          onOpenStock={() => openStockContext({ stockId: group.stock.id })}
                          onOpenDetail={(alertId) => {
                            setSelectedAlertId(alertId);
                            setAlertDetailOpen(true);
                          }}
                          onQuickDecision={(alert, action) => void quickDecision(alert, action)}
                          onSnooze={(alertId) => void actions.snoozeAlert(alertId, 24)}
                          onReviewed={(alertId) => void actions.markAlertReviewed(alertId)}
                          onAcknowledgeAll={() => void acknowledgeAlertGroup(group.openAlerts)}
                        />
                      ))
                    )}
                  </View>
                </Reveal>
              ) : null}

              {alertWorkspaceTab === "History" ? (
                <Reveal delay={40}>
                  <SectionHeader title={`Alert History · ${alertHistory.length}`} note="Review acknowledged and snoozed alerts, and jump into linked journals when they exist." />
                  <View style={styles.stack}>
                    {alertHistory.length === 0 ? (
                      <Card>
                        <Text style={styles.cardBody}>No alert history yet.</Text>
                      </Card>
                    ) : (
                      alertHistory.map((alert) => {
                        const eye = data.eyes.find((item) => item.id === alert.eyeId);
                        const linkedDecision = data.decisions.find((decision) => decision.alertId === alert.id);
                        return (
                          <Card key={`history-${alert.id}`}>
                            <View style={styles.inlineBetween}>
                              <Text style={styles.cardEyebrow}>{stockLabel(data.stocks, eye?.stockId ?? "")}</Text>
                              <Text style={styles.inventoryRowMeta}>{formatDate(alert.createdAt)}</Text>
                            </View>
                            <Text style={styles.alertTitle}>{alert.title}</Text>
                            <Text style={styles.cardBody} numberOfLines={2}>{alert.whyNow}</Text>
                            <View style={styles.metaRow}>
                              <MetaPill label={alert.reviewed ? "Acknowledged" : `Snoozed until ${alert.snoozedUntil ? formatDate(alert.snoozedUntil) : "unknown"}`} />
                              <MetaPill label={alert.priority} />
                              {alert.usefulness ? <MetaPill label={alert.usefulness} /> : null}
                              {linkedDecision ? <MetaPill label={`Journal · ${linkedDecision.action}`} /> : null}
                            </View>
                            <View style={styles.analysisActionRow}>
                              <Button label="Detail" onPress={() => {
                                setSelectedAlertId(alert.id);
                                setAlertDetailOpen(true);
                              }} />
                              {!alert.reviewed ? <Button label="Unsnooze" tone="secondary" onPress={() => void actions.snoozeAlert(alert.id, -1)} /> : null}
                              {eye ? <Button label="Stock" tone="secondary" onPress={() => openStockContext({ stockId: eye.stockId, eyeId: eye.id, alertId: alert.id, target: "Alerts" })} /> : null}
                              {linkedDecision ? (
                                <Button
                                  label="Journal"
                                  tone="ghost"
                                  onPress={() => {
                                    if (linkedDecision) {
                                      setSelectedDecisionId(linkedDecision.id);
                                    }
                                    setTab("Journal");
                                  }}
                                />
                              ) : null}
                            </View>
                          </Card>
                        );
                      })
                    )}
                  </View>
                </Reveal>
              ) : null}
            </>
          ) : null}

          {tab === "Journal" ? (
            <>
              <Reveal>
                <SectionHeader note="Decision history first." />
                <View style={styles.homeSummaryStrip}>
                  <DenseStat label="Entries" value={`${data.decisions.length}`} tone="strong" />
                  <DenseStat label="Entered" value={`${data.decisions.filter((decision) => decision.action === "Entered").length}`} />
                  <DenseStat label="Skipped" value={`${data.decisions.filter((decision) => decision.action === "Skipped").length}`} />
                  <DenseStat label="Pending Outcomes" value={`${data.outcomes.filter((outcome) => outcome.status === "Pending").length}`} />
                </View>
                <HorizontalChoice options={journalFilters} value={journalFilter} onSelect={setJournalFilter} />
                <View style={styles.actionRow}>
                  <Button label="New" onPress={() => setJournalComposerOpen(true)} />
                </View>
              </Reveal>

              <Reveal delay={40}>
                <View style={styles.stack}>
                  {filteredJournalHistory.length === 0 ? (
                    <Card>
                      <Text style={styles.cardBody}>No journal entries in this filter yet.</Text>
                    </Card>
                  ) : filteredJournalHistory.map((decision) => {
                    const linkedEye = data.eyes.find((eye) => eye.id === decision.eyeId);
                    const linkedOutcome = data.outcomes.find((outcome) => outcome.decisionId === decision.id);
                    return (
                      <Pressable
                        key={decision.id}
                        onPress={() => setSelectedDecisionId(decision.id)}
                        style={({ pressed }) => [styles.pressableCardWrap, pressed ? styles.pressableCardWrapPressed : null]}
                      >
                      <Card>
                        <Text style={styles.cardEyebrow}>{formatDate(decision.createdAt)}</Text>
                        <Text style={styles.alertTitle}>{decision.action} · {decisionTitle(decision.eyeId, data.eyes, data.stocks, data.recipes)}</Text>
                        <Text style={styles.cardBody} numberOfLines={2}>{decision.note}</Text>
                        <View style={styles.metaRow}>
                          <MetaPill label={decision.stateAtDecision ?? "No state snapshot"} />
                          <MetaPill label={decision.dataQuality ?? "No data note"} />
                          <MetaPill label={`Thesis ${decision.thesisValid}`} />
                          <MetaPill label={decision.timing} />
                        </View>
                        <Text style={styles.metaLine}>Concern: {decision.concern || "Not captured"}</Text>
                        <View style={styles.analysisActionRow}>
                          <Button label="Open" tone="secondary" onPress={() => setSelectedDecisionId(decision.id)} />
                          {linkedEye ? (
                            <Button
                              label="Stock"
                              onPress={() => openStockContext({ stockId: linkedEye.stockId, eyeId: linkedEye.id })}
                            />
                          ) : null}
                          {decision.alertId ? (
                            <Button
                              label="Alert"
                              tone="ghost"
                              onPress={() => {
                                setSelectedAlertId(decision.alertId ?? "");
                                setAlertWorkspaceTab("History");
                                setAlertDetailOpen(true);
                                setTab("Alerts");
                              }}
                            />
                          ) : null}
                        </View>
                        {linkedOutcome ? (
                          <View style={styles.formulaPanel}>
                            <Text style={styles.formulaTitle}>Outcome · {linkedOutcome.status}</Text>
                            <Text style={styles.formulaBody}>{linkedOutcome.lesson}</Text>
                            <Text style={styles.formulaMeta}>{linkedOutcome.recipeSuggestion}</Text>
                          </View>
                        ) : null}
                      </Card>
                      </Pressable>
                    );
                  })}
                </View>
              </Reveal>
            </>
          ) : null}

          {tab === "Settings" ? (
            <>
              <Reveal>
                <SectionHeader note="Provider health and controls." />
                <View style={styles.homeSummaryStrip}>
                  <DenseStat
                    label="Healthy"
                    value={`${providerHealth.filter((entry) => entry.status === "Healthy").length}`}
                    tone="strong"
                  />
                  <DenseStat
                    label="Limited"
                    value={`${providerHealth.filter((entry) => entry.status === "Plan Limited").length}`}
                    tone="risk"
                  />
                  <DenseStat
                    label="Config Missing"
                    value={`${providerHealth.filter((entry) => entry.status === "Unconfigured").length}`}
                  />
                  <DenseStat label="Tracked Stocks" value={`${data.stocks.length}`} />
                </View>
                <View style={styles.actionRow}>
                  <Button
                    label={providerHealthLoading ? "Checking..." : "Check API Health"}
                    onPress={() => void actions.refreshProviderHealth()}
                    disabled={providerHealthLoading}
                  />
                  <Button label="Refresh Snapshots" tone="secondary" onPress={() => void actions.refreshMockData()} />
                </View>
              </Reveal>

              <Reveal delay={40}>
                <Card>
                  <Text style={styles.cardTitle}>Free-tier policy</Text>
                  <Text style={styles.cardBody}>
                    The app is staying dummy-backed for daily use right now. These providers are configured and health-checked here, but they are parked until you explicitly switch real data back on.
                  </Text>
                </Card>
              </Reveal>

              <Reveal delay={80}>
                <View style={styles.stack}>
                  {providerHealth.map((entry) => (
                    <Card key={entry.provider} highlighted={entry.status !== "Healthy"}>
                      <View style={styles.inlineBetween}>
                        <View style={styles.flexOne}>
                          <Text style={styles.cardEyebrow}>{entry.mode}</Text>
                          <Text style={styles.alertTitle}>{entry.provider}</Text>
                        </View>
                        <Text style={providerHealthTone(entry)}>{entry.status}</Text>
                      </View>
                      <Text style={styles.cardBody}>{entry.note}</Text>
                      <View style={styles.metaRow}>
                        <MetaPill label={entry.configured ? "Configured" : "Missing key"} />
                        {entry.endpoint ? <MetaPill label={entry.endpoint} /> : null}
                        {entry.lastCheckedAt ? <MetaPill label={formatDate(entry.lastCheckedAt)} /> : null}
                      </View>
                    </Card>
                  ))}
                </View>
              </Reveal>
            </>
          ) : null}
        </ScrollView>

        {recipeBuilderOpen ? (
          <WindowPanel
            title="Recipe Builder"
            subtitle="Guided pages. Fill the required fields, move step by step, and preview before saving."
            onClose={() => setRecipeBuilderOpen(false)}
          >
            <StepFlow steps={recipeBuilderSteps} current={recipeBuilderStep} onSelect={setRecipeBuilderStep} />
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>{recipeBuilderStep}</Text>
              <Text style={styles.previewText}>{recipeStepPrompt}</Text>
            </View>
            <View style={styles.homeSummaryStrip}>
              <DenseStat label="Conditions" value={`${draftConditions.length}`} tone={draftConditions.length > 0 ? "strong" : "neutral"} />
              <DenseStat label="Risk Rules" value={`${draftConditions.filter((condition) => condition.kind === "negative" || condition.kind === "disqualifier").length}`} />
              <DenseStat label="Cadence" value={`${recipeForm.reviewCadenceDays}d`} />
              <DenseStat label="Cooldown" value={`${recipeForm.alertCooldownHours}h`} />
            </View>
            <View style={styles.metaRow}>
              {recipeStepReadiness.map((item) => (
                <MetaPill
                  key={`recipe-step-${item.step}`}
                  label={`${item.step} · ${item.ready ? "Ready" : "Needs input"}`}
                />
              ))}
            </View>

            <Reveal key={`builder-step-${recipeBuilderStep}`}>
              {recipeBuilderStep === "Purpose" ? (
                <>
                <Text style={styles.inputLabel}>Recipe name</Text>
                <Input value={recipeForm.name} onChangeText={(name) => setRecipeForm((current) => ({ ...current, name }))} placeholder="Temporary Bargain Sale" invalid={recipeFormAttempted && !recipeForm.name.trim()} />
                {recipeFormAttempted && !recipeForm.name.trim() ? <Text style={styles.validationText}>Recipe name is required.</Text> : null}
                <Text style={styles.inputLabel}>Opportunity type</Text>
                <HorizontalChoice options={opportunityTypes} value={recipeForm.opportunityType} onSelect={(opportunityType) => setRecipeForm((current) => ({ ...current, opportunityType }))} />
                <Text style={styles.inputLabel}>Time horizon</Text>
                <HorizontalChoice options={timeHorizons} value={recipeForm.timeHorizon} onSelect={(timeHorizon) => setRecipeForm((current) => ({ ...current, timeHorizon }))} />
                <Text style={styles.inputLabel}>Primary use case</Text>
                <HorizontalChoice options={useCaseOptions} value={recipeForm.intendedUseCase} onSelect={(intendedUseCase) => setRecipeForm((current) => ({ ...current, intendedUseCase }))} />
                <Text style={styles.inputLabel}>Purpose</Text>
                <Input value={recipeForm.purpose} onChangeText={(purpose) => setRecipeForm((current) => ({ ...current, purpose }))} placeholder="What opportunity should this logic surface?" multiline invalid={recipeFormAttempted && !recipeForm.purpose.trim()} />
                {recipeFormAttempted && !recipeForm.purpose.trim() ? <Text style={styles.validationText}>Purpose is required.</Text> : null}
                </>
              ) : null}

              {recipeBuilderStep === "Logic" ? (
                <>
                <Text style={styles.inputLabel}>Category</Text>
                <HorizontalChoice
                  options={conditionCategories}
                  value={conditionBuilder.category as (typeof conditionCategories)[number]}
                  onSelect={(category) => {
                    const firstTemplate = conditionLibrary.find((item) => item.category === category) ?? conditionLibrary[0];
                    setConditionBuilder({
                      category,
                      templateId: firstTemplate.id,
                      kind: firstTemplate.defaultKind,
                      operator: firstTemplate.defaultOperator,
                      threshold: firstTemplate.defaultValue,
                      note: "",
                    });
                  }}
                />
                <Text style={styles.inputLabel}>Template</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>
                  {conditionLibrary
                    .filter((item) => item.category === conditionBuilder.category)
                    .map((template) => (
                      <Pressable
                        key={template.id}
                        onPress={() => setConditionBuilder((current) => ({ ...current, templateId: template.id }))}
                        style={[styles.templateCard, conditionBuilder.templateId === template.id ? styles.templateCardActive : null]}
                      >
                        <Text style={[styles.templateTitle, conditionBuilder.templateId === template.id ? styles.templateTitleActive : null]}>
                          {template.title}
                        </Text>
                        <Text style={[styles.templateSubtitle, conditionBuilder.templateId === template.id ? styles.templateSubtitleActive : null]}>
                          {template.complexity} · {template.description}
                        </Text>
                      </Pressable>
                    ))}
                </ScrollView>
                <Text style={styles.inputLabel}>Condition role</Text>
                <HorizontalChoice options={conditionKinds} value={conditionBuilder.kind} onSelect={(kind) => setConditionBuilder((current) => ({ ...current, kind }))} />
                <Text style={styles.inputLabel}>Operator</Text>
                <HorizontalChoice options={selectedOperatorOptions} value={conditionBuilder.operator} onSelect={(operator) => setConditionBuilder((current) => ({ ...current, operator }))} />
                <Text style={styles.inputLabel}>Threshold / parameter</Text>
                {selectedTemplate.control.type === "number" ? (
                  <NumberStepper
                    label={selectedTemplate.metricLabel}
                    value={Number(conditionBuilder.threshold)}
                    onChange={(next) => setConditionBuilder((current) => ({ ...current, threshold: String(next) }))}
                    step={selectedTemplate.control.step}
                    min={selectedTemplate.control.min}
                    max={selectedTemplate.control.max}
                    unit={selectedTemplate.control.unit}
                  />
                ) : (
                  <HorizontalChoice options={selectedTemplate.control.options} value={conditionBuilder.threshold} onSelect={(threshold) => setConditionBuilder((current) => ({ ...current, threshold }))} />
                )}
                <Text style={styles.inputLabel}>Why this matters</Text>
                <Input value={conditionBuilder.note} onChangeText={(note) => setConditionBuilder((current) => ({ ...current, note }))} placeholder="Optional context for future you" multiline />
                <View style={styles.previewCard}>
                  <Text style={styles.previewLabel}>Condition preview</Text>
                  <Text style={styles.previewText}>
                    {selectedTemplate.title}: {selectedTemplate.metricLabel} {conditionBuilder.operator} {formatMetricThreshold(selectedTemplate, conditionBuilder.threshold || selectedTemplate.defaultValue)}
                  </Text>
                </View>
                <View style={styles.actionRow}>
                  <Button label="Add Condition" onPress={addDraftCondition} />
                  <Button label="Clear Draft" tone="ghost" onPress={() => setDraftConditions([])} />
                </View>
                {draftConditions.length > 0 ? (
                  <View style={styles.stack}>
                    {draftConditions.map((condition) => (
                      <Card key={condition.id}>
                        <View style={styles.inlineBetween}>
                          <View style={styles.flexOne}>
                            <Text style={[styles.kindPill, conditionKindTone(condition.kind)]}>{condition.kind}</Text>
                            <Text style={styles.cardBody}>{condition.label}</Text>
                          </View>
                          <Button label="Remove" tone="ghost" onPress={() => setDraftConditions((current) => current.filter((item) => item.id !== condition.id))} />
                        </View>
                      </Card>
                    ))}
                  </View>
                ) : null}
                {recipeFormAttempted && draftConditions.length === 0 ? <Text style={styles.validationText}>Add at least one condition.</Text> : null}
                </>
              ) : null}

              {recipeBuilderStep === "Risk & Alerts" ? (
                <>
                <View style={styles.dualDenseGrid}>
                  <DenseStat label="Alert cooldown" value={`${recipeForm.alertCooldownHours}h`} tone="strong" />
                  <DenseStat label="Risk rules" value={`${draftConditions.filter((condition) => condition.kind === "negative" || condition.kind === "disqualifier").length}`} />
                </View>
                <Text style={styles.inputLabel}>Alert cooldown</Text>
                <HorizontalChoice options={alertCooldownOptions.map(String)} value={String(recipeForm.alertCooldownHours)} onSelect={(value) => setRecipeForm((current) => ({ ...current, alertCooldownHours: Number(value) }))} />
                <Text style={styles.inputLabel}>Notes</Text>
                <Input value={recipeForm.notes} onChangeText={(notes) => setRecipeForm((current) => ({ ...current, notes }))} placeholder="Downgrade rules, blockers, and alert expectations" multiline />
                </>
              ) : null}

              {recipeBuilderStep === "Review & Outcome" ? (
                <>
                <View style={styles.dualDenseGrid}>
                  <DenseStat label="Review cadence" value={`${recipeForm.reviewCadenceDays}d`} tone="strong" />
                  <DenseStat label="Draft conditions" value={`${draftConditions.length}`} />
                </View>
                <Text style={styles.inputLabel}>Review cadence</Text>
                <HorizontalChoice options={reviewCadenceOptions.map(String)} value={String(recipeForm.reviewCadenceDays)} onSelect={(value) => setRecipeForm((current) => ({ ...current, reviewCadenceDays: Number(value) }))} />
                {previewRecipe && previewEvaluation && previewStock ? (
                  <>
                    <Text style={styles.inputLabel}>Preview stock</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>
                      {data.stocks.map((stock) => (
                        <Pressable key={stock.id} onPress={() => setPreviewStockId(stock.id)} style={[styles.selectChip, previewStockId === stock.id ? styles.selectChipActive : null]}>
                          <Text style={[styles.selectChipTitle, previewStockId === stock.id ? styles.selectChipTitleActive : null]} numberOfLines={1}>{stock.symbol}</Text>
                          <Text style={[styles.selectChipSubtitle, previewStockId === stock.id ? styles.selectChipSubtitleActive : null]} numberOfLines={1}>{stock.name}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                    <WhyNowPanel title="Draft result" body={previewEvaluation.whyNow} state={previewEvaluation.currentState} recipeVersion={`${previewRecipe.name} v${previewRecipe.version}`} />
                    <Text style={styles.previewDisclosure}>Preview uses adapter-style sample data and stays clearly labeled.</Text>
                  </>
                ) : (
                  <Text style={styles.cardBody}>Add draft conditions first to unlock preview.</Text>
                )}
                <View style={styles.formulaPanel}>
                  <Text style={styles.formulaTitle}>Ready to save</Text>
                  <Text style={styles.formulaBody}>
                    {recipeForm.name.trim() || "Untitled Recipe"} is set up for {recipeForm.opportunityType} with {draftConditions.length} conditions, a {recipeForm.reviewCadenceDays}-day review cadence, and a {recipeForm.alertCooldownHours}-hour alert cooldown.
                  </Text>
                  <Text style={styles.formulaMeta}>
                    Save only when the draft logic reads like a clear investing rule, not a checklist of indicators.
                  </Text>
                </View>
                </>
              ) : null}
            </Reveal>

            <View style={styles.actionRow}>
              {recipeBuilderStep !== "Purpose" ? (
                <Button
                  label="Back"
                  tone="secondary"
                  onPress={() =>
                    setRecipeBuilderStep(recipeBuilderSteps[Math.max(recipeBuilderSteps.indexOf(recipeBuilderStep) - 1, 0)])
                  }
                />
              ) : null}
              {recipeBuilderStep !== "Review & Outcome" ? (
                <Button
                  label="Next"
                  disabled={!canAdvanceRecipeStep}
                  onPress={() =>
                    setRecipeBuilderStep(recipeBuilderSteps[Math.min(recipeBuilderSteps.indexOf(recipeBuilderStep) + 1, recipeBuilderSteps.length - 1)])
                  }
                />
              ) : (
                <Button label="Save Recipe" disabled={!canAdvanceRecipeStep} onPress={() => void saveRecipe()} />
              )}
            </View>
          </WindowPanel>
        ) : null}

        {selectedRecipe ? (
          <WindowPanel
            title={selectedRecipe.name}
            subtitle={`Version ${selectedRecipe.version} · ${selectedRecipe.timeHorizon}`}
            onClose={() => setRecipeDetailId("")}
          >
            <Text style={styles.cardBody}>{selectedRecipe.purpose}</Text>
            <View style={styles.dualDenseGrid}>
              <DenseStat label="Type" value={selectedRecipe.opportunityType ?? "General"} tone="strong" />
              <DenseStat label="Use case" value={selectedRecipe.intendedUseCase || "Unset"} />
              <DenseStat label="Cadence" value={`${selectedRecipe.reviewConfig?.cadenceDays ?? 14}d`} />
              <DenseStat label="Cooldown" value={`${selectedRecipe.alertConfig?.cooldownHours ?? 24}h`} />
              <DenseStat label="Eyes" value={`${selectedRecipeLinkedEyes.length}`} />
              <DenseStat label="Stocks" value={`${selectedRecipeWatchedStocks}`} />
            </View>
            <View style={styles.metaRow}>
              <MetaPill label={starterRecipeNames.includes(selectedRecipe.name) ? "Starter" : "Custom"} />
              <MetaPill label={`${selectedRecipe.conditions.length} conditions`} />
              {selectedRecipe.notes ? <MetaPill label="Has notes" /> : null}
            </View>
            {selectedRecipeLinkedEyes.length > 0 ? (
              <View style={styles.detailCallout}>
                <Text style={styles.detailCalloutLabel}>Tracked stocks</Text>
                <View style={styles.metaRow}>
                  {selectedRecipeLinkedEyes.slice(0, 6).map((eye) => (
                    <MetaPill key={`recipe-stock-${eye.id}`} label={stockLabel(data.stocks, eye.stockId)} />
                  ))}
                </View>
              </View>
            ) : null}
            <View style={styles.actionRow}>
              <Button
                label="Use for Eye"
                onPress={() => {
                  setEyeForm((current) => ({ ...current, recipeId: selectedRecipe.id }));
                  setRecipeDetailId("");
                  setEyeComposerOpen(true);
                }}
              />
              <Button
                label="Open Builder"
                tone="secondary"
                onPress={() => {
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
                  setRecipeDetailId("");
                  setRecipeBuilderStep("Purpose");
                  setRecipeBuilderOpen(true);
                }}
              />
            </View>
            {selectedRecipe.notes ? (
              <View style={styles.detailCallout}>
                <Text style={styles.detailCalloutLabel}>Builder notes</Text>
                <Text style={styles.detailCalloutBody}>{selectedRecipe.notes}</Text>
              </View>
            ) : null}
            <View style={styles.stack}>
              {selectedRecipe.conditions.map((condition) => (
                <Card key={`recipe-condition-${condition.id}`}>
                  <Text style={[styles.kindPill, conditionKindTone(condition.kind)]}>{condition.kind}</Text>
                  <Text style={styles.cardBody}>{condition.label}</Text>
                </Card>
              ))}
            </View>
          </WindowPanel>
        ) : null}

        {eyeDetailOpen && selectedEye ? (
          <WindowPanel
            title={stockLabel(data.stocks, selectedEye.stockId)}
            subtitle={`${recipeLabel(data.recipes, selectedEye.recipeId)} · ${selectedEye.lastEvaluation?.currentState ?? "Not Evaluated"}`}
            onClose={() => setEyeDetailOpen(false)}
          >
            <WhyNowPanel
              title="Current Eye state"
              body={
                selectedEye.lastEvaluation?.whyNow ??
                "This Eye has not produced a meaningful review summary yet."
              }
              state={selectedEye.lastEvaluation?.currentState ?? "Not Relevant"}
              recipeVersion={`${selectedEyeRecipe?.name ?? "Unknown Recipe"} v${selectedEye.recipeVersionAtCreation ?? selectedEye.lastEvaluation?.recipeVersion ?? 1}`}
            />
            <View style={styles.dualDenseGrid}>
              <DenseStat label="Urgency" value={selectedEye.lastEvaluation?.actionUrgency ?? "Wait"} tone="strong" />
              <DenseStat label="Review" value={selectedEye.lastReviewedAt ? formatShortDate(selectedEye.lastReviewedAt) : "Due"} />
              <DenseStat label="Entry Low" value={selectedEye.plannedEntryLow ? `$${selectedEye.plannedEntryLow.toFixed(2)}` : "Unset"} />
              <DenseStat label="Entry High" value={selectedEye.plannedEntryHigh ? `$${selectedEye.plannedEntryHigh.toFixed(2)}` : "Unset"} />
              <DenseStat label="Alerts" value={`${selectedEyeLinkedAlerts.length}`} />
              <DenseStat label="Journal" value={`${selectedEyeLinkedDecisions.length}`} />
            </View>
            <View style={styles.detailCallout}>
              <Text style={styles.detailCalloutLabel}>Thesis snapshot</Text>
              <Text style={styles.detailCalloutBody}>{selectedEye.thesisSnapshot}</Text>
            </View>
            <View style={styles.detailCallout}>
              <Text style={styles.detailCalloutLabel}>Invalidation rule</Text>
              <Text style={styles.detailCalloutBody}>{selectedEye.invalidationRule || "No invalidation rule recorded yet."}</Text>
            </View>
            {selectedEyeLinkedDecisions[0] ? (
              <View style={styles.detailCallout}>
                <Text style={styles.detailCalloutLabel}>Last logged decision</Text>
                <Text style={styles.detailCalloutBody}>
                  {selectedEyeLinkedDecisions[0].action} · {formatShortDate(selectedEyeLinkedDecisions[0].createdAt)}
                </Text>
              </View>
            ) : null}
            <View style={styles.actionRow}>
              <Button
                label="Stock"
                onPress={() => {
                  setEyeDetailOpen(false);
                  openStockContext({ stockId: selectedEye.stockId, eyeId: selectedEye.id });
                }}
              />
              <Button
                label="Mark Reviewed"
                tone="secondary"
                onPress={() => void actions.markEyesReviewed({ stockId: selectedEye.stockId, recipeId: selectedEye.recipeId })}
              />
              <Button
                label="Add Journal"
                tone="secondary"
                onPress={() => {
                  setDecisionForm((current) => ({ ...current, eyeId: selectedEye.id }));
                  setEyeDetailOpen(false);
                  setJournalComposerOpen(true);
                }}
              />
              {selectedEyeLinkedDecisions[0] ? (
                <Button
                  label="Journal"
                  tone="ghost"
                  onPress={() => {
                    setSelectedDecisionId(selectedEyeLinkedDecisions[0].id);
                    setEyeDetailOpen(false);
                    setTab("Journal");
                  }}
                />
              ) : null}
              <Button
                label="Delete"
                tone="ghost"
                onPress={() => {
                  setEyeDetailOpen(false);
                  void actions.deleteEye(selectedEye.id);
                }}
              />
            </View>
            <View style={styles.metaRow}>
              {selectedEyeStock ? <MetaPill label={selectedEyeStock.symbol} /> : null}
              {selectedEyeRecipe ? <MetaPill label={selectedEyeRecipe.timeHorizon || "Unset horizon"} /> : null}
              {selectedEye.lastEvaluation?.dataQuality ? <MetaPill label={selectedEye.lastEvaluation.dataQuality} /> : null}
            </View>
          </WindowPanel>
        ) : null}

        {eyeComposerOpen ? (
          <WindowPanel
            title="Create Eye"
            subtitle="Subscribe a selected stock to a selected recipe with your thesis snapshot."
            onClose={() => setEyeComposerOpen(false)}
          >
            <Text style={styles.inputLabel}>Stock</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>
              {data.stocks.map((stock) => (
                <Pressable key={stock.id} onPress={() => setEyeForm((current) => ({ ...current, stockId: stock.id }))} style={[styles.selectChip, eyeForm.stockId === stock.id ? styles.selectChipActive : null]}>
                  <Text style={[styles.selectChipTitle, eyeForm.stockId === stock.id ? styles.selectChipTitleActive : null]} numberOfLines={1}>{stock.symbol}</Text>
                  <Text style={[styles.selectChipSubtitle, eyeForm.stockId === stock.id ? styles.selectChipSubtitleActive : null]} numberOfLines={1}>{stock.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {eyeFormAttempted && !eyeForm.stockId ? <Text style={styles.validationText}>Select a stock.</Text> : null}
            <Text style={styles.inputLabel}>Recipe</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>
              {data.recipes.map((recipe) => (
                <Pressable key={recipe.id} onPress={() => setEyeForm((current) => ({ ...current, recipeId: recipe.id }))} style={[styles.selectChip, eyeForm.recipeId === recipe.id ? styles.selectChipActive : null]}>
                  <Text style={[styles.selectChipTitle, eyeForm.recipeId === recipe.id ? styles.selectChipTitleActive : null]} numberOfLines={1}>{recipe.name}</Text>
                  <Text style={[styles.selectChipSubtitle, eyeForm.recipeId === recipe.id ? styles.selectChipSubtitleActive : null]} numberOfLines={1}>{recipe.timeHorizon}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {eyeFormAttempted && !eyeForm.recipeId ? <Text style={styles.validationText}>Select a recipe.</Text> : null}
            <Text style={styles.inputLabel}>Specific thesis snapshot</Text>
            <Input value={eyeForm.thesisSnapshot} onChangeText={(thesisSnapshot) => setEyeForm((current) => ({ ...current, thesisSnapshot }))} placeholder="Why does this stock under this recipe deserve repeated attention?" multiline invalid={eyeFormAttempted && !eyeForm.thesisSnapshot.trim()} />
            {eyeFormAttempted && !eyeForm.thesisSnapshot.trim() ? <Text style={styles.validationText}>Thesis snapshot is required.</Text> : null}
            <View style={styles.dualDenseGrid}>
              <NumberStepper label="Planned entry low" value={Number(eyeForm.plannedEntryLow || 0)} onChange={(next) => setEyeForm((current) => ({ ...current, plannedEntryLow: next.toFixed(2) }))} step={0.5} min={0} max={10000} />
              <NumberStepper label="Planned entry high" value={Number(eyeForm.plannedEntryHigh || 0)} onChange={(next) => setEyeForm((current) => ({ ...current, plannedEntryHigh: next.toFixed(2) }))} step={0.5} min={0} max={10000} />
            </View>
            <Text style={styles.inputLabel}>Last thesis review</Text>
            <HorizontalChoice
              options={reviewDateOptions.map((item) => item.label)}
              value={reviewDateOptions.find((item) => item.daysAgo === eyeForm.lastReviewedDaysAgo)?.label ?? reviewDateOptions[2].label}
              onSelect={(label) =>
                setEyeForm((current) => ({
                  ...current,
                  lastReviewedDaysAgo: reviewDateOptions.find((item) => item.label === label)?.daysAgo ?? reviewDateOptions[2].daysAgo,
                }))
              }
            />
            <Text style={styles.inputLabel}>Invalidation rule</Text>
            <Input value={eyeForm.invalidationRule} onChangeText={(invalidationRule) => setEyeForm((current) => ({ ...current, invalidationRule }))} placeholder="What would break the thesis fast?" multiline />
            <Button label="Create Eye" onPress={() => void saveEye()} />
          </WindowPanel>
        ) : null}

        {alertDetailOpen && selectedAlert && selectedAlertEye && selectedAlertRecipe && selectedAlertEvaluation ? (
          <WindowPanel
            title={selectedAlert.title}
            subtitle={`${stockLabel(data.stocks, selectedAlertEye.stockId)} · ${selectedAlert.priority}`}
            onClose={() => setAlertDetailOpen(false)}
          >
            <WhyNowPanel title="What happened" body={selectedAlert.whyNow} state={selectedAlertEvaluation.currentState} recipeVersion={`${selectedAlertRecipe.name} v${selectedAlertRecipe.version}`} />
            <View style={styles.detailMetricStrip}>
              <DenseStat label="Priority" value={selectedAlert.priority} tone={selectedAlert.priority === "High" ? "risk" : "strong"} />
              <DenseStat label="State" value={selectedAlertEvaluation.currentState} />
              <DenseStat label="Urgency" value={selectedAlertEvaluation.actionUrgency} />
              <DenseStat label="Data" value={selectedAlert.dataQuality} tone={selectedAlert.dataQuality.includes("Mock") ? "risk" : "neutral"} />
            </View>
            <View style={styles.dualColumn}>
              <View style={styles.evidenceColumn}>
                <Text style={styles.columnTitle}>Biggest support</Text>
                <Text style={styles.listLine}>+ {selectedAlert.supportingEvidence[0] ?? "No strong support recorded."}</Text>
              </View>
              <View style={styles.evidenceColumn}>
                <Text style={styles.columnTitle}>Biggest risk</Text>
                <Text style={styles.listLine}>- {selectedAlert.risks[0] ?? "No major risk recorded."}</Text>
              </View>
            </View>
            <WhatChangedPanel title="Review in 5 seconds" items={[`Priority is ${selectedAlert.priority}.`, `State change: ${selectedAlert.stateChange}.`, selectedAlert.dataQuality]} />
            <View style={styles.metaRow}>
              <MetaPill label={selectedAlert.reviewed ? "Acknowledged" : "Open"} />
              <MetaPill label={selectedAlertSnapshot?.isMock ? "Mock-backed" : "Provider-backed"} />
              <MetaPill label={selectedAlertSnapshot?.freshness ?? "Unavailable"} />
              {selectedAlert.usefulness ? <MetaPill label={selectedAlert.usefulness} /> : null}
            </View>
            <View style={styles.analysisActionRow}>
              <Button
                label="Stock"
                tone="secondary"
                onPress={() => {
                  setAlertDetailOpen(false);
                  openStockContext({ stockId: selectedAlertEye.stockId, eyeId: selectedAlertEye.id, alertId: selectedAlert.id, target: "Alerts" });
                }}
              />
              <Button label="Acknowledge" onPress={() => void actions.markAlertReviewed(selectedAlert.id)} />
              <Button label="Snooze 24H" tone="secondary" onPress={() => void actions.snoozeAlert(selectedAlert.id, 24)} />
              <Button label="Useful" tone="ghost" onPress={() => void actions.setAlertFeedback(selectedAlert.id, "Useful")} />
              <Button label="Not Useful" tone="ghost" onPress={() => void actions.setAlertFeedback(selectedAlert.id, "Not Useful")} />
              {selectedAlertDecision ? (
                <Button
                  label="Journal"
                  tone="ghost"
                  onPress={() => {
                    setSelectedDecisionId(selectedAlertDecision.id);
                    setAlertDetailOpen(false);
                    setTab("Journal");
                  }}
                />
              ) : null}
            </View>
            <View style={styles.stack}>
              {selectedAlertEvidenceGroups.map((group) => (
                <EvidenceGroupView key={`alert-${group.key}`} group={group} defaultExpanded={group.key === "supporting-evidence"} />
              ))}
            </View>
          </WindowPanel>
        ) : null}

        {journalComposerOpen ? (
          <WindowPanel
            title="New Journal Entry"
            subtitle="Capture the decision only when you choose to add one."
            onClose={() => setJournalComposerOpen(false)}
          >
            <Text style={styles.inputLabel}>Eye</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>
              {data.eyes.map((eye) => (
                <Pressable key={eye.id} onPress={() => setDecisionForm((current) => ({ ...current, eyeId: eye.id }))} style={[styles.selectChip, decisionForm.eyeId === eye.id ? styles.selectChipActive : null]}>
                  <Text style={[styles.selectChipTitle, decisionForm.eyeId === eye.id ? styles.selectChipTitleActive : null]} numberOfLines={1}>{stockLabel(data.stocks, eye.stockId)}</Text>
                  <Text style={[styles.selectChipSubtitle, decisionForm.eyeId === eye.id ? styles.selectChipSubtitleActive : null]} numberOfLines={1}>{recipeLabel(data.recipes, eye.recipeId)}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {journalFormAttempted && !decisionForm.eyeId ? <Text style={styles.validationText}>Select an Eye.</Text> : null}
            <Text style={styles.inputLabel}>Action</Text>
            <HorizontalChoice options={decisionActions} value={decisionForm.action} onSelect={(action) => setDecisionForm((current) => ({ ...current, action }))} />
            <Text style={styles.inputLabel}>Why did you act this way?</Text>
            <Input value={decisionForm.note} onChangeText={(note) => setDecisionForm((current) => ({ ...current, note }))} placeholder="Why did you enter, skip, or revise?" multiline invalid={journalFormAttempted && !decisionForm.note.trim()} />
            {journalFormAttempted && !decisionForm.note.trim() ? <Text style={styles.validationText}>A decision note is required.</Text> : null}
            <Text style={styles.inputLabel}>Main concern</Text>
            <Input value={decisionForm.concern} onChangeText={(concern) => setDecisionForm((current) => ({ ...current, concern }))} placeholder="What risk mattered most?" multiline />
            <Text style={styles.inputLabel}>Thesis validity</Text>
            <HorizontalChoice options={thesisValidityOptions} value={decisionForm.thesisValid} onSelect={(thesisValid) => setDecisionForm((current) => ({ ...current, thesisValid }))} />
            <Text style={styles.inputLabel}>Timing</Text>
            <HorizontalChoice options={timingOptions} value={decisionForm.timing} onSelect={(timing) => setDecisionForm((current) => ({ ...current, timing }))} />
            <Button label="Save Decision" onPress={() => void saveDecision()} />
          </WindowPanel>
        ) : null}

        {selectedDecision ? (
          <WindowPanel
            title={selectedDecision.action}
            subtitle={decisionTitle(selectedDecision.eyeId, data.eyes, data.stocks, data.recipes)}
            onClose={() => setSelectedDecisionId("")}
          >
            <WhatChangedPanel
              title="Decision context"
              items={[
                selectedDecision.stateAtDecision ?? "State snapshot unavailable",
                selectedDecision.dataQuality ?? "Data-quality note unavailable",
                `Thesis ${selectedDecision.thesisValid} · Timing ${selectedDecision.timing}`,
              ]}
            />
            <View style={styles.detailCallout}>
              <Text style={styles.detailCalloutLabel}>Decision note</Text>
              <Text style={styles.detailCalloutBody}>{selectedDecision.note || "No decision note recorded."}</Text>
            </View>
            <View style={styles.detailCallout}>
              <Text style={styles.detailCalloutLabel}>Concern</Text>
              <Text style={styles.detailCalloutBody}>{selectedDecision.concern || "No primary concern recorded."}</Text>
            </View>
            <View style={styles.actionRow}>
              <Button
                label="Stock"
                onPress={() => {
                  const linkedEye = data.eyes.find((eye) => eye.id === selectedDecision.eyeId);
                  if (!linkedEye) return;
                  setSelectedDecisionId("");
                  openStockContext({ stockId: linkedEye.stockId, eyeId: linkedEye.id });
                }}
              />
              {selectedDecision.alertId ? (
                <Button
                  label="Alert"
                  tone="secondary"
                  onPress={() => {
                    setSelectedAlertId(selectedDecision.alertId ?? "");
                    setSelectedDecisionId("");
                    setAlertWorkspaceTab("History");
                    setAlertDetailOpen(true);
                    setTab("Alerts");
                  }}
                />
              ) : null}
              {selectedDecisionOutcome ? (
                <Button
                  label={selectedDecisionOutcome.status === "Reviewed" ? "Outcome Done" : "Mark Outcome"}
                  tone="secondary"
                  onPress={() =>
                    void actions.setOutcomeStatus(
                      selectedDecisionOutcome.id,
                      selectedDecisionOutcome.status === "Reviewed" ? "Pending" : "Reviewed",
                    )
                  }
                />
              ) : null}
            </View>
            {selectedDecisionOutcome ? (
              <View style={styles.formulaPanel}>
                <Text style={styles.formulaTitle}>
                  Outcome · {selectedDecisionOutcome.status ?? "Pending"}
                </Text>
                <Text style={styles.formulaBody}>{selectedDecisionOutcome.lesson}</Text>
                <Text style={styles.formulaMeta}>{selectedDecisionOutcome.recipeSuggestion}</Text>
                <View style={styles.metaRow}>
                  <MetaPill label={selectedDecisionOutcome.reviewWindow} />
                  <MetaPill label={selectedDecisionOutcome.priceChangeNote} />
                </View>
              </View>
            ) : null}
          </WindowPanel>
        ) : null}

        {stockComposerOpen ? (
          <WindowPanel
            title="Add Stock"
            subtitle="Add a stock into the factual stock workspace."
            onClose={() => {
              setStockComposerOpen(false);
              setStockFormAttempted(false);
            }}
          >
            <Text style={styles.inputLabel}>Ticker</Text>
            <Input
              value={stockForm.symbol}
              onChangeText={(symbol) => setStockForm((current) => ({ ...current, symbol }))}
              placeholder="Ticker symbol"
              autoCapitalize="characters"
              invalid={stockFormAttempted && !stockForm.symbol.trim()}
            />
            {stockFormAttempted && !stockForm.symbol.trim() ? <Text style={styles.validationText}>Ticker is required.</Text> : null}
            <Text style={styles.inputLabel}>Company</Text>
            <Input
              value={stockForm.name}
              onChangeText={(name) => setStockForm((current) => ({ ...current, name }))}
              placeholder="Company name"
              invalid={stockFormAttempted && !stockForm.name.trim()}
            />
            {stockFormAttempted && !stockForm.name.trim() ? <Text style={styles.validationText}>Company name is required.</Text> : null}
            <Text style={styles.inputLabel}>Why track it</Text>
            <Input
              value={stockForm.thesis}
              onChangeText={(thesis) => setStockForm((current) => ({ ...current, thesis }))}
              placeholder="What makes this worth monitoring?"
              multiline
            />
            <Button
              label="Add Stock"
              onPress={() => {
                setStockFormAttempted(true);
                if (!stockForm.symbol.trim() || !stockForm.name.trim()) return;
                void actions.addStock(stockForm);
                setStockForm({ symbol: "", name: "", thesis: "" });
                setStockComposerOpen(false);
                setStockFormAttempted(false);
              }}
            />
          </WindowPanel>
        ) : null}

        {selectedEvidenceCard ? (
          <WindowPanel
            title={selectedEvidenceCard.title}
            subtitle={`${selectedStockSummary?.stock.symbol ?? "Stock"} · ${selectedEvidenceCard.freshness}${selectedEvidenceIndex >= 0 ? ` · ${selectedEvidenceIndex + 1} of ${sortedSelectedStockAnalysisCards.length}` : ""}`}
            onClose={() => setSelectedEvidenceCard(null)}
          >
            <StockMetricDetailContent
              card={selectedEvidenceCard}
              selectedEvidenceIndex={selectedEvidenceIndex}
              total={sortedSelectedStockAnalysisCards.length}
              sortedCards={sortedSelectedStockAnalysisCards}
              compactLayout={isCompactPhone}
              isPinned={
                !!selectedStockSummary &&
                pinnedMetricKeys.includes(stockMetricPreferenceKey(selectedStockSummary.stock.id, selectedEvidenceCard.id))
              }
              onPrevious={() => cycleEvidenceCard(-1)}
              onNext={() => cycleEvidenceCard(1)}
              onTogglePin={() => togglePinnedMetric(selectedEvidenceCard)}
              onSelectCard={setSelectedEvidenceCard}
            />
          </WindowPanel>
        ) : null}

        <BottomNav tabs={tabs} currentTab={tab} onSelect={setTab} />
      </View>
    </SafeAreaView>
  );
}

const SectionHeader = ({ title, note }: { title?: string; note?: string }) => (
  <View style={styles.sectionHeader}>
    {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
    {note ? <Text style={styles.sectionNote}>{note}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  frame: {
    flex: 1,
    backgroundColor: "#f5f5f7",
  },
  topBar: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#fbfbfd",
  },
  topBarTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "800",
    fontFamily,
  },
  topBarSubtitle: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
    fontFamily,
    marginTop: 3,
  },
  inventoryRowMeta: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "700",
    fontFamily,
    marginLeft: 12,
  },
  alertBell: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  alertBellIcon: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
    fontFamily,
  },
  alertBellBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  alertBellBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
    fontFamily,
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f7",
  },
  loadingText: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "700",
    fontFamily,
  },
  page: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 136,
    gap: 14,
  },
  // Search Hero Styles
  searchHero: {
    marginTop: 40,
    gap: 32,
  },
  searchHeroTitle: {
    color: "#f8fafc",
    fontSize: 32,
    fontWeight: "900",
    textAlign: "center",
    fontFamily,
  },
  searchHeroSubtitle: {
    marginTop: 8,
    color: "#94a3b8",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    fontFamily,
  },
  searchBarContainer: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#1e293b",
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  heroSearchInput: {
    flex: 1,
    backgroundColor: "transparent",
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "700",
  },
  inlineSearchInput: {
    flex: 1,
    backgroundColor: "#1e293b",
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  recentTitle: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  recentScroll: {
    gap: 12,
  },
  recentChip: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  recentChipSymbol: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "900",
  },
  homeStatsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  homeStatCard: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  homeStatValue: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "900",
  },
  homeStatLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    marginTop: 4,
  },
  // Stock Hero
  stockHero: {
    gap: 4,
    marginBottom: 10,
  },
  stockHeroSymbol: {
    color: "#111827",
    fontSize: 34,
    fontWeight: "800",
  },
  stockHeroName: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "600",
  },
  stockSearchShell: {
    gap: 10,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#eceef2",
    overflow: "hidden",
  },
  stockSearchShellCompact: {
    gap: 8,
    padding: 10,
    borderRadius: 16,
  },
  stockSearchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stockSearchHeaderCompact: {
    gap: 8,
  },
  suggestionLabel: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontFamily,
  },
  searchSectionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchResultCount: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    fontFamily,
  },
  inlineUtilityText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
    fontFamily,
  },
  searchAssistText: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "500",
    fontFamily,
  },
  stockSuggestionPill: {
    width: 144,
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 0,
    borderRadius: 14,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 3,
    justifyContent: "center",
  },
  stockSuggestionPillActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  stockSuggestionPillPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.94,
  },
  stockSuggestionSymbol: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "800",
    fontFamily,
  },
  stockSuggestionSymbolActive: {
    color: "#ffffff",
  },
  stockSuggestionName: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "600",
    fontFamily,
  },
  stockSuggestionNameActive: {
    color: "#d1d5db",
  },
  stockSuggestionList: {
    gap: 8,
  },
  stockSuggestionRow: {
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#eceef2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  stockSuggestionRowCompact: {
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 10,
  },
  stockSuggestionRowActive: {
    borderColor: "#111827",
    backgroundColor: "#f3f4f6",
  },
  stockSuggestionRowPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  stockSuggestionLead: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stockSuggestionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  stockSuggestionAvatarText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
    fontFamily,
  },
  stockSuggestionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stockTopMatchLabel: {
    color: "#0f766e",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontFamily,
  },
  stockRecentLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.35,
    fontFamily,
  },
  stockSuggestionRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  stockSuggestionPrice: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "800",
    fontFamily,
  },
  stockSuggestionMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  stockSuggestionMeta: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "700",
    fontFamily,
  },
  stockSuggestionRemove: {
    color: "#475569",
    fontSize: 10,
    fontWeight: "800",
    fontFamily,
  },
  emptySearchState: {
    paddingVertical: 10,
    gap: 4,
    alignItems: "flex-start",
  },
  emptySearchTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
    fontFamily,
  },
  emptySearchBody: {
    color: "#6b7280",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    fontFamily,
  },
  homeSummaryStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  compactStatRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  detailCallout: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#edf0f5",
  },
  detailCalloutLabel: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontFamily,
  },
  detailCalloutBody: {
    marginTop: 4,
    color: "#111827",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    fontFamily,
  },
  stockControlsPanel: {
    marginTop: 14,
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#edf0f5",
  },
  stockControlsPanelCompact: {
    marginTop: 12,
    gap: 8,
    padding: 10,
    borderRadius: 14,
  },
  stockControlsHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  stockControlsTitle: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "800",
    fontFamily,
  },
  stockControlsMeta: {
    color: "#6b7280",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
    fontFamily,
    marginTop: 2,
  },
  stockControlsReset: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "800",
    fontFamily,
  },
  stockControlGroup: {
    gap: 6,
  },
  stockControlGroupLabel: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.35,
    fontFamily,
  },
  stockShellHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  stockShellHeaderCompact: {
    gap: 10,
  },
  stockShellIdentity: {
    flex: 1,
    gap: 4,
  },
  stockShellMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  stockShellHeaderActions: {
    alignItems: "flex-end",
    gap: 8,
  },
  stockTrendHero: {
    marginTop: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#edf0f5",
    gap: 10,
  },
  stockTrendHeroCompact: {
    marginTop: 10,
    padding: 12,
    borderRadius: 16,
    gap: 8,
  },
  stockTrendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  stockTrendHeaderCompact: {
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 8,
  },
  stockHeroControlRow: {
    flexDirection: "row",
    gap: 8,
  },
  stockHeroControlRowCompact: {
    flexDirection: "column",
    gap: 8,
  },
  stockHeroControlBlock: {
    flex: 1,
    gap: 6,
  },
  stockHeroControlBlockCompact: {
    width: "100%",
  },
  stockHeroControlLabel: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.35,
    fontFamily,
  },
  stockTrendSummaryMini: {
    flexDirection: "row",
    gap: 8,
  },
  stockTrendSummaryMiniCompact: {
    width: "100%",
    justifyContent: "space-between",
  },
  stockTrendSummaryMiniBlock: {
    minWidth: 74,
    alignItems: "flex-end",
    gap: 2,
  },
  stockTrendSummaryMiniBlockCompact: {
    minWidth: 0,
    flex: 1,
  },
  stockTrendSummaryMiniLabel: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontFamily,
  },
  stockTrendSummaryMiniValue: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "800",
    fontFamily,
  },
  stockTrendPrice: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "800",
    fontFamily,
  },
  stockTrendPriceCompact: {
    fontSize: 24,
  },
  stockTrendCaption: {
    marginTop: 2,
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
    fontFamily,
  },
  stockTrendChart: {
    height: 148,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#eceef2",
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 18,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    overflow: "hidden",
  },
  stockTrendChartCompact: {
    height: 136,
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 16,
    gap: 3,
  },
  stockTrendGrid: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    paddingVertical: 18,
  },
  stockTrendGridLine: {
    height: 1,
    backgroundColor: "#eef1f5",
  },
  stockTrendBar: {
    width: "100%",
    borderRadius: 999,
    backgroundColor: "#111827",
  },
  stockTrendBarHit: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%",
    borderRadius: 8,
    paddingBottom: 0,
  },
  stockTrendBarHitActive: {
    backgroundColor: "rgba(17, 24, 39, 0.04)",
  },
  stockTrendBarActive: {
    backgroundColor: "#2563eb",
  },
  stockTrendLineOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  stockTrendLineDot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 999,
    marginLeft: -2,
    marginBottom: -2,
    backgroundColor: "#9ca3af",
  },
  stockTrendLineDotActive: {
    width: 8,
    height: 8,
    marginLeft: -4,
    marginBottom: -4,
    backgroundColor: "#111827",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  stockTrendBenchmarkDot: {
    position: "absolute",
    width: 3,
    height: 3,
    borderRadius: 999,
    marginLeft: -1.5,
    marginBottom: -1.5,
    backgroundColor: "#60a5fa",
    opacity: 0.9,
  },
  stockTrendCurrentMarker: {
    position: "absolute",
    left: 8,
    right: 8,
    height: 1,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "rgba(17, 24, 39, 0.14)",
  },
  stockTrendLegend: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stockTrendLegendCompact: {
    flexWrap: "wrap",
    gap: 6,
  },
  stockTrendLegendText: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontFamily,
  },
  stockTrendInsight: {
    color: "#4b5563",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    fontFamily,
  },
  stockBoardMetaRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  stockBoardMetaText: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.35,
    fontFamily,
  },
  stockBoardMetaDivider: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "800",
    fontFamily,
  },
  // Grid Layouts
  suggestionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  suggestionCard: {
    width: "31%",
    backgroundColor: "#1e293b",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  suggestionSymbol: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "900",
  },
  suggestionName: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  analysisGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  analysisGridCompact: {
    gap: 8,
  },
  analysisGridItem: {
    width: "48.2%",
  },
  analysisGridItemCompact: {
    width: "48.8%",
  },
  analysisGridItemVeryCompact: {
    width: "48.9%",
  },
  // Evidence Cards
  evidenceCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#eceef2",
    gap: 8,
    overflow: "hidden",
  },
  evidenceCardCompact: {
    padding: 10,
    gap: 7,
    minHeight: 166,
    borderColor: "#e5e7eb",
  },
  evidenceCardCompactDense: {
    padding: 9,
    gap: 6,
    minHeight: 154,
  },
  evidenceCardCompactPassed: {
    borderColor: "#bbf7d0",
  },
  evidenceCardCompactNear: {
    borderColor: "#fde68a",
  },
  evidenceCardCompactWarning: {
    borderColor: "#fcd34d",
  },
  evidenceCardCompactBlocked: {
    borderColor: "#fca5a5",
  },
  evidenceCardCompactStale: {
    borderColor: "#cbd5e1",
  },
  evidenceCardCompactPartial: {
    borderColor: "#d8b4fe",
  },
  evidenceCardCompactMock: {
    borderColor: "#bfdbfe",
  },
  evidenceCardCompactUnavailable: {
    borderColor: "#d1d5db",
  },
  evidenceCardInteractive: {
    shadowColor: "#111827",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  evidenceCardPressed: {
    transform: [{ scale: 0.985 }],
  },
  evidenceCompactAccent: {
    height: 3,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    marginBottom: 2,
  },
  evidenceCompactHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  evidenceCardFamilyCompact: {
    color: "#6b7280",
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.35,
    flexShrink: 1,
    fontFamily,
  },
  evidenceCardFamilyCompactDense: {
    fontSize: 8,
  },
  evidenceCardTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
    fontFamily,
  },
  evidenceCardTitleCompact: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
    lineHeight: 17,
  },
  evidenceCardTitleCompactDense: {
    fontSize: 12,
    lineHeight: 16,
  },
  evidenceCardHeaderMeta: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginLeft: 8,
  },
  evidencePinnedMark: {
    color: "#0f766e",
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontFamily,
  },
  visualContainer: {
    height: 100,
    justifyContent: "center",
  },
  compactVisualContainer: {
    height: 58,
    justifyContent: "center",
  },
  compactEvidenceFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 4,
    gap: 8,
  },
  compactEvidenceValue: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
    flexShrink: 1,
    fontFamily,
  },
  compactEvidenceValueDense: {
    fontSize: 13,
  },
  compactEvidenceThreshold: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "700",
    fontFamily,
    flexShrink: 1,
    textAlign: "right",
    maxWidth: "52%",
  },
  compactEvidenceThresholdDense: {
    fontSize: 9,
    maxWidth: "54%",
  },
  compactEvidenceMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginTop: 3,
  },
  compactStatusBadge: {
    minHeight: 22,
    paddingHorizontal: 7,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  compactStatusBadgeDense: {
    minHeight: 20,
    paddingHorizontal: 6,
  },
  compactEvidenceStatusText: {
    color: "#111827",
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    fontFamily,
  },
  compactEvidenceStatusTextDense: {
    fontSize: 8,
  },
  compactEvidenceEffect: {
    color: "#4b5563",
    fontSize: 10,
    fontWeight: "700",
    fontFamily,
    flex: 1,
  },
  compactEvidenceEffectDense: {
    fontSize: 9,
  },
  compactFreshnessWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "44%",
  },
  compactFreshnessText: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "700",
    fontFamily,
  },
  compactFreshnessTextDense: {
    fontSize: 9,
  },
  metricJumpChip: {
    paddingHorizontal: 11,
    minHeight: 32,
    borderRadius: 11,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    justifyContent: "center",
    overflow: "hidden",
  },
  metricJumpChipActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  metricJumpChipText: {
    color: "#4b5563",
    fontSize: 12,
    fontWeight: "700",
    fontFamily,
  },
  metricJumpChipTextActive: {
    color: "#ffffff",
  },
  detailMetricStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  detailMetricStripCompact: {
    gap: 6,
  },
  detailNarrativePanel: {
    marginTop: 12,
    padding: 15,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#eceef2",
    gap: 10,
  },
  detailNarrativePanelCompact: {
    marginTop: 10,
    padding: 12,
    gap: 8,
  },
  detailNarrativeHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  detailNarrativeHeaderCompact: {
    gap: 6,
  },
  detailNarrativeLead: {
    color: "#111827",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
    fontFamily,
  },
  detailNarrativeSplit: {
    gap: 10,
  },
  detailNarrativeSplitCompact: {
    gap: 8,
  },
  detailNarrativeBlock: {
    gap: 4,
  },
  detailNarrativeLabel: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    fontFamily,
  },
  detailHeroCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    gap: 14,
    overflow: "hidden",
  },
  detailHeroCardCompact: {
    padding: 12,
    borderRadius: 16,
    gap: 10,
  },
  detailHeroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  detailHeroHeaderCompact: {
    gap: 10,
  },
  detailHeroEyebrow: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontFamily,
  },
  detailHeroValue: {
    color: "#f8fafc",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    fontFamily,
  },
  detailHeroValueCompact: {
    fontSize: 21,
    lineHeight: 27,
  },
  detailHeroBadge: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "rgba(148, 163, 184, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  detailHeroBadgeText: {
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: "800",
    fontFamily,
  },
  detailHeroChart: {
    height: 248,
    borderRadius: 16,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  detailHeroChartCompact: {
    height: 216,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
  },
  detailHeroGrid: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    paddingVertical: 18,
  },
  detailHeroGridLine: {
    height: 1,
    backgroundColor: "rgba(148, 163, 184, 0.15)",
  },
  detailHeroThresholdLine: {
    position: "absolute",
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: "rgba(248, 250, 252, 0.28)",
    borderStyle: "dashed",
  },
  detailHeroCurrentLine: {
    position: "absolute",
    left: 12,
    right: 12,
    height: 2,
    backgroundColor: "#22c55e",
    opacity: 0.7,
  },
  detailHeroBarsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    flex: 1,
  },
  detailHeroBarHit: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
    borderRadius: 10,
    paddingBottom: 4,
  },
  detailHeroBarHitActive: {
    backgroundColor: "rgba(148, 163, 184, 0.08)",
  },
  detailHeroBar: {
    width: "100%",
    borderRadius: 9,
    backgroundColor: "rgba(96, 165, 250, 0.48)",
    minHeight: 22,
  },
  detailHeroBarActive: {
    backgroundColor: "#60a5fa",
  },
  detailHeroLineOverlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "none",
  },
  detailHeroLineDot: {
    position: "absolute",
    width: 8,
    height: 8,
    marginLeft: -4,
    marginBottom: -4,
    borderRadius: 4,
    backgroundColor: "#f8fafc",
  },
  detailHeroLineDotMuted: {
    position: "absolute",
    width: 7,
    height: 7,
    marginLeft: -3.5,
    marginBottom: -3.5,
    borderRadius: 3.5,
    backgroundColor: "#94a3b8",
    opacity: 0.9,
  },
  detailHeroLegend: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  detailHeroLegendCompact: {
    gap: 6,
  },
  detailHeroLegendText: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "700",
    fontFamily,
    flexShrink: 1,
  },
  detailHeroFootnote: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    fontFamily,
  },
  detailSheetActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  detailSheetActionRowCompact: {
    gap: 6,
    marginTop: 8,
  },
  detailJumpSection: {
    marginTop: 10,
    gap: 8,
  },
  detailJumpSectionCompact: {
    marginTop: 8,
    gap: 6,
  },
  detailJumpTitle: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    fontFamily,
  },
  detailJumpRow: {
    gap: 8,
    paddingRight: 6,
  },
  detailDisclosurePanel: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#eceef2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  detailChecklistStack: {
    gap: 8,
  },
  detailChecklistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  detailChecklistMarker: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  detailChecklistMarkerGood: {
    backgroundColor: "#22c55e",
  },
  detailChecklistMarkerWarning: {
    backgroundColor: "#f59e0b",
  },
  detailChecklistMarkerDanger: {
    backgroundColor: "#ef4444",
  },
  detailChecklistMarkerNeutral: {
    backgroundColor: "#94a3b8",
  },
  detailChecklistLabel: {
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
    fontFamily,
  },
  detailCountdownWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 8,
    minHeight: 140,
  },
  detailCountdownDays: {
    color: "#f8fafc",
    fontSize: 80,
    lineHeight: 86,
    fontWeight: "800",
    fontFamily,
  },
  detailCountdownUnit: {
    color: "#cbd5e1",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    marginBottom: 14,
    fontFamily,
  },
  detailGaugeTrack: {
    height: 34,
    borderRadius: 18,
    overflow: "hidden",
    flexDirection: "row",
    position: "relative",
  },
  detailGaugeSafe: {
    flex: 1,
    backgroundColor: "#14532d",
  },
  detailGaugeWarn: {
    flex: 1,
    backgroundColor: "#92400e",
  },
  detailGaugeDanger: {
    flex: 1,
    backgroundColor: "#7f1d1d",
  },
  detailGaugeThreshold: {
    position: "absolute",
    top: -3,
    bottom: -3,
    width: 2,
    backgroundColor: "#f8fafc",
    opacity: 0.65,
  },
  detailGaugeCurrent: {
    position: "absolute",
    top: -5,
    bottom: -5,
    width: 4,
    borderRadius: 2,
    backgroundColor: "#60a5fa",
  },
  detailZoneTrack: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    position: "relative",
    justifyContent: "center",
    overflow: "hidden",
  },
  detailZoneBand: {
    position: "absolute",
    top: 10,
    bottom: 10,
    borderRadius: 12,
    backgroundColor: "rgba(34, 197, 94, 0.32)",
    borderWidth: 1,
    borderColor: "rgba(74, 222, 128, 0.8)",
  },
  detailZoneMarker: {
    position: "absolute",
    top: 4,
    bottom: 4,
    width: 4,
    borderRadius: 2,
    backgroundColor: "#f8fafc",
  },
  freshnessDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981", // Green
  },
  choiceRow: {
    gap: 10,
    paddingVertical: 4,
    paddingRight: 8,
  },
  segmentedChoice: {
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: "#eef2f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    flexDirection: "row",
    overflow: "hidden",
  },
  segmentedChoiceItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    backgroundColor: "transparent",
  },
  segmentedChoiceItemDivider: {
    borderLeftWidth: 1,
    borderLeftColor: "#e5e7eb",
  },
  segmentedChoiceItemActive: {
    backgroundColor: "#111827",
  },
  segmentedChoiceText: {
    color: "#4b5563",
    fontSize: 12,
    fontWeight: "800",
    fontFamily,
  },
  segmentedChoiceTextActive: {
    color: "#ffffff",
  },
  choiceChip: {
    paddingHorizontal: 14,
    minHeight: 38,
    borderRadius: 11,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    minWidth: 80,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  choiceChipPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.94,
  },
  choiceChipActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  choiceChipText: {
    color: "#4b5563",
    fontSize: 13,
    fontWeight: "700",
    fontFamily,
  },
  choiceChipTextActive: {
    color: "#ffffff",
  },
  templateCard: {
    width: 200,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#eceef2",
    gap: 8,
  },
  templateCardActive: {
    borderColor: "#111827",
    backgroundColor: "#f8fafc",
  },
  templateTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
  },
  templateTitleActive: {
    color: "#111827",
  },
  templateSubtitle: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "600",
  },
  templateSubtitleActive: {
    color: "#4b5563",
  },
  selectChip: {
    width: "48%",
    minHeight: 70,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 4,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  selectChipActive: {
    borderColor: "#111827",
    backgroundColor: "#111827",
  },
  selectChipTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
  },
  selectChipTitleActive: {
    color: "#ffffff",
  },
  selectChipSubtitle: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "700",
  },
  selectChipSubtitleActive: {
    color: "#d1d5db",
  },
  validationText: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
  },
  previewDisclosure: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 12,
  },
  statusBadgeText: {
    color: "#111827",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  panelBadges: {
    alignItems: "flex-end",
    gap: 6,
  },
  formulaPanel: {
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#eceef2",
    gap: 12,
  },
  formulaTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
  },
  formulaBody: {
    color: "#4b5563",
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  formulaMeta: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
  },
  formulaToggleText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  evidenceRelated: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  evidenceEffect: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },
  evidenceWhy: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "500",
  },
  evidenceRole: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: 2,
  },
  evidenceSummary: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  evidenceMetricsRow: {
    flexDirection: "row",
    gap: 12,
  },
  metaPillText: {
    color: "#4b5563",
    fontSize: 10,
    fontWeight: "700",
    flexShrink: 1,
  },
  metaPill: {
    paddingHorizontal: 8,
    minHeight: 22,
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    justifyContent: "center",
    maxWidth: "100%",
    overflow: "hidden",
  },
  stepper: {
    flex: 1,
    gap: 8,
  },
  stepperLabel: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  stepperTrack: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  stepperButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
  },
  stepperButtonText: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "700",
  },
  stepperValueWrap: {
    flex: 1,
    alignItems: "center",
  },
  stepperValue: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  denseStat: {
    width: "48%",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#eceef2",
    alignItems: "flex-start",
    justifyContent: "center",
    minHeight: 68,
    overflow: "hidden",
  },
  denseStatStrong: {
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
  },
  denseStatRisk: {
    borderColor: "#fecaca",
    backgroundColor: "#fff7f7",
  },
  denseStatLabel: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "700",
    width: "100%",
  },
  denseStatValue: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 4,
    width: "100%",
  },
  alertTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "800",
    marginTop: 4,
    flexShrink: 1,
  },
  cardEyebrow: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily,
  },
  cardTitle: {
    color: "#111827",
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
    fontFamily,
    flexShrink: 1,
  },
  cardBody: {
    color: "#4b5563",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "500",
    fontFamily,
    flexShrink: 1,
  },
  metaLine: {
    color: "#6b7280",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    fontFamily,
  },
  dualColumn: {
    flexDirection: "row",
    gap: 12,
  },
  columnTitle: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
    fontFamily,
  },
  listLine: {
    color: "#4b5563",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    fontFamily,
  },
  priorityStack: {
    alignItems: "flex-end",
    gap: 6,
  },
  statePill: {
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "700",
    fontFamily,
  },
  statePillAttention: {
    color: "#991b1b",
    backgroundColor: "#fee2e2",
  },
  statePillOpportunity: {
    color: "#166534",
    backgroundColor: "#dcfce7",
  },
  statePillRisk: {
    color: "#92400e",
    backgroundColor: "#fef3c7",
  },
  statePillBroken: {
    color: "#ffffff",
    backgroundColor: "#111827",
  },
  statePillWatch: {
    color: "#1d4ed8",
    backgroundColor: "#dbeafe",
  },
  statePillInteresting: {
    color: "#0f766e",
    backgroundColor: "#ccfbf1",
  },
  statePillQuiet: {
    color: "#4b5563",
    backgroundColor: "#f3f4f6",
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priorityHigh: { backgroundColor: "#ef4444" },
  priorityMedium: { backgroundColor: "#f59e0b" },
  priorityLow: { backgroundColor: "#10b981" },
  priorityBadgeText: {
    color: "#f8fafc",
    fontSize: 10,
    fontWeight: "900",
  },
  timestampText: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  stockGroupSummary: {
    color: "#4b5563",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    marginTop: 6,
  },
  stockTriageHeader: {
    gap: 10,
  },
  stockTriageTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  stockTriageToggle: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontFamily,
  },
  stockTriageSummaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  stockTriagePrimaryMetric: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
    fontFamily,
  },
  stockTriageSecondaryMetric: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "700",
    fontFamily,
  },
  alertClusterHeader: {
    gap: 10,
  },
  alertClusterPreview: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "700",
    fontFamily,
  },
  alertClusterItem: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f2f5",
    gap: 10,
  },
  alertClusterActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusPassed: { backgroundColor: "rgba(16, 185, 129, 0.1)", borderColor: "#10b981" },
  statusNear: { backgroundColor: "rgba(56, 189, 248, 0.1)", borderColor: "#38bdf8" },
  statusWarning: { backgroundColor: "rgba(245, 158, 11, 0.1)", borderColor: "#f59e0b" },
  statusBlocked: { backgroundColor: "rgba(239, 68, 68, 0.1)", borderColor: "#ef4444" },
  statusPartial: { backgroundColor: "#f3f4f6", borderColor: "#d1d5db" },
  statusUnavailable: { backgroundColor: "#f3f4f6", borderColor: "#d1d5db" },
  statusStale: { backgroundColor: "#fef3c7", borderColor: "#f59e0b" },
  statusMock: { backgroundColor: "rgba(167, 139, 250, 0.1)", borderColor: "#a78bfa" },
  statusFailed: { backgroundColor: "#f3f4f6", borderColor: "#d1d5db" },
  freshnessBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  freshnessFresh: { backgroundColor: "rgba(16, 185, 129, 0.1)", borderColor: "#10b981" },
  freshnessDelayed: { backgroundColor: "rgba(245, 158, 11, 0.1)", borderColor: "#f59e0b" },
  freshnessPartial: { backgroundColor: "#f3f4f6", borderColor: "#d1d5db" },
  freshnessUnavailable: { backgroundColor: "#f3f4f6", borderColor: "#d1d5db" },
  freshnessStale: { backgroundColor: "#fef3c7", borderColor: "#f59e0b" },
  freshnessMock: { backgroundColor: "rgba(167, 139, 250, 0.1)", borderColor: "#a78bfa" },
  freshnessBadgeText: {
    color: "#111827",
    fontSize: 9,
    fontWeight: "700",
  },
  // Legacy/Required Compat
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#eceef2",
    shadowColor: "#111827",
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    overflow: "hidden",
  },
  cardHighlighted: {
    borderColor: "#d1d5db",
  },
  pressableCardWrap: {
    borderRadius: 18,
  },
  pressableCardWrapPressed: {
    transform: [{ scale: 0.988 }],
    opacity: 0.96,
  },
  inputLabel: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  analysisActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  dualDenseGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  compactMetricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  compactMetricText: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
    fontFamily,
  },
  evidenceGroup: {
    gap: 10,
  },
  groupHeaderButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  groupHeaderToggle: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    fontFamily,
  },
  evidenceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  evidenceGridItem: {
    width: "48.5%",
  },
  alertMiniRow: {
    paddingVertical: 10,
    gap: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f2f5",
  },
  alertMiniTitle: {
    color: "#111827",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    fontFamily,
  },
  alertMiniBody: {
    marginTop: 4,
    color: "#6b7280",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
    fontFamily,
  },
  evidenceColumn: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#eceef2",
  },
  previewCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#eceef2",
  },
  previewLabel: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    fontFamily,
  },
  previewText: {
    marginTop: 6,
    color: "#111827",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    fontFamily,
  },
  kindPill: {
    alignSelf: "flex-start",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    fontFamily,
  },
  button: {
    paddingHorizontal: 14,
    minHeight: 42,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "100%",
    overflow: "hidden",
  },
  buttonPrimary: {
    backgroundColor: "#111827",
  },
  buttonPrimaryText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  buttonSecondary: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  buttonSecondaryText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  buttonGhost: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  buttonGhostText: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "700",
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.42,
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  buttonDisabledText: {
    color: "#9ca3af",
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    color: "#111827",
    padding: 14,
    borderRadius: 14,
    fontSize: 14,
    fontWeight: "600",
  },
  inputInvalid: {
    borderColor: "#ef4444",
    backgroundColor: "#fff8f8",
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  inlineBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  flexOne: {
    flex: 1,
  },
  stack: {
    gap: 10,
  },
  thresholdWrap: {
    gap: 8,
  },
  thresholdTrack: {
    height: 6,
    backgroundColor: "#e5e7eb",
    borderRadius: 3,
    overflow: "hidden",
  },
  thresholdMarkerCurrent: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "#111827",
  },
  thresholdMarkerThreshold: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "#9ca3af",
  },
  entryZoneBand: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(16, 185, 129, 0.3)",
  },
  thresholdLegend: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  thresholdLegendText: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  freshnessVisual: {
    gap: 8,
  },
  freshnessTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
  },
  freshnessVisualText: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
    fontFamily,
  },
  binaryVisual: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  binaryDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  binaryDotActive: {
    backgroundColor: "#111827",
  },
  binaryDotMuted: {
    backgroundColor: "#d1d5db",
  },
  binaryVisualText: {
    color: "#4b5563",
    fontSize: 12,
    fontWeight: "600",
    fontFamily,
  },
  miniTrendVisual: {
    height: 40,
  },
  miniTrendBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    height: 30,
  },
  miniTrendBar: {
    flex: 1,
    backgroundColor: "#d1d5db",
    borderRadius: 1,
  },
  miniTrendBarActive: {
    backgroundColor: "#111827",
  },
  riskGaugeTrack: {
    height: 6,
    flexDirection: "row",
    borderRadius: 3,
    overflow: "hidden",
  },
  riskGaugeSafe: {
    flex: 3,
    backgroundColor: "#10b981",
  },
  riskGaugeWarn: {
    flex: 1,
    backgroundColor: "#f59e0b",
  },
  riskGaugeDanger: {
    flex: 1,
    backgroundColor: "#ef4444",
  },
  checklistVisual: {
    gap: 6,
  },
  checklistItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checklistDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  checklistDotGood: { backgroundColor: "#10b981" },
  checklistDotNeutral: { backgroundColor: "#9ca3af" },
  checklistDotWarning: { backgroundColor: "#f59e0b" },
  checklistDotDanger: { backgroundColor: "#ef4444" },
  checklistText: {
    color: "#4b5563",
    fontSize: 11,
    fontWeight: "700",
  },
  sparklineOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 1,
    paddingHorizontal: 2,
    opacity: 0.4,
  },
  sparklineBar: {
    flex: 1,
    backgroundColor: "#d1d5db",
    borderRadius: 1,
  },
  sparklineBarActive: {
    backgroundColor: "#111827",
  },
  sparklineLine: {
    position: "absolute",
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#38bdf8",
  },
  sparklineLineMuted: {
    position: "absolute",
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#94a3b8",
  },
  eventCountdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  eventCountdownBadge: {
    minWidth: 52,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: "center",
  },
  eventCountdownUrgent: {
    backgroundColor: "#fff7ed",
  },
  eventCountdownCalm: {
    backgroundColor: "#eff6ff",
  },
  eventCountdownValue: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
    fontFamily,
  },
  eventCountdownLabel: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
    fontFamily,
  },
  eventCountdownMeta: {
    color: "#6b7280",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    fontFamily,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 21,
    fontWeight: "800",
    lineHeight: 26,
    fontFamily,
  },
  sectionNote: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 17,
    fontFamily,
  },
  stepFlow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: "#e5e7eb",
    marginHorizontal: 6,
  },
  stepConnectorActive: {
    backgroundColor: "#111827",
  },
  stepNode: {
    width: 72,
    alignItems: "center",
    gap: 6,
  },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  stepDotComplete: {
    backgroundColor: "#e5e7eb",
    borderColor: "#e5e7eb",
  },
  stepDotText: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "800",
    fontFamily,
  },
  stepDotTextActive: {
    color: "#ffffff",
  },
  stepLabel: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    fontFamily,
  },
  stepLabelActive: {
    color: "#111827",
  },
  conditionRequired: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#38bdf8",
  },
  conditionSupporting: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#10b981",
  },
  conditionNegative: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#f59e0b",
  },
  conditionDisqualifier: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#ef4444",
  },
});
