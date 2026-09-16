import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { AppLanguage, t } from "../../lib/i18n";

interface PreviewTestLayerProps {
  language: AppLanguage;
  selectedRecipe: any;
  data: any;
  previewStockId: string;
  setPreviewStockId: (id: string) => void;
  selectedLogicPreviewStock: any;
  selectedLogicPreviewEvaluation: any;
  selectedLogicPreviewSnapshot: any;
  logicLabScorecard: any;
  logicThesisRiskLabel: (language: AppLanguage, evaluation: any) => string;
  logicDataQualityLabel: (language: AppLanguage, evaluation: any, snapshot: any) => string;
  logicActionUrgencyLabel: (language: AppLanguage, urgency: any) => string;
  selectedLogicConditionRows: any[];
  selectedLogicPreviewEvidenceGroups: any[];
  localizedEyeState: (language: AppLanguage, state: any) => string;
  localizedStatus: (language: AppLanguage, status: any) => string;
  localizedConditionRole: (language: AppLanguage, role: any) => string;
  logicRoleWeight: (role: any) => string;
  logicRoleStateEffect: (language: AppLanguage, role: any) => string;
  logicRoleAlertEffect: (language: AppLanguage, role: any) => string;
  SectionHeader: React.FC<any>;
  Card: React.FC<any>;
  DenseStat: React.FC<any>;
  MetaPill: React.FC<any>;
  LogicBlock: React.FC<any>;
  WhyNowPanel: React.FC<any>;
  EvidenceCardView: React.FC<any>;
  isCompactPhone: boolean;
  onOpenEvidence: (card: any) => void;
  SearchableSelect: React.FC<any>;
}

