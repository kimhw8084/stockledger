import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { AppLanguage, t } from "../../lib/i18n";
import { Eye } from "../../types";

interface L3EyesLayerProps {
  language: AppLanguage;
  eyes: Eye[];
  selectedRecipe?: any;
  onOpenStock: (params: { stockId: string; eyeId: string }) => void;
  onOpenDetail: (id: string) => void;
  data: any;
  localizedEyeState: (language: AppLanguage, state: string) => string;
  stockLabel: (stocks: any[], id: string) => string;
  SectionHeader: React.FC<any>;
  Card: React.FC<any>;
  Button: React.FC<any>;
}

export const L3EyesLayer: React.FC<L3EyesLayerProps> = ({
  language,
  eyes,
  selectedRecipe,
  onOpenStock,
  onOpenDetail,
  data,
  localizedEyeState,
  stockLabel,
  SectionHeader,
  Card,
  Button,
}) => {
  const filteredEyes = selectedRecipe 
    ? eyes.filter(eye => eye.recipeId === selectedRecipe.id)
    : eyes;

  return (
    <View style={styles.container}>
      <SectionHeader
        title={language === "ko" ? "L3 ACTIVE EYES" : "L3 ACTIVE EYES"}
        note={
          language === "ko"
            ? "레시피가 실시간 데이터와 연결되어 작동 중인 상태입니다. 각 모니터의 점수 행렬과 상태를 추적합니다."
            : "Live instances of recipes tracking specific stocks. Monitor state transitions and logic matrices."
        }
      />
      
      <View style={styles.stack}>
        {filteredEyes.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {language === "ko" ? "연결된 모니터가 없습니다." : "NO ACTIVE EYES FOR THIS LOGIC"}
            </Text>
          </Card>
        ) : (
          filteredEyes.map((eye) => (
            <Card key={`logic-eye-${eye.id}`} style={styles.eyeCard}>
              <View style={styles.inlineBetween}>
                <View style={styles.flexOne}>
                  <Text style={styles.cardEyebrow}>{stockLabel(data.stocks, eye.stockId)}</Text>
                  <Text style={styles.cardTitle}>{localizedEyeState(language, eye.lastEvaluation?.currentState ?? "Not Relevant")}</Text>
                </View>
                <View style={styles.versionBadge}>
                   <Text style={styles.versionText}>{`v${eye.recipeVersionAtCreation ?? eye.lastEvaluation?.recipeVersion ?? (selectedRecipe?.version || "?")}`}</Text>
                </View>
              </View>
              
              <View style={styles.matrixSection}>
                 <Text style={styles.matrixHeader}>{language === "ko" ? "조건 결과 행렬" : "CONDITION RESULT MATRIX"}</Text>
                 <View style={styles.matrixGrid}>
                    {(eye.lastEvaluation?.conditionResults ?? []).map((result, idx) => (
                       <View 
                          key={`matrix-${eye.id}-${idx}`} 
                          style={[
                             styles.matrixCell, 
                             result.passed ? styles.matrixCellPassed : styles.matrixCellFailed
                          ]} 
                       />
                    ))}
                    {/* Add placeholders if few conditions to maintain grid feel */}
                    {Array.from({ length: Math.max(0, 8 - (eye.lastEvaluation?.conditionResults?.length ?? 0)) }).map((_, i) => (
                       <View key={`placeholder-${i}`} style={styles.matrixCellPlaceholder} />
                    ))}
                 </View>
              </View>

              <Text style={styles.thesisText} numberOfLines={2}>{eye.thesisSnapshot}</Text>
              
              <View style={styles.cardActions}>
                <Button style={styles.actionBtn} label={t(language, "common.stock")} onPress={() => onOpenStock({ stockId: eye.stockId, eyeId: eye.id })} />
                <Button style={styles.actionBtn} label={t(language, "common.detail")} tone="secondary" onPress={() => onOpenDetail(eye.id)} />
              </View>
            </Card>
          ))
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
  eyeCard: {
    padding: 18,
  },
  inlineBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
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
    marginBottom: 4,
    fontStyle: "italic",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  versionBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  versionText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
  },
  thesisText: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
    fontWeight: "600",
    marginBottom: 16,
  },
  cardActions: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
  },
  matrixSection: {
    marginVertical: 14,
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  matrixHeader: {
    fontSize: 9,
    fontWeight: "900",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
    fontStyle: "italic",
  },
  matrixGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  matrixCell: {
    width: 22,
    height: 10,
    borderRadius: 3,
  },
  matrixCellPassed: {
    backgroundColor: "#10b981",
  },
  matrixCellFailed: {
    backgroundColor: "#ef4444",
  },
  matrixCellPlaceholder: {
    width: 22,
    height: 10,
    borderRadius: 3,
    backgroundColor: "#e2e8f0",
    opacity: 0.5,
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
