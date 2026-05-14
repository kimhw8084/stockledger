import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
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
import { DecisionAction, Eye, Recipe, Stock } from "./src/types";

type TabKey = "Home" | "Recipes" | "Eyes" | "Alerts" | "Journal" | "Outcomes";

const tabs: TabKey[] = ["Home", "Recipes", "Eyes", "Alerts", "Journal", "Outcomes"];

const formatDate = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const stateTone = (state?: string) => {
  switch (state) {
    case "Attention Needed":
      return styles.stateHigh;
    case "Opportunity Zone Forming":
      return styles.stateMedium;
    case "Thesis Risk Rising":
    case "Thesis Broken":
      return styles.stateRisk;
    default:
      return styles.stateLow;
  }
};

const Card = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.card}>{children}</View>
);

const SectionTitle = ({ title, note }: { title: string; note?: string }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {note ? <Text style={styles.sectionNote}>{note}</Text> : null}
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
    placeholderTextColor="#6c7786"
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
  tone?: "primary" | "secondary";
}) => (
  <Pressable
    onPress={onPress}
    style={[styles.button, tone === "secondary" ? styles.buttonSecondary : styles.buttonPrimary]}
  >
    <Text style={tone === "secondary" ? styles.buttonSecondaryText : styles.buttonPrimaryText}>
      {label}
    </Text>
  </Pressable>
);

const stockLabel = (stocks: Stock[], stockId: string) =>
  stocks.find((stock) => stock.id === stockId)?.symbol ?? "Unknown";

const recipeLabel = (recipes: Recipe[], recipeId: string) =>
  recipes.find((recipe) => recipe.id === recipeId)?.name ?? "Unknown";

const eyeLine = (eye: Eye, stocks: Stock[], recipes: Recipe[]) =>
  `${stockLabel(stocks, eye.stockId)} • ${recipeLabel(recipes, eye.recipeId)}`;

