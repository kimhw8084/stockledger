import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useAppModel } from "./src/hooks/useAppModel";
import { Alert, DecisionAction, Eye, EyeState, Recipe, Stock } from "./src/types";

type TabKey = "Home" | "Eyes" | "Recipes" | "Journal";

const tabs: TabKey[] = ["Home", "Eyes", "Recipes", "Journal"];
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
const statePriority: EyeState[] = [
  "Attention Needed",
  "Thesis Risk Rising",
  "Opportunity Zone Forming",
  "Watch Closely",
  "Becoming Interesting",
  "Not Relevant",
  "Thesis Broken",
];

const fontFamily = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: "system-ui",
});

const formatDate = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
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

const Card = ({
  children,
  elevated,
  tone = "default",
}: {
  children: React.ReactNode;
  elevated?: boolean;
  tone?: "default" | "dark" | "muted";
}) => (
  <View
    style={[
      styles.card,
      tone === "dark" ? styles.cardDark : null,
      tone === "muted" ? styles.cardMuted : null,
      elevated ? styles.cardElevated : null,
    ]}
  >
    {children}
  </View>
);

const SectionTitle = ({
  title,
  note,
  action,
}: {
  title: string;
  note?: string;
  action?: React.ReactNode;
}) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionHeaderText}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {note ? <Text style={styles.sectionNote}>{note}</Text> : null}
    </View>
    {action}
  </View>
);

const Input = ({
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) => (
  <TextInput
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor="#7f867f"
    multiline={multiline}
    style={[styles.input, multiline ? styles.textArea : null]}
  />
);

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

const ChoiceGroup = <T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
}) => (
  <View style={styles.choiceGroup}>
    {options.map((option) => (
      <Pressable
        key={option}
        onPress={() => onSelect(option)}
        style={[styles.choiceChip, selected === option ? styles.choiceChipActive : null]}
      >
        <Text style={[styles.choiceChipText, selected === option ? styles.choiceChipTextActive : null]}>
          {option}
        </Text>
      </Pressable>
    ))}
  </View>
);

