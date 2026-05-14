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
  View,
} from "react-native";

import { useAppModel } from "./src/hooks/useAppModel";
import {
  Alert,
  ConditionOperator,
  DecisionAction,
  Eye,
  EyeState,
  FreshnessStatus,
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
  buildWhatChangedList,
} from "./src/lib/visualEvidence";

type TabKey = "Home" | "Stocks" | "Recipes" | "Eyes" | "Alerts" | "Journal";
type StockFilter = "All" | "Needs Review" | "Opportunity" | "Quiet";
type RecipeWorkspaceTab = "Builder" | "Preview" | "Library";
type EyeWorkspaceTab = "Active Eyes" | "Create Eye";
type AlertWorkspaceTab = "Queue" | "Detail" | "Snoozed";
type JournalWorkspaceTab = "Log Decision" | "History";
type StockWorkspaceTab = "Summary" | "Visual Analysis" | "Recipe Map" | "Notes";
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

type AnalysisDensity = "Compact" | "Comfortable";
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

const tabs: TabKey[] = ["Home", "Stocks", "Recipes", "Eyes", "Alerts", "Journal"];
const stockFilters: StockFilter[] = ["All", "Needs Review", "Opportunity", "Quiet"];
const recipeWorkspaceTabs: RecipeWorkspaceTab[] = ["Builder", "Preview", "Library"];
const eyeWorkspaceTabs: EyeWorkspaceTab[] = ["Active Eyes", "Create Eye"];
const alertWorkspaceTabs: AlertWorkspaceTab[] = ["Queue", "Detail", "Snoozed"];
const journalWorkspaceTabs: JournalWorkspaceTab[] = ["Log Decision", "History"];
const stockWorkspaceTabs: StockWorkspaceTab[] = ["Summary", "Visual Analysis", "Recipe Map", "Notes"];
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
const analysisDensityOptions: AnalysisDensity[] = ["Compact", "Comfortable"];
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
      return [styles.statePill, styles.statePillAttention];
    case "Opportunity Zone Forming":
      return [styles.statePill, styles.statePillOpportunity];
    case "Thesis Risk Rising":
      return [styles.statePill, styles.statePillRisk];
    case "Thesis Broken":
      return [styles.statePill, styles.statePillBroken];
    case "Watch Closely":
      return [styles.statePill, styles.statePillWatch];
    case "Becoming Interesting":
      return [styles.statePill, styles.statePillInteresting];
    default:
      return [styles.statePill, styles.statePillQuiet];
  }
};

const priorityTone = (priority: Alert["priority"]) => {
  switch (priority) {
    case "High":
      return [styles.priorityBadge, styles.priorityHigh];
    case "Medium":
      return [styles.priorityBadge, styles.priorityMedium];
    default:
      return [styles.priorityBadge, styles.priorityLow];
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
        duration: 260,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 260,
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
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "secondary" | "ghost";
}) => (
  <Pressable
    onPress={onPress}
    style={[
      styles.button,
      tone === "primary"
        ? styles.buttonPrimary
        : tone === "secondary"
          ? styles.buttonSecondary
          : styles.buttonGhost,
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
      ]}
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
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: "default" | "numeric";
  autoCapitalize?: "none" | "sentences" | "characters";
}) => (
  <TextInput
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor="#8da0b7"
    multiline={multiline}
    keyboardType={keyboardType}
    autoCapitalize={autoCapitalize}
    style={[styles.input, multiline ? styles.textArea : null]}
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
    <Text style={styles.denseStatLabel}>{label}</Text>
    <Text style={styles.denseStatValue}>{value}</Text>
  </View>
);

const MetricButton = ({
  value,
  label,
  note,
  onPress,
}: {
  value: string | number;
  label: string;
  note: string;
  onPress: () => void;
}) => (
  <Pressable onPress={onPress} style={styles.metricButton}>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricNote}>{note}</Text>
  </Pressable>
);

const MetaPill = ({ label }: { label: string }) => (
  <View style={styles.metaPill}>
    <Text style={styles.metaPillText}>{label}</Text>
  </View>
);

const HorizontalChoice = <T extends string>({
  options,
  value,
  onSelect,
}: {
  options: readonly T[];
  value: T;
  onSelect: (next: T) => void;
}) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>
    {options.map((option) => (
      <Pressable
        key={option}
        onPress={() => onSelect(option)}
        style={[styles.choiceChip, option === value ? styles.choiceChipActive : null]}
      >
        <Text style={[styles.choiceChipText, option === value ? styles.choiceChipTextActive : null]}>
          {option}
        </Text>
      </Pressable>
    ))}
  </ScrollView>
);

const StockSparkline = ({
  price,
  drawdownPct,
  stabilizationScore,
}: {
  price: number;
  drawdownPct: number;
  stabilizationScore: number;
}) => {
  const series = useMemo(
    () => buildChartSeries(price, drawdownPct, stabilizationScore),
    [price, drawdownPct, stabilizationScore],
  );

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Price Action</Text>
        <Text style={styles.chartLegend}>Mock 1M sparkline</Text>
      </View>
      <View style={styles.chartBars}>
        {series.map((point, index) => (
          <View
            key={`${index}-${point.toFixed(2)}`}
            style={[
              styles.chartBar,
              {
                height: 24 + point * 0.64,
                backgroundColor: index === series.length - 1 ? "#22c55e" : "#60a5fa",
              },
            ]}
          />
        ))}
      </View>
      <Text style={styles.chartFootnote}>
        ${price.toFixed(2)} now · {drawdownPct}% from high · stabilization {stabilizationScore}/100
      </Text>
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
  <View style={styles.panel}>
    <View style={styles.inlineBetween}>
      <View style={styles.flexOne}>
        <Text style={styles.panelLabel}>{title}</Text>
        <Text style={styles.panelBody}>{body}</Text>
      </View>
      <View style={styles.panelBadges}>
        <Text style={stateTone(state)}>{state}</Text>
        <MetaPill label={recipeVersion} />
      </View>
    </View>
  </View>
);

const WhatChangedPanel = ({ title, items }: { title: string; items: string[] }) => (
  <View style={styles.panel}>
    <Text style={styles.panelLabel}>{title}</Text>
    <View style={styles.panelList}>
      {items.map((item) => (
        <Text key={item} style={styles.panelListItem}>
          • {item}
        </Text>
      ))}
    </View>
  </View>
);

