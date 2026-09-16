import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { FrozenScannerRule } from "../../lib/frozenScannerRules";
import { AppLanguage } from "../../lib/i18n";
import { ReviewLog, ScanSignal } from "../../types";
import { LogicLevelCard } from "./LogicLevelCard";

interface L15ConditionsLayerProps {
  language: AppLanguage;
  signals: ScanSignal[];
  rules: FrozenScannerRule[];
  reviewLogsBySignal: Map<string, ReviewLog>;
  onOpenHelp: () => void;
  onOpenReview: (signal: ScanSignal) => void;
  SectionHeader: React.FC<any>;
  Button: React.FC<any>;
  MetaPill: React.FC<any>;
}

const signalSummary = (language: AppLanguage, signal: ScanSignal) => {
  if (signal.status === "MATCHED") return "Condition matched — human review required.";
  if (signal.status === "NEAR_MATCH") return "Near match — watchlist only.";
  return language === "ko"
    ? "데이터 부족 또는 검증 실패로 스캔이 차단됐습니다."
    : "Scan blocked because data is incomplete or invalid.";
};

const humanRuleTitle = (language: AppLanguage, rule?: FrozenScannerRule) => {
  if (!rule) return language === "ko" ? "알 수 없는 규칙" : "Unknown rule";
  if (rule.family === "DeepDiscount") {
    return language === "ko" ? `${rule.sector} 깊은 할인 회복` : `${rule.sector} Deep Discount Recovery`;
  }
  return language === "ko" ? `${rule.sector} 실패한 하향 이탈 회복` : `${rule.sector} Failed Breakdown Recovery`;
};

export const L15ConditionsLayer: React.FC<L15ConditionsLayerProps> = ({
  language,
  signals,
  rules,
  reviewLogsBySignal,
  onOpenHelp,
  onOpenReview,
  SectionHeader,
  Button,
  MetaPill,
}) => {
  return (
    <View style={styles.container}>
      <SectionHeader
        title={language === "ko" ? "신호" : "SIGNALS"}
        note={
          language === "ko"
            ? "오늘 스캔 결과만 압축해 보여줍니다. MATCHED, NEAR_MATCH, BLOCKED만 남기고 FAILED는 노출하지 않습니다."
            : "Compressed daily scan output. Only MATCHED, NEAR_MATCH, and BLOCKED are surfaced here."
        }
        action={<Button label="?" tone="ghost" onPress={onOpenHelp} style={styles.helpButton} />}
        compact
      />

      <View style={styles.stack}>
        {signals.length === 0 ? (
          <LogicLevelCard
            title={language === "ko" ? "오늘 표시할 신호가 없습니다" : "No surfaced signals yet"}
            defaultExpanded
          >
            <Text style={styles.emptyText}>
              {language === "ko"
                ? "일일 스캔을 실행하면 MATCHED, NEAR_MATCH, BLOCKED 결과가 여기에 모입니다."
                : "Run the daily scan to surface MATCHED, NEAR_MATCH, and BLOCKED outputs here."}
            </Text>
            <Text style={styles.emptyText}>
              {language === "ko"
                ? "이 영역은 더 이상 임의 규칙 라이브러리가 아니라, 실제 스캔 산출물만 보여줍니다."
                : "This is no longer an arbitrary rule library. It only shows real scanner outputs."}
            </Text>
          </LogicLevelCard>
        ) : (
          signals.slice(0, 18).map((signal) => {
            const review = reviewLogsBySignal.get(signal.signalId);
            const rule = rules.find((item) => item.ruleId === signal.ruleId);
            return (
              <LogicLevelCard
                key={signal.signalId}
                title={`${signal.ticker} · ${humanRuleTitle(language, rule)}`}
                pills={
                  <>
                    <MetaPill label={signal.status} tone="info" />
                    <MetaPill label={signal.sector} />
                    <MetaPill label={signal.appPriority} />
                    {review ? <MetaPill label={language === "ko" ? "검토 기록" : "Review logged"} tone="success" /> : null}
                  </>
                }
              >
                <Text style={styles.signalIntro}>{signalSummary(language, signal)}</Text>
                <View style={styles.detailGroup}>
                  <Text style={styles.label}>{language === "ko" ? "규칙 ID" : "Rule ID"}</Text>
                  <Text style={styles.valueStrong}>{signal.ruleId}</Text>
                </View>
                <View style={styles.detailGroup}>
                  <Text style={styles.label}>{language === "ko" ? "조건 결과" : "Condition results"}</Text>
                  <View style={styles.pillRow}>
                    <MetaPill label={`${signal.matchedConditionsJson.length} ${language === "ko" ? "통과" : "passed"}`} tone="success" />
                    {signal.failedConditionsJson.length > 0 ? (
                      <MetaPill label={`${signal.failedConditionsJson.length} ${language === "ko" ? "실패" : "failed"}`} tone="info" />
                    ) : null}
                    {signal.missingConditionsJson.length > 0 ? (
                      <MetaPill label={`${signal.missingConditionsJson.length} ${language === "ko" ? "누락" : "missing"}`} tone="risk" />
                    ) : null}
                  </View>
                </View>
                <View style={styles.detailGroup}>
                  <Text style={styles.label}>{language === "ko" ? "편향 경고" : "Bias warning"}</Text>
                  <Text style={styles.value}>{signal.survivorshipBiasLabel}</Text>
                </View>
                <View style={styles.actionRow}>
                  <Button
                    label={language === "ko" ? "검토 기록" : "Log Review"}
                    tone="secondary"
                    onPress={() => onOpenReview(signal)}
                  />
                </View>
              </LogicLevelCard>
            );
          })
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 14,
  },
  helpButton: {
    minWidth: 38,
    height: 38,
    paddingHorizontal: 0,
  },
  stack: {
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#334155",
    fontWeight: "600",
  },
  signalIntro: {
    fontSize: 12,
    lineHeight: 18,
    color: "#334155",
    fontWeight: "700",
  },
  detailGroup: {
    gap: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: "900",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  value: {
    fontSize: 12,
    lineHeight: 18,
    color: "#334155",
    fontWeight: "600",
  },
  valueStrong: {
    fontSize: 12,
    lineHeight: 18,
    color: "#0f172a",
    fontWeight: "800",
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  actionRow: {
    marginTop: 2,
  },
});
