import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { FrozenScannerRule, scannerTokenFeatureMap } from "../../lib/frozenScannerRules";
import { AppLanguage } from "../../lib/i18n";
import { ProcessedFeatureRecord } from "../../types";
import { LogicLevelCard } from "./LogicLevelCard";

interface L1MetricsLayerProps {
  language: AppLanguage;
  processedFeatures: ProcessedFeatureRecord[];
  latestScanDate?: string;
  rules: FrozenScannerRule[];
  onOpenHelp: () => void;
  MetaPill: React.FC<any>;
  SectionHeader: React.FC<any>;
  Button: React.FC<any>;
}

const featureLabels = (language: AppLanguage, key: string) => {
  const labels: Record<string, { en: string; ko: string }> = {
    DD_126: { en: "126D Drawdown", ko: "126일 하락폭" },
    MA10: { en: "MA10", ko: "10일선" },
    MA20: { en: "MA20", ko: "20일선" },
    MA50: { en: "MA50", ko: "50일선" },
    EXRET_20_SPY: { en: "20D Excess vs SPY", ko: "20일 SPY 초과수익" },
    EXRET_20_SECTOR: { en: "20D Excess vs Sector", ko: "20일 섹터 초과수익" },
    VOL_SPIKE_20: { en: "20D Volume Spike", ko: "20일 거래량 배수" },
    RS_IMPROVE_5: { en: "5D RS Improve", ko: "5일 상대강도 개선" },
    SECTOR_ABOVE_MA50: { en: "Sector > MA50", ko: "섹터 50일선 상회" },
  };
  return labels[key]?.[language] ?? key;
};

const humanRuleTitle = (language: AppLanguage, rule: FrozenScannerRule) => {
  if (rule.family === "DeepDiscount") {
    return language === "ko" ? `${rule.sector} 깊은 할인 회복` : `${rule.sector} Deep Discount Recovery`;
  }
  return language === "ko" ? `${rule.sector} 실패한 하향 이탈 회복` : `${rule.sector} Failed Breakdown Recovery`;
};

const formatFeatureValue = (value: number | boolean | string | null | undefined) => {
  if (value === null || value === undefined) return "--";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(3);
  return value;
};

export const L1MetricsLayer: React.FC<L1MetricsLayerProps> = ({
  language,
  processedFeatures,
  latestScanDate,
  rules,
  onOpenHelp,
  MetaPill,
  SectionHeader,
  Button,
}) => {
  const [visibleCount, setVisibleCount] = useState(18);
  const ruleMapByFeature = new Map<string, FrozenScannerRule[]>();
  rules.forEach((rule) => {
    rule.activeConditions.forEach((token) => {
      (scannerTokenFeatureMap[token] ?? []).forEach((featureKey) => {
        ruleMapByFeature.set(featureKey, [...(ruleMapByFeature.get(featureKey) ?? []), rule]);
      });
    });
  });

  return (
    <View style={styles.container}>
      <SectionHeader
        title={language === "ko" ? "처리 피처" : "PROCESSED FEATURES"}
        note={
          latestScanDate
            ? language === "ko"
              ? `${latestScanDate} 종가 기준으로 계산된 스캐너 전용 파생값입니다.`
              : `Scanner-derived feature values computed from the ${latestScanDate} close.`
            : language === "ko"
              ? "아직 계산된 피처가 없습니다."
              : "No processed features yet."
        }
        action={<Button label="?" tone="ghost" onPress={onOpenHelp} style={styles.helpButton} />}
        compact
      />

      <View style={styles.stack}>
        {processedFeatures.length === 0 ? (
          <LogicLevelCard
            title={language === "ko" ? "처리 피처가 아직 없습니다" : "No processed features yet"}
            defaultExpanded
          >
            <Text style={styles.emptyText}>
              {language === "ko"
                ? "일일 스캔을 한 번 실행하면 원시 종가와 거래량에서 이동평균, 하락폭, 상대강도, 거래량 배수 같은 파생값이 계산됩니다."
                : "Run the daily scan once to compute moving averages, drawdowns, relative strength, and volume-derived features from raw bars."}
            </Text>
            <Text style={styles.emptyText}>
              {language === "ko"
                ? "각 피처는 어떤 고정 규칙을 먹여 살리는지 함께 보여줘야 합니다."
                : "Each feature exists to feed one or more frozen rules, not as an isolated formula."}
            </Text>
          </LogicLevelCard>
        ) : (
          processedFeatures.slice(0, visibleCount).map((feature) => {
            const coreKeys = [
              "DD_126",
              "MA10",
              "MA20",
              "MA50",
              "EXRET_20_SPY",
              "EXRET_20_SECTOR",
              "VOL_SPIKE_20",
              "RS_IMPROVE_5",
              "SECTOR_ABOVE_MA50",
            ];
            const linkedRules = Array.from(new Set(coreKeys.flatMap((key) => (ruleMapByFeature.get(key) ?? []).map((rule) => rule.ruleId)))).map((ruleId) => rules.find((rule) => rule.ruleId === ruleId)).filter(Boolean) as FrozenScannerRule[];
            return (
              <LogicLevelCard
                key={feature.id}
                title={`${feature.symbol} · ${feature.sector}`}
                pills={
                  <>
                    <MetaPill label={feature.sectorEtf} tone="info" />
                    <MetaPill label={feature.featureSemanticsVersion} />
                    <MetaPill label={feature.asOfDate} />
                  </>
                }
              >
                <Text style={styles.featureIntro}>
                  {language === "ko"
                    ? `${feature.asOfDate} 종가 기준으로 계산된 스캐너 파생값입니다.`
                    : `Scanner-derived values computed from the ${feature.asOfDate} close.`}
                </Text>
                <View style={styles.featureGrid}>
                  {coreKeys.map((key) => (
                    <View key={`${feature.id}-${key}`} style={styles.featureCell}>
                      <Text style={styles.featureLabel}>{featureLabels(language, key)}</Text>
                      <Text style={styles.featureValue}>
                        {formatFeatureValue(feature.featureValues[key])}
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={styles.linkedGroup}>
                  <Text style={styles.linkedLabel}>{language === "ko" ? "이 피처 묶음을 쓰는 규칙" : "Rules fed by this feature set"}</Text>
                  <View style={styles.pillRow}>
                    {linkedRules.map((rule) => (
                      <MetaPill key={`${feature.id}-${rule.ruleId}`} label={humanRuleTitle(language, rule)} tone="info" />
                    ))}
                  </View>
                </View>
              </LogicLevelCard>
            );
          })
        )}
      </View>
      {processedFeatures.length > visibleCount ? <Button label={language === "ko" ? "더 보기" : `Show more (${processedFeatures.length - visibleCount} remaining)`} tone="secondary" onPress={() => setVisibleCount(count => count + 18)} /> : null}
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
  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  featureIntro: {
    fontSize: 12,
    lineHeight: 18,
    color: "#334155",
    fontWeight: "700",
  },
  featureCell: {
    width: "47.5%",
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 4,
  },
  featureLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  featureValue: {
    fontSize: 13,
    fontWeight: "900",
    color: "#0f172a",
  },
  linkedGroup: {
    gap: 5,
  },
  linkedLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
});
