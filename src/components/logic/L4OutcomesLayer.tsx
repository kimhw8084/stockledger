import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { AppLanguage } from "../../lib/i18n";
import { Outcome } from "../../types";

interface L4OutcomesLayerProps {
  language: AppLanguage;
  outcomes: Outcome[];
  decisions: any[];
  alerts: any[];
  selectedRecipe?: any;
  localizedOutcomeStatus: (language: AppLanguage, status: string) => string;
  SectionHeader: React.FC<any>;
  Card: React.FC<any>;
  DenseStat: React.FC<any>;
}

export const L4OutcomesLayer: React.FC<L4OutcomesLayerProps> = ({
  language,
  outcomes,
  decisions,
  alerts,
  selectedRecipe,
  localizedOutcomeStatus,
  SectionHeader,
  Card,
  DenseStat,
}) => {
  const filteredOutcomes = selectedRecipe 
    ? outcomes.filter(o => o.recipeId === selectedRecipe.id)
    : outcomes;
    
  const filteredDecisions = selectedRecipe
    ? decisions.filter(d => d.recipeId === selectedRecipe.id)
    : decisions;

  const filteredAlerts = selectedRecipe
    ? alerts.filter(a => a.recipeId === selectedRecipe.id)
    : alerts;

  return (
    <View style={styles.container}>
      <SectionHeader
        title={language === "ko" ? "L4 OUTCOME LEARNING" : "L4 OUTCOME LEARNING"}
        note={
          language === "ko"
            ? "과거 결정과 성과를 분석해 논리를 개선합니다. 어떤 조건이 수익에 기여했는지, 어떤 노이즈가 있었는지 확인합니다."
            : "Refine logic through decision retrospectives. Identify high-signal conditions versus noise."
        }
      />
      
      <Card style={styles.summaryCard} highlighted>
        <Text style={styles.cardEyebrow}>{language === "ko" ? "LOGIC VALIDATION STATS" : "LOGIC VALIDATION STATS"}</Text>
        <View style={styles.statGrid}>
          <DenseStat label="Decisions" value={`${filteredDecisions.length}`} tone="strong" />
          <DenseStat label="Outcomes" value={`${filteredOutcomes.length}`} tone="success" />
          <DenseStat label="Alerts" value={`${filteredAlerts.length}`} />
        </View>
        
        <View style={styles.usefulnessStats}>
           <Text style={styles.blueprintLabel}>{language === "ko" ? "조건 유용성 지표" : "CONDITION SIGNAL QUALITY"}</Text>
           <View style={styles.usefulnessRow}>
              <View style={styles.usefulnessItem}>
                 <View style={styles.labelValueRow}>
                    <Text style={styles.usefulnessLabel}>SIGNAL</Text>
                    <Text style={styles.usefulnessValue}>85%</Text>
                 </View>
                 <View style={styles.usefulnessBar}><View style={[styles.usefulnessFill, { width: '85%', backgroundColor: '#10b981' }]} /></View>
              </View>
              <View style={styles.usefulnessItem}>
                 <View style={styles.labelValueRow}>
                    <Text style={styles.usefulnessLabel}>NOISE</Text>
                    <Text style={styles.usefulnessValue}>15%</Text>
                 </View>
                 <View style={styles.usefulnessBar}><View style={[styles.usefulnessFill, { width: '15%', backgroundColor: '#ef4444' }]} /></View>
              </View>
           </View>
        </View>
      </Card>

      <View style={styles.stack}>
        {filteredOutcomes.length > 0 ? (
          filteredOutcomes.map((outcome) => (
            <View key={`logic-outcome-${outcome.id}`} style={styles.outcomeCard}>
              <View style={styles.outcomeHeader}>
                <Text style={styles.outcomeEyebrow}>
                  {language === "ko"
                    ? `OUTCOME · ${localizedOutcomeStatus(language, outcome.status ?? "Pending")}`
                    : `OUTCOME · ${localizedOutcomeStatus(language, outcome.status ?? "Pending")}`}
                </Text>
                <View style={[styles.statusDot, outcome.status === "Reviewed" ? styles.dotSuccess : styles.dotPending]} />
              </View>
              
              <Text style={styles.outcomeBody}>{outcome.lesson}</Text>
              
              <View style={styles.suggestionBox}>
                 <Text style={styles.suggestionLabel}>{language === "ko" ? "레시피 개선 제안" : "RECIPE EVOLUTION NOTE"}</Text>
                 <Text style={styles.suggestionText}>{outcome.recipeSuggestion}</Text>
              </View>
            </View>
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {language === "ko" ? "아직 축적된 성과 학습이 없습니다." : "NO OUTCOME DATA ACCUMULATED YET"}
            </Text>
          </Card>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  stack: {
    gap: 16,
  },
  summaryCard: {
    marginBottom: 24,
    backgroundColor: "#f8fafc",
  },
  cardEyebrow: {
    fontSize: 10,
    fontWeight: "900",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 12,
    fontStyle: "italic",
  },
  statGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    gap: 10,
  },
  usefulnessStats: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  blueprintLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
    fontStyle: "italic",
  },
  usefulnessRow: {
    flexDirection: "row",
    gap: 20,
  },
  usefulnessItem: {
    flex: 1,
  },
  labelValueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 6,
  },
  usefulnessLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748b",
  },
  usefulnessValue: {
    fontSize: 11,
    fontWeight: "900",
    color: "#0f172a",
  },
  usefulnessBar: {
    height: 6,
    backgroundColor: "#e2e8f0",
    borderRadius: 3,
    overflow: "hidden",
  },
  usefulnessFill: {
    height: "100%",
  },
  outcomeCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#f1f5f9",
    padding: 18,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 8,
  },
  outcomeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  outcomeEyebrow: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotSuccess: { backgroundColor: "#10b981" },
  dotPending: { backgroundColor: "#f59e0b" },
  outcomeBody: {
    fontSize: 14,
    color: "#1e293b",
    lineHeight: 20,
    fontWeight: "600",
    marginBottom: 14,
  },
  suggestionBox: {
    backgroundColor: "#f0f9ff",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e0f2fe",
  },
  suggestionLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#0369a1",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  suggestionText: {
    fontSize: 13,
    color: "#075985",
    fontWeight: "700",
    fontStyle: "italic",
  },
  emptyCard: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    borderStyle: "dashed",
    backgroundColor: "#f9fafb",
  },
  emptyText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#94a3b8",
    letterSpacing: 1,
  }
});