const decisionEyeLine = (eyeId: string, eyes: Eye[], stocks: Stock[], recipes: Recipe[]) => {
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
    thesisValid: "Yes" as "Yes" | "Partly" | "No",
    timing: "On Time" as "Early" | "On Time" | "Late",
  });

  if (loading || !data) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <Text style={styles.loadingText}>Loading StockLedger…</Text>
      </SafeAreaView>
    );
  }

  const topEyes = [...data.eyes]
    .sort((a, b) => (a.lastEvaluation?.actionUrgency ?? "").localeCompare(b.lastEvaluation?.actionUrgency ?? ""))
    .slice(0, 4);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.hero}>
        <Text style={styles.kicker}>Personal investment recipe engine</Text>
        <Text style={styles.title}>StockLedger</Text>
        <Text style={styles.subtitle}>
          A calm, mobile-first memory system for stock ideas. Current build uses clearly labeled mock
          market data through a replaceable adapter.
        </Text>
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

      <ScrollView contentContainerStyle={styles.content}>
        {tab === "Home" ? (
          <>
            <SectionTitle title="Attention Today" note="Prioritized by Eye state, not raw price noise." />
            {topEyes.map((eye) => (
              <Card key={eye.id}>
                <Text style={styles.cardTitle}>{eyeLine(eye, data.stocks, data.recipes)}</Text>
                <Text style={[styles.statePill, stateTone(eye.lastEvaluation?.currentState)]}>
                  {eye.lastEvaluation?.currentState ?? "Not Evaluated"}
                </Text>
                <Text style={styles.cardBody}>{eye.lastEvaluation?.whyNow}</Text>
                <Text style={styles.metaLine}>
                  Urgency: {eye.lastEvaluation?.actionUrgency} • Data: {eye.lastEvaluation?.dataQuality}
                </Text>
              </Card>
            ))}

            <View style={styles.actionRow}>
              <Button label="Refresh Mock Evaluations" onPress={() => actions.refreshMockData()} />
              <Button label="Reload Seed Snapshot" onPress={() => actions.resetToSeed()} tone="secondary" />
            </View>

            <SectionTitle title="Recent Alerts" note="Only meaningful state changes create alerts." />
            {data.alerts.slice(0, 3).map((alert) => (
              <Card key={alert.id}>
                <Text style={styles.cardTitle}>{alert.title}</Text>
                <Text style={styles.metaLine}>
                  {alert.priority} priority • {formatDate(alert.createdAt)}
                </Text>
                <Text style={styles.cardBody}>{alert.whyNow}</Text>
              </Card>
            ))}
          </>
        ) : null}

        {tab === "Recipes" ? (
          <>
            <SectionTitle title="Create Recipe" note="Human-readable first. Keep rules understandable." />
            <Card>
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
                placeholder="Notes"
                multiline
              />
              <Button
                label="Save Recipe"
                onPress={() => {
                  if (!recipeForm.name.trim()) return;
                  actions.addRecipe(recipeForm);
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

            <SectionTitle title="Recipe Library" />
            {data.recipes.map((recipe) => (
              <Card key={recipe.id}>
                <Text style={styles.cardTitle}>
                  {recipe.name} v{recipe.version}
                </Text>
                <Text style={styles.cardBody}>{recipe.purpose}</Text>
                <Text style={styles.metaLine}>
                  {recipe.timeHorizon} • {recipe.conditions.length} conditions
                </Text>
                <Text style={styles.cardBody}>{recipe.notes}</Text>
              </Card>
            ))}
          </>
        ) : null}

        {tab === "Eyes" ? (
          <>
            <SectionTitle title="Add Stock" note="Start watchlist-first. No broad scanner in V1." />
            <Card>
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
                  actions.addStock(stockForm);
                  setStockForm({ symbol: "", name: "", thesis: "" });
                }}
              />
            </Card>

            <SectionTitle title="Create Eye" note="A stock is watched through a reason." />
            <Card>
              <Input
                value={eyeForm.stockId}
                onChangeText={(stockId) => setEyeForm((current) => ({ ...current, stockId }))}
                placeholder="Stock ID from the list below"
              />
              <Input
                value={eyeForm.recipeId}
                onChangeText={(recipeId) => setEyeForm((current) => ({ ...current, recipeId }))}
                placeholder="Recipe ID from the list below"
              />
              <Input
                value={eyeForm.thesisSnapshot}
                onChangeText={(thesisSnapshot) =>
                  setEyeForm((current) => ({ ...current, thesisSnapshot }))
                }
                placeholder="Thesis snapshot for this Eye"
                multiline
              />
              <Button
                label="Create Eye"
                onPress={() => {
                  if (!eyeForm.stockId || !eyeForm.recipeId || !eyeForm.thesisSnapshot.trim()) return;
                  actions.addEye(eyeForm);
                  setEyeForm({ stockId: "", recipeId: "", thesisSnapshot: "" });
                }}
              />
            </Card>

            <SectionTitle title="Stocks" />
            {data.stocks.map((stock) => (
              <Card key={stock.id}>
                <Text style={styles.cardTitle}>
                  {stock.symbol} • {stock.name}
                </Text>
                <Text style={styles.metaLine}>ID: {stock.id}</Text>
                <Text style={styles.cardBody}>{stock.thesis}</Text>
              </Card>
            ))}

            <SectionTitle title="Eyes" />
            {data.eyes.map((eye) => (
              <Card key={eye.id}>
                <Text style={styles.cardTitle}>{eyeLine(eye, data.stocks, data.recipes)}</Text>
                <Text style={styles.metaLine}>ID: {eye.id}</Text>
                <Text style={[styles.statePill, stateTone(eye.lastEvaluation?.currentState)]}>
                  {eye.lastEvaluation?.currentState ?? "Not Evaluated"}
                </Text>
                <Text style={styles.cardBody}>{eye.thesisSnapshot}</Text>
                <Text style={styles.metaLine}>{eye.lastEvaluation?.whyNow}</Text>
              </Card>
            ))}
          </>
        ) : null}

        {tab === "Alerts" ? (
          <>
            <SectionTitle title="Alert Review" note="Alerts explain why now, risks, and what changed." />
            {data.alerts.length === 0 ? (
              <Card>
                <Text style={styles.cardBody}>No alerts yet. Refresh mock data or add more Eyes to trigger state changes.</Text>
              </Card>
            ) : null}
            {data.alerts.map((alert) => (
              <Card key={alert.id}>
                <Text style={styles.cardTitle}>{alert.title}</Text>
                <Text style={styles.metaLine}>
                  {alert.stateChange} • {alert.priority} priority • {alert.reviewed ? "Reviewed" : "Open"}
                </Text>
                <Text style={styles.cardBody}>{alert.whyNow}</Text>
                <Text style={styles.metaLine}>Support: {alert.supportingEvidence.join(" | ") || "None"}</Text>
                <Text style={styles.metaLine}>Risks: {alert.risks.join(" | ") || "None"}</Text>
                <Text style={styles.metaLine}>Data quality: {alert.dataQuality}</Text>
              </Card>
            ))}
          </>
        ) : null}

        {tab === "Journal" ? (
          <>
            <SectionTitle title="Log Decision" note="Fast guided prompts instead of blank journaling." />
            <Card>
              <Input
                value={decisionForm.eyeId}
                onChangeText={(eyeId) => setDecisionForm((current) => ({ ...current, eyeId }))}
                placeholder="Eye ID"
              />
              <Input
                value={decisionForm.alertId}
                onChangeText={(alertId) => setDecisionForm((current) => ({ ...current, alertId }))}
                placeholder="Alert ID if logging from an alert"
              />
              <Input
                value={decisionForm.action}
                onChangeText={(action) =>
                  setDecisionForm((current) => ({ ...current, action: action as DecisionAction }))
                }
                placeholder="Action: Entered / Skipped / Snoozed / Revised / Rejected / Marked Thesis Broken"
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
              <Input
                value={decisionForm.thesisValid}
                onChangeText={(thesisValid) =>
                  setDecisionForm((current) => ({
                    ...current,
                    thesisValid: thesisValid as "Yes" | "Partly" | "No",
                  }))
                }
                placeholder="Thesis valid? Yes / Partly / No"
              />
              <Input
                value={decisionForm.timing}
                onChangeText={(timing) =>
                  setDecisionForm((current) => ({ ...current, timing: timing as "Early" | "On Time" | "Late" }))
                }
                placeholder="Alert timing: Early / On Time / Late"
              />
              <Button
                label="Save Decision"
                onPress={() => {
                  if (!decisionForm.eyeId.trim() || !decisionForm.note.trim()) return;
                  actions.logDecision({
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

            <SectionTitle title="Recent Decisions" />
            {data.decisions.map((decision) => (
              <Card key={decision.id}>
                <Text style={styles.cardTitle}>{decision.action}</Text>
                <Text style={styles.metaLine}>
                  {decisionEyeLine(decision.eyeId, data.eyes, data.stocks, data.recipes)}
                </Text>
                <Text style={styles.cardBody}>{decision.note}</Text>
                <Text style={styles.metaLine}>
                  Thesis: {decision.thesisValid} • Timing: {decision.timing} • Concern: {decision.concern}
                </Text>
              </Card>
            ))}
          </>
        ) : null}

        {tab === "Outcomes" ? (
          <>
            <SectionTitle title="Outcome Review" note="Outcome metrics are placeholders until a real provider replaces the mock adapter." />
            {data.outcomes.map((outcome) => (
              <Card key={outcome.id}>
                <Text style={styles.cardTitle}>Review window: {outcome.reviewWindow}</Text>
                <Text style={styles.cardBody}>{outcome.lesson}</Text>
                <Text style={styles.metaLine}>Price change: {outcome.priceChangeNote}</Text>
                <Text style={styles.metaLine}>Max run-up: {outcome.maxRunupNote}</Text>
                <Text style={styles.metaLine}>Max drawdown: {outcome.maxDrawdownNote}</Text>
                <Text style={styles.metaLine}>Recipe improvement: {outcome.recipeSuggestion}</Text>
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
    backgroundColor: "#f5f1e8",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f1e8",
  },
  loadingText: {
    fontSize: 20,
    color: "#1f2937",
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    backgroundColor: "#e8dfcf",
    borderBottomWidth: 1,
    borderBottomColor: "#d2c6b3",
  },
  kicker: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    color: "#8a5a30",
    marginBottom: 6,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#12202f",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: "#41515f",
  },
  tabRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  tab: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#c9b997",
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "#f8f4ec",
  },
  tabActive: {
    backgroundColor: "#12202f",
    borderColor: "#12202f",
  },
  tabText: {
    color: "#5f6b79",
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#f9f5ef",
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 16,
  },
  sectionHeader: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#12202f",
  },
  sectionNote: {
    marginTop: 4,
    color: "#5f6b79",
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#fffdf8",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#dfd5c3",
    gap: 8,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#182533",
  },
  cardBody: {
    fontSize: 15,
    lineHeight: 22,
    color: "#344250",
  },
  metaLine: {
    fontSize: 13,
    lineHeight: 19,
    color: "#66717f",
  },
  statePill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontWeight: "700",
    overflow: "hidden",
  },
  stateHigh: {
    color: "#083344",
    backgroundColor: "#bfdbfe",
  },
  stateMedium: {
    color: "#6b3f10",
    backgroundColor: "#fde68a",
  },
  stateRisk: {
    color: "#7f1d1d",
    backgroundColor: "#fecaca",
  },
  stateLow: {
    color: "#1f2937",
    backgroundColor: "#e5e7eb",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d9ccba",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#12202f",
    backgroundColor: "#fffcf5",
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  button: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: {
    backgroundColor: "#ba6b2c",
  },
  buttonSecondary: {
    backgroundColor: "#e8dfcf",
    borderWidth: 1,
    borderColor: "#ceb99a",
  },
  buttonPrimaryText: {
    color: "#fffdf8",
    fontWeight: "700",
  },
  buttonSecondaryText: {
    color: "#12202f",
    fontWeight: "700",
  },
});
