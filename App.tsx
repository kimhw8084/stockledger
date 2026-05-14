import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAppModel } from "./src/hooks/useAppModel";
import { Alert, DecisionAction, Eye, Recipe, Stock } from "./src/types";

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
      return styles.stateCritical;
    case "Opportunity Zone Forming":
      return styles.stateOpportunity;
    case "Thesis Risk Rising":
    case "Thesis Broken":
      return styles.stateRisk;
    case "Watch Closely":
      return styles.stateWatch;
    default:
      return styles.stateQuiet;
  }
};

const priorityTone = (priority: Alert["priority"]) => {
  switch (priority) {
    case "High":
      return styles.priorityHigh;
    case "Medium":
      return styles.priorityMedium;
    default:
      return styles.priorityLow;
  }
};

const Card = ({
  children,
  elevated,
}: {
  children: React.ReactNode;
  elevated?: boolean;
}) => <View style={[styles.card, elevated ? styles.cardElevated : null]}>{children}</View>;

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
    placeholderTextColor="#73808c"
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
    <Text style={styles.selectLabel}>{label}</Text>
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
      [...(data?.eyes ?? [])].sort((a, b) =>
        urgencyWeight(a.lastEvaluation?.actionUrgency) - urgencyWeight(b.lastEvaluation?.actionUrgency),
      ),
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
    }
  }, [eyesSorted, selectedEyeId]);

  useEffect(() => {
    const openAlert = alertQueue.find((item) => !item.reviewed) ?? alertQueue[0];
    if (!selectedAlertId && openAlert) {
      setSelectedAlertId(openAlert.id);
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
  }, [data, eyeForm.recipeId, eyeForm.stockId]);

  if (loading || !data) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar style="dark" />
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
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>Personal investment recipe engine</Text>
          <Text style={styles.title}>StockLedger</Text>
          <Text style={styles.subtitle}>
            Evidence-first stock memory for opportunities you do not want to lose. This build is
            local-first and honest about mock data.
          </Text>

          <View style={styles.metricStrip}>
            <Card elevated>
              <Text style={styles.metricValue}>{openAlerts}</Text>
              <Text style={styles.metricLabel}>Open alerts</Text>
            </Card>
            <Card elevated>
              <Text style={styles.metricValue}>{criticalEyes}</Text>
              <Text style={styles.metricLabel}>Risk or attention</Text>
            </Card>
            <Card elevated>
              <Text style={styles.metricValue}>{opportunityEyes}</Text>
              <Text style={styles.metricLabel}>Opportunity forming</Text>
            </Card>
          </View>
        </View>

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
              title="Attention Today"
              note="A mobile-first review surface. Prioritized by meaningful state, not price noise."
              action={<Button label="Refresh Mock Data" onPress={() => actions.refreshMockData()} tone="ghost" />}
            />

            {selectedEye ? (
              <Card elevated>
                <View style={styles.inlineBetween}>
                  <View style={styles.flexOne}>
                    <Text style={styles.cardEyebrow}>Focus eye</Text>
                    <Text style={styles.cardTitle}>{eyeLine(selectedEye, data.stocks, data.recipes)}</Text>
                    <Text style={styles.cardBody}>{selectedEye.lastEvaluation?.whyNow}</Text>
                  </View>
                  <Text style={[styles.statePill, stateTone(selectedEye.lastEvaluation?.currentState)]}>
                    {selectedEye.lastEvaluation?.currentState ?? "Not Evaluated"}
                  </Text>
                </View>

                <View style={styles.metaPillRow}>
                  <MetaPill label={selectedEye.lastEvaluation?.actionUrgency ?? "Wait"} />
                  <MetaPill label={selectedEye.lastEvaluation?.setupStrength ?? "Low"} />
                  {selectedSnapshot ? (
                    <MetaPill label={selectedSnapshot.freshness} tone={styles.metaPillMock} />
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
                    <Text style={styles.columnTitle}>Contradictions and risks</Text>
                    {(selectedEye.lastEvaluation?.contradictingEvidence ?? []).slice(0, 4).map((item) => (
                      <Text key={item} style={styles.listLine}>
                        - {item}
                      </Text>
                    ))}
                  </View>
                </View>

                <Text style={styles.footnote}>{selectedEye.lastEvaluation?.dataQuality}</Text>
              </Card>
            ) : (
              <Card>
                <Text style={styles.cardBody}>No Eyes yet. Add a stock, pick a recipe, and create an Eye.</Text>
              </Card>
            )}

            <SectionTitle title="Alert Queue" note="Tap an alert to review it in place." />
            {selectedAlert ? (
              <Card elevated>
                <View style={styles.inlineBetween}>
                  <View style={styles.flexOne}>
                    <Text style={styles.cardEyebrow}>Selected alert</Text>
                    <Text style={styles.cardTitle}>{selectedAlert.title}</Text>
                    <Text style={styles.cardBody}>{selectedAlert.whyNow}</Text>
                  </View>
                  <View style={[styles.priorityBadge, priorityTone(selectedAlert.priority)]}>
                    <Text style={styles.priorityBadgeText}>{selectedAlert.priority}</Text>
                  </View>
                </View>
                <Text style={styles.metaLine}>
                  {selectedAlert.stateChange} · {selectedAlert.reviewed ? "Reviewed" : "Open"} ·{" "}
                  {formatDate(selectedAlert.createdAt)}
                </Text>
                <Text style={styles.metaLine}>Support: {selectedAlert.supportingEvidence.join(" | ") || "None"}</Text>
                <Text style={styles.metaLine}>Risks: {selectedAlert.risks.join(" | ") || "None"}</Text>
                <Text style={styles.footnote}>{selectedAlert.dataQuality}</Text>
                <View style={styles.actionRow}>
                  <Button label="Entered" onPress={() => void quickDecision("Entered")} />
                  <Button label="Skipped" onPress={() => void quickDecision("Skipped")} tone="secondary" />
                  <Button label="Snoozed" onPress={() => void quickDecision("Snoozed")} tone="secondary" />
                </View>
                <View style={styles.actionRow}>
                  <Button
                    label="Mark Reviewed"
                    onPress={() => void actions.markAlertReviewed(selectedAlert.id)}
                    tone="ghost"
                  />
                  <Button
                    label="Journal It"
                    onPress={() => {
                      setDecisionForm((current) => ({
                        ...current,
                        eyeId: selectedAlert.eyeId,
                        alertId: selectedAlert.id,
                        note: selectedAlert.whyNow,
                      }));
                      setTab("Journal");
                    }}
                    tone="ghost"
                  />
                </View>
              </Card>
            ) : (
              <Card>
                <Text style={styles.cardBody}>No alerts to review right now.</Text>
              </Card>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectRow}>
              {alertQueue.map((alert) => (
                <Pressable
                  key={alert.id}
                  onPress={() => setSelectedAlertId(alert.id)}
                  style={[styles.alertChip, selectedAlert?.id === alert.id ? styles.alertChipActive : null]}
                >
                  <Text style={styles.alertChipTitle}>{stockLabel(data.stocks, data.eyes.find((eye) => eye.id === alert.eyeId)?.stockId ?? "")}</Text>
                  <Text style={styles.alertChipSubtitle}>{alert.stateChange}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        {tab === "Eyes" ? (
          <>
            <SectionTitle
              title="Create Eye"
              note="A stock is watched through a reason. Pick both explicitly."
              action={<Button label="Load Curated Starter" onPress={() => actions.resetToSeed()} tone="ghost" />}
            />
            <Card elevated>
              <View style={styles.formBlock}>
                <Text style={styles.formTitle}>1. Add stock to memory</Text>
                <Input
                  value={stockForm.symbol}
                  onChangeText={(symbol) => setStockForm((current) => ({ ...current, symbol }))}
                  placeholder="Ticker symbol"
                />
                <Input
                  value={stockForm.name}
                  onChangeText={(name) => setStockForm((current) => ({ ...current, name }))}
                  placeholder="Company name"
                />
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
                <Text style={styles.formTitle}>2. Apply a recipe</Text>
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

            <SectionTitle title="Active Eyes" note="Tap a card to make it the focus eye on Home." />
            {eyesSorted.map((eye) => {
              const stock = data.stocks.find((item) => item.id === eye.stockId);
              const snapshot = data.snapshots.find((item) => item.stockId === eye.stockId);
              return (
                <Pressable
                  key={eye.id}
                  onPress={() => {
                    setSelectedEyeId(eye.id);
                    setTab("Home");
                  }}
                >
                  <Card elevated={selectedEyeId === eye.id}>
                    <View style={styles.inlineBetween}>
                      <View style={styles.flexOne}>
                        <Text style={styles.cardTitle}>{eyeLine(eye, data.stocks, data.recipes)}</Text>
                        <Text style={styles.cardBody}>{eye.thesisSnapshot}</Text>
                      </View>
                      <Text style={[styles.statePill, stateTone(eye.lastEvaluation?.currentState)]}>
                        {eye.lastEvaluation?.currentState ?? "Not Evaluated"}
                      </Text>
                    </View>
                    <View style={styles.metaPillRow}>
                      <MetaPill label={eye.lastEvaluation?.actionUrgency ?? "Wait"} />
                      {snapshot ? <MetaPill label={snapshot.freshness} tone={styles.metaPillMock} /> : null}
                    </View>
                    <Text style={styles.metaLine}>{eye.lastEvaluation?.whyNow}</Text>
                    {stock ? <Text style={styles.footnote}>Original stock thesis: {stock.thesis}</Text> : null}
                  </Card>
                </Pressable>
              );
            })}
          </>
        ) : null}

        {tab === "Recipes" ? (
          <>
            <SectionTitle
              title="Recipe Builder"
              note="Keep rules human-readable. This is not a programming tool."
            />
            <Card elevated>
              <Input
                value={recipeForm.name}
                onChangeText={(name) => setRecipeForm((current) => ({ ...current, name }))}
                placeholder="Recipe name"
              />
              <Input
                value={recipeForm.purpose}
                onChangeText={(purpose) => setRecipeForm((current) => ({ ...current, purpose }))}
                placeholder="Purpose"
                multiline
              />
              <Input
                value={recipeForm.timeHorizon}
                onChangeText={(timeHorizon) => setRecipeForm((current) => ({ ...current, timeHorizon }))}
                placeholder="Time horizon"
              />
              <Input
                value={recipeForm.intendedUseCase}
                onChangeText={(intendedUseCase) =>
                  setRecipeForm((current) => ({ ...current, intendedUseCase }))
                }
                placeholder="Intended use case"
                multiline
              />
              <Input
                value={recipeForm.notes}
                onChangeText={(notes) => setRecipeForm((current) => ({ ...current, notes }))}
                placeholder="Notes and hard disqualifiers"
                multiline
              />
              <Button
                label="Save Recipe"
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

            <SectionTitle title="Recipe Library" note="Readable first. Conditions stay visible." />
            {data.recipes.map((recipe) => (
              <Card key={recipe.id}>
                <Text style={styles.cardTitle}>
                  {recipe.name} v{recipe.version}
                </Text>
                <Text style={styles.cardBody}>{recipe.purpose}</Text>
                <Text style={styles.metaLine}>
                  {recipe.timeHorizon} · {recipe.intendedUseCase}
                </Text>
                {recipe.conditions.map((condition) => (
                  <Text key={condition.id} style={styles.listLine}>
                    {condition.kind === "disqualifier" ? "!" : condition.kind === "negative" ? "-" : "+"}{" "}
                    {condition.label}
                  </Text>
                ))}
                <Text style={styles.footnote}>{recipe.notes}</Text>
              </Card>
            ))}
          </>
        ) : null}

        {tab === "Journal" ? (
          <>
            <SectionTitle title="Decision Journal" note="Guided logging, not blank note-taking." />
            <Card elevated>
              <SelectChips
                label="Eye"
                emptyLabel="Create an Eye first."
                options={data.eyes.map((eye) => ({
                  id: eye.id,
                  title: eyeLine(eye, data.stocks, data.recipes),
                  subtitle: eye.lastEvaluation?.currentState ?? "Not Evaluated",
                }))}
                selectedId={decisionForm.eyeId}
                onSelect={(eyeId) => setDecisionForm((current) => ({ ...current, eyeId }))}
              />
              <SelectChips
                label="Linked alert"
                emptyLabel="Optional. Choose an alert if this decision came from one."
                options={data.alerts.map((alert) => ({
                  id: alert.id,
                  title: alert.title,
                  subtitle: alert.stateChange,
                }))}
                selectedId={decisionForm.alertId}
                onSelect={(alertId) => setDecisionForm((current) => ({ ...current, alertId }))}
              />
              <Text style={styles.selectLabel}>Action</Text>
              <ChoiceGroup
                options={decisionActions}
                selected={decisionForm.action}
                onSelect={(action) => setDecisionForm((current) => ({ ...current, action }))}
              />
              <Input
                value={decisionForm.note}
                onChangeText={(note) => setDecisionForm((current) => ({ ...current, note }))}
                placeholder="Why did you make this decision?"
                multiline
              />
              <Input
                value={decisionForm.concern}
                onChangeText={(concern) => setDecisionForm((current) => ({ ...current, concern }))}
                placeholder="What risk concerned you most?"
                multiline
              />
              <Text style={styles.selectLabel}>Was the original thesis still valid?</Text>
              <ChoiceGroup
                options={thesisValidityOptions}
                selected={decisionForm.thesisValid}
                onSelect={(thesisValid) => setDecisionForm((current) => ({ ...current, thesisValid }))}
              />
              <Text style={styles.selectLabel}>Alert timing</Text>
              <ChoiceGroup
                options={timingOptions}
                selected={decisionForm.timing}
                onSelect={(timing) => setDecisionForm((current) => ({ ...current, timing }))}
              />
              <Button
                label="Save Decision"
                onPress={() => {
                  if (!decisionForm.eyeId.trim() || !decisionForm.note.trim()) return;
                  void actions.logDecision({
                    ...decisionForm,
                    alertId: decisionForm.alertId || undefined,
                  });
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

            <SectionTitle title="Recent Decisions" note="The product should teach the recipe loop over time." />
            {data.decisions.map((decision) => (
              <Card key={decision.id}>
                <View style={styles.inlineBetween}>
                  <View style={styles.flexOne}>
                    <Text style={styles.cardTitle}>{decision.action}</Text>
                    <Text style={styles.metaLine}>
                      {decisionTitle(decision.eyeId, data.eyes, data.stocks, data.recipes)}
                    </Text>
                  </View>
                  <Text style={styles.cardEyebrow}>{formatDate(decision.createdAt)}</Text>
                </View>
                <Text style={styles.cardBody}>{decision.note}</Text>
                <Text style={styles.metaLine}>
                  Thesis: {decision.thesisValid} · Timing: {decision.timing}
                </Text>
                <Text style={styles.footnote}>Top concern: {decision.concern || "None captured."}</Text>
              </Card>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f2efe8",
  },
  page: {
    paddingBottom: 40,
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f2efe8",
  },
  loadingText: {
    fontSize: 20,
    color: "#203246",
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    backgroundColor: "#e8e1d4",
    borderBottomWidth: 1,
    borderBottomColor: "#d8cfbe",
  },
  kicker: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    color: "#8d5d2c",
    marginBottom: 8,
    fontWeight: "700",
  },
  title: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "700",
    color: "#152638",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: "#42515f",
  },
  metricStrip: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#152638",
  },
  metricLabel: {
    marginTop: 4,
    fontSize: 12,
    color: "#5e6a75",
  },
  tabRow: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    gap: 10,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#e4ddd0",
  },
  tabActive: {
    backgroundColor: "#1f3448",
  },
  tabText: {
    color: "#4c5b68",
    fontSize: 14,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#f7f3ea",
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginTop: 18,
    marginBottom: 10,
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
    fontSize: 22,
    fontWeight: "700",
    color: "#152638",
  },
  sectionNote: {
    fontSize: 13,
    lineHeight: 18,
    color: "#697481",
  },
  card: {
    backgroundColor: "#fbf8f2",
    borderWidth: 1,
    borderColor: "#dfd5c6",
    borderRadius: 24,
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 18,
  },
  cardElevated: {
    shadowColor: "#17293b",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  cardEyebrow: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "#8d5d2c",
    fontWeight: "700",
  },
  cardTitle: {
    marginTop: 6,
    fontSize: 20,
    lineHeight: 24,
    color: "#152638",
    fontWeight: "700",
  },
  cardBody: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: "#44525f",
  },
  metaLine: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    color: "#67737f",
  },
  footnote: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
    color: "#75818c",
  },
  statePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
    color: "#152638",
  },
  stateCritical: {
    backgroundColor: "#f5c9b4",
  },
  stateOpportunity: {
    backgroundColor: "#f0dc9b",
  },
  stateRisk: {
    backgroundColor: "#edc2c1",
  },
  stateWatch: {
    backgroundColor: "#d6e0d1",
  },
  stateQuiet: {
    backgroundColor: "#dce4ea",
  },
  priorityBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  priorityHigh: {
    backgroundColor: "#f1b4b2",
  },
  priorityMedium: {
    backgroundColor: "#f2dd9c",
  },
  priorityLow: {
    backgroundColor: "#dde4ea",
  },
  priorityBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#152638",
  },
  metaPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  metaPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#e4ddd0",
  },
  metaPillMock: {
    backgroundColor: "#d7e1ec",
  },
  metaPillText: {
    fontSize: 12,
    color: "#475462",
    fontWeight: "600",
  },
  snapshotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  snapshotMetric: {
    width: "47%",
    backgroundColor: "#f1ece2",
    borderRadius: 18,
    padding: 12,
  },
  snapshotLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    color: "#7d6952",
    fontWeight: "700",
  },
  snapshotValue: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 20,
    color: "#203246",
    fontWeight: "600",
  },
  dualColumn: {
    gap: 12,
    marginTop: 16,
  },
  evidenceColumn: {
    backgroundColor: "#f4efe5",
    borderRadius: 18,
    padding: 14,
  },
  columnTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#203246",
    marginBottom: 8,
  },
  listLine: {
    fontSize: 14,
    lineHeight: 20,
    color: "#44525f",
    marginTop: 6,
  },
  inlineBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  flexOne: {
    flex: 1,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    flexWrap: "wrap",
  },
  button: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonPrimary: {
    backgroundColor: "#203246",
  },
  buttonSecondary: {
    backgroundColor: "#e4ddd0",
  },
  buttonGhost: {
    backgroundColor: "#f5f1e8",
    borderWidth: 1,
    borderColor: "#d6cdc0",
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  buttonPrimaryText: {
    color: "#f7f3ea",
  },
  buttonSecondaryText: {
    color: "#304354",
  },
  buttonGhostText: {
    color: "#5c6874",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d6cdc0",
    backgroundColor: "#fffdf9",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#203246",
    marginBottom: 12,
  },
  textArea: {
    minHeight: 92,
    textAlignVertical: "top",
  },
  formBlock: {
    gap: 2,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#203246",
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: "#e2d9ca",
    marginVertical: 18,
  },
  selectBlock: {
    marginBottom: 12,
  },
  selectLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#5d6976",
    marginBottom: 8,
  },
  selectRow: {
    gap: 10,
    paddingRight: 20,
  },
  selectChip: {
    width: 178,
    backgroundColor: "#f1ece2",
    borderWidth: 1,
    borderColor: "#dbd2c5",
    borderRadius: 20,
    padding: 14,
  },
  selectChipActive: {
    backgroundColor: "#203246",
    borderColor: "#203246",
  },
  selectChipTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#203246",
  },
  selectChipTitleActive: {
    color: "#f7f3ea",
  },
  selectChipSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: "#62707d",
  },
  selectChipSubtitleActive: {
    color: "#d5dde4",
  },
  emptyInline: {
    fontSize: 13,
    color: "#7b8893",
    marginBottom: 8,
  },
  choiceGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  choiceChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#e8e1d4",
  },
  choiceChipActive: {
    backgroundColor: "#203246",
  },
  choiceChipText: {
    fontSize: 13,
    color: "#50606d",
    fontWeight: "600",
  },
  choiceChipTextActive: {
    color: "#f7f3ea",
  },
  alertChip: {
    width: 180,
    backgroundColor: "#f1ece2",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dfd5c6",
    marginLeft: 20,
  },
  alertChipActive: {
    backgroundColor: "#203246",
    borderColor: "#203246",
  },
  alertChipTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#203246",
  },
  alertChipSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: "#65727e",
  },
});