export const PreviewTestLayer: React.FC<PreviewTestLayerProps> = ({
  language,
  selectedRecipe,
  data,
  previewStockId,
  setPreviewStockId,
  selectedLogicPreviewStock,
  selectedLogicPreviewEvaluation,
  selectedLogicPreviewSnapshot,
  logicLabScorecard,
  logicThesisRiskLabel,
  logicDataQualityLabel,
  logicActionUrgencyLabel,
  selectedLogicConditionRows,
  selectedLogicPreviewEvidenceGroups,
  localizedEyeState,
  localizedStatus,
  localizedConditionRole,
  logicRoleWeight,
  logicRoleStateEffect,
  logicRoleAlertEffect,
  SectionHeader,
  Card,
  DenseStat,
  MetaPill,
  LogicBlock,
  WhyNowPanel,
  EvidenceCardView,
  isCompactPhone,
  onOpenEvidence,
  SearchableSelect,
}) => {
  const stockOptions = data.stocks.map((s: any) => ({
    id: s.id,
    label: s.symbol,
    sublabel: s.name
  }));

  return (
    <View style={styles.container}>
      <SectionHeader
        title={language === "ko" ? "PREVIEW & TEST WORKSPACE" : "PREVIEW & TEST WORKSPACE"}
        note={
          language === "ko"
            ? "선택한 종목의 L0 스냅샷을 L1 지표, L1.5 조건, L2 레시피 평가, L3 Eye 상태로 실제 통과시켜 결과를 검증합니다."
            : "Run the selected stock's L0 snapshot through L1 metrics, L1.5 conditions, L2 recipe evaluation, and L3 Eye state."
        }
      />
      
      <Card style={styles.configCard} highlighted>
        <View style={styles.inlineBetween}>
          <View style={styles.flexOne}>
            <Text style={styles.cardEyebrow}>{language === "ko" ? "ACTIVE TEST RECIPE" : "ACTIVE TEST RECIPE"}</Text>
            <Text style={styles.cardTitle}>{selectedRecipe?.name || "NONE SELECTED"}</Text>
          </View>
          {selectedRecipe && (
            <View style={styles.versionBadge}>
               <Text style={styles.versionText}>{`v${selectedRecipe.version}`}</Text>
            </View>
          )}
        </View>

        <SearchableSelect
          label={language === "ko" ? "테스트할 종목 선택" : "SELECT STOCK FOR TESTING"}
          options={stockOptions}
          value={previewStockId}
          onSelect={(opt: any) => setPreviewStockId(opt.id)}
          placeholder="Search by symbol or name..."
        />
      </Card>

      {selectedLogicPreviewEvaluation ? (
        <View style={[styles.resultWorkspace, !isCompactPhone ? styles.resultWorkspaceWeb : null]}>
          <View style={!isCompactPhone ? styles.sideBySideLeft : null}>
            <WhyNowPanel
              title={language === "ko" ? "결과 상태 리포트" : "EVALUATION STATE REPORT"}
              body={selectedLogicPreviewEvaluation.whyNow}
              state={selectedLogicPreviewEvaluation.currentState}
              recipeVersion={`${selectedRecipe.name} v${selectedRecipe.version}`}
            />
            
            <View style={styles.scoreBoard}>
               <View style={styles.scoreHeader}>
                  <Text style={styles.scoreHeaderLabel}>OPPORTUNITY SCORE</Text>
               </View>
               <View style={styles.scoreMainRow}>
                  <View style={styles.scoreValueCircle}>
                     <Text style={styles.scoreValueText}>{logicLabScorecard.total}</Text>
                  </View>
                  <View style={styles.scoreDetailGrid}>
                     <View style={styles.scoreDetailItem}>
                        <Text style={styles.scoreDetailLabel}>ELIGIBILITY</Text>
                        <Text style={styles.scoreDetailValue}>{logicLabScorecard.eligibility}%</Text>
                     </View>
                     <View style={styles.scoreDetailItem}>
                        <Text style={styles.scoreDetailLabel}>EVIDENCE</Text>
                        <Text style={styles.scoreDetailValue}>{logicLabScorecard.evidence}%</Text>
                     </View>
                     <View style={styles.scoreDetailItem}>
                        <Text style={styles.scoreDetailLabel}>RISK</Text>
                        <Text style={[styles.scoreDetailValue, { color: '#ef4444' }]}>-{logicLabScorecard.riskPenalty}</Text>
                     </View>
                  </View>
               </View>
            </View>

            <View style={styles.metaRow}>
              <MetaPill label={`PASSED ${(selectedLogicPreviewEvaluation.conditionResults ?? []).filter((result: any) => result.passed).length}`} tone="success" />
              <MetaPill label={`BLOCKERS ${logicLabScorecard.blockerCount}`} tone={logicLabScorecard.blockerCount > 0 ? "risk" : "neutral"} />
              <MetaPill label={`DATA: ${logicDataQualityLabel(language, selectedLogicPreviewEvaluation, selectedLogicPreviewSnapshot)}`} tone="info" />
            </View>
          </View>

          <View style={!isCompactPhone ? styles.sideBySideRight : null}>
            <View style={styles.sectionDivider}>
               <Text style={styles.blueprintLabel}>{language === "ko" ? "조건별 세부 평가 행렬" : "CONDITION EVALUATION MATRIX"}</Text>
            </View>
            
            <View style={styles.stack}>
              {selectedLogicConditionRows.map(({ condition, result, metric, formula }) => (
                <LogicBlock
                  key={`logic-condition-row-${condition.id}`}
                  eyebrow={`${localizedConditionRole(language, condition.role)} · ${metric?.name || "--"}`}
                  title={condition.label}
                  summary={result?.explanation || condition.humanDescription || condition.notes || "No additional detail."}
                  status={result?.passed ? "Passed" : "Failed"}
                  meta={
                    <>
                      <MetaPill label={`RESULT: ${String(result?.actualValue ?? "--")}`} tone={result?.passed ? "success" : "risk"} />
                      <MetaPill label={`WEIGHT: ${logicRoleWeight(condition.role)}`} />
                    </>
                  }
                >
                   <View style={styles.logicBlockInner}>
                      <Text style={styles.formulaLine}>FORMULA: <Text style={styles.formulaBold}>{formula?.name || "--"}</Text></Text>
                      <Text style={styles.formulaLine}>EFFECT: <Text style={styles.formulaBold}>{logicRoleStateEffect(language, condition.role)}</Text></Text>
                   </View>
                </LogicBlock>
              ))}
            </View>

            <View style={styles.evidenceSection}>
              {selectedLogicPreviewEvidenceGroups.map((group) => (
                <View key={`logic-preview-group-${group.key}`} style={styles.evidenceGroup}>
                  <Text style={styles.evidenceGroupTitle}>{group.title}</Text>
                  <View style={styles.evidenceGrid}>
                    {group.cards.slice(0, 2).map((card: any) => (
                      <View key={card.id} style={styles.evidenceGridItem}>
                        <EvidenceCardView
                          card={card}
                          compact
                          dense={isCompactPhone}
                          pinned={false}
                          hideFreshness
                          language={language}
                          onOpen={() => onOpenEvidence(card)}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.emptyState}>
           <Text style={styles.emptyStateText}>
              {language === "ko" ? "종목을 선택해 테스트를 시작하세요." : "SELECT A STOCK TO INITIALIZE TEST"}
           </Text>
        </View>
      )}
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
  configCard: {
    marginBottom: 24,
    backgroundColor: "#f8fafc",
  },
  inlineBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  flexOne: {
    flex: 1,
  },
  cardEyebrow: {
    fontSize: 10,
    fontWeight: "900",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 6,
    fontStyle: "italic",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0f172a",
  },
  versionBadge: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
  },
  versionText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#0f172a",
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#94a3b8",
    textTransform: "uppercase",
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  choiceRow: {
    gap: 10,
    paddingVertical: 4,
  },
  stockChip: {
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    minWidth: 90,
  },
  stockChipActive: {
    borderColor: "#0f172a",
    backgroundColor: "#f1f5f9",
  },
  stockChipPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  stockSymbol: {
    fontSize: 14,
    fontWeight: "900",
    color: "#334155",
  },
  stockSymbolActive: {
    color: "#0f172a",
  },
  stockName: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94a3b8",
    marginTop: 2,
  },
  stockNameActive: {
    color: "#64748b",
  },
  resultWorkspace: {
    marginTop: 10,
    gap: 24,
  },
  resultWorkspaceWeb: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  sideBySideLeft: {
    flex: 0.42,
    gap: 24,
  },
  sideBySideRight: {
    flex: 0.58,
    gap: 24,
  },
  scoreBoard: {
    backgroundColor: "#0f172a",
    padding: 22,
    borderRadius: 22,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  scoreHeader: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    paddingBottom: 10,
  },
  scoreHeaderLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#38bdf8",
    letterSpacing: 1.5,
    fontStyle: "italic",
  },
  scoreMainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  scoreValueCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#38bdf8",
  },
  scoreValueText: {
    fontSize: 34,
    fontWeight: "900",
    color: "#ffffff",
  },
  scoreDetailGrid: {
    flex: 1,
    gap: 10,
  },
  scoreDetailItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scoreDetailLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94a3b8",
  },
  scoreDetailValue: {
    fontSize: 13,
    fontWeight: "900",
    color: "#ffffff",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sectionDivider: {
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  blueprintLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontStyle: "italic",
  },
  logicBlockInner: {
    marginTop: 4,
    gap: 4,
  },
  formulaLine: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  formulaBold: {
    color: "#334155",
    fontWeight: "800",
  },
  evidenceSection: {
    marginTop: 12,
    gap: 20,
  },
  evidenceGroup: {
    gap: 12,
  },
  evidenceGroupTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#0f172a",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  evidenceGrid: {
    flexDirection: "row",
    gap: 14,
  },
  evidenceGridItem: {
    flex: 1,
  },
  emptyState: {
    height: 140,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 22,
    marginTop: 16,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    borderStyle: "dashed",
  },
  emptyStateText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "900",
    letterSpacing: 1.5,
    fontStyle: "italic",
  }
});
