import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Recipe,
  RecipeCondition,
  Stock,
} from "./src/types";

type TabKey = "Dashboard" | "Watchlist" | "Studio" | "Journal";
type WatchFilter = "All" | "Attention" | "Opportunity" | "Quiet";
type StudioPanel = "Recipes" | "Eyes" | "Stocks";
type DashboardFocus = "alerts" | "eyes" | "recipes" | "decisions";
type ConditionKind = RecipeCondition["kind"];

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

const tabs: TabKey[] = ["Dashboard", "Watchlist", "Studio", "Journal"];
const watchFilters: WatchFilter[] = ["All", "Attention", "Opportunity", "Quiet"];
const studioPanels: StudioPanel[] = ["Recipes", "Eyes", "Stocks"];
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
  const [tab, setTab] = useState<TabKey>("Dashboard");
  const [watchFilter, setWatchFilter] = useState<WatchFilter>("All");
  const [dashboardFocus, setDashboardFocus] = useState<DashboardFocus>("alerts");
  const [studioPanel, setStudioPanel] = useState<StudioPanel>("Recipes");
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
  const [selectedStockId, setSelectedStockId] = useState("");

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

  const stockSummaries = useMemo(() => {
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
        };
      })
      .filter((item) => item.eyes.length > 0)
      .sort((a, b) => {
        const left = a.dominantEye?.lastEvaluation?.currentState ?? "Not Relevant";
        const right = b.dominantEye?.lastEvaluation?.currentState ?? "Not Relevant";
        return statePriority.indexOf(left) - statePriority.indexOf(right);
      });
  }, [data]);

  const filteredStockSummaries = useMemo(() => {
    if (watchFilter === "All") return stockSummaries;
    if (watchFilter === "Attention") {
      return stockSummaries.filter((item) =>
        ["Attention Needed", "Thesis Risk Rising", "Thesis Broken"].includes(
          item.dominantEye?.lastEvaluation?.currentState ?? "",
        ),
      );
    }
    if (watchFilter === "Opportunity") {
      return stockSummaries.filter(
        (item) => item.dominantEye?.lastEvaluation?.currentState === "Opportunity Zone Forming",
      );
    }
    return stockSummaries.filter((item) =>
      ["Watch Closely", "Becoming Interesting", "Not Relevant"].includes(
        item.dominantEye?.lastEvaluation?.currentState ?? "",
      ),
    );
  }, [stockSummaries, watchFilter]);

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
    if (!selectedStockId && stockSummaries[0]) {
      setSelectedStockId(stockSummaries[0].stock.id);
      return;
    }
    if (selectedStockId && !stockSummaries.some((item) => item.stock.id === selectedStockId)) {
      setSelectedStockId(stockSummaries[0]?.stock.id ?? "");
    }
  }, [selectedStockId, stockSummaries]);

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
    filteredStockSummaries.find((item) => item.stock.id === selectedStockId) ??
    stockSummaries.find((item) => item.stock.id === selectedStockId) ??
    filteredStockSummaries[0] ??
    stockSummaries[0];
  const selectedTemplate =
    conditionLibrary.find((item) => item.id === conditionBuilder.templateId) ?? conditionLibrary[0];
  const selectedOperatorOptions = operatorOptionsForTemplate(selectedTemplate);
  const openAlerts = data.alerts.filter((alert) => !alert.reviewed).length;
  const criticalEyes = data.eyes.filter((eye) =>
    ["Attention Needed", "Thesis Risk Rising", "Thesis Broken"].includes(
      eye.lastEvaluation?.currentState ?? "",
    ),
  ).length;
  const opportunityEyes = data.eyes.filter(
    (eye) => eye.lastEvaluation?.currentState === "Opportunity Zone Forming",
  ).length;

  const jumpTo = (focus: DashboardFocus) => {
    setDashboardFocus(focus);
    if (focus === "eyes") {
      setTab("Watchlist");
      return;
    }
    if (focus === "recipes") {
      setStudioPanel("Recipes");
      setTab("Studio");
      return;
    }
    if (focus === "decisions") {
      setTab("Journal");
      return;
    }
    setTab("Dashboard");
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
    setTab("Journal");
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
    tab === "Dashboard"
      ? [
          {
            label: "Refresh",
            onPress: () => {
              setFabOpen(false);
              void actions.refreshMockData();
            },
          },
          {
            label: "Log Decision",
            onPress: () => {
              setFabOpen(false);
              setTab("Journal");
            },
          },
        ]
      : tab === "Watchlist"
        ? [
            {
              label: "New Eye",
              onPress: () => {
                setFabOpen(false);
                setStudioPanel("Eyes");
                setTab("Studio");
              },
            },
            {
              label: "Alerts",
              onPress: () => {
                setFabOpen(false);
                setTab("Dashboard");
                setDashboardFocus("alerts");
              },
            },
          ]
        : tab === "Studio"
          ? [
              {
                label: "New Recipe",
                onPress: () => {
                  setFabOpen(false);
                  setStudioPanel("Recipes");
                },
              },
              {
                label: "Add Stock",
                onPress: () => {
                  setFabOpen(false);
                  setStudioPanel("Stocks");
                },
              },
              {
                label: "New Eye",
                onPress: () => {
                  setFabOpen(false);
                  setStudioPanel("Eyes");
                },
              },
            ]
          : [
              {
                label: "New Decision",
                onPress: () => {
                  setFabOpen(false);
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
          <Reveal>
            <Card highlighted>
              <Text style={styles.heroEyebrow}>Evidence-driven investing workspace</Text>
              <Text style={styles.heroTitle}>StockLedger</Text>
              <Text style={styles.heroSubtitle}>
                Light, fast review surfaces for recipes, monitored stocks, and decisions you cannot afford
                to skim poorly.
              </Text>

              <View style={styles.metricGrid}>
                <MetricButton
                  value={openAlerts}
                  label="Open Alerts"
                  note="Jump to review queue"
                  onPress={() => jumpTo("alerts")}
                />
                <MetricButton
                  value={data.eyes.length}
                  label="Active Eyes"
                  note="Open monitored list"
                  onPress={() => jumpTo("eyes")}
                />
                <MetricButton
                  value={data.recipes.length}
                  label="Recipes"
                  note="Open studio library"
                  onPress={() => jumpTo("recipes")}
                />
                <MetricButton
                  value={data.decisions.length}
                  label="Decisions"
                  note="Open journal history"
                  onPress={() => jumpTo("decisions")}
                />
              </View>

              <View style={styles.summaryRow}>
                <MetaPill label={`${criticalEyes} critical eyes`} />
                <MetaPill label={`${opportunityEyes} opportunity setups`} />
                <MetaPill
                  label={`${data.snapshots.filter((snapshot) => snapshot.isMock).length} mock feeds active`}
                />
              </View>
            </Card>
          </Reveal>

          {tab === "Dashboard" ? (
            <>
              <Reveal delay={40}>
                <SectionHeader
                  title="Dashboard"
                  note="The fastest way to catch what changed, why it matters, and what deserves action."
                />
              </Reveal>

              <Reveal delay={80}>
                <SectionHeader
                  title="Priority Radar"
                  note="State-led summaries for quick scanning."
                />
                <View style={styles.radarGrid}>
                  {[
                    { label: "Attention Needed", value: criticalEyes, tone: styles.radarCritical },
                    { label: "Opportunity Forming", value: opportunityEyes, tone: styles.radarOpportunity },
                    {
                      label: "Quiet / watchful",
                      value: data.eyes.length - criticalEyes - opportunityEyes,
                      tone: styles.radarQuiet,
                    },
                  ].map((item) => (
                    <View key={item.label} style={[styles.radarCard, item.tone]}>
                      <Text style={styles.radarValue}>{item.value}</Text>
                      <Text style={styles.radarLabel}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </Reveal>

              {selectedEye ? (
                <Reveal delay={120}>
                  <SectionHeader title="Focus Eye" note="Current context with price shape, evidence, and risks." />
                  <Card>
                    <View style={styles.inlineBetween}>
                      <View style={styles.flexOne}>
                        <Text style={styles.cardEyebrow}>Focused monitor</Text>
                        <Text style={styles.cardTitle}>{eyeLine(selectedEye, data.stocks, data.recipes)}</Text>
                        <Text style={styles.cardBody}>
                          {selectedEye.lastEvaluation?.whyNow ?? "This Eye has not been evaluated yet."}
                        </Text>
                      </View>
                      <Text style={stateTone(selectedEye.lastEvaluation?.currentState)}>
                        {selectedEye.lastEvaluation?.currentState ?? "Not Evaluated"}
                      </Text>
                    </View>

                    {data.snapshots.find((snapshot) => snapshot.stockId === selectedEye.stockId) ? (
                      <StockSparkline
                        price={data.snapshots.find((snapshot) => snapshot.stockId === selectedEye.stockId)!.price}
                        drawdownPct={
                          data.snapshots.find((snapshot) => snapshot.stockId === selectedEye.stockId)!.drawdownPct
                        }
                        stabilizationScore={
                          data.snapshots.find((snapshot) => snapshot.stockId === selectedEye.stockId)!
                            .stabilizationScore
                        }
                      />
                    ) : null}

                    <View style={styles.metaRow}>
                      <MetaPill label={selectedEye.lastEvaluation?.actionUrgency ?? "Wait"} />
                      <MetaPill label={`Setup ${selectedEye.lastEvaluation?.setupStrength ?? "Low"}`} />
                      <MetaPill label={selectedEye.thesisSnapshot.slice(0, 42) + (selectedEye.thesisSnapshot.length > 42 ? "..." : "")} />
                    </View>

                    <View style={styles.dualColumn}>
                      <View style={styles.evidenceColumn}>
                        <Text style={styles.columnTitle}>Supporting Evidence</Text>
                        {(selectedEye.lastEvaluation?.supportingEvidence ?? []).slice(0, 4).map((item) => (
                          <Text key={item} style={styles.listLine}>
                            + {item}
                          </Text>
                        ))}
                      </View>
                      <View style={styles.evidenceColumn}>
                        <Text style={styles.columnTitle}>Risks and Contradictions</Text>
                        {(selectedEye.lastEvaluation?.contradictingEvidence ?? []).slice(0, 4).map((item) => (
                          <Text key={item} style={styles.listLine}>
                            - {item}
                          </Text>
                        ))}
                      </View>
                    </View>
                  </Card>
                </Reveal>
              ) : null}

              <Reveal delay={160}>
                <SectionHeader
                  title="Review Queue"
                  note="Fast scan cards with direct actions."
                />
                <View style={styles.stack}>
                  {alertQueue.length === 0 ? (
                    <Card>
                      <Text style={styles.cardBody}>No alerts are open right now.</Text>
                    </Card>
                  ) : (
                    alertQueue.slice(0, 5).map((alert) => {
                      const eye = data.eyes.find((item) => item.id === alert.eyeId);
                      return (
                        <Card key={alert.id}>
                          <View style={styles.inlineBetween}>
                            <View style={styles.flexOne}>
                              <Text style={styles.cardEyebrow}>
                                {stockLabel(data.stocks, eye?.stockId ?? "")}
                              </Text>
                              <Text style={styles.alertTitle}>{alert.title}</Text>
                              <Text style={styles.cardBody}>{alert.whyNow}</Text>
                            </View>
                            <View style={styles.priorityStack}>
                              <View style={priorityTone(alert.priority)}>
                                <Text style={styles.priorityBadgeText}>{alert.priority}</Text>
                              </View>
                              <Text style={styles.timestampText}>{formatDate(alert.createdAt)}</Text>
                            </View>
                          </View>
                          <Text style={styles.metaLine}>{alert.stateChange}</Text>
                          <Text style={styles.metaLine}>Support: {alert.supportingEvidence.join(" | ") || "None"}</Text>
                          <Text style={styles.metaLine}>Risks: {alert.risks.join(" | ") || "None"}</Text>
                          <View style={styles.actionRow}>
                            <Button label="Entered" onPress={() => void quickDecision(alert, "Entered")} />
                            <Button
                              label="Skipped"
                              tone="secondary"
                              onPress={() => void quickDecision(alert, "Skipped")}
                            />
                            <Button
                              label="Reviewed"
                              tone="ghost"
                              onPress={() => void actions.markAlertReviewed(alert.id)}
                            />
                          </View>
                        </Card>
                      );
                    })
                  )}
                </View>
              </Reveal>
            </>
          ) : null}

          {tab === "Watchlist" ? (
            <>
              <Reveal>
                <SectionHeader
                  title="Watchlist"
                  note="Chart-first stock monitoring with recipe-backed Eyes."
                />
                <HorizontalChoice options={watchFilters} value={watchFilter} onSelect={setWatchFilter} />
              </Reveal>

              {selectedStockSummary ? (
                <Reveal delay={60}>
                  <Card highlighted>
                    <View style={styles.inlineBetween}>
                      <View style={styles.flexOne}>
                        <Text style={styles.cardEyebrow}>{selectedStockSummary.stock.name}</Text>
                        <Text style={styles.cardTitle}>{selectedStockSummary.stock.symbol}</Text>
                        <Text style={styles.cardBody}>{selectedStockSummary.stock.thesis}</Text>
                      </View>
                      <Text style={stateTone(selectedStockSummary.dominantEye?.lastEvaluation?.currentState)}>
                        {selectedStockSummary.dominantEye?.lastEvaluation?.currentState ?? "No state"}
                      </Text>
                    </View>
                    {selectedStockSummary.snapshot ? (
                      <StockSparkline
                        price={selectedStockSummary.snapshot.price}
                        drawdownPct={selectedStockSummary.snapshot.drawdownPct}
                        stabilizationScore={selectedStockSummary.snapshot.stabilizationScore}
                      />
                    ) : null}
                    {selectedStockSummary.snapshot ? (
                      <View style={styles.dualDenseGrid}>
                        <DenseStat label="Price" value={`$${selectedStockSummary.snapshot.price.toFixed(2)}`} tone="strong" />
                        <DenseStat label="Drawdown" value={`${selectedStockSummary.snapshot.drawdownPct}%`} />
                        <DenseStat
                          label="RS vs SPY"
                          value={`${selectedStockSummary.snapshot.relativeStrengthVsSpyPct ?? 0}%`}
                          tone={(selectedStockSummary.snapshot.relativeStrengthVsSpyPct ?? 0) < 0 ? "risk" : "neutral"}
                        />
                        <DenseStat label="Freshness" value={selectedStockSummary.snapshot.freshness} />
                      </View>
                    ) : null}
                    <View style={styles.metaRow}>
                      <MetaPill label={`${selectedStockSummary.eyes.length} eyes`} />
                      <MetaPill label={`${selectedStockSummary.openAlerts.length} open alerts`} />
                      {selectedStockSummary.snapshot ? (
                        <MetaPill label={selectedStockSummary.snapshot.freshness} />
                      ) : null}
                    </View>
                  </Card>
                </Reveal>
              ) : null}

              <Reveal delay={100}>
                <SectionHeader title="Monitored Stocks" note="Tap any stock to promote it into focus." />
                <View style={styles.stack}>
                  {filteredStockSummaries.map((item) => (
                    <Pressable key={item.stock.id} onPress={() => setSelectedStockId(item.stock.id)}>
                      <Card highlighted={selectedStockSummary?.stock.id === item.stock.id}>
                        <View style={styles.inlineBetween}>
                          <View style={styles.flexOne}>
                            <Text style={styles.cardEyebrow}>{item.stock.name}</Text>
                            <Text style={styles.alertTitle}>{item.stock.symbol}</Text>
                            <Text style={styles.cardBody}>{topReason(item.dominantEye ?? item.eyes[0])}</Text>
                          </View>
                          <Text style={stateTone(item.dominantEye?.lastEvaluation?.currentState)}>
                            {item.dominantEye?.lastEvaluation?.currentState ?? "No state"}
                          </Text>
                        </View>
                        {item.snapshot ? (
                          <StockSparkline
                            price={item.snapshot.price}
                            drawdownPct={item.snapshot.drawdownPct}
                            stabilizationScore={item.snapshot.stabilizationScore}
                          />
                        ) : null}
                        {item.snapshot ? (
                          <View style={styles.compactMetricRow}>
                            <Text style={styles.compactMetricText}>${item.snapshot.price.toFixed(2)}</Text>
                            <Text style={styles.compactMetricText}>{item.snapshot.drawdownPct}% drawdown</Text>
                            <Text style={styles.compactMetricText}>
                              RS {item.snapshot.relativeStrengthVsSpyPct ?? 0}%
                            </Text>
                          </View>
                        ) : null}
                        <View style={styles.metaRow}>
                          <MetaPill label={`${item.eyes.length} recipes watching`} />
                          <MetaPill label={`${item.openAlerts.length} alerts`} />
                          {item.snapshot ? <MetaPill label={`Updated ${formatDate(item.snapshot.updatedAt)}`} /> : null}
                        </View>
                      </Card>
                    </Pressable>
                  ))}
                </View>
              </Reveal>
            </>
          ) : null}

          {tab === "Studio" ? (
            <>
              <Reveal>
                <SectionHeader
                  title="Studio"
                  note="Build reusable investing logic and bind it to stocks through explicit Eyes."
                />
                <HorizontalChoice options={studioPanels} value={studioPanel} onSelect={setStudioPanel} />
              </Reveal>

              {studioPanel === "Recipes" ? (
                <>
                  <Reveal delay={60}>
                    <SectionHeader
                      title="Recipe Generator"
                      note="Guided, typed controls for logic, cadence, and alerts instead of loose parameter text."
                    />
                    <Card highlighted>
                      <View style={styles.compactSection}>
                        <Text style={styles.inputLabel}>Recipe name</Text>
                        <Input
                          value={recipeForm.name}
                          onChangeText={(name) => setRecipeForm((current) => ({ ...current, name }))}
                          placeholder="Temporary Bargain Sale"
                        />

                        <Text style={styles.inputLabel}>Opportunity type</Text>
                        <HorizontalChoice
                          options={opportunityTypes}
                          value={recipeForm.opportunityType}
                          onSelect={(opportunityType) =>
                            setRecipeForm((current) => ({ ...current, opportunityType }))
                          }
                        />

                        <Text style={styles.inputLabel}>Time horizon</Text>
                        <HorizontalChoice
                          options={timeHorizons}
                          value={recipeForm.timeHorizon}
                          onSelect={(timeHorizon) => setRecipeForm((current) => ({ ...current, timeHorizon }))}
                        />

                        <Text style={styles.inputLabel}>Primary use case</Text>
                        <HorizontalChoice
                          options={useCaseOptions}
                          value={recipeForm.intendedUseCase}
                          onSelect={(intendedUseCase) =>
                            setRecipeForm((current) => ({ ...current, intendedUseCase }))
                          }
                        />

                        <View style={styles.dualDenseGrid}>
                          <DenseStat label="Review cadence" value={`${recipeForm.reviewCadenceDays} days`} tone="strong" />
                          <DenseStat label="Alert cooldown" value={`${recipeForm.alertCooldownHours} hours`} />
                        </View>

                        <Text style={styles.inputLabel}>Review cadence</Text>
                        <HorizontalChoice
                          options={reviewCadenceOptions.map(String)}
                          value={String(recipeForm.reviewCadenceDays)}
                          onSelect={(value) =>
                            setRecipeForm((current) => ({ ...current, reviewCadenceDays: Number(value) }))
                          }
                        />

                        <Text style={styles.inputLabel}>Alert cooldown</Text>
                        <HorizontalChoice
                          options={alertCooldownOptions.map(String)}
                          value={String(recipeForm.alertCooldownHours)}
                          onSelect={(value) =>
                            setRecipeForm((current) => ({ ...current, alertCooldownHours: Number(value) }))
                          }
                        />

                        <Text style={styles.inputLabel}>Purpose</Text>
                        <Input
                          value={recipeForm.purpose}
                          onChangeText={(purpose) => setRecipeForm((current) => ({ ...current, purpose }))}
                          placeholder="What opportunity should this logic surface?"
                          multiline
                        />

                        <Text style={styles.inputLabel}>Notes</Text>
                        <Input
                          value={recipeForm.notes}
                          onChangeText={(notes) => setRecipeForm((current) => ({ ...current, notes }))}
                          placeholder="Review triggers, downgrade rules, or thesis guardrails"
                          multiline
                        />
                      </View>

                      <View style={styles.divider} />

                      <Text style={styles.formTitle}>Condition Library</Text>
                      <Text style={styles.formNote}>
                        Choose the kind of critical thinking you want the recipe to express.
                      </Text>

                      <Text style={styles.inputLabel}>Category</Text>
                      <HorizontalChoice
                        options={conditionCategories}
                        value={conditionBuilder.category as (typeof conditionCategories)[number]}
                        onSelect={(category) => {
                          const firstTemplate =
                            conditionLibrary.find((item) => item.category === category) ?? conditionLibrary[0];
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
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.choiceRow}
                      >
                        {conditionLibrary
                          .filter((item) => item.category === conditionBuilder.category)
                          .map((template) => (
                            <Pressable
                              key={template.id}
                              onPress={() =>
                                setConditionBuilder((current) => ({
                                  ...current,
                                  templateId: template.id,
                                }))
                              }
                              style={[
                                styles.templateCard,
                                conditionBuilder.templateId === template.id ? styles.templateCardActive : null,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.templateTitle,
                                  conditionBuilder.templateId === template.id
                                    ? styles.templateTitleActive
                                    : null,
                                ]}
                              >
                                {template.title}
                              </Text>
                              <Text
                                style={[
                                  styles.templateSubtitle,
                                  conditionBuilder.templateId === template.id
                                    ? styles.templateSubtitleActive
                                    : null,
                                ]}
                              >
                                {template.complexity} · {template.description}
                              </Text>
                            </Pressable>
                          ))}
                      </ScrollView>

                      <Text style={styles.inputLabel}>Condition role</Text>
                      <HorizontalChoice
                        options={conditionKinds}
                        value={conditionBuilder.kind}
                        onSelect={(kind) => setConditionBuilder((current) => ({ ...current, kind }))}
                      />

                      <Text style={styles.inputLabel}>Operator</Text>
                      <HorizontalChoice
                        options={selectedOperatorOptions}
                        value={conditionBuilder.operator}
                        onSelect={(operator) => setConditionBuilder((current) => ({ ...current, operator }))}
                      />

                      <Text style={styles.inputLabel}>Threshold / parameter</Text>
                      {selectedTemplate.control.type === "number" ? (
                        <NumberStepper
                          label={selectedTemplate.metricLabel}
                          value={Number(conditionBuilder.threshold)}
                          onChange={(next) =>
                            setConditionBuilder((current) => ({ ...current, threshold: String(next) }))
                          }
                          step={selectedTemplate.control.step}
                          min={selectedTemplate.control.min}
                          max={selectedTemplate.control.max}
                          unit={selectedTemplate.control.unit}
                        />
                      ) : (
                        <HorizontalChoice
                          options={selectedTemplate.control.options}
                          value={conditionBuilder.threshold}
                          onSelect={(threshold) => setConditionBuilder((current) => ({ ...current, threshold }))}
                        />
                      )}

                      <Text style={styles.inputLabel}>Why this matters</Text>
                      <Input
                        value={conditionBuilder.note}
                        onChangeText={(note) => setConditionBuilder((current) => ({ ...current, note }))}
                        placeholder="Optional context for future you"
                        multiline
                      />

                      <View style={styles.previewCard}>
                        <Text style={styles.previewLabel}>Preview</Text>
                        <Text style={styles.previewText}>
                          {selectedTemplate.title}: {selectedTemplate.metricLabel} {conditionBuilder.operator}{" "}
                          {formatMetricThreshold(
                            selectedTemplate,
                            conditionBuilder.threshold || selectedTemplate.defaultValue,
                          )}
                        </Text>
                        <Text style={styles.previewHint}>{selectedTemplate.description}</Text>
                      </View>

                      <View style={styles.actionRow}>
                        <Button label="Add Condition" onPress={addDraftCondition} />
                        <Button
                          label="Clear Draft"
                          tone="ghost"
                          onPress={() => setDraftConditions([])}
                        />
                      </View>
                    </Card>
                  </Reveal>

                  <Reveal delay={100}>
                    <SectionHeader
                      title="Draft Conditions"
                      note="Mix simple filters, layered confirmations, and hard disqualifiers."
                    />
                    <View style={styles.stack}>
                      {draftConditions.length === 0 ? (
                        <Card>
                          <Text style={styles.cardBody}>
                            No conditions added yet. Use the library above to translate your investment logic.
                          </Text>
                        </Card>
                      ) : (
                        draftConditions.map((condition) => (
                          <Card key={condition.id}>
                            <View style={styles.inlineBetween}>
                              <View style={styles.flexOne}>
                                <Text style={[styles.kindPill, conditionKindTone(condition.kind)]}>
                                  {condition.kind}
                                </Text>
                                <Text style={styles.cardBody}>{condition.label}</Text>
                              </View>
                              <Button
                                label="Remove"
                                tone="ghost"
                                onPress={() =>
                                  setDraftConditions((current) =>
                                    current.filter((item) => item.id !== condition.id),
                                  )
                                }
                              />
                            </View>
                          </Card>
                        ))
                      )}
                    </View>
                    <View style={styles.actionRow}>
                      <Button label="Save Recipe" onPress={() => void saveRecipe()} />
                    </View>
                  </Reveal>

                  <Reveal delay={140}>
                    <SectionHeader title="Recipe Library" note="Existing playbooks ready to reuse." />
                    <View style={styles.stack}>
                      {data.recipes.map((recipe) => (
                        <Card key={recipe.id}>
                          <Text style={styles.cardEyebrow}>Version {recipe.version}</Text>
                          <Text style={styles.cardTitle}>{recipe.name}</Text>
                          <Text style={styles.cardBody}>{recipe.purpose}</Text>
                          <View style={styles.dualDenseGrid}>
                            <DenseStat label="Type" value={recipe.opportunityType ?? "General"} tone="strong" />
                            <DenseStat label="Horizon" value={recipe.timeHorizon || "Unset"} />
                            <DenseStat
                              label="Cadence"
                              value={`${recipe.reviewConfig?.cadenceDays ?? 14}d`}
                            />
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
                </>
              ) : null}

              {studioPanel === "Eyes" ? (
                <>
                  <Reveal delay={60}>
                    <SectionHeader
                      title="Create Eye"
                      note="Bind a stock to a recipe with entry zone, review date, and invalidation context."
                    />
                    <Card highlighted>
                      <Text style={styles.inputLabel}>Stock</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>
                        {data.stocks.map((stock) => (
                          <Pressable
                            key={stock.id}
                            onPress={() => setEyeForm((current) => ({ ...current, stockId: stock.id }))}
                            style={[styles.selectChip, eyeForm.stockId === stock.id ? styles.selectChipActive : null]}
                          >
                            <Text
                              style={[
                                styles.selectChipTitle,
                                eyeForm.stockId === stock.id ? styles.selectChipTitleActive : null,
                              ]}
                            >
                              {stock.symbol}
                            </Text>
                            <Text
                              style={[
                                styles.selectChipSubtitle,
                                eyeForm.stockId === stock.id ? styles.selectChipSubtitleActive : null,
                              ]}
                            >
                              {stock.name}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>

                      <Text style={styles.inputLabel}>Recipe</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>
                        {data.recipes.map((recipe) => (
                          <Pressable
                            key={recipe.id}
                            onPress={() => setEyeForm((current) => ({ ...current, recipeId: recipe.id }))}
                            style={[styles.selectChip, eyeForm.recipeId === recipe.id ? styles.selectChipActive : null]}
                          >
                            <Text
                              style={[
                                styles.selectChipTitle,
                                eyeForm.recipeId === recipe.id ? styles.selectChipTitleActive : null,
                              ]}
                            >
                              {recipe.name}
                            </Text>
                            <Text
                              style={[
                                styles.selectChipSubtitle,
                                eyeForm.recipeId === recipe.id ? styles.selectChipSubtitleActive : null,
                              ]}
                            >
                              {recipe.timeHorizon}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>

                      <Text style={styles.inputLabel}>Specific thesis snapshot</Text>
                      <Input
                        value={eyeForm.thesisSnapshot}
                        onChangeText={(thesisSnapshot) =>
                          setEyeForm((current) => ({ ...current, thesisSnapshot }))
                        }
                        placeholder="Why does this stock under this recipe deserve repeated attention?"
                        multiline
                      />

                      <View style={styles.dualDenseGrid}>
                        <NumberStepper
                          label="Planned entry low"
                          value={Number(eyeForm.plannedEntryLow || 0)}
                          onChange={(next) =>
                            setEyeForm((current) => ({ ...current, plannedEntryLow: next.toFixed(2) }))
                          }
                          step={0.5}
                          min={0}
                          max={10000}
                        />
                        <NumberStepper
                          label="Planned entry high"
                          value={Number(eyeForm.plannedEntryHigh || 0)}
                          onChange={(next) =>
                            setEyeForm((current) => ({ ...current, plannedEntryHigh: next.toFixed(2) }))
                          }
                          step={0.5}
                          min={0}
                          max={10000}
                        />
                      </View>

                      <Text style={styles.inputLabel}>Last thesis review</Text>
                      <HorizontalChoice
                        options={reviewDateOptions.map((item) => item.label)}
                        value={
                          reviewDateOptions.find((item) => item.daysAgo === eyeForm.lastReviewedDaysAgo)?.label ??
                          reviewDateOptions[2].label
                        }
                        onSelect={(label) =>
                          setEyeForm((current) => ({
                            ...current,
                            lastReviewedDaysAgo:
                              reviewDateOptions.find((item) => item.label === label)?.daysAgo ??
                              reviewDateOptions[2].daysAgo,
                          }))
                        }
                      />

                      <Text style={styles.inputLabel}>Invalidation rule</Text>
                      <Input
                        value={eyeForm.invalidationRule}
                        onChangeText={(invalidationRule) =>
                          setEyeForm((current) => ({ ...current, invalidationRule }))
                        }
                        placeholder="What would break the thesis fast?"
                        multiline
                      />

                      <View style={styles.dualDenseGrid}>
                        <DenseStat
                          label="Review stamp"
                          value={formatShortDate(isoDateDaysAgo(eyeForm.lastReviewedDaysAgo))}
                        />
                        <DenseStat
                          label="Entry band"
                          value={
                            eyeForm.plannedEntryLow && eyeForm.plannedEntryHigh
                              ? `$${eyeForm.plannedEntryLow} to $${eyeForm.plannedEntryHigh}`
                              : "Not set"
                          }
                          tone="strong"
                        />
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
                        }}
                      />
                    </Card>
                  </Reveal>

                  <Reveal delay={100}>
                    <SectionHeader title="Active Eyes" note="Every monitored pairing currently in the system." />
                    <View style={styles.stack}>
                      {eyesSorted.map((eye) => (
                        <Card key={eye.id}>
                          <View style={styles.inlineBetween}>
                            <View style={styles.flexOne}>
                              <Text style={styles.cardEyebrow}>
                                {stockLabel(data.stocks, eye.stockId)}
                              </Text>
                              <Text style={styles.alertTitle}>{recipeLabel(data.recipes, eye.recipeId)}</Text>
                              <Text style={styles.cardBody}>{eye.thesisSnapshot}</Text>
                            </View>
                            <Text style={stateTone(eye.lastEvaluation?.currentState)}>
                              {eye.lastEvaluation?.currentState ?? "Not Evaluated"}
                            </Text>
                          </View>
                          <View style={styles.dualDenseGrid}>
                            <DenseStat
                              label="Entry zone"
                              value={
                                eye.plannedEntryLow !== undefined && eye.plannedEntryHigh !== undefined
                                  ? `$${eye.plannedEntryLow} to $${eye.plannedEntryHigh}`
                                  : "Unset"
                              }
                            />
                            <DenseStat
                              label="Last review"
                              value={eye.lastReviewedAt ? formatShortDate(eye.lastReviewedAt) : "Unset"}
                            />
                          </View>
                        </Card>
                      ))}
                    </View>
                  </Reveal>
                </>
              ) : null}

              {studioPanel === "Stocks" ? (
                <>
                  <Reveal delay={60}>
                    <SectionHeader
                      title="Add Stock"
                      note="Keep the tracked universe intentional and thesis-led."
                    />
                    <Card highlighted>
                      <Text style={styles.inputLabel}>Ticker</Text>
                      <Input
                        value={stockForm.symbol}
                        onChangeText={(symbol) => setStockForm((current) => ({ ...current, symbol }))}
                        placeholder="Ticker symbol"
                        autoCapitalize="characters"
                      />
                      <Text style={styles.inputLabel}>Company name</Text>
                      <Input
                        value={stockForm.name}
                        onChangeText={(name) => setStockForm((current) => ({ ...current, name }))}
                        placeholder="Company name"
                      />
                      <Text style={styles.inputLabel}>Why track it</Text>
                      <Input
                        value={stockForm.thesis}
                        onChangeText={(thesis) => setStockForm((current) => ({ ...current, thesis }))}
                        placeholder="What makes this worth saving into your monitoring memory?"
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
                </>
              ) : null}
            </>
          ) : null}

          {tab === "Journal" ? (
            <>
              <Reveal>
                <SectionHeader
                  title="Decision Journal"
                  note="Capture action, concern, timing, and thesis quality while the context is fresh."
                />
              </Reveal>

              <Reveal delay={60}>
                <Card highlighted>
                  <Text style={styles.inputLabel}>Eye</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow}>
                    {data.eyes.map((eye) => (
                      <Pressable
                        key={eye.id}
                        onPress={() => setDecisionForm((current) => ({ ...current, eyeId: eye.id }))}
                        style={[styles.selectChip, decisionForm.eyeId === eye.id ? styles.selectChipActive : null]}
                      >
                        <Text
                          style={[
                            styles.selectChipTitle,
                            decisionForm.eyeId === eye.id ? styles.selectChipTitleActive : null,
                          ]}
                        >
                          {stockLabel(data.stocks, eye.stockId)}
                        </Text>
                        <Text
                          style={[
                            styles.selectChipSubtitle,
                            decisionForm.eyeId === eye.id ? styles.selectChipSubtitleActive : null,
                          ]}
                        >
                          {recipeLabel(data.recipes, eye.recipeId)}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <Text style={styles.inputLabel}>Action</Text>
                  <HorizontalChoice
                    options={decisionActions}
                    value={decisionForm.action}
                    onSelect={(action) => setDecisionForm((current) => ({ ...current, action }))}
                  />

                  <Text style={styles.inputLabel}>Why did you act this way?</Text>
                  <Input
                    value={decisionForm.note}
                    onChangeText={(note) => setDecisionForm((current) => ({ ...current, note }))}
                    placeholder="Why did you enter, skip, or revise?"
                    multiline
                  />

                  <Text style={styles.inputLabel}>Main concern</Text>
                  <Input
                    value={decisionForm.concern}
                    onChangeText={(concern) => setDecisionForm((current) => ({ ...current, concern }))}
                    placeholder="What risk mattered most?"
                    multiline
                  />

                  <Text style={styles.inputLabel}>Thesis validity</Text>
                  <HorizontalChoice
                    options={thesisValidityOptions}
                    value={decisionForm.thesisValid}
                    onSelect={(thesisValid) => setDecisionForm((current) => ({ ...current, thesisValid }))}
                  />

                  <Text style={styles.inputLabel}>Timing</Text>
                  <HorizontalChoice
                    options={timingOptions}
                    value={decisionForm.timing}
                    onSelect={(timing) => setDecisionForm((current) => ({ ...current, timing }))}
                  />

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
                    }}
                  />
                </Card>
              </Reveal>

              <Reveal delay={100}>
                <SectionHeader title="History" note="Review outcomes and judgment quality over time." />
                <View style={styles.stack}>
                  {data.decisions.map((decision) => (
                    <Card key={decision.id}>
                      <Text style={styles.alertTitle}>
                        {decision.action} · {decisionTitle(decision.eyeId, data.eyes, data.stocks, data.recipes)}
                      </Text>
                      <Text style={styles.cardBody}>{decision.note}</Text>
                      <View style={styles.compactMetricRow}>
                        <Text style={styles.compactMetricText}>{decision.stateAtDecision ?? "No state snapshot"}</Text>
                        <Text style={styles.compactMetricText}>{decision.dataQuality ?? "No data note"}</Text>
                      </View>
                      <Text style={styles.metaLine}>Concern: {decision.concern || "Not captured"}</Text>
                      <Text style={styles.metaLine}>
                        Thesis {decision.thesisValid} · Timing {decision.timing} · {formatDate(decision.createdAt)}
                      </Text>
                    </Card>
                  ))}
                </View>
              </Reveal>
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
    paddingHorizontal: 8,
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
    fontSize: 12,
    fontWeight: "700",
    fontFamily,
  },
  navLabelActive: {
    color: "#0f172a",
  },
});