const SelectChips = ({
  label,
  emptyLabel,
  options,
  selectedId,
  onSelect,
}: {
  label: string;
  emptyLabel: string;
  options: { id: string; title: string; subtitle?: string }[];
  selectedId: string;
  onSelect: (value: string) => void;
}) => (
  <View style={styles.selectBlock}>
    <Text style={styles.inputLabel}>{label}</Text>
    {options.length === 0 ? <Text style={styles.emptyInline}>{emptyLabel}</Text> : null}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectRow}>
      {options.map((option) => (
        <Pressable
          key={option.id}
          onPress={() => onSelect(option.id)}
          style={[styles.selectChip, selectedId === option.id ? styles.selectChipActive : null]}
        >
          <Text style={[styles.selectChipTitle, selectedId === option.id ? styles.selectChipTitleActive : null]}>
            {option.title}
          </Text>
          {option.subtitle ? (
            <Text
              style={[
                styles.selectChipSubtitle,
                selectedId === option.id ? styles.selectChipSubtitleActive : null,
              ]}
            >
              {option.subtitle}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </ScrollView>
  </View>
);

const MetaPill = ({ label, tone }: { label: string; tone?: object }) => (
  <View style={[styles.metaPill, tone]}>
    <Text style={styles.metaPillText}>{label}</Text>
  </View>
);

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

export default function App() {
  const { data, loading, actions } = useAppModel();
  const [tab, setTab] = useState<TabKey>("Home");

  const [stockForm, setStockForm] = useState({ symbol: "", name: "", thesis: "" });
  const [recipeForm, setRecipeForm] = useState({
    name: "",
    purpose: "",
    timeHorizon: "",
    intendedUseCase: "",
    notes: "",
  });
  const [eyeForm, setEyeForm] = useState({ stockId: "", recipeId: "", thesisSnapshot: "" });
  const [decisionForm, setDecisionForm] = useState({
    eyeId: "",
    alertId: "",
    action: "Entered" as DecisionAction,
    note: "",
    concern: "",
    thesisValid: "Yes" as (typeof thesisValidityOptions)[number],
    timing: "On Time" as (typeof timingOptions)[number],
  });

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

  const [selectedEyeId, setSelectedEyeId] = useState("");
  const [selectedAlertId, setSelectedAlertId] = useState("");

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
    const openAlert = alertQueue.find((item) => !item.reviewed) ?? alertQueue[0];
    if (!selectedAlertId && openAlert) {
      setSelectedAlertId(openAlert.id);
      return;
    }
    if (selectedAlertId && !alertQueue.some((alert) => alert.id === selectedAlertId)) {
      setSelectedAlertId(openAlert?.id ?? "");
    }
  }, [alertQueue, selectedAlertId]);

  useEffect(() => {
    if (!data) return;
    if (eyeForm.stockId && !data.stocks.some((stock) => stock.id === eyeForm.stockId)) {
      setEyeForm((current) => ({ ...current, stockId: "" }));
    }
    if (eyeForm.recipeId && !data.recipes.some((recipe) => recipe.id === eyeForm.recipeId)) {
      setEyeForm((current) => ({ ...current, recipeId: "" }));
    }
    if (decisionForm.eyeId && !data.eyes.some((eye) => eye.id === decisionForm.eyeId)) {
      setDecisionForm((current) => ({ ...current, eyeId: "", alertId: "" }));
    }
  }, [data, decisionForm.eyeId, eyeForm.recipeId, eyeForm.stockId]);

  if (loading || !data) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar style="light" />
        <Text style={styles.loadingText}>Loading StockLedger...</Text>
      </SafeAreaView>
    );
  }

  const selectedEye = eyesSorted.find((eye) => eye.id === selectedEyeId) ?? eyesSorted[0];
  const selectedAlert = alertQueue.find((alert) => alert.id === selectedAlertId) ?? alertQueue[0];
  const selectedStock = selectedEye
    ? data.stocks.find((stock) => stock.id === selectedEye.stockId)
    : undefined;
  const selectedRecipe = selectedEye
    ? data.recipes.find((recipe) => recipe.id === selectedEye.recipeId)
    : undefined;
  const selectedSnapshot = selectedStock
    ? data.snapshots.find((snapshot) => snapshot.stockId === selectedStock.id)
    : undefined;

  const criticalEyes = data.eyes.filter((eye) =>
    ["Attention Needed", "Thesis Risk Rising", "Thesis Broken"].includes(
      eye.lastEvaluation?.currentState ?? "",
    ),
  ).length;
  const opportunityEyes = data.eyes.filter(
    (eye) => eye.lastEvaluation?.currentState === "Opportunity Zone Forming",
  ).length;
  const openAlerts = data.alerts.filter((alert) => !alert.reviewed).length;
  const quietEyes = data.eyes.filter(
    (eye) =>
      !["Attention Needed", "Thesis Risk Rising", "Thesis Broken", "Opportunity Zone Forming"].includes(
        eye.lastEvaluation?.currentState ?? "",
      ),
  ).length;
  const mockCount = data.snapshots.filter((snapshot) => snapshot.isMock).length;
  const freshestUpdate = data.snapshots
    .map((snapshot) => snapshot.updatedAt)
    .sort((a, b) => b.localeCompare(a))[0];

  const stateSummary = statePriority
    .filter((state) => state !== "Not Relevant")
    .map((state) => ({
      state,
      count: data.eyes.filter((eye) => eye.lastEvaluation?.currentState === state).length,
    }))
    .filter((item) => item.count > 0);

  const recentDecisions = data.decisions.slice(0, 3);

  const quickDecision = async (action: DecisionAction) => {
    if (!selectedAlert) return;
    const eye = data.eyes.find((item) => item.id === selectedAlert.eyeId);
    if (!eye) return;

    await actions.logDecision({
      eyeId: eye.id,
      alertId: selectedAlert.id,
      action,
      note: `${action} after reviewing ${eyeLine(eye, data.stocks, data.recipes)}.`,
      concern:
        eye.lastEvaluation?.contradictingEvidence[0] ?? "No additional concern captured during quick review.",
      thesisValid: action === "Marked Thesis Broken" ? "No" : action === "Rejected" ? "Partly" : "Yes",
      timing: "On Time",
    });
    setSelectedAlertId("");
    setTab("Journal");
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <Card tone="dark" elevated>
          <View style={styles.heroTopline}>
            <Text style={styles.heroEyebrow}>Evidence-driven investing workspace</Text>
            <Text style={styles.heroTimestamp}>
              {freshestUpdate ? `Updated ${formatDate(freshestUpdate)}` : "No market snapshots yet"}
            </Text>
          </View>
          <Text style={styles.heroTitle}>StockLedger</Text>
          <Text style={styles.heroSubtitle}>
            Calm monitoring for investment ideas that deserve memory, context, and disciplined review.
          </Text>

          <View style={styles.metricStrip}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{openAlerts}</Text>
              <Text style={styles.metricLabel}>Open alerts</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{criticalEyes}</Text>
              <Text style={styles.metricLabel}>Risk or attention</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{opportunityEyes}</Text>
              <Text style={styles.metricLabel}>Opportunity forming</Text>
            </View>
          </View>

          <View style={styles.heroFootRow}>
            <MetaPill label={`${quietEyes} quieter eyes`} tone={styles.metaPillSoftDark} />
            <MetaPill
              label={mockCount > 0 ? `${mockCount} mock feeds active` : "Provider-backed data"}
              tone={styles.metaPillSoftDark}
            />
          </View>
        </Card>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {tabs.map((item) => (
            <Pressable
              key={item}
              onPress={() => setTab(item)}
              style={[styles.tab, tab === item ? styles.tabActive : null]}
            >
              <Text style={[styles.tabText, tab === item ? styles.tabTextActive : null]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {tab === "Home" ? (
          <>
            <SectionTitle
              title="Today"
              note="What needs your attention, what can wait, and why."
              action={<Button label="Refresh Mock Data" onPress={() => actions.refreshMockData()} tone="ghost" />}
            />

            {stateSummary.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.stateBoardRow}
              >
                {stateSummary.map((item) => (
                  <Card key={item.state} tone="muted">
                    <Text style={styles.stateBoardCount}>{item.count}</Text>
                    <Text style={styles.stateBoardLabel}>{item.state}</Text>
                  </Card>
                ))}
              </ScrollView>
            ) : null}

            {selectedEye ? (
              <Card elevated>
                <View style={styles.inlineBetweenStart}>
                  <View style={styles.flexOne}>
                    <Text style={styles.cardEyebrow}>Focus eye</Text>
                    <Text style={styles.cardTitle}>{selectedEye ? eyeLine(selectedEye, data.stocks, data.recipes) : "No Eye"}</Text>
                    <Text style={styles.cardBody}>
                      {selectedEye.lastEvaluation?.whyNow ?? "This Eye has not been evaluated yet."}
                    </Text>
                  </View>
                  <Text style={stateTone(selectedEye.lastEvaluation?.currentState)}>
                    {selectedEye.lastEvaluation?.currentState ?? "Not Evaluated"}
                  </Text>
                </View>

                <View style={styles.metaPillRow}>
                  <MetaPill label={selectedEye.lastEvaluation?.actionUrgency ?? "Wait"} />
                  <MetaPill label={`Setup ${selectedEye.lastEvaluation?.setupStrength ?? "Low"}`} />
                  {selectedRecipe ? <MetaPill label={selectedRecipe.timeHorizon || "No horizon"} /> : null}
                  {selectedSnapshot ? (
                    <MetaPill
                      label={`${selectedSnapshot.sourceName} · ${selectedSnapshot.freshness}`}
                      tone={selectedSnapshot.isMock ? styles.metaPillMock : undefined}
                    />
                  ) : null}
                </View>

                {selectedStock ? (
                  <View style={styles.snapshotGrid}>
                    <View style={styles.snapshotMetric}>
                      <Text style={styles.snapshotLabel}>Symbol</Text>
                      <Text style={styles.snapshotValue}>{selectedStock.symbol}</Text>
                    </View>
                    <View style={styles.snapshotMetric}>
                      <Text style={styles.snapshotLabel}>Price</Text>
                      <Text style={styles.snapshotValue}>
                        {selectedSnapshot ? `$${selectedSnapshot.price.toFixed(2)}` : "N/A"}
                      </Text>
                    </View>
                    <View style={styles.snapshotMetric}>
                      <Text style={styles.snapshotLabel}>Drawdown</Text>
                      <Text style={styles.snapshotValue}>
                        {selectedSnapshot ? `${selectedSnapshot.drawdownPct}%` : "N/A"}
                      </Text>
                    </View>
                    <View style={styles.snapshotMetric}>
                      <Text style={styles.snapshotLabel}>Updated</Text>
                      <Text style={styles.snapshotValue}>
                        {selectedSnapshot ? formatDate(selectedSnapshot.updatedAt) : "N/A"}
                      </Text>
                    </View>
                  </View>
                ) : null}

                <View style={styles.dualColumn}>
                  <View style={styles.evidenceColumn}>
                    <Text style={styles.columnTitle}>Supporting evidence</Text>
                    {(selectedEye.lastEvaluation?.supportingEvidence ?? []).slice(0, 4).map((item) => (
                      <Text key={item} style={styles.listLine}>
                        + {item}
                      </Text>
                    ))}
                  </View>
                  <View style={styles.evidenceColumn}>
                    <Text style={styles.columnTitle}>Risks and contradictions</Text>
                    {(selectedEye.lastEvaluation?.contradictingEvidence ?? []).slice(0, 4).map((item) => (
                      <Text key={item} style={styles.listLine}>
                        - {item}
                      </Text>
                    ))}
                  </View>
                </View>

                <View style={styles.annotationBlock}>
                  <Text style={styles.annotationLabel}>Original thesis snapshot</Text>
                  <Text style={styles.annotationText}>{selectedEye.thesisSnapshot}</Text>
                </View>

                <Text style={styles.footnote}>{selectedEye.lastEvaluation?.dataQuality}</Text>
              </Card>
            ) : (
              <Card>
                <Text style={styles.cardBody}>No Eyes yet. Add a stock, choose a recipe, and start monitoring.</Text>
              </Card>
            )}

            <SectionTitle title="Review Queue" note="A five-second scan should be enough to know what changed." />
            {alertQueue.length > 0 ? (
              <View style={styles.stack}>
                {alertQueue.slice(0, 5).map((alert) => {
                  const alertEye = data.eyes.find((eye) => eye.id === alert.eyeId);
                  return (
                    <Pressable
                      key={alert.id}
                      onPress={() => {
                        setSelectedAlertId(alert.id);
                        if (alertEye) {
                          setSelectedEyeId(alertEye.id);
                        }
                      }}
                    >
                      <Card elevated={selectedAlert?.id === alert.id} tone={selectedAlert?.id === alert.id ? "default" : "muted"}>
                        <View style={styles.inlineBetweenStart}>
                          <View style={styles.flexOne}>
                            <Text style={styles.alertSymbol}>
                              {stockLabel(data.stocks, alertEye?.stockId ?? "")}
                            </Text>
                            <Text style={styles.alertTitle}>{alert.title}</Text>
                            <Text style={styles.cardBody}>{alert.whyNow}</Text>
                          </View>
                          <View style={styles.alertMetaCol}>
                            <View style={priorityTone(alert.priority)}>
                              <Text style={styles.priorityBadgeText}>{alert.priority}</Text>
                            </View>
                            <Text style={styles.alertTimestamp}>{formatDate(alert.createdAt)}</Text>
                          </View>
                        </View>
                        <Text style={styles.metaLine}>{alert.stateChange}</Text>
                        <Text style={styles.metaLine}>Support: {alert.supportingEvidence.join(" | ") || "None"}</Text>
                        <Text style={styles.metaLine}>Risks: {alert.risks.join(" | ") || "None"}</Text>
                        <View style={styles.actionRow}>
                          <Button label="Entered" onPress={() => void quickDecision("Entered")} />
                          <Button label="Skipped" onPress={() => void quickDecision("Skipped")} tone="secondary" />
                          <Button label="Snoozed" onPress={() => void quickDecision("Snoozed")} tone="ghost" />
                        </View>
                      </Card>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Card>
                <Text style={styles.cardBody}>No alerts are open right now.</Text>
              </Card>
            )}

            <SectionTitle title="Recent Decisions" note="Keep the feedback loop close to the monitoring surface." />
            {recentDecisions.length > 0 ? (
              <View style={styles.stack}>
                {recentDecisions.map((decision) => (
                  <Card key={decision.id} tone="muted">
                    <Text style={styles.decisionHeading}>
                      {decision.action} · {decisionTitle(decision.eyeId, data.eyes, data.stocks, data.recipes)}
                    </Text>
                    <Text style={styles.cardBody}>{decision.note}</Text>
                    <Text style={styles.metaLine}>
                      Thesis {decision.thesisValid} · Timing {decision.timing} · {formatDate(decision.createdAt)}
                    </Text>
                  </Card>
                ))}
              </View>
            ) : (
              <Card tone="muted">
                <Text style={styles.cardBody}>No decisions logged yet.</Text>
              </Card>
            )}
          </>
        ) : null}

        {tab === "Eyes" ? (
          <>
            <SectionTitle
              title="Active Eyes"
              note="Each Eye should explain current state, top reason, freshness, and the next useful action."
              action={<Button label="Load Curated Starter" onPress={() => actions.resetToSeed()} tone="ghost" />}
            />
            <View style={styles.stack}>
              {eyesSorted.map((eye) => {
                const stock = data.stocks.find((item) => item.id === eye.stockId);
                const recipe = data.recipes.find((item) => item.id === eye.recipeId);
                const snapshot = data.snapshots.find((item) => item.stockId === eye.stockId);
                const relatedAlert = alertQueue.find((alert) => alert.eyeId === eye.id && !alert.reviewed);
                return (
                  <Pressable
                    key={eye.id}
                    onPress={() => {
                      setSelectedEyeId(eye.id);
                      if (relatedAlert) {
                        setSelectedAlertId(relatedAlert.id);
                      }
                      setTab("Home");
                    }}
                  >
                    <Card elevated={selectedEye?.id === eye.id}>
                      <View style={styles.inlineBetweenStart}>
                        <View style={styles.flexOne}>
                          <Text style={styles.cardEyebrow}>{stock?.name ?? "Unknown company"}</Text>
                          <Text style={styles.cardTitle}>
                            {stock?.symbol ?? "Unknown"} · {recipe?.name ?? "Unknown recipe"}
                          </Text>
                          <Text style={styles.cardBody}>{topReason(eye)}</Text>
                        </View>
                        <Text style={stateTone(eye.lastEvaluation?.currentState)}>
                          {eye.lastEvaluation?.currentState ?? "Not Evaluated"}
                        </Text>
                      </View>
                      <View style={styles.metaPillRow}>
                        <MetaPill label={eye.lastEvaluation?.actionUrgency ?? "Wait"} />
                        {snapshot ? (
                          <MetaPill
                            label={`${snapshot.freshness} · ${formatDate(snapshot.updatedAt)}`}
                            tone={snapshot.isMock ? styles.metaPillMock : undefined}
                          />
                        ) : null}
                        {relatedAlert ? <MetaPill label={`Alert ${relatedAlert.priority}`} /> : null}
                      </View>
                      <Text style={styles.metaLine}>{eye.thesisSnapshot}</Text>
                    </Card>
                  </Pressable>
                );
              })}
            </View>

            <SectionTitle title="Create Eye" note="A stock is watched through an explicit recipe, not a vague alert." />
            <Card elevated>
              <View style={styles.formBlock}>
                <Text style={styles.formTitle}>1. Add stock to memory</Text>
                <Text style={styles.formNote}>Keep it deliberate. Save only names worth repeated review.</Text>
                <Text style={styles.inputLabel}>Ticker</Text>
                <Input
                  value={stockForm.symbol}
                  onChangeText={(symbol) => setStockForm((current) => ({ ...current, symbol }))}
                  placeholder="Ticker symbol"
                />
                <Text style={styles.inputLabel}>Company</Text>
                <Input
                  value={stockForm.name}
                  onChangeText={(name) => setStockForm((current) => ({ ...current, name }))}
                  placeholder="Company name"
                />
                <Text style={styles.inputLabel}>Why this stock belongs here</Text>
                <Input
                  value={stockForm.thesis}
                  onChangeText={(thesis) => setStockForm((current) => ({ ...current, thesis }))}
                  placeholder="Why this stock belongs in your memory system"
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
              </View>

              <View style={styles.divider} />

              <View style={styles.formBlock}>
                <Text style={styles.formTitle}>2. Apply recipe to stock</Text>
                <Text style={styles.formNote}>This creates a living monitor, not a one-off trigger.</Text>
                <SelectChips
                  label="Stock"
                  emptyLabel="Add a stock first."
                  options={data.stocks.map((stock) => ({
                    id: stock.id,
                    title: stock.symbol,
                    subtitle: stock.name,
                  }))}
                  selectedId={eyeForm.stockId}
                  onSelect={(stockId) => setEyeForm((current) => ({ ...current, stockId }))}
                />
                <SelectChips
                  label="Recipe"
                  emptyLabel="Create a recipe first."
                  options={data.recipes.map((recipe) => ({
                    id: recipe.id,
                    title: recipe.name,
                    subtitle: recipe.timeHorizon,
                  }))}
                  selectedId={eyeForm.recipeId}
                  onSelect={(recipeId) => setEyeForm((current) => ({ ...current, recipeId }))}
                />
                <Text style={styles.inputLabel}>Why this pairing matters</Text>
                <Input
                  value={eyeForm.thesisSnapshot}
                  onChangeText={(thesisSnapshot) =>
                    setEyeForm((current) => ({ ...current, thesisSnapshot }))
                  }
                  placeholder="Why this exact stock under this recipe is worth monitoring"
                  multiline
                />
                <Button
                  label="Create Eye"
                  onPress={() => {
                    if (!eyeForm.stockId || !eyeForm.recipeId || !eyeForm.thesisSnapshot.trim()) return;
                    void actions.addEye(eyeForm);
                    setEyeForm({ stockId: "", recipeId: "", thesisSnapshot: "" });
                  }}
                />
              </View>
            </Card>
          </>
        ) : null}

        {tab === "Recipes" ? (
          <>
            <SectionTitle title="Recipe Library" note="Human-readable investing logic first. Technical expansion can come later." />
            <View style={styles.stack}>
              {data.recipes.map((recipe) => (
                <Card key={recipe.id} elevated>
                  <View style={styles.inlineBetweenStart}>
                    <View style={styles.flexOne}>
                      <Text style={styles.cardEyebrow}>Version {recipe.version}</Text>
                      <Text style={styles.cardTitle}>{recipe.name}</Text>
                      <Text style={styles.cardBody}>{recipe.purpose}</Text>
                    </View>
                    <MetaPill label={recipe.timeHorizon || "No horizon"} />
                  </View>
                  <Text style={styles.metaLine}>Use case: {recipe.intendedUseCase || "Not specified yet"}</Text>
                  {recipe.conditions.map((condition) => (
                    <Text key={condition.id} style={styles.listLine}>
                      {condition.kind === "required"
                        ? "+ "
                        : condition.kind === "supporting"
                          ? "+ "
                          : condition.kind === "negative"
                            ? "- "
                            : "! "}
                      {condition.label}
                    </Text>
                  ))}
                  {recipe.notes ? <Text style={styles.footnote}>{recipe.notes}</Text> : null}
                </Card>
              ))}
            </View>

            <SectionTitle title="Draft New Recipe" note="The builder stays plain-language for now." />
            <Card elevated>
              <Text style={styles.inputLabel}>Recipe name</Text>
              <Input
                value={recipeForm.name}
                onChangeText={(name) => setRecipeForm((current) => ({ ...current, name }))}
                placeholder="Temporary Bargain Sale"
              />
              <Text style={styles.inputLabel}>Purpose</Text>
              <Input
                value={recipeForm.purpose}
                onChangeText={(purpose) => setRecipeForm((current) => ({ ...current, purpose }))}
                placeholder="What investment idea does this represent?"
                multiline
              />
              <Text style={styles.inputLabel}>Time horizon</Text>
              <Input
                value={recipeForm.timeHorizon}
                onChangeText={(timeHorizon) =>
                  setRecipeForm((current) => ({ ...current, timeHorizon }))
                }
                placeholder="Weeks, months, or years?"
              />
              <Text style={styles.inputLabel}>Intended use case</Text>
              <Input
                value={recipeForm.intendedUseCase}
                onChangeText={(intendedUseCase) =>
                  setRecipeForm((current) => ({ ...current, intendedUseCase }))
                }
                placeholder="When should this recipe be applied?"
                multiline
              />
              <Text style={styles.inputLabel}>Notes</Text>
              <Input
                value={recipeForm.notes}
                onChangeText={(notes) => setRecipeForm((current) => ({ ...current, notes }))}
                placeholder="Risks, disqualifiers, or review ideas"
                multiline
              />
              <Button
                label="Save Recipe Draft"
                onPress={() => {
                  if (!recipeForm.name.trim()) return;
                  void actions.addRecipe(recipeForm);
                  setRecipeForm({
                    name: "",
                    purpose: "",
                    timeHorizon: "",
                    intendedUseCase: "",
                    notes: "",
                  });
                }}
              />
            </Card>
          </>
        ) : null}

        {tab === "Journal" ? (
          <>
            <SectionTitle title="Decision Journal" note="Fast prompts, minimal friction, enough context to learn later." />
            <Card elevated>
              <SelectChips
                label="Eye"
                emptyLabel="Create an Eye first."
                options={data.eyes.map((eye) => ({
                  id: eye.id,
                  title: stockLabel(data.stocks, eye.stockId),
                  subtitle: recipeLabel(data.recipes, eye.recipeId),
                }))}
                selectedId={decisionForm.eyeId}
                onSelect={(eyeId) => setDecisionForm((current) => ({ ...current, eyeId }))}
              />
              <SelectChips
                label="Related alert"
                emptyLabel="No alerts yet."
                options={alertQueue.map((alert) => ({
                  id: alert.id,
                  title: stockLabel(
                    data.stocks,
                    data.eyes.find((eye) => eye.id === alert.eyeId)?.stockId ?? "",
                  ),
                  subtitle: alert.stateChange,
                }))}
                selectedId={decisionForm.alertId}
                onSelect={(alertId) => {
                  const linkedAlert = data.alerts.find((alert) => alert.id === alertId);
                  setDecisionForm((current) => ({
                    ...current,
                    alertId,
                    eyeId: linkedAlert?.eyeId ?? current.eyeId,
                    note: linkedAlert?.whyNow ?? current.note,
                  }));
                }}
              />
              <Text style={styles.inputLabel}>Action</Text>
              <ChoiceGroup
                options={decisionActions}
                selected={decisionForm.action}
                onSelect={(action) => setDecisionForm((current) => ({ ...current, action }))}
              />
              <Text style={styles.inputLabel}>Why did you act this way?</Text>
              <Input
                value={decisionForm.note}
                onChangeText={(note) => setDecisionForm((current) => ({ ...current, note }))}
                placeholder="Why did you enter, skip, or delay?"
                multiline
              />
              <Text style={styles.inputLabel}>Main concern</Text>
              <Input
                value={decisionForm.concern}
                onChangeText={(concern) => setDecisionForm((current) => ({ ...current, concern }))}
                placeholder="What risk mattered most?"
                multiline
              />
              <Text style={styles.inputLabel}>Was the thesis still valid?</Text>
              <ChoiceGroup
                options={thesisValidityOptions}
                selected={decisionForm.thesisValid}
                onSelect={(thesisValid) => setDecisionForm((current) => ({ ...current, thesisValid }))}
              />
              <Text style={styles.inputLabel}>Was the alert early, on time, or late?</Text>
              <ChoiceGroup
                options={timingOptions}
                selected={decisionForm.timing}
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

            <SectionTitle title="History" note="Review quality of decisions before trying to optimize recipes." />
            <View style={styles.stack}>
              {data.decisions.map((decision) => (
                <Card key={decision.id} tone="muted">
                  <Text style={styles.decisionHeading}>
                    {decision.action} · {decisionTitle(decision.eyeId, data.eyes, data.stocks, data.recipes)}
                  </Text>
                  <Text style={styles.cardBody}>{decision.note}</Text>
                  <Text style={styles.metaLine}>Concern: {decision.concern || "Not captured"}</Text>
                  <Text style={styles.metaLine}>
                    Thesis {decision.thesisValid} · Timing {decision.timing} · {formatDate(decision.createdAt)}
                  </Text>
                </Card>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f4f7fb",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0b1220",
  },
  loadingText: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "600",
    fontFamily,
  },
  page: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 42,
    gap: 18,
  },
  card: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d9e2ec",
  },
  cardDark: {
    backgroundColor: "#0b1220",
    borderColor: "#182235",
  },
  cardMuted: {
    backgroundColor: "#f8fafc",
  },
  cardElevated: {
    shadowColor: "#08101f",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },
  heroTopline: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  heroEyebrow: {
    color: "#56f0a7",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    fontFamily,
  },
  heroTimestamp: {
    color: "#94a3b8",
    fontSize: 12,
    fontFamily,
  },
  heroTitle: {
    marginTop: 16,
    color: "#f8fafc",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800",
    fontFamily,
  },
  heroSubtitle: {
    marginTop: 10,
    color: "#cbd5e1",
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 560,
    fontFamily,
  },
  metricStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 22,
  },
  metricCard: {
    flexGrow: 1,
    minWidth: 96,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#111c2e",
    borderWidth: 1,
    borderColor: "#1f2c42",
  },
  metricValue: {
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "800",
    fontFamily,
  },
  metricLabel: {
    marginTop: 6,
    color: "#94a3b8",
    fontSize: 12,
    fontFamily,
  },
  heroFootRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  tabRow: {
    gap: 10,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#eaf0f6",
    borderWidth: 1,
    borderColor: "#d8e2ec",
  },
  tabActive: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
  },
  tabText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700",
    fontFamily,
  },
  tabTextActive: {
    color: "#0f172a",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },
  sectionHeaderText: {
    flex: 1,
    gap: 4,
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
  stateBoardRow: {
    gap: 12,
  },
  stateBoardCount: {
    color: "#0f172a",
    fontSize: 28,
    fontWeight: "800",
    fontFamily,
  },
  stateBoardLabel: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 13,
    maxWidth: 120,
    lineHeight: 18,
    fontFamily,
  },
  inlineBetweenStart: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
  },
  flexOne: {
    flex: 1,
  },
  cardEyebrow: {
    color: "#3b82f6",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily,
  },
  cardTitle: {
    marginTop: 8,
    color: "#0f172a",
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
    fontFamily,
  },
  cardBody: {
    marginTop: 10,
    color: "#334155",
    fontSize: 15,
    lineHeight: 22,
    fontFamily,
  },
  statePill: {
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "700",
    fontFamily,
  },
  statePillAttention: {
    color: "#ffffff",
    backgroundColor: "#ef4444",
  },
  statePillOpportunity: {
    color: "#052e16",
    backgroundColor: "#86efac",
  },
  statePillRisk: {
    color: "#7f1d1d",
    backgroundColor: "#fecaca",
  },
  statePillBroken: {
    color: "#ffffff",
    backgroundColor: "#991b1b",
  },
  statePillWatch: {
    color: "#1e3a8a",
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
  metaPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#eff4f9",
  },
  metaPillText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
    fontFamily,
  },
  metaPillMock: {
    backgroundColor: "#dbeafe",
  },
  metaPillSoftDark: {
    backgroundColor: "#131d30",
  },
  snapshotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 18,
  },
  snapshotMetric: {
    minWidth: "47%",
    flexGrow: 1,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  snapshotLabel: {
    color: "#64748b",
    fontSize: 12,
    fontFamily,
  },
  snapshotValue: {
    marginTop: 6,
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "800",
    fontFamily,
  },
  dualColumn: {
    gap: 12,
    marginTop: 18,
  },
  evidenceColumn: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
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
    marginTop: 3,
    fontFamily,
  },
  annotationBlock: {
    marginTop: 18,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#0f172a",
  },
  annotationLabel: {
    color: "#34d399",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily,
  },
  annotationText: {
    marginTop: 8,
    color: "#dbe4ee",
    fontSize: 14,
    lineHeight: 21,
    fontFamily,
  },
  footnote: {
    marginTop: 14,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
    fontFamily,
  },
  stack: {
    gap: 12,
  },
  alertSymbol: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily,
  },
  alertTitle: {
    marginTop: 6,
    color: "#0f172a",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
    fontFamily,
  },
  alertMetaCol: {
    alignItems: "flex-end",
    gap: 8,
  },
  priorityBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  priorityHigh: {
    backgroundColor: "#ef4444",
  },
  priorityMedium: {
    backgroundColor: "#f59e0b",
  },
  priorityLow: {
    backgroundColor: "#cbd5e1",
  },
  priorityBadgeText: {
    color: "#f8fafc",
    fontSize: 11,
    fontWeight: "700",
    fontFamily,
  },
  alertTimestamp: {
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
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  button: {
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: {
    backgroundColor: "#12b76a",
  },
  buttonSecondary: {
    backgroundColor: "#e8f0fb",
  },
  buttonGhost: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d7e3ef",
  },
  buttonText: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily,
  },
  buttonPrimaryText: {
    color: "#04130c",
  },
  buttonSecondaryText: {
    color: "#1d4ed8",
  },
  buttonGhostText: {
    color: "#334155",
  },
  formBlock: {
    gap: 10,
  },
  formTitle: {
    color: "#0f172a",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
    fontFamily,
  },
  formNote: {
    color: "#64748b",
    fontSize: 14,
    lineHeight: 20,
    fontFamily,
  },
  divider: {
    marginVertical: 18,
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  inputLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 4,
    fontFamily,
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d7e3ef",
    backgroundColor: "#f8fbff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#0f172a",
    fontSize: 15,
    fontFamily,
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  selectBlock: {
    gap: 8,
  },
  emptyInline: {
    color: "#64748b",
    fontSize: 13,
    fontFamily,
  },
  selectRow: {
    gap: 10,
  },
  selectChip: {
    minWidth: 132,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#f8fbff",
    borderWidth: 1,
    borderColor: "#d7e3ef",
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
    color: "#94a3b8",
  },
  choiceGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  choiceChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d7e3ef",
    backgroundColor: "#f8fbff",
  },
  choiceChipActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  choiceChipText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "600",
    fontFamily,
  },
  choiceChipTextActive: {
    color: "#f8fafc",
  },
  decisionHeading: {
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    fontFamily,
  },
});