const EvidenceCardView = ({
  card,
  compact = false,
}: {
  card: VisualEvidenceCard;
  compact?: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable onPress={() => setExpanded((current) => !current)} style={[styles.evidenceCard, compact ? styles.evidenceCardCompact : null]}>
      <View style={styles.inlineBetween}>
        <View style={styles.flexOne}>
          <Text style={styles.evidenceCardTitle}>{card.title}</Text>
          {!compact ? <Text style={styles.evidenceRole}>{card.role}</Text> : null}
        </View>
        <View style={styles.evidenceBadgeStack}>
          <View style={statusTone(card.status)}>
            <Text style={styles.statusBadgeText}>{card.status}</Text>
          </View>
          {compact ? null : (
            <View style={freshnessTone(card.freshness)}>
              <Text style={styles.freshnessBadgeText}>{card.freshness}</Text>
            </View>
          )}
        </View>
      </View>

      {compact ? null : <Text style={styles.evidenceSummary}>{card.summary}</Text>}
      <ThresholdBar card={card} />

      {compact ? (
        <View style={styles.compactEvidenceFooter}>
          <Text style={styles.compactEvidenceValue}>{card.metric.currentLabel}</Text>
          <Text style={styles.compactEvidenceThreshold}>{card.metric.thresholdLabel ?? card.metric.comparisonLabel ?? "Context"}</Text>
          <View style={freshnessTone(card.freshness)}>
            <Text style={styles.freshnessBadgeText}>{card.freshness}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.evidenceMetricsRow}>
          <DenseStat label="Current" value={card.metric.currentLabel} tone="strong" />
          <DenseStat label="Threshold" value={card.metric.thresholdLabel ?? "Context only"} />
        </View>
      )}

      {!compact && card.relatedConditionLabel ? (
        <Text style={styles.evidenceRelated}>Recipe link: {card.relatedConditionLabel}</Text>
      ) : null}

      {!compact ? <Text style={styles.evidenceEffect}>Effect: {card.effect}</Text> : null}
      {!compact ? <Text style={styles.evidenceWhy}>Why it matters: {card.whyItMatters}</Text> : null}

      {!compact ? (
        <View style={styles.metaRow}>
          <MetaPill label={card.sourceType} />
          {card.metric.comparisonLabel ? <MetaPill label={card.metric.comparisonLabel} /> : null}
        </View>
      ) : null}

      <Text style={styles.formulaToggleText}>{expanded ? "Hide details" : compact ? "Tap for details" : "Show formula details"}</Text>

      {expanded ? (
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
    <View style={styles.recipeMapCard}>
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

      <Text style={styles.evidenceSummary}>{evaluation.whyNow}</Text>

      <View style={styles.recipeMapStats}>
        <DenseStat label="Passed" value={`${passed.length}`} tone="strong" />
        <DenseStat label="Failed" value={`${failed.length}`} />
        <DenseStat label="Warnings" value={`${warnings.length}`} tone={warnings.length > 0 ? "risk" : "neutral"} />
        <DenseStat label="Blockers" value={`${blockers.length}`} tone={blockers.length > 0 ? "risk" : "neutral"} />
      </View>

      <View style={styles.dualColumn}>
        <View style={styles.evidenceColumn}>
          <Text style={styles.columnTitle}>Top support</Text>
          {(evaluation.supportingEvidence ?? []).slice(0, 3).map((item) => (
            <Text key={item} style={styles.listLine}>
              + {item}
            </Text>
          ))}
        </View>
        <View style={styles.evidenceColumn}>
          <Text style={styles.columnTitle}>Top risks</Text>
          {[
            ...(evaluation.contradictingEvidence ?? []),
            ...(evaluation.riskWarnings ?? []),
            ...(evaluation.hardDisqualifiers ?? []),
          ]
            .slice(0, 3)
            .map((item) => (
              <Text key={item} style={styles.listLine}>
                - {item}
              </Text>
            ))}
        </View>
      </View>

      <View style={styles.metaRow}>
        <MetaPill label={`Last state change ${evaluation.stateChanged ? "now" : "unchanged"}`} />
        <MetaPill label={`Urgency ${evaluation.actionUrgency}`} />
        <MetaPill label={evaluation.setupStrength} />
      </View>

      {nextTrigger ? (
        <Text style={styles.evidenceWhy}>Next likely trigger: {nextTrigger.explanation}</Text>
      ) : null}

      {(evaluation.missingData.length > 0 || evaluation.staleData.length > 0) ? (
        <Text style={styles.evidenceEffect}>
          Data issues: {[...evaluation.missingData, ...evaluation.staleData].slice(0, 2).join(" | ")}
        </Text>
      ) : null}

      <Pressable onPress={() => setExpanded((current) => !current)} style={styles.formulaToggle}>
        <Text style={styles.formulaToggleText}>{expanded ? "Hide condition matrix" : "Show condition matrix"}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.recipeMatrix}>
          {(evaluation.conditionResults ?? []).map((item) => (
            <View key={item.conditionId} style={styles.recipeMatrixRow}>
              <View style={statusTone(item.missingData ? "Partial" : item.passed ? "Passed" : item.role === "Hard Disqualifier" ? "Blocked" : item.role === "Risk Warning" ? "Warning" : "Failed")}>
                <Text style={styles.statusBadgeText}>
                  {item.missingData ? "Partial" : item.passed ? "Passed" : item.role === "Hard Disqualifier" ? "Blocked" : item.role === "Risk Warning" ? "Warning" : "Failed"}
                </Text>
              </View>
              <View style={styles.flexOne}>
                <Text style={styles.recipeMatrixTitle}>{item.metricKey ?? "Condition"}</Text>
                <Text style={styles.recipeMatrixBody}>{item.explanation}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const HomeStockGroupCard = ({
  item,
  recipes,
  onOpenStock,
}: {
  item: {
    stock: Stock;
    eyes: Eye[];
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
}) => {
  const evaluation = item.dominantEye?.lastEvaluation;
  const topSupport = evaluation?.supportingEvidence?.[0] ?? "No clear support captured yet.";
  const topRisk =
    evaluation?.hardDisqualifiers?.[0] ??
    evaluation?.riskWarnings?.[0] ??
    evaluation?.contradictingEvidence?.[0] ??
    "No major risk flagged.";

  return (
    <Pressable onPress={onOpenStock}>
      <Card highlighted>
        <View style={styles.inlineBetween}>
          <View style={styles.flexOne}>
            <Text style={styles.cardEyebrow}>{item.stock.name}</Text>
            <Text style={styles.cardTitle}>{item.stock.symbol}</Text>
            <Text style={styles.stockGroupSummary}>{topSupport}</Text>
          </View>
          <Text style={stateTone(evaluation?.currentState)}>{evaluation?.currentState ?? "Unwatched"}</Text>
        </View>

        <View style={styles.stockGroupStats}>
          <DenseStat label="Eyes" value={`${item.eyes.length}`} tone="strong" />
          <DenseStat label="Alerts" value={`${item.openAlerts.length}`} tone={item.openAlerts.length > 0 ? "risk" : "neutral"} />
          <DenseStat label="Urgency" value={evaluation?.actionUrgency ?? "Wait"} />
          <DenseStat label="Data" value={item.snapshot?.freshness ?? "Unavailable"} tone={item.snapshot?.isMock ? "risk" : "neutral"} />
        </View>

        {item.snapshot ? (
          <View style={styles.stockGroupMetricRow}>
            <Text style={styles.compactMetricText}>${item.snapshot.price.toFixed(2)}</Text>
            <Text style={styles.compactMetricText}>{item.snapshot.drawdownPct}% drawdown</Text>
            <Text style={styles.compactMetricText}>Updated {formatDate(item.snapshot.updatedAt)}</Text>
          </View>
        ) : null}

        <View style={styles.stockGroupEvidenceRow}>
          <View style={styles.stockGroupEvidenceCol}>
            <Text style={styles.stockGroupLabel}>Top support</Text>
            <Text style={styles.stockGroupLine}>+ {topSupport}</Text>
          </View>
          <View style={styles.stockGroupEvidenceCol}>
            <Text style={styles.stockGroupLabel}>Top risk</Text>
            <Text style={styles.stockGroupLine}>- {topRisk}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          {item.eyes.slice(0, 3).map((eye) => (
            <MetaPill key={eye.id} label={recipeLabel(recipes, eye.recipeId)} />
          ))}
        </View>
      </Card>
    </Pressable>
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
  const { data, loading, actions } = useAppModel();
  const [tab, setTab] = useState<TabKey>("Home");
  const [stockFilter, setStockFilter] = useState<StockFilter>("All");
  const [recipeWorkspaceTab, setRecipeWorkspaceTab] = useState<RecipeWorkspaceTab>("Builder");
  const [recipeBuilderStep, setRecipeBuilderStep] = useState<RecipeBuilderStep>("Purpose");
  const [eyeWorkspaceTab, setEyeWorkspaceTab] = useState<EyeWorkspaceTab>("Active Eyes");
  const [alertWorkspaceTab, setAlertWorkspaceTab] = useState<AlertWorkspaceTab>("Queue");
  const [journalWorkspaceTab, setJournalWorkspaceTab] = useState<JournalWorkspaceTab>("Log Decision");
  const [stockWorkspaceTab, setStockWorkspaceTab] = useState<StockWorkspaceTab>("Visual Analysis");
  const [analysisBenchmark, setAnalysisBenchmark] = useState<AnalysisBenchmark>("SPY");
  const [analysisLookback, setAnalysisLookback] = useState<AnalysisLookback>("3M");
  const [analysisStatusFilter, setAnalysisStatusFilter] = useState<AnalysisStatusFilter>("All Statuses");
  const [analysisDensity, setAnalysisDensity] = useState<AnalysisDensity>("Compact");
  const [fabOpen, setFabOpen] = useState(false);

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
  const [analysisRecipeFilter, setAnalysisRecipeFilter] = useState("All Recipes");
  const [analysisNote, setAnalysisNote] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [recentStockIds, setRecentStockIds] = useState<string[]>([]);
  const deferredStockSearch = useDeferredValue(stockSearch);

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
  const activeAlertQueue = useMemo(
    () =>
      alertQueue.filter(
        (alert) => !alert.snoozedUntil || new Date(alert.snoozedUntil).getTime() <= Date.now(),
      ),
    [alertQueue],
  );
  const snoozedAlerts = useMemo(
    () =>
      alertQueue.filter(
        (alert) => Boolean(alert.snoozedUntil) && new Date(alert.snoozedUntil!).getTime() > Date.now(),
      ),
    [alertQueue],
  );

  const stockDirectory = useMemo(() => {
    if (!data) return [];
    return data.stocks
      .map((stock) => {
        const eyes = data.eyes.filter((eye) => eye.stockId === stock.id);
        const snapshot = data.snapshots.find((item) => item.stockId === stock.id);
        const openAlerts = data.alerts.filter(
          (alert) => !alert.reviewed && eyes.some((eye) => eye.id === alert.eyeId),
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
    const baseList = stockDirectory.filter((item) => {
      if (!normalizedQuery) return true;
      return (
        item.stock.symbol.toLowerCase().includes(normalizedQuery) ||
        item.stock.name.toLowerCase().includes(normalizedQuery) ||
        item.stock.thesis.toLowerCase().includes(normalizedQuery)
      );
    });

    if (stockFilter === "All") return baseList;
    if (stockFilter === "Needs Review") {
      return baseList.filter((item) =>
        ["Attention Needed", "Thesis Risk Rising", "Thesis Broken"].includes(
          item.dominantEye?.lastEvaluation?.currentState ?? "",
        ),
      );
    }
    if (stockFilter === "Opportunity") {
      return baseList.filter(
        (item) => item.dominantEye?.lastEvaluation?.currentState === "Opportunity Zone Forming",
      );
    }
    return baseList.filter((item) =>
      ["Watch Closely", "Becoming Interesting", "Not Relevant"].includes(
        item.dominantEye?.lastEvaluation?.currentState ?? "",
      ),
    );
  }, [deferredStockSearch, stockDirectory, stockFilter]);

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
    if (!selectedStockId && stockDirectory[0]) {
      setSelectedStockId(stockDirectory[0].stock.id);
      return;
    }
    if (selectedStockId && !stockDirectory.some((item) => item.stock.id === selectedStockId)) {
      setSelectedStockId(stockDirectory[0]?.stock.id ?? "");
    }
  }, [selectedStockId, stockDirectory]);

  useEffect(() => {
    setAnalysisRecipeFilter("All Recipes");
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

  if (loading || !data) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <Text style={styles.loadingText}>Loading StockLedger...</Text>
      </SafeAreaView>
    );
  }

  const selectedEye = eyesSorted.find((eye) => eye.id === selectedEyeId) ?? eyesSorted[0];
  const selectedStockSummary =
    filteredStockDirectory.find((item) => item.stock.id === selectedStockId) ??
    stockDirectory.find((item) => item.stock.id === selectedStockId) ??
    filteredStockDirectory[0] ??
    stockDirectory[0];
  const selectedTemplate =
    conditionLibrary.find((item) => item.id === conditionBuilder.templateId) ?? conditionLibrary[0];
  const selectedOperatorOptions = operatorOptionsForTemplate(selectedTemplate);
  const selectedAlert = alertQueue.find((alert) => alert.id === selectedAlertId) ?? alertQueue[0];
  const openAlerts = data.alerts.filter((alert) => !alert.reviewed).length;
  const criticalEyes = data.eyes.filter((eye) =>
    ["Attention Needed", "Thesis Risk Rising", "Thesis Broken"].includes(
      eye.lastEvaluation?.currentState ?? "",
    ),
  ).length;
  const opportunityEyes = data.eyes.filter(
    (eye) => eye.lastEvaluation?.currentState === "Opportunity Zone Forming",
  ).length;

  const selectedEyeRecipe = selectedEye
    ? data.recipes.find((recipe) => recipe.id === selectedEye.recipeId)
    : undefined;
  const selectedEyeSnapshot = selectedEye
    ? data.snapshots.find((snapshot) => snapshot.stockId === selectedEye.stockId)
    : undefined;
  const selectedEyeEvidenceGroups =
    selectedEye && selectedEyeRecipe && selectedEyeSnapshot && selectedEye.lastEvaluation
      ? buildEvidenceGroups({
          eye: selectedEye,
          recipe: selectedEyeRecipe,
          snapshot: selectedEyeSnapshot,
          evaluation: selectedEye.lastEvaluation,
        })
      : [];
  const selectedEyeWhatChanged =
    selectedEye && selectedEyeSnapshot && selectedEye.lastEvaluation
      ? buildWhatChangedList({
          eye: selectedEye,
          snapshot: selectedEyeSnapshot,
          evaluation: selectedEye.lastEvaluation,
        })
      : [];

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
  const selectedStockRecipeOptions = [
    "All Recipes",
    ...selectedStockEyes
      .map((eye) => data.recipes.find((recipe) => recipe.id === eye.recipeId)?.name)
      .filter((name): name is string => Boolean(name)),
  ].filter((name, index, list) => list.indexOf(name) === index);
  const selectedStockFilteredEyes =
    analysisRecipeFilter === "All Recipes"
      ? selectedStockEyes
      : selectedStockEyes.filter(
          (eye) => data.recipes.find((recipe) => recipe.id === eye.recipeId)?.name === analysisRecipeFilter,
        );
  const selectedStockAnalysisGroups =
    selectedStockSummary?.snapshot
      ? buildStockVisualAnalysisGroups({
          stock: selectedStockSummary.stock,
          snapshot: selectedStockSummary.snapshot,
          eyes: selectedStockFilteredEyes,
          recipes: data.recipes,
          benchmark: analysisBenchmark,
          lookbackLabel: analysisLookback,
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
  const selectedStockRecipeMapEyes =
    selectedStockFilteredEyes.length > 0 ? selectedStockFilteredEyes : selectedStockEyes;

  const selectedStockWhatChanged = (() => {
    if (!selectedStockSummary) return [];
    const dominantEvaluation = selectedStockSummary.dominantEye?.lastEvaluation;
    const items: string[] = [];
    if (selectedStockSummary.snapshot) {
      items.push(
        `${selectedStockSummary.stock.symbol} is at $${selectedStockSummary.snapshot.price.toFixed(2)} with ${selectedStockSummary.snapshot.drawdownPct}% drawdown.`,
      );
      items.push(
        `Data quality is ${selectedStockSummary.snapshot.freshness}${selectedStockSummary.snapshot.isMock ? " and mock-backed" : ""}.`,
      );
    }
    if (dominantEvaluation?.supportingEvidence?.[0]) {
      items.push(`Top support: ${dominantEvaluation.supportingEvidence[0]}`);
    }
    if (
      dominantEvaluation?.hardDisqualifiers?.[0] ||
      dominantEvaluation?.riskWarnings?.[0] ||
      dominantEvaluation?.contradictingEvidence?.[0]
    ) {
      items.push(
        `Top risk: ${
          dominantEvaluation.hardDisqualifiers?.[0] ??
          dominantEvaluation.riskWarnings?.[0] ??
          dominantEvaluation.contradictingEvidence?.[0]
        }`,
      );
    }
    if (selectedStockSummary.openAlerts.length > 0) {
      items.push(`${selectedStockSummary.openAlerts.length} active alerts are open on this stock.`);
    }
    return items.slice(0, 4);
  })();

  const recentStocks = recentStockIds
    .map((id) => stockDirectory.find((item) => item.stock.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

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
  const previewEvidenceGroups =
    previewRecipe && previewEye && previewSnapshot && previewEvaluation
      ? buildEvidenceGroups({
          eye: previewEye,
          recipe: previewRecipe,
          snapshot: previewSnapshot,
          evaluation: previewEvaluation,
        })
      : [];

  const jumpTo = (target: TabKey) => {
    setFabOpen(false);
    setTab(target);
  };

  const openStockContext = ({
    stockId,
    eyeId,
    alertId,
    target = "Stocks",
    stockTab = "Visual Analysis",
  }: {
    stockId: string;
    eyeId?: string;
    alertId?: string;
    target?: StockRouteTarget;
    stockTab?: StockWorkspaceTab;
  }) => {
    setSelectedStockId(stockId);
    if (eyeId) setSelectedEyeId(eyeId);
    if (alertId) setSelectedAlertId(alertId);
    setRecentStockIds((current) => [stockId, ...current.filter((id) => id !== stockId)].slice(0, 6));

    if (target === "Stocks") {
      setStockWorkspaceTab(stockTab);
      setTab("Stocks");
      return;
    }
    if (target === "Alerts") {
      setAlertWorkspaceTab(alertId ? "Detail" : "Queue");
      setTab("Alerts");
      return;
    }
    if (target === "Eyes") {
      setEyeWorkspaceTab("Active Eyes");
      setTab("Eyes");
      return;
    }
    setJournalWorkspaceTab("Log Decision");
    setTab("Journal");
  };

  const quickDecision = async (alert: Alert, action: DecisionAction) => {
    const eye = data.eyes.find((item) => item.id === alert.eyeId);
    if (!eye) return;

    await actions.logDecision({
      eyeId: eye.id,
      alertId: alert.id,
      action,
      note: `${action} after reviewing ${eyeLine(eye, data.stocks, data.recipes)}.`,
      concern:
        eye.lastEvaluation?.contradictingEvidence[0] ?? "No additional concern captured during quick review.",
      thesisValid: action === "Marked Thesis Broken" ? "No" : action === "Rejected" ? "Partly" : "Yes",
      timing: "On Time",
    });
    openStockContext({
      stockId: eye.stockId,
      eyeId: eye.id,
      alertId: alert.id,
      target: "Journal",
    });
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
    if (!recipeForm.name.trim()) return;
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
  };

  const fabActions =
    tab === "Home"
      ? [
          {
            label: "Sync Data",
            onPress: () => {
              setFabOpen(false);
              void actions.refreshMockData();
            },
          },
          {
            label: "Log Decision",
            onPress: () => {
              setFabOpen(false);
              setJournalWorkspaceTab("Log Decision");
              setTab("Journal");
            },
          },
        ]
      : tab === "Stocks"
        ? [
            {
              label: "New Eye",
              onPress: () => {
                setFabOpen(false);
                setEyeWorkspaceTab("Create Eye");
                setTab("Eyes");
              },
            },
            {
              label: "Alerts",
              onPress: () => {
                setFabOpen(false);
                setAlertWorkspaceTab("Queue");
                setTab("Alerts");
              },
            },
          ]
        : tab === "Recipes"
          ? [
              {
                label: "New Recipe",
                onPress: () => {
                  setFabOpen(false);
                  setRecipeWorkspaceTab("Builder");
                },
              },
              {
                label: "New Eye",
                onPress: () => {
                  setFabOpen(false);
                  setEyeWorkspaceTab("Create Eye");
                  setTab("Eyes");
                },
              },
            ]
          : tab === "Eyes"
            ? [
                {
                  label: "Create Eye",
                  onPress: () => {
                    setFabOpen(false);
                    setEyeWorkspaceTab("Create Eye");
                  },
                },
                {
                  label: "Stocks",
                  onPress: () => {
                    setFabOpen(false);
                    setTab("Stocks");
                  },
                },
              ]
          : tab === "Alerts"
            ? [
                {
                  label: "Review Queue",
                  onPress: () => {
                    setFabOpen(false);
                    setAlertWorkspaceTab("Queue");
                  },
                },
                {
                  label: "Journal",
                  onPress: () => {
                    setFabOpen(false);
                    setJournalWorkspaceTab("Log Decision");
                    setTab("Journal");
                  },
                },
              ]
          : [
              {
                label: "New Decision",
                onPress: () => {
                  setFabOpen(false);
                  setJournalWorkspaceTab("Log Decision");
                },
              },
              {
                label: "Load Seed",
                onPress: () => {
                  setFabOpen(false);
                  void actions.resetToSeed();
                },
              },
            ];

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.frame}>
        <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
          {tab === "Home" ? (
            <>
              <Reveal>
                <Card highlighted>
                  <Text style={styles.heroEyebrow}>Clear investment operating system</Text>
                  <Text style={styles.heroTitle}>StockLedger</Text>
                  <Text style={styles.heroSubtitle}>
                    The shell now separates triage, stock inspection, recipe logic, alerts, and judgment history
                    into distinct workspaces so each screen answers one question quickly.
                  </Text>

                  <View style={styles.metricGrid}>
                    <MetricButton value={openAlerts} label="Alerts" note="Open review queue" onPress={() => jumpTo("Alerts")} />
                    <MetricButton value={data.stocks.length} label="Stocks" note="Open search workspace" onPress={() => jumpTo("Stocks")} />
                    <MetricButton value={data.recipes.length} label="Recipes" note="Open logic library" onPress={() => jumpTo("Recipes")} />
                    <MetricButton value={data.decisions.length} label="Journal" note="Open decision memory" onPress={() => jumpTo("Journal")} />
                  </View>

                  <View style={styles.summaryRow}>
                    <MetaPill label={`${criticalEyes} critical eyes`} />
                    <MetaPill label={`${opportunityEyes} opportunity setups`} />
                    <MetaPill
                      label={`${data.snapshots.filter((snapshot) => !snapshot.isMock).length} provider-backed · ${data.snapshots.filter((snapshot) => snapshot.isMock).length} mock fallback`}
                    />
                  </View>
                </Card>
              </Reveal>

              <Reveal delay={40}>
                <SectionHeader title="Priority Radar" note="Home is now triage only: what changed, what is urgent, and what to reopen." />
                <View style={styles.radarGrid}>
                  {[
                    { label: "Review Now", value: criticalEyes, tone: styles.radarCritical },
                    { label: "Forming", value: opportunityEyes, tone: styles.radarOpportunity },
                    { label: "Tracked Stocks", value: data.stocks.length, tone: styles.radarQuiet },
                  ].map((item) => (
                    <View key={item.label} style={[styles.radarCard, item.tone]}>
                      <Text style={styles.radarValue}>{item.value}</Text>
                      <Text style={styles.radarLabel}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </Reveal>

              <Reveal delay={60}>
                <SectionHeader title="Data Trust" note="Provider coverage is still partial, so this panel shows what is real, delayed, or falling back to mock." />
                <Card>
                  <View style={styles.dualDenseGrid}>
                    <DenseStat label="Provider" value={`${snapshotDiagnostics.provider}`} tone="strong" />
                    <DenseStat label="Mock fallback" value={`${snapshotDiagnostics.mock}`} tone={snapshotDiagnostics.mock > 0 ? "risk" : "neutral"} />
                    <DenseStat label="Delayed" value={`${snapshotDiagnostics.delayed}`} />
                    <DenseStat label="Partial / unavailable" value={`${snapshotDiagnostics.partial + snapshotDiagnostics.unavailable + snapshotDiagnostics.stale}`} tone={snapshotDiagnostics.partial + snapshotDiagnostics.unavailable + snapshotDiagnostics.stale > 0 ? "risk" : "neutral"} />
                  </View>
                  <Text style={styles.metaLine}>
                    Price/trend/relative-strength metrics are the current real-data slice. Earnings, news, valuation, and quality are still partial or deferred until the next provider expansions land.
                  </Text>
                </Card>
              </Reveal>

              <Reveal delay={80}>
                <SectionHeader title="Needs Review By Stock" note="Home is grouped by stock so one name does not get scattered across multiple monitor cards." />
                <View style={styles.stack}>
                  {homeUrgentStocks.length === 0 ? (
                    <Card>
                      <Text style={styles.cardBody}>No stocks are in the urgent review bucket right now.</Text>
                    </Card>
                  ) : (
                    homeUrgentStocks.slice(0, 4).map((item) => (
                      <HomeStockGroupCard
                        key={item.stock.id}
                        item={item}
                        recipes={data.recipes}
                        onOpenStock={() => openStockContext({ stockId: item.stock.id })}
                      />
                    ))
                  )}
                </View>
              </Reveal>

              <Reveal delay={120}>
                <SectionHeader title="Opportunity Stocks" note="Stocks that are forming but not yet urgent." />
                <View style={styles.stack}>
                  {homeOpportunityStocks.slice(0, 3).map((item) => (
                    <HomeStockGroupCard
                      key={item.stock.id}
                      item={item}
                      recipes={data.recipes}
                      onOpenStock={() => openStockContext({ stockId: item.stock.id })}
                    />
                  ))}
                  {homeOpportunityStocks.length === 0 ? (
                    <Card>
                      <Text style={styles.cardBody}>No stocks are in the opportunity-forming bucket right now.</Text>
                    </Card>
                  ) : null}
                </View>
              </Reveal>

              <Reveal delay={160}>
                <SectionHeader title="Stale Thesis Reviews" note="Stocks whose Eyes should be revisited soon even without a fresh alert." />
                <View style={styles.stack}>
                  {homeStaleReviewStocks.slice(0, 3).map((item) => (
                    <HomeStockGroupCard
                      key={item.stock.id}
                      item={item}
                      recipes={data.recipes}
                      onOpenStock={() => openStockContext({ stockId: item.stock.id, stockTab: "Notes" })}
                    />
                  ))}
                  {homeStaleReviewStocks.length === 0 ? (
                    <Card>
                      <Text style={styles.cardBody}>No stale thesis reviews are currently flagged.</Text>
                    </Card>
                  ) : null}
                </View>
              </Reveal>
            </>
          ) : null}

          {tab === "Stocks" ? (
            <>
              <Reveal>
                <SectionHeader
                  title="Stocks"
                  note="Search first, select a stock, then inspect the same visual parameter grid every time."
                />
                <Card highlighted>
                  <Text style={styles.inputLabel}>Search stocks</Text>
                  <Input
                    value={stockSearch}
                    onChangeText={setStockSearch}
                    placeholder="Search ticker, company, or thesis"
                    autoCapitalize="none"
                  />
                  <Text style={styles.inputLabel}>Filter</Text>
                  <HorizontalChoice options={stockFilters} value={stockFilter} onSelect={setStockFilter} />
                  <View style={styles.metaRow}>
                    <MetaPill label={`${filteredStockDirectory.length} results`} />
                    <MetaPill label={`${data.stocks.length} tracked stocks`} />
                  </View>
                </Card>
              </Reveal>

              <Reveal delay={40}>
                <SectionHeader title="Stock Directory" note="Select a stock to open its dedicated workspace." />
                {recentStocks.length > 0 ? (
                  <View style={styles.recentStockStrip}>
                    <Text style={styles.inputLabel}>Recent</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>
                      {recentStocks.map((item) => (
                        <Pressable
                          key={`recent-${item.stock.id}`}
                          onPress={() => openStockContext({ stockId: item.stock.id })}
                          style={[styles.selectChip, selectedStockSummary?.stock.id === item.stock.id ? styles.selectChipActive : null]}
                        >
                          <Text style={[styles.selectChipTitle, selectedStockSummary?.stock.id === item.stock.id ? styles.selectChipTitleActive : null]}>
                            {item.stock.symbol}
                          </Text>
                          <Text style={[styles.selectChipSubtitle, selectedStockSummary?.stock.id === item.stock.id ? styles.selectChipSubtitleActive : null]}>
                            {item.dominantEye?.lastEvaluation?.currentState ?? "Recent"}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
                <View style={styles.stockGrid}>
                  {filteredStockDirectory.slice(0, 8).map((item) => (
                    <Pressable
                      key={item.stock.id}
                      onPress={() => openStockContext({ stockId: item.stock.id })}
                      style={styles.stockGridItem}
                    >
                      <Card highlighted={selectedStockSummary?.stock.id === item.stock.id}>
                        <View style={styles.inlineBetween}>
                          <View style={styles.flexOne}>
                            <Text style={styles.cardEyebrow}>{item.stock.name}</Text>
                            <Text style={styles.alertTitle}>{item.stock.symbol}</Text>
                          </View>
                          <Text style={stateTone(item.dominantEye?.lastEvaluation?.currentState)}>
                            {item.dominantEye?.lastEvaluation?.currentState ?? "Unwatched"}
                          </Text>
                        </View>
                        <Text style={styles.cardBody}>{item.stock.thesis}</Text>
                        {item.snapshot ? (
                          <View style={styles.compactMetricRow}>
                            <Text style={styles.compactMetricText}>${item.snapshot.price.toFixed(2)}</Text>
                            <Text style={styles.compactMetricText}>{item.snapshot.drawdownPct}%</Text>
                            <Text style={styles.compactMetricText}>{item.snapshot.freshness}</Text>
                          </View>
                        ) : (
                          <Text style={styles.metaLine}>No snapshot loaded yet.</Text>
                        )}
                      </Card>
                    </Pressable>
                  ))}
                </View>
              </Reveal>

              <Reveal delay={60}>
                <SectionHeader title="Add Stock" note="Keep the stock universe intentional and searchable." />
                <Card>
                  <View style={styles.dualColumn}>
                    <View style={styles.evidenceColumn}>
                      <Text style={styles.inputLabel}>Ticker</Text>
                      <Input
                        value={stockForm.symbol}
                        onChangeText={(symbol) => setStockForm((current) => ({ ...current, symbol }))}
                        placeholder="Ticker symbol"
                        autoCapitalize="characters"
                      />
                    </View>
                    <View style={styles.evidenceColumn}>
                      <Text style={styles.inputLabel}>Company</Text>
                      <Input
                        value={stockForm.name}
                        onChangeText={(name) => setStockForm((current) => ({ ...current, name }))}
                        placeholder="Company name"
                      />
                    </View>
                  </View>
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
                      if (!stockForm.symbol.trim()) return;
                      void actions.addStock(stockForm);
                      setStockForm({ symbol: "", name: "", thesis: "" });
                    }}
                  />
                </Card>
              </Reveal>

              {selectedStockSummary ? (
                <>
                  <Reveal delay={80}>
                    <SectionHeader
                      title={`${selectedStockSummary.stock.symbol} Workspace`}
                      note="Summary, parameter grid, recipe logic, and notes stay separate so the view does not collapse into one endless surface."
                    />
                    <HorizontalChoice options={stockWorkspaceTabs} value={stockWorkspaceTab} onSelect={setStockWorkspaceTab} />
                  </Reveal>

                  {stockWorkspaceTab === "Summary" ? (
                    <Reveal delay={100}>
                      <Card highlighted>
                        <View style={styles.inlineBetween}>
                          <View style={styles.flexOne}>
                            <Text style={styles.cardEyebrow}>{selectedStockSummary.stock.name}</Text>
                            <Text style={styles.cardTitle}>{selectedStockSummary.stock.symbol}</Text>
                            <Text style={styles.cardBody}>{selectedStockSummary.stock.thesis}</Text>
                          </View>
                          <Text style={stateTone(selectedStockSummary.dominantEye?.lastEvaluation?.currentState)}>
                            {selectedStockSummary.dominantEye?.lastEvaluation?.currentState ?? "No eye state"}
                          </Text>
                        </View>
                        {selectedStockSummary.snapshot ? (
                          <StockSparkline
                            price={selectedStockSummary.snapshot.price}
                            drawdownPct={selectedStockSummary.snapshot.drawdownPct}
                            stabilizationScore={selectedStockSummary.snapshot.stabilizationScore}
                          />
                        ) : null}
                        <View style={styles.dualDenseGrid}>
                          <DenseStat label="Price" value={selectedStockSummary.snapshot ? `$${selectedStockSummary.snapshot.price.toFixed(2)}` : "No feed"} tone="strong" />
                          <DenseStat label="Setup Strength" value={selectedStockSummary.dominantEye?.lastEvaluation?.setupStrength ?? "Low"} />
                          <DenseStat label="Action Urgency" value={selectedStockSummary.dominantEye?.lastEvaluation?.actionUrgency ?? "Wait"} />
                          <DenseStat label="Data Quality" value={selectedStockSummary.snapshot?.freshness ?? "Unavailable"} tone={selectedStockSummary.snapshot?.isMock ? "risk" : "neutral"} />
                        </View>
                        <View style={styles.analysisActionRow}>
                          <Button label="Open Visual Analysis" onPress={() => setStockWorkspaceTab("Visual Analysis")} />
                          <Button label="Open Recipe Map" tone="secondary" onPress={() => setStockWorkspaceTab("Recipe Map")} />
                          <Button
                            label="Create / Apply Eye"
                            tone="ghost"
                            onPress={() => {
                              setEyeForm((current) => ({
                                ...current,
                                stockId: selectedStockSummary.stock.id,
                                thesisSnapshot: current.thesisSnapshot || selectedStockSummary.stock.thesis,
                              }));
                              setRecentStockIds((current) => [selectedStockSummary.stock.id, ...current.filter((id) => id !== selectedStockSummary.stock.id)].slice(0, 6));
                              setEyeWorkspaceTab("Create Eye");
                              setTab("Eyes");
                            }}
                          />
                        </View>
                        {selectedStockWhatChanged.length > 0 ? (
                          <WhatChangedPanel title="What changed on this stock" items={selectedStockWhatChanged} />
                        ) : null}
                      </Card>
                    </Reveal>
                  ) : null}

                  {stockWorkspaceTab === "Visual Analysis" ? (
                    <Reveal delay={100}>
                      <Card highlighted>
                        <Text style={styles.cardEyebrow}>Visual Analysis</Text>
                        <Text style={styles.cardTitle}>Consistent parameter grid for {selectedStockSummary.stock.symbol}</Text>
                        <Text style={styles.cardBody}>
                          One continuous metric board for this stock. Tap any tile for details. Provider-backed and mock fallback data stay labeled.
                        </Text>

                        <Text style={styles.inputLabel}>Recipe filter</Text>
                        <HorizontalChoice options={selectedStockRecipeOptions} value={analysisRecipeFilter} onSelect={setAnalysisRecipeFilter} />

                        <View style={styles.dualColumn}>
                          <View style={styles.evidenceColumn}>
                            <Text style={styles.inputLabel}>Benchmark</Text>
                            <HorizontalChoice options={analysisBenchmarks} value={analysisBenchmark} onSelect={setAnalysisBenchmark} />
                          </View>
                          <View style={styles.evidenceColumn}>
                            <Text style={styles.inputLabel}>Lookback</Text>
                            <HorizontalChoice options={analysisLookbacks} value={analysisLookback} onSelect={setAnalysisLookback} />
                          </View>
                        </View>

                        <View style={styles.dualColumn}>
                          <View style={styles.evidenceColumn}>
                            <Text style={styles.inputLabel}>Status</Text>
                            <HorizontalChoice options={analysisStatusFilters} value={analysisStatusFilter} onSelect={setAnalysisStatusFilter} />
                          </View>
                          <View style={styles.evidenceColumn}>
                            <Text style={styles.inputLabel}>Density</Text>
                            <HorizontalChoice options={analysisDensityOptions} value={analysisDensity} onSelect={setAnalysisDensity} />
                          </View>
                        </View>

                        <View style={styles.metaRow}>
                          <MetaPill label={`Data ${selectedStockSummary.snapshot?.freshness ?? "Unavailable"}`} />
                          <MetaPill label={`Filter ${analysisRecipeFilter}`} />
                          <MetaPill label={`Benchmark ${analysisBenchmark}`} />
                        </View>

                        <Text style={styles.inputLabel}>Review note</Text>
                        <Input
                          value={analysisNote}
                          onChangeText={setAnalysisNote}
                          placeholder="What changed since the last review?"
                          multiline
                        />

                        <View style={styles.analysisActionRow}>
                          <Button
                            label="Mark Thesis Reviewed"
                            onPress={() =>
                              void actions.markEyesReviewed({
                                stockId: selectedStockSummary.stock.id,
                                recipeId:
                                  analysisRecipeFilter === "All Recipes" ? undefined : selectedStockFilteredEyes[0]?.recipeId,
                              })
                            }
                          />
                          <Button
                            label="Recipe Preview"
                            tone="secondary"
                            onPress={() => {
                              setPreviewStockId(selectedStockSummary.stock.id);
                              setRecentStockIds((current) => [selectedStockSummary.stock.id, ...current.filter((id) => id !== selectedStockSummary.stock.id)].slice(0, 6));
                              setRecipeWorkspaceTab("Preview");
                              setTab("Recipes");
                            }}
                          />
                          <Button
                            label="Decision Log"
                            tone="ghost"
                            onPress={() => {
                              setDecisionForm((current) => ({
                                ...current,
                                eyeId: selectedStockFilteredEyes[0]?.id ?? selectedStockEyes[0]?.id ?? current.eyeId,
                                note:
                                  analysisNote.trim() ||
                                  `Review note for ${selectedStockSummary.stock.symbol}: visual analysis reviewed.`,
                              }));
                              setRecentStockIds((current) => [selectedStockSummary.stock.id, ...current.filter((id) => id !== selectedStockSummary.stock.id)].slice(0, 6));
                              setJournalWorkspaceTab("Log Decision");
                              setTab("Journal");
                            }}
                          />
                        </View>
                      </Card>

                      <View style={styles.stack}>
                        {selectedStockAnalysisCards.length > 0 ? (
                          <View style={analysisDensity === "Compact" ? styles.stockAnalysisBoard : styles.stack}>
                            {selectedStockAnalysisCards.map((card) => (
                              <View
                                key={`stock-card-${card.id}`}
                                style={analysisDensity === "Compact" ? styles.stockAnalysisBoardItem : undefined}
                              >
                                <EvidenceCardView card={card} compact={analysisDensity === "Compact"} />
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Card>
                            <Text style={styles.cardBody}>No parameters match the current filters.</Text>
                          </Card>
                        )}
                      </View>
                    </Reveal>
                  ) : null}

                  {stockWorkspaceTab === "Recipe Map" ? (
                    <Reveal delay={100}>
                      <SectionHeader title="Recipe Condition Map" note="See how each active Eye currently interprets this stock." />
                      <View style={styles.stack}>
                        {selectedStockRecipeMapEyes.length === 0 ? (
                          <Card>
                            <Text style={styles.cardBody}>No active Eyes are attached to this stock yet.</Text>
                          </Card>
                        ) : (
                          selectedStockRecipeMapEyes.map((eye) => {
                            const recipe = data.recipes.find((item) => item.id === eye.recipeId);
                            return recipe ? (
                              <RecipeConditionMapCard key={eye.id} eye={eye} recipe={recipe} stock={selectedStockSummary.stock} />
                            ) : null;
                          })
                        )}
                      </View>
                      {selectedStockWhatChanged.length > 0 ? (
                        <WhatChangedPanel title="Stock-level change summary" items={selectedStockWhatChanged} />
                      ) : null}
                    </Reveal>
                  ) : null}

                  {stockWorkspaceTab === "Notes" ? (
                    <Reveal delay={100}>
                      <Card>
                        <Text style={styles.cardEyebrow}>Notes & Decisions</Text>
                        <Text style={styles.cardTitle}>{selectedStockSummary.stock.symbol} thesis memory</Text>
                        <Text style={styles.cardBody}>{selectedStockSummary.stock.thesis}</Text>
                        <View style={styles.metaRow}>
                          <MetaPill label={`${selectedStockSummary.eyes.length} eyes`} />
                          <MetaPill label={`${selectedStockSummary.decisions.length} decisions`} />
                          <MetaPill label={`${selectedStockSummary.openAlerts.length} open alerts`} />
                        </View>
                        <Text style={styles.inputLabel}>Current review note</Text>
                        <Input value={analysisNote} onChangeText={setAnalysisNote} placeholder="Capture what changed in the thesis." multiline />
                        <View style={styles.analysisActionRow}>
                          <Button
                            label="Log This Note"
                            onPress={() => {
                              setDecisionForm((current) => ({
                                ...current,
                                eyeId: selectedStockFilteredEyes[0]?.id ?? selectedStockEyes[0]?.id ?? current.eyeId,
                                note: analysisNote.trim() || current.note,
                              }));
                              setJournalWorkspaceTab("Log Decision");
                              setTab("Journal");
                            }}
                          />
                          <Button label="Visual Analysis" tone="secondary" onPress={() => setStockWorkspaceTab("Visual Analysis")} />
                        </View>
                      </Card>

                      <View style={styles.stack}>
                        {selectedStockSummary.decisions.slice(0, 6).map((decision) => (
                          <Card key={decision.id}>
                            <Text style={styles.alertTitle}>{decision.action}</Text>
                            <Text style={styles.cardBody}>{decision.note}</Text>
                            <Text style={styles.metaLine}>
                              {decision.stateAtDecision ?? "No state snapshot"} · {decision.dataQuality ?? "No data note"} · {formatDate(decision.createdAt)}
                            </Text>
                          </Card>
                        ))}
                      </View>
                    </Reveal>
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}

          {tab === "Recipes" ? (
            <>
              <Reveal>
                <SectionHeader title="Recipes" note="Recipe authoring, preview, and library stay here instead of leaking into stock review screens." />
                <HorizontalChoice options={recipeWorkspaceTabs} value={recipeWorkspaceTab} onSelect={setRecipeWorkspaceTab} />
              </Reveal>

              {recipeWorkspaceTab === "Builder" ? (
                <>
                  <Reveal delay={40}>
                    <Card highlighted>
                      <Text style={styles.formTitle}>Recipe Builder</Text>
                      <Text style={styles.formNote}>Build guided investment logic through typed controls and role-based conditions.</Text>
                      <Text style={styles.inputLabel}>Builder section</Text>
                      <HorizontalChoice options={recipeBuilderSteps} value={recipeBuilderStep} onSelect={setRecipeBuilderStep} />
                      {recipeBuilderStep === "Purpose" ? (
                        <>
                          <Text style={styles.inputLabel}>Recipe name</Text>
                          <Input value={recipeForm.name} onChangeText={(name) => setRecipeForm((current) => ({ ...current, name }))} placeholder="Temporary Bargain Sale" />
                          <Text style={styles.inputLabel}>Opportunity type</Text>
                          <HorizontalChoice options={opportunityTypes} value={recipeForm.opportunityType} onSelect={(opportunityType) => setRecipeForm((current) => ({ ...current, opportunityType }))} />
                          <Text style={styles.inputLabel}>Time horizon</Text>
                          <HorizontalChoice options={timeHorizons} value={recipeForm.timeHorizon} onSelect={(timeHorizon) => setRecipeForm((current) => ({ ...current, timeHorizon }))} />
                          <Text style={styles.inputLabel}>Primary use case</Text>
                          <HorizontalChoice options={useCaseOptions} value={recipeForm.intendedUseCase} onSelect={(intendedUseCase) => setRecipeForm((current) => ({ ...current, intendedUseCase }))} />
                          <Text style={styles.inputLabel}>Purpose</Text>
                          <Input value={recipeForm.purpose} onChangeText={(purpose) => setRecipeForm((current) => ({ ...current, purpose }))} placeholder="What opportunity should this logic surface?" multiline />
                        </>
                      ) : null}
                      {recipeBuilderStep === "Risk & Alerts" ? (
                        <>
                          <View style={styles.dualDenseGrid}>
                            <DenseStat label="Alert cooldown" value={`${recipeForm.alertCooldownHours} hours`} tone="strong" />
                            <DenseStat label="Risk posture" value={draftConditions.filter((condition) => condition.kind === "disqualifier" || condition.kind === "negative").length ? "Defined" : "Light"} />
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
                            <DenseStat label="Review cadence" value={`${recipeForm.reviewCadenceDays} days`} tone="strong" />
                            <DenseStat label="Outcome tags" value={`${draftConditions.length} linked rules`} />
                          </View>
                          <Text style={styles.inputLabel}>Review cadence</Text>
                          <HorizontalChoice options={reviewCadenceOptions.map(String)} value={String(recipeForm.reviewCadenceDays)} onSelect={(value) => setRecipeForm((current) => ({ ...current, reviewCadenceDays: Number(value) }))} />
                          <Text style={styles.inputLabel}>Notes</Text>
                          <Input value={recipeForm.notes} onChangeText={(notes) => setRecipeForm((current) => ({ ...current, notes }))} placeholder="Review prompts and what should be learned after decisions" multiline />
                        </>
                      ) : null}
                      {recipeBuilderStep === "Logic" ? (
                        <Text style={styles.metaLine}>
                          Use the condition library below to define eligibility, support, timing, warnings, and hard disqualifiers for this recipe.
                        </Text>
                      ) : null}
                    </Card>
                  </Reveal>

                  {recipeBuilderStep === "Logic" ? (
                    <Reveal delay={60}>
                      <Card>
                        <Text style={styles.formTitle}>Condition Library</Text>
                        <Text style={styles.formNote}>Translate evidence into eligibility, support, risk, and disqualifier roles.</Text>
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
                        <Text style={styles.previewLabel}>Preview</Text>
                        <Text style={styles.previewText}>
                          {selectedTemplate.title}: {selectedTemplate.metricLabel} {conditionBuilder.operator} {formatMetricThreshold(selectedTemplate, conditionBuilder.threshold || selectedTemplate.defaultValue)}
                        </Text>
                        <Text style={styles.previewHint}>{selectedTemplate.description}</Text>
                      </View>
                        <View style={styles.actionRow}>
                          <Button label="Add Condition" onPress={addDraftCondition} />
                          <Button label="Clear Draft" tone="ghost" onPress={() => setDraftConditions([])} />
                        </View>
                      </Card>
                    </Reveal>
                  ) : null}

                  <Reveal delay={80}>
                    <SectionHeader title="Draft Conditions" note="Review the current recipe logic before saving." />
                    <View style={styles.stack}>
                      {draftConditions.length === 0 ? (
                        <Card>
                          <Text style={styles.cardBody}>No conditions added yet.</Text>
                        </Card>
                      ) : (
                        draftConditions.map((condition) => (
                          <Card key={condition.id}>
                            <View style={styles.inlineBetween}>
                              <View style={styles.flexOne}>
                                <Text style={[styles.kindPill, conditionKindTone(condition.kind)]}>{condition.kind}</Text>
                                <Text style={styles.cardBody}>{condition.label}</Text>
                              </View>
                              <Button label="Remove" tone="ghost" onPress={() => setDraftConditions((current) => current.filter((item) => item.id !== condition.id))} />
                            </View>
                          </Card>
                        ))
                      )}
                    </View>
                    <View style={styles.actionRow}>
                      <Button label="Save Recipe" onPress={() => void saveRecipe()} />
                      <Button label="Open Preview" tone="secondary" onPress={() => setRecipeWorkspaceTab("Preview")} />
                    </View>
                  </Reveal>
                </>
              ) : null}

              {recipeWorkspaceTab === "Preview" ? (
                <Reveal delay={40}>
                  <SectionHeader title="Recipe Preview" note="Apply the current draft to a selected stock before saving it." />
                  <Card highlighted>
                    <Text style={styles.inputLabel}>Preview stock</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>
                      {data.stocks.map((stock) => (
                        <Pressable key={stock.id} onPress={() => setPreviewStockId(stock.id)} style={[styles.selectChip, previewStockId === stock.id ? styles.selectChipActive : null]}>
                          <Text style={[styles.selectChipTitle, previewStockId === stock.id ? styles.selectChipTitleActive : null]}>{stock.symbol}</Text>
                          <Text style={[styles.selectChipSubtitle, previewStockId === stock.id ? styles.selectChipSubtitleActive : null]}>{stock.name}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>

                    {previewRecipe && previewEvaluation && previewStock ? (
                      <>
                        <WhyNowPanel title="Draft result" body={previewEvaluation.whyNow} state={previewEvaluation.currentState} recipeVersion={`${previewRecipe.name} v${previewRecipe.version}`} />
                        <View style={styles.dualColumn}>
                          <View style={styles.evidenceColumn}>
                            <Text style={styles.columnTitle}>Preview support</Text>
                            {(previewEvaluation.supportingEvidence ?? []).slice(0, 4).map((item) => (
                              <Text key={item} style={styles.listLine}>+ {item}</Text>
                            ))}
                          </View>
                          <View style={styles.evidenceColumn}>
                            <Text style={styles.columnTitle}>Preview contradictions</Text>
                            {(previewEvaluation.contradictingEvidence ?? []).slice(0, 4).map((item) => (
                              <Text key={item} style={styles.listLine}>- {item}</Text>
                            ))}
                          </View>
                        </View>
                        <Text style={styles.previewDisclosure}>Preview uses adapter-style sample data and must not be mistaken for live market data.</Text>
                        {previewEvidenceGroups.map((group) => (
                          <EvidenceGroupView key={`preview-${group.key}`} group={group} defaultExpanded={group.key === "supporting-evidence"} />
                        ))}
                      </>
                    ) : (
                      <Text style={styles.cardBody}>Add draft conditions first to see a preview.</Text>
                    )}
                  </Card>
                </Reveal>
              ) : null}

              {recipeWorkspaceTab === "Library" ? (
                <Reveal delay={40}>
                  <SectionHeader title="Recipe Library" note="Saved logic stays readable and reusable." />
                  <View style={styles.stack}>
                    {data.recipes.map((recipe) => (
                      <Card key={recipe.id}>
                        <Text style={styles.cardEyebrow}>Version {recipe.version}</Text>
                        <Text style={styles.cardTitle}>{recipe.name}</Text>
                        <Text style={styles.cardBody}>{recipe.purpose}</Text>
                        <View style={styles.dualDenseGrid}>
                          <DenseStat label="Type" value={recipe.opportunityType ?? "General"} tone="strong" />
                          <DenseStat label="Horizon" value={recipe.timeHorizon || "Unset"} />
                          <DenseStat label="Cadence" value={`${recipe.reviewConfig?.cadenceDays ?? 14}d`} />
                          <DenseStat label="Conditions" value={String(recipe.conditions.length)} />
                        </View>
                        <View style={styles.metaRow}>
                          <MetaPill label={recipe.intendedUseCase || "No use case"} />
                          <MetaPill label={`${recipe.alertConfig?.cooldownHours ?? 24}h cooldown`} />
                        </View>
                      </Card>
                    ))}
                  </View>
                </Reveal>
              ) : null}
            </>
          ) : null}

          {tab === "Eyes" ? (
            <>
              <Reveal>
                <SectionHeader title="Eyes" note="Eyes are the recipe-applied monitors. Keep monitor review separate from raw stock inspection." />
                <HorizontalChoice options={eyeWorkspaceTabs} value={eyeWorkspaceTab} onSelect={setEyeWorkspaceTab} />
              </Reveal>

              {eyeWorkspaceTab === "Active Eyes" ? (
                <>
                  {selectedEye ? (
                    <Reveal delay={40}>
                      <Card highlighted>
                        <Text style={styles.cardEyebrow}>Focused Eye</Text>
                        <Text style={styles.cardTitle}>{eyeLine(selectedEye, data.stocks, data.recipes)}</Text>
                        <Text style={styles.cardBody}>{selectedEye.thesisSnapshot}</Text>
                        <View style={styles.metaRow}>
                          <MetaPill label={selectedEye.lastEvaluation?.actionUrgency ?? "Wait"} />
                          <MetaPill label={`Setup ${selectedEye.lastEvaluation?.setupStrength ?? "Low"}`} />
                          <MetaPill label={selectedEyeSnapshot?.freshness ?? "No feed"} />
                        </View>
                        {selectedEye.lastEvaluation && selectedEyeRecipe ? (
                          <>
                            <WhyNowPanel
                              title="Why now"
                              body={selectedEye.lastEvaluation.whyNow}
                              state={selectedEye.lastEvaluation.currentState}
                              recipeVersion={`${selectedEyeRecipe.name} v${selectedEyeRecipe.version}`}
                            />
                            <WhatChangedPanel title="What changed" items={selectedEyeWhatChanged} />
                            <View style={styles.actionRow}>
                              <Button
                                label="Open Stock"
                                onPress={() =>
                                  openStockContext({
                                    stockId: selectedEye.stockId,
                                    eyeId: selectedEye.id,
                                  })
                                }
                              />
                              <Button
                                label="Decision Log"
                                tone="secondary"
                                onPress={() => {
                                  setDecisionForm((current) => ({ ...current, eyeId: selectedEye.id }));
                                  setJournalWorkspaceTab("Log Decision");
                                  setTab("Journal");
                                }}
                              />
                            </View>
                          </>
                        ) : null}
                      </Card>
                    </Reveal>
                  ) : null}

                  <Reveal delay={60}>
                    <SectionHeader title="Active Monitor List" note="Pick a monitor, then branch to stock analysis or decision logging." />
                    <View style={styles.stack}>
                      {eyesSorted.map((eye) => (
                        <Pressable
                          key={eye.id}
                          onPress={() =>
                            openStockContext({
                              stockId: eye.stockId,
                              eyeId: eye.id,
                              target: "Eyes",
                            })
                          }
                        >
                          <Card highlighted={selectedEye?.id === eye.id}>
                            <View style={styles.inlineBetween}>
                              <View style={styles.flexOne}>
                                <Text style={styles.cardEyebrow}>{stockLabel(data.stocks, eye.stockId)}</Text>
                                <Text style={styles.alertTitle}>{recipeLabel(data.recipes, eye.recipeId)}</Text>
                                <Text style={styles.cardBody}>{eye.thesisSnapshot}</Text>
                              </View>
                              <Text style={stateTone(eye.lastEvaluation?.currentState)}>
                                {eye.lastEvaluation?.currentState ?? "Not Evaluated"}
                              </Text>
                            </View>
                            <View style={styles.dualDenseGrid}>
                              <DenseStat label="Entry zone" value={eye.plannedEntryLow !== undefined && eye.plannedEntryHigh !== undefined ? `$${eye.plannedEntryLow} to $${eye.plannedEntryHigh}` : "Unset"} />
                              <DenseStat label="Last review" value={eye.lastReviewedAt ? formatShortDate(eye.lastReviewedAt) : "Unset"} />
                            </View>
                          </Card>
                        </Pressable>
                      ))}
                    </View>
                  </Reveal>
                </>
              ) : null}

              {eyeWorkspaceTab === "Create Eye" ? (
                <Reveal delay={40}>
                  <SectionHeader title="Create Eye" note="Bind a stock to a recipe with entry zone, review date, and invalidation context." />
                  <Card highlighted>
                    <Text style={styles.inputLabel}>Stock</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>
                      {data.stocks.map((stock) => (
                        <Pressable key={stock.id} onPress={() => setEyeForm((current) => ({ ...current, stockId: stock.id }))} style={[styles.selectChip, eyeForm.stockId === stock.id ? styles.selectChipActive : null]}>
                          <Text style={[styles.selectChipTitle, eyeForm.stockId === stock.id ? styles.selectChipTitleActive : null]}>{stock.symbol}</Text>
                          <Text style={[styles.selectChipSubtitle, eyeForm.stockId === stock.id ? styles.selectChipSubtitleActive : null]}>{stock.name}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>

                    <Text style={styles.inputLabel}>Recipe</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>
                      {data.recipes.map((recipe) => (
                        <Pressable key={recipe.id} onPress={() => setEyeForm((current) => ({ ...current, recipeId: recipe.id }))} style={[styles.selectChip, eyeForm.recipeId === recipe.id ? styles.selectChipActive : null]}>
                          <Text style={[styles.selectChipTitle, eyeForm.recipeId === recipe.id ? styles.selectChipTitleActive : null]}>{recipe.name}</Text>
                          <Text style={[styles.selectChipSubtitle, eyeForm.recipeId === recipe.id ? styles.selectChipSubtitleActive : null]}>{recipe.timeHorizon}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>

                    <Text style={styles.inputLabel}>Specific thesis snapshot</Text>
                    <Input value={eyeForm.thesisSnapshot} onChangeText={(thesisSnapshot) => setEyeForm((current) => ({ ...current, thesisSnapshot }))} placeholder="Why does this stock under this recipe deserve repeated attention?" multiline />
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
                    <View style={styles.dualDenseGrid}>
                      <DenseStat label="Review stamp" value={formatShortDate(isoDateDaysAgo(eyeForm.lastReviewedDaysAgo))} />
                      <DenseStat label="Entry band" value={eyeForm.plannedEntryLow && eyeForm.plannedEntryHigh ? `$${eyeForm.plannedEntryLow} to $${eyeForm.plannedEntryHigh}` : "Not set"} tone="strong" />
                    </View>
                    <Button
                      label="Create Eye"
                      onPress={() => {
                        if (!eyeForm.stockId || !eyeForm.recipeId || !eyeForm.thesisSnapshot.trim()) return;
                        void actions.addEye({
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
                        setEyeWorkspaceTab("Active Eyes");
                      }}
                    />
                  </Card>
                </Reveal>
              ) : null}
            </>
          ) : null}

          {tab === "Alerts" ? (
            <>
              <Reveal>
                <SectionHeader title="Alerts" note="Alerts answer what happened, why now, and what deserves review first." />
                <HorizontalChoice options={alertWorkspaceTabs} value={alertWorkspaceTab} onSelect={setAlertWorkspaceTab} />
              </Reveal>

              {alertWorkspaceTab === "Queue" ? (
                <Reveal delay={40}>
                  <SectionHeader title="Queue" note="Alerts are grouped by stock first so related signals stay together." />
                  <View style={styles.stack}>
                    {groupedAlertQueue.length === 0 ? (
                      <Card>
                        <Text style={styles.cardBody}>No alerts are open right now.</Text>
                      </Card>
                    ) : (
                      groupedAlertQueue.map((group) => (
                        <Card key={`alert-group-${group.stock.id}`} highlighted={selectedStockId === group.stock.id}>
                          <View style={styles.inlineBetween}>
                            <View style={styles.flexOne}>
                              <Text style={styles.cardEyebrow}>{group.stock.name}</Text>
                              <Text style={styles.cardTitle}>{group.stock.symbol}</Text>
                              <Text style={styles.stockGroupSummary}>
                                {group.dominantEye?.lastEvaluation?.whyNow ?? "Review grouped signals on this stock."}
                              </Text>
                            </View>
                            <View style={styles.priorityStack}>
                              <View style={priorityTone(group.highestPriority)}>
                                <Text style={styles.priorityBadgeText}>{group.highestPriority}</Text>
                              </View>
                              <Text style={styles.timestampText}>{group.openAlerts.length} alerts</Text>
                            </View>
                          </View>

                          <View style={styles.metaRow}>
                            {Object.entries(group.groupedAlerts).map(([recipeName, alerts]) => (
                              <MetaPill key={`${group.stock.id}-${recipeName}`} label={`${recipeName} · ${alerts.length}`} />
                            ))}
                          </View>

                          <View style={styles.stack}>
                            {group.openAlerts.slice(0, 3).map((alert) => {
                              const eye = group.eyes.find((item) => item.id === alert.eyeId);
                              return (
                                <Pressable
                                  key={alert.id}
                                  onPress={() =>
                                    openStockContext({
                                      stockId: group.stock.id,
                                      eyeId: eye?.id,
                                      alertId: alert.id,
                                      target: "Alerts",
                                    })
                                  }
                                >
                                  <View style={styles.alertMiniRow}>
                                    <View style={styles.flexOne}>
                                      <Text style={styles.alertMiniTitle}>{alert.title}</Text>
                                      <Text style={styles.alertMiniBody}>{alert.whyNow}</Text>
                                    </View>
                                    <View style={styles.priorityStack}>
                                      <View style={priorityTone(alert.priority)}>
                                        <Text style={styles.priorityBadgeText}>{alert.priority}</Text>
                                      </View>
                                      <Text style={styles.timestampText}>{formatDate(alert.createdAt)}</Text>
                                    </View>
                                  </View>
                                  <View style={styles.actionRow}>
                                    <Button label="Entered" onPress={() => void quickDecision(alert, "Entered")} />
                                    <Button label="Skipped" tone="secondary" onPress={() => void quickDecision(alert, "Skipped")} />
                                    <Button label="Snooze 24H" tone="secondary" onPress={() => void actions.snoozeAlert(alert.id, 24)} />
                                    <Button label="Reviewed" tone="ghost" onPress={() => void actions.markAlertReviewed(alert.id)} />
                                  </View>
                                </Pressable>
                              );
                            })}
                          </View>

                          <View style={styles.analysisActionRow}>
                            <Button
                              label="Open Stock"
                              onPress={() => openStockContext({ stockId: group.stock.id })}
                            />
                            <Button
                              label="Open Detail"
                              tone="secondary"
                              onPress={() => {
                                const firstAlert = group.openAlerts[0];
                                const firstEye = group.eyes.find((eye) => eye.id === firstAlert?.eyeId);
                                if (!firstAlert) return;
                                openStockContext({
                                  stockId: group.stock.id,
                                  eyeId: firstEye?.id,
                                  alertId: firstAlert.id,
                                  target: "Alerts",
                                });
                              }}
                            />
                          </View>
                        </Card>
                      ))
                    )}
                  </View>
                </Reveal>
              ) : null}

              {alertWorkspaceTab === "Detail" && selectedAlert && selectedAlertEye && selectedAlertRecipe && selectedAlertEvaluation ? (
                <Reveal delay={40}>
                  <SectionHeader title="Alert Detail" note="Visual explanation of the current alert, not just text." />
                  <Card highlighted>
                    <WhyNowPanel title="What happened" body={selectedAlert.whyNow} state={selectedAlertEvaluation.currentState} recipeVersion={`${selectedAlertRecipe.name} v${selectedAlertRecipe.version}`} />
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
                    <View style={styles.analysisActionRow}>
                      <Button label="Snooze 24H" onPress={() => void actions.snoozeAlert(selectedAlert.id, 24)} />
                      <Button label="Useful" tone="secondary" onPress={() => void actions.setAlertFeedback(selectedAlert.id, "Useful")} />
                      <Button label="Not Useful" tone="ghost" onPress={() => void actions.setAlertFeedback(selectedAlert.id, "Not Useful")} />
                    </View>
                  </Card>
                  <View style={styles.stack}>
                    {selectedAlertEvidenceGroups.map((group) => (
                      <EvidenceGroupView key={`alert-${group.key}`} group={group} defaultExpanded={group.key === "supporting-evidence"} />
                    ))}
                  </View>
                </Reveal>
              ) : null}

              {alertWorkspaceTab === "Snoozed" ? (
                <Reveal delay={40}>
                  <SectionHeader title="Snoozed Alerts" note="Temporarily deferred alerts stay visible here with their wake-up time." />
                  <View style={styles.stack}>
                    {snoozedAlerts.length === 0 ? (
                      <Card>
                        <Text style={styles.cardBody}>No alerts are currently snoozed.</Text>
                      </Card>
                    ) : (
                      snoozedAlerts.map((alert) => {
                        const eye = data.eyes.find((item) => item.id === alert.eyeId);
                        return (
                          <Card key={`snoozed-${alert.id}`}>
                            <Text style={styles.cardEyebrow}>{stockLabel(data.stocks, eye?.stockId ?? "")}</Text>
                            <Text style={styles.alertTitle}>{alert.title}</Text>
                            <Text style={styles.cardBody}>{alert.whyNow}</Text>
                            <View style={styles.metaRow}>
                              <MetaPill label={`Until ${alert.snoozedUntil ? formatDate(alert.snoozedUntil) : "unknown"}`} />
                              {alert.usefulness ? <MetaPill label={alert.usefulness} /> : null}
                            </View>
                            <View style={styles.actionRow}>
                              <Button label="Open Detail" onPress={() => {
                                if (!eye) return;
                                openStockContext({ stockId: eye.stockId, eyeId: eye.id, alertId: alert.id, target: "Alerts" });
                                setAlertWorkspaceTab("Detail");
                              }} />
                              <Button label="Unsnooze" tone="secondary" onPress={() => void actions.snoozeAlert(alert.id, -1)} />
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
                <SectionHeader title="Journal" note="Capture decisions while the context is fresh, then review the record later without mixing it into alert triage." />
                <HorizontalChoice options={journalWorkspaceTabs} value={journalWorkspaceTab} onSelect={setJournalWorkspaceTab} />
              </Reveal>

              {journalWorkspaceTab === "Log Decision" ? (
                <Reveal delay={40}>
                  <Card highlighted>
                    <Text style={styles.inputLabel}>Eye</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>
                      {data.eyes.map((eye) => (
                        <Pressable key={eye.id} onPress={() => setDecisionForm((current) => ({ ...current, eyeId: eye.id }))} style={[styles.selectChip, decisionForm.eyeId === eye.id ? styles.selectChipActive : null]}>
                          <Text style={[styles.selectChipTitle, decisionForm.eyeId === eye.id ? styles.selectChipTitleActive : null]}>{stockLabel(data.stocks, eye.stockId)}</Text>
                          <Text style={[styles.selectChipSubtitle, decisionForm.eyeId === eye.id ? styles.selectChipSubtitleActive : null]}>{recipeLabel(data.recipes, eye.recipeId)}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                    <Text style={styles.inputLabel}>Action</Text>
                    <HorizontalChoice options={decisionActions} value={decisionForm.action} onSelect={(action) => setDecisionForm((current) => ({ ...current, action }))} />
                    <Text style={styles.inputLabel}>Why did you act this way?</Text>
                    <Input value={decisionForm.note} onChangeText={(note) => setDecisionForm((current) => ({ ...current, note }))} placeholder="Why did you enter, skip, or revise?" multiline />
                    <Text style={styles.inputLabel}>Main concern</Text>
                    <Input value={decisionForm.concern} onChangeText={(concern) => setDecisionForm((current) => ({ ...current, concern }))} placeholder="What risk mattered most?" multiline />
                    <Text style={styles.inputLabel}>Thesis validity</Text>
                    <HorizontalChoice options={thesisValidityOptions} value={decisionForm.thesisValid} onSelect={(thesisValid) => setDecisionForm((current) => ({ ...current, thesisValid }))} />
                    <Text style={styles.inputLabel}>Timing</Text>
                    <HorizontalChoice options={timingOptions} value={decisionForm.timing} onSelect={(timing) => setDecisionForm((current) => ({ ...current, timing }))} />
                    <Button
                      label="Save Decision"
                      onPress={() => {
                        if (!decisionForm.eyeId || !decisionForm.note.trim()) return;
                        void actions.logDecision(decisionForm);
                        setDecisionForm({
                          eyeId: "",
                          alertId: "",
                          action: "Entered",
                          note: "",
                          concern: "",
                          thesisValid: "Yes",
                          timing: "On Time",
                        });
                        setJournalWorkspaceTab("History");
                      }}
                    />
                  </Card>
                </Reveal>
              ) : null}

              {journalWorkspaceTab === "History" ? (
                <Reveal delay={40}>
                  <SectionHeader title="History" note="Review decisions, state context, and data quality later." />
                  <View style={styles.stack}>
                    {data.decisions.map((decision) => (
                      <Card key={decision.id}>
                        <Text style={styles.alertTitle}>{decision.action} · {decisionTitle(decision.eyeId, data.eyes, data.stocks, data.recipes)}</Text>
                        <Text style={styles.cardBody}>{decision.note}</Text>
                        <View style={styles.compactMetricRow}>
                          <Text style={styles.compactMetricText}>{decision.stateAtDecision ?? "No state snapshot"}</Text>
                          <Text style={styles.compactMetricText}>{decision.dataQuality ?? "No data note"}</Text>
                        </View>
                        <Text style={styles.metaLine}>Concern: {decision.concern || "Not captured"}</Text>
                        <Text style={styles.metaLine}>Thesis {decision.thesisValid} · Timing {decision.timing} · {formatDate(decision.createdAt)}</Text>
                        {data.outcomes.find((outcome) => outcome.decisionId === decision.id) ? (
                          <View style={styles.formulaPanel}>
                            <Text style={styles.formulaTitle}>
                              Outcome · {data.outcomes.find((outcome) => outcome.decisionId === decision.id)?.status ?? "Pending"}
                            </Text>
                            <Text style={styles.formulaBody}>
                              {data.outcomes.find((outcome) => outcome.decisionId === decision.id)?.lesson}
                            </Text>
                            <Text style={styles.formulaMeta}>
                              {data.outcomes.find((outcome) => outcome.decisionId === decision.id)?.recipeSuggestion}
                            </Text>
                          </View>
                        ) : null}
                      </Card>
                    ))}
                  </View>
                </Reveal>
              ) : null}
            </>
          ) : null}
        </ScrollView>

        {fabOpen ? (
          <View pointerEvents="box-none" style={styles.fabMenu}>
            {fabActions.map((action, index) => (
              <Reveal key={action.label} delay={index * 40}>
                <Pressable onPress={action.onPress} style={styles.fabMenuItem}>
                  <Text style={styles.fabMenuText}>{action.label}</Text>
                </Pressable>
              </Reveal>
            ))}
          </View>
        ) : null}

        <Pressable onPress={() => setFabOpen((current) => !current)} style={styles.fabButton}>
          <Text style={styles.fabButtonText}>{fabOpen ? "×" : "+"}</Text>
        </Pressable>

        <View style={styles.bottomNav}>
          {tabs.map((item) => (
            <Pressable
              key={item}
              onPress={() => {
                setFabOpen(false);
                setTab(item);
              }}
              style={styles.navItem}
            >
              <View style={[styles.navIndicator, tab === item ? styles.navIndicatorActive : null]} />
              <Text style={[styles.navLabel, tab === item ? styles.navLabelActive : null]}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const SectionHeader = ({ title, note }: { title: string; note: string }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <Text style={styles.sectionNote}>{note}</Text>
  </View>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f6f8fb",
  },
  frame: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f6f8fb",
  },
  loadingText: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "700",
    fontFamily,
  },
  page: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 140,
    gap: 14,
  },
  card: {
    backgroundColor: "#fbfcfe",
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: "#e5ebf2",
  },
  cardHighlighted: {
    backgroundColor: "#ffffff",
    borderColor: "#d8e2ee",
  },
  heroEyebrow: {
    color: "#5b6b80",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily,
  },
  heroTitle: {
    marginTop: 8,
    color: "#0f172a",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
    fontFamily,
  },
  heroSubtitle: {
    marginTop: 8,
    color: "#5d6b7d",
    fontSize: 15,
    lineHeight: 22,
    fontFamily,
  },
  metricGrid: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricButton: {
    width: "48%",
    minWidth: 150,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e7edf4",
  },
  metricValue: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "800",
    fontFamily,
  },
  metricLabel: {
    marginTop: 4,
    color: "#1e293b",
    fontSize: 13,
    fontWeight: "700",
    fontFamily,
  },
  metricNote: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
    fontFamily,
  },
  summaryRow: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  compactSection: {
    gap: 10,
  },
  sectionHeader: {
    gap: 2,
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
    fontFamily,
  },
  sectionNote: {
    color: "#64748b",
    fontSize: 14,
    lineHeight: 20,
    fontFamily,
  },
  radarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  radarCard: {
    flex: 1,
    minWidth: 100,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  radarCritical: {
    backgroundColor: "#fff5f5",
    borderColor: "#f0d7da",
  },
  radarOpportunity: {
    backgroundColor: "#f2fbf6",
    borderColor: "#d6e9dd",
  },
  radarQuiet: {
    backgroundColor: "#f4f7fb",
    borderColor: "#dde5ee",
  },
  radarValue: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "800",
    fontFamily,
  },
  radarLabel: {
    marginTop: 6,
    color: "#334155",
    fontSize: 13,
    lineHeight: 18,
    fontFamily,
  },
  inlineBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
  },
  flexOne: {
    flex: 1,
  },
  cardEyebrow: {
    color: "#5b6b80",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily,
  },
  cardTitle: {
    marginTop: 6,
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
    fontFamily,
  },
  alertTitle: {
    marginTop: 6,
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    fontFamily,
  },
  cardBody: {
    marginTop: 8,
    color: "#334155",
    fontSize: 15,
    lineHeight: 22,
    fontFamily,
  },
  statePill: {
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: "700",
    fontFamily,
  },
  statePillAttention: {
    color: "#ffffff",
    backgroundColor: "#ef4444",
  },
  statePillOpportunity: {
    color: "#14532d",
    backgroundColor: "#86efac",
  },
  statePillRisk: {
    color: "#991b1b",
    backgroundColor: "#fecaca",
  },
  statePillBroken: {
    color: "#ffffff",
    backgroundColor: "#7f1d1d",
  },
  statePillWatch: {
    color: "#1d4ed8",
    backgroundColor: "#dbeafe",
  },
  statePillInteresting: {
    color: "#155e75",
    backgroundColor: "#cffafe",
  },
  statePillQuiet: {
    color: "#475569",
    backgroundColor: "#e2e8f0",
  },
  chartCard: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#f3f6fa",
    borderWidth: 1,
    borderColor: "#e3e9f1",
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chartTitle: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700",
    fontFamily,
  },
  chartLegend: {
    color: "#64748b",
    fontSize: 12,
    fontFamily,
  },
  chartBars: {
    marginTop: 14,
    height: 104,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  chartBar: {
    flex: 1,
    borderRadius: 2,
    minHeight: 20,
  },
  chartFootnote: {
    marginTop: 12,
    color: "#64748b",
    fontSize: 12,
    fontFamily,
  },
  metaRow: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 5,
    backgroundColor: "#f1f4f8",
  },
  metaPillText: {
    color: "#58677a",
    fontSize: 12,
    fontWeight: "600",
    fontFamily,
  },
  panel: {
    marginTop: 14,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5ebf2",
    backgroundColor: "#f8fafc",
    gap: 8,
  },
  panelLabel: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontFamily,
  },
  panelBody: {
    marginTop: 8,
    color: "#0f172a",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    fontFamily,
  },
  panelBadges: {
    alignItems: "flex-end",
    gap: 8,
  },
  panelList: {
    gap: 6,
  },
  panelListItem: {
    color: "#334155",
    fontSize: 14,
    lineHeight: 20,
    fontFamily,
  },
  dualColumn: {
    marginTop: 16,
    gap: 12,
  },
  evidenceColumn: {
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#f5f7fa",
    borderWidth: 1,
    borderColor: "#e6ebf2",
  },
  columnTitle: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    fontFamily,
  },
  listLine: {
    color: "#334155",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 4,
    fontFamily,
  },
  stack: {
    gap: 10,
  },
  evidenceGroup: {
    marginTop: 16,
    gap: 10,
  },
  evidenceCard: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e4eaf1",
    backgroundColor: "#ffffff",
    gap: 10,
  },
  evidenceCardCompact: {
    minHeight: 210,
    justifyContent: "space-between",
  },
  evidenceCardTitle: {
    color: "#0f172a",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    fontFamily,
  },
  evidenceRole: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    fontFamily,
  },
  evidenceBadgeStack: {
    alignItems: "flex-end",
    gap: 6,
  },
  compactEvidenceFooter: {
    gap: 6,
  },
  compactEvidenceValue: {
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    fontFamily,
  },
  compactEvidenceThreshold: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    fontFamily,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5,
  },
  statusPassed: {
    backgroundColor: "#eaf6ee",
  },
  statusNear: {
    backgroundColor: "#eef6ff",
  },
  statusFailed: {
    backgroundColor: "#f3f4f6",
  },
  statusWarning: {
    backgroundColor: "#fff4e5",
  },
  statusBlocked: {
    backgroundColor: "#fee2e2",
  },
  statusPartial: {
    backgroundColor: "#eef2ff",
  },
  statusUnavailable: {
    backgroundColor: "#e5e7eb",
  },
  statusStale: {
    backgroundColor: "#fef3c7",
  },
  statusMock: {
    backgroundColor: "#e0f2fe",
  },
  statusBadgeText: {
    color: "#0f172a",
    fontSize: 11,
    fontWeight: "800",
    fontFamily,
  },
  freshnessBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5,
  },
  freshnessFresh: {
    backgroundColor: "#eefbf3",
  },
  freshnessDelayed: {
    backgroundColor: "#eef2ff",
  },
  freshnessPartial: {
    backgroundColor: "#fff7ed",
  },
  freshnessUnavailable: {
    backgroundColor: "#f3f4f6",
  },
  freshnessStale: {
    backgroundColor: "#fef3c7",
  },
  freshnessMock: {
    backgroundColor: "#e0f2fe",
  },
  freshnessBadgeText: {
    color: "#334155",
    fontSize: 11,
    fontWeight: "700",
    fontFamily,
  },
  evidenceSummary: {
    color: "#334155",
    fontSize: 14,
    lineHeight: 21,
    fontFamily,
  },
  evidenceMetricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  evidenceRelated: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
    fontFamily,
  },
  thresholdWrap: {
    gap: 8,
  },
  thresholdTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#e8eef5",
    overflow: "hidden",
    position: "relative",
  },
  thresholdMarkerThreshold: {
    position: "absolute",
    top: -3,
    bottom: -3,
    width: 2,
    backgroundColor: "#64748b",
    marginLeft: -1,
  },
  thresholdMarkerCurrent: {
    position: "absolute",
    top: -5,
    bottom: -5,
    width: 4,
    borderRadius: 4,
    backgroundColor: "#0f172a",
    marginLeft: -2,
  },
  entryZoneBand: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: "#dbeafe",
  },
  thresholdLegend: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  thresholdLegendText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
    fontFamily,
  },
  sparklineOverlay: {
    height: 42,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    position: "relative",
    overflow: "hidden",
  },
  sparklineBar: {
    flex: 1,
    borderRadius: 2,
    backgroundColor: "#d7e5f6",
  },
  sparklineBarActive: {
    backgroundColor: "#0f172a",
  },
  sparklineLine: {
    position: "absolute",
    width: 6,
    height: 2,
    marginLeft: -3,
    borderRadius: 999,
    backgroundColor: "#4f83cc",
  },
  sparklineLineMuted: {
    position: "absolute",
    width: 5,
    height: 2,
    marginLeft: -2.5,
    borderRadius: 999,
    backgroundColor: "#93a9bf",
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
    backgroundColor: "#0f172a",
  },
  binaryDotMuted: {
    backgroundColor: "#cbd5e1",
  },
  binaryVisualText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
    fontFamily,
  },
  freshnessVisual: {
    gap: 8,
  },
  freshnessTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#dbeafe",
  },
  freshnessVisualText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
    fontFamily,
  },
  checklistVisual: {
    gap: 8,
  },
  checklistItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  checklistDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginTop: 5,
  },
  checklistDotGood: {
    backgroundColor: "#16a34a",
  },
  checklistDotNeutral: {
    backgroundColor: "#94a3b8",
  },
  checklistDotWarning: {
    backgroundColor: "#d97706",
  },
  checklistDotDanger: {
    backgroundColor: "#dc2626",
  },
  checklistText: {
    flex: 1,
    color: "#334155",
    fontSize: 13,
    lineHeight: 18,
    fontFamily,
  },
  eventCountdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 2,
  },
  eventCountdownBadge: {
    minWidth: 52,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  eventCountdownUrgent: {
    backgroundColor: "#fff1f2",
  },
  eventCountdownCalm: {
    backgroundColor: "#eff6ff",
  },
  eventCountdownValue: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "800",
    fontFamily,
  },
  eventCountdownLabel: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "800",
    fontFamily,
  },
  eventCountdownMeta: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
    fontFamily,
  },
  riskGaugeTrack: {
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    flexDirection: "row",
    position: "relative",
  },
  riskGaugeSafe: {
    flex: 1,
    backgroundColor: "#dcfce7",
  },
  riskGaugeWarn: {
    flex: 1,
    backgroundColor: "#fef3c7",
  },
  riskGaugeDanger: {
    flex: 1,
    backgroundColor: "#fee2e2",
  },
  miniTrendVisual: {
    gap: 8,
  },
  miniTrendBars: {
    height: 48,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
  },
  miniTrendBar: {
    flex: 1,
    borderRadius: 2,
    backgroundColor: "#d7e5f6",
  },
  miniTrendBarActive: {
    backgroundColor: "#0f172a",
  },
  evidenceEffect: {
    color: "#0f172a",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    fontFamily,
  },
  evidenceWhy: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 20,
    fontFamily,
  },
  recipeMapCard: {
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e4eaf1",
    backgroundColor: "#ffffff",
    gap: 12,
  },
  recipeMapStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  recipeMatrix: {
    gap: 10,
  },
  recipeMatrixRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  recipeMatrixTitle: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "800",
    fontFamily,
  },
  recipeMatrixBody: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 18,
    fontFamily,
  },
  formulaToggle: {
    paddingTop: 2,
  },
  formulaToggleText: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700",
    fontFamily,
  },
  formulaPanel: {
    padding: 12,
    borderRadius: 7,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e4eaf1",
    gap: 6,
  },
  formulaTitle: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "800",
    fontFamily,
  },
  formulaBody: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 19,
    fontFamily,
  },
  formulaMeta: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
    fontFamily,
  },
  priorityStack: {
    alignItems: "flex-end",
    gap: 8,
  },
  priorityBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  priorityHigh: {
    backgroundColor: "#dd5a5f",
  },
  priorityMedium: {
    backgroundColor: "#c9872d",
  },
  priorityLow: {
    backgroundColor: "#c8d2de",
  },
  priorityBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    fontFamily,
  },
  timestampText: {
    color: "#64748b",
    fontSize: 12,
    fontFamily,
  },
  metaLine: {
    marginTop: 10,
    color: "#475569",
    fontSize: 13,
    lineHeight: 20,
    fontFamily,
  },
  analysisActionRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  stockGroupSummary: {
    marginTop: 8,
    color: "#334155",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    fontFamily,
  },
  stockGroupStats: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  stockGroupMetricRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  alertMiniRow: {
    paddingVertical: 10,
    gap: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "#edf2f7",
  },
  alertMiniTitle: {
    color: "#0f172a",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    fontFamily,
  },
  alertMiniBody: {
    marginTop: 4,
    color: "#475569",
    fontSize: 12,
    lineHeight: 17,
    fontFamily,
  },
  stockGroupEvidenceRow: {
    marginTop: 12,
    gap: 10,
  },
  stockGroupEvidenceCol: {
    padding: 12,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#e7edf4",
    backgroundColor: "#f8fafc",
  },
  stockGroupLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontFamily,
  },
  stockGroupLine: {
    marginTop: 6,
    color: "#0f172a",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    fontFamily,
  },
  actionRow: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  button: {
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: {
    backgroundColor: "#0f172a",
  },
  buttonSecondary: {
    backgroundColor: "#eef3f8",
  },
  buttonGhost: {
    backgroundColor: "#fbfcfe",
    borderWidth: 1,
    borderColor: "#e1e7ef",
  },
  buttonText: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily,
  },
  buttonPrimaryText: {
    color: "#f8fafc",
  },
  buttonSecondaryText: {
    color: "#1f2937",
  },
  buttonGhostText: {
    color: "#334155",
  },
  choiceRow: {
    gap: 8,
  },
  choiceChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 6,
    backgroundColor: "#f2f5f8",
    borderWidth: 1,
    borderColor: "#e3e9f0",
  },
  choiceChipActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  choiceChipText: {
    color: "#46607f",
    fontSize: 13,
    fontWeight: "700",
    fontFamily,
  },
  choiceChipTextActive: {
    color: "#f8fafc",
  },
  inputLabel: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontFamily,
  },
  input: {
    minHeight: 46,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e1e7ef",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: "#0f172a",
    fontSize: 15,
    fontFamily,
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  divider: {
    marginVertical: 18,
    height: 1,
    backgroundColor: "#e2edf7",
  },
  formTitle: {
    color: "#0f172a",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
    fontFamily,
  },
  formNote: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 20,
    fontFamily,
  },
  templateCard: {
    width: 220,
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#f5f7fa",
    borderWidth: 1,
    borderColor: "#e5ebf2",
    gap: 6,
  },
  templateCardActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  templateTitle: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "800",
    fontFamily,
  },
  templateTitleActive: {
    color: "#f8fafc",
  },
  templateSubtitle: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
    fontFamily,
  },
  templateSubtitleActive: {
    color: "#cbd5e1",
  },
  previewCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#f4f7fb",
    borderWidth: 1,
    borderColor: "#dde6f0",
  },
  previewLabel: {
    color: "#526276",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontFamily,
  },
  previewText: {
    marginTop: 8,
    color: "#0f172a",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
    fontFamily,
  },
  previewHint: {
    marginTop: 6,
    color: "#475569",
    fontSize: 13,
    lineHeight: 20,
    fontFamily,
  },
  previewDisclosure: {
    marginTop: 14,
    color: "#7c8ba1",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    fontFamily,
  },
  kindPill: {
    alignSelf: "flex-start",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    fontFamily,
  },
  conditionRequired: {
    backgroundColor: "#e8eef6",
    color: "#40556d",
  },
  conditionSupporting: {
    backgroundColor: "#e7f3eb",
    color: "#276245",
  },
  conditionNegative: {
    backgroundColor: "#f7ecd9",
    color: "#8a5a20",
  },
  conditionDisqualifier: {
    backgroundColor: "#f8e3e5",
    color: "#9a3740",
  },
  selectChip: {
    minWidth: 142,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 6,
    backgroundColor: "#f5f7fa",
    borderWidth: 1,
    borderColor: "#e4eaf1",
    gap: 4,
  },
  selectChipActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  selectChipTitle: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "700",
    fontFamily,
  },
  selectChipTitleActive: {
    color: "#f8fafc",
  },
  selectChipSubtitle: {
    color: "#64748b",
    fontSize: 12,
    fontFamily,
  },
  selectChipSubtitleActive: {
    color: "#cbd5e1",
  },
  stepper: {
    gap: 6,
  },
  stepperLabel: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontFamily,
  },
  stepperTrack: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e1e7ef",
    borderRadius: 6,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  stepperButton: {
    width: 44,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f6fa",
  },
  stepperButtonText: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "700",
    fontFamily,
  },
  stepperValueWrap: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#e1e7ef",
  },
  stepperValue: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700",
    fontFamily,
  },
  dualDenseGrid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  stockGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  recentStockStrip: {
    marginBottom: 12,
    gap: 8,
  },
  stockGridItem: {
    width: "48.5%",
  },
  stockAnalysisBoard: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  stockAnalysisBoardItem: {
    width: "48.5%",
  },
  groupHeaderButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  groupHeaderToggle: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
  denseStat: {
    minWidth: 120,
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e4eaf1",
    backgroundColor: "#f8fafc",
    borderRadius: 6,
  },
  denseStatStrong: {
    borderColor: "#d7e2ef",
    backgroundColor: "#ffffff",
  },
  denseStatRisk: {
    borderColor: "#edd8da",
    backgroundColor: "#fff7f7",
  },
  denseStatLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontFamily,
  },
  denseStatValue: {
    marginTop: 5,
    color: "#0f172a",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    fontFamily,
  },
  compactMetricRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  compactMetricText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
    fontFamily,
  },
  fabMenu: {
    position: "absolute",
    right: 20,
    bottom: 116,
    gap: 10,
    alignItems: "flex-end",
  },
  fabMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  fabMenuText: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "700",
    fontFamily,
  },
  fabButton: {
    position: "absolute",
    right: 20,
    bottom: 86,
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  fabButtonText: {
    color: "#f8fafc",
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "400",
    fontFamily,
  },
  bottomNav: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  navIndicator: {
    width: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: "transparent",
  },
  navIndicatorActive: {
    backgroundColor: "#111827",
  },
  navLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
    fontFamily,
  },
  navLabelActive: {
    color: "#0f172a",
  },
});
