import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { FrozenScannerRule, ScannerToken, scannerTokenFeatureMap, scannerTokenRawDataMap } from "../../lib/frozenScannerRules";
import { AppLanguage } from "../../lib/i18n";
import { LogicLevelCard } from "./LogicLevelCard";

interface L2RecipesLayerProps {
  language: AppLanguage;
  rules: FrozenScannerRule[];
  onOpenHelp: () => void;
  SectionHeader: React.FC<any>;
  Button: React.FC<any>;
  MetaPill: React.FC<any>;
}

const rawLabel = (language: AppLanguage, key: string) => {
  const labels: Record<string, { en: string; ko: string }> = {
    priceHistorySeries: { en: "Price history", ko: "가격 시계열" },
    ohlcBarSeries: { en: "OHLC bars", ko: "OHLC 바" },
    volumeHistorySeries: { en: "Volume history", ko: "거래량 시계열" },
    benchmarkHistorySeries: { en: "SPY history", ko: "SPY 시계열" },
    sectorBenchmarkSeries: { en: "Sector ETF history", ko: "섹터 ETF 시계열" },
  };
  return labels[key]?.[language] ?? key;
};

const featureLabel = (language: AppLanguage, key: string) => {
  const labels: Record<string, { en: string; ko: string }> = {
    DD_126: { en: "126D drawdown", ko: "126일 하락폭" },
    MA10: { en: "10D moving average", ko: "10일선" },
    MA20: { en: "20D moving average", ko: "20일선" },
    EXRET_20_SPY: { en: "20D excess return vs SPY", ko: "20일 SPY 초과수익" },
    EXRET_20_SECTOR: { en: "20D excess return vs sector", ko: "20일 섹터 초과수익" },
    VOL_SPIKE_20: { en: "20D volume spike", ko: "20일 거래량 배수" },
    RS_IMPROVE_5: { en: "5D relative-strength improvement", ko: "5일 상대강도 개선" },
    SECTOR_ABOVE_MA50: { en: "Sector above MA50", ko: "섹터 50일선 상회" },
    failed_break_N_R: { en: "Recent failed breakdown", ko: "최근 실패한 하향 이탈" },
    reclaim_low_N: { en: "Prior-low reclaim", ko: "직전 저점 재돌파" },
  };
  return labels[key]?.[language] ?? key;
};

const localizedPriority = (language: AppLanguage, priority: FrozenScannerRule["appPriority"]) => {
  if (language === "en") return priority.replaceAll("_", " ");
  switch (priority) {
    case "primary":
      return "최우선";
    case "high":
      return "높음";
    case "medium_high":
      return "중상";
    case "medium":
      return "중간";
    case "low_fragile":
      return "낮음·취약";
    default:
      return priority;
  }
};

const localizedWarning = (language: AppLanguage, warning: string) => {
  if (language === "en") return warning.replaceAll("_", " ");
  switch (warning) {
    case "current_constituents_survivorship_biased":
      return "현재 구성종목 기준 편향";
    case "point_in_time_membership_unavailable":
      return "시점별 편입 정보 부족";
    case "forward_proof_required":
      return "전진 검증 필요";
    default:
      return warning;
  }
};

const humanRuleTitle = (language: AppLanguage, rule: FrozenScannerRule) => {
  if (rule.family === "DeepDiscount") {
    return language === "ko"
      ? `${rule.sector} 깊은 할인 회복 규칙`
      : `${rule.sector} Deep Discount Recovery`;
  }
  return language === "ko"
    ? `${rule.sector} 실패한 하향 이탈 회복 규칙`
    : `${rule.sector} Failed Breakdown Recovery`;
};

const conditionSentence = (language: AppLanguage, rule: FrozenScannerRule, token: ScannerToken) => {
  const ddThresh = rule.parameters.ddThresh ?? -0.3;
  const reclaimDays = rule.parameters.reclaimDays ?? 0;
  const window = rule.parameters.window;
  const sentences: Record<ScannerToken, { en: string; ko: string }> = {
    DEEP_DISCOUNT: {
      en: `126-day drawdown is ${ddThresh} or lower.`,
      ko: `126일 하락폭이 ${ddThresh} 이하입니다.`,
    },
    MA20: {
      en: "Close finishes above the 20-day moving average.",
      ko: "종가가 20일선 위에서 마감합니다.",
    },
    MA10: {
      en: "Close finishes above the 10-day moving average.",
      ko: "종가가 10일선 위에서 마감합니다.",
    },
    MA20_RECLAIM: {
      en: "Close reclaims the 20-day moving average.",
      ko: "종가가 20일선을 재돌파합니다.",
    },
    NO_VOL_REJECT: {
      en: "20-day volume spike stays at 2.5 or below.",
      ko: "20일 거래량 배수가 2.5 이하로 유지됩니다.",
    },
    RS_IMP: {
      en: "5-day relative strength versus SPY is improving.",
      ko: "SPY 대비 5일 상대강도가 개선되고 있습니다.",
    },
    RS_SPY_POS: {
      en: "20-day excess return versus SPY is positive.",
      ko: "SPY 대비 20일 초과수익이 플러스입니다.",
    },
    RS_SEC_POS: {
      en: "20-day excess return versus the sector ETF is positive.",
      ko: "섹터 ETF 대비 20일 초과수익이 플러스입니다.",
    },
    SEC_M50: {
      en: "The sector ETF is above its 50-day moving average.",
      ko: "섹터 ETF가 50일선 위에 있습니다.",
    },
    FAILED_BREAK: {
      en: `A failed breakdown happened within the last ${reclaimDays} days using the prior ${window}-day low reference.`,
      ko: `직전 ${window}일 저점을 기준으로 최근 ${reclaimDays}일 안에 실패한 하향 이탈이 발생했습니다.`,
    },
    RECLAIM_LOW: {
      en: `Close reclaimed the prior ${window}-day low reference.`,
      ko: `종가가 직전 ${window}일 저점 기준을 다시 회복했습니다.`,
    },
  };
  return sentences[token][language];
};

const unique = (items: string[]) => Array.from(new Set(items));

export const L2RecipesLayer: React.FC<L2RecipesLayerProps> = ({
  language,
  rules,
  onOpenHelp,
  SectionHeader,
  Button,
  MetaPill,
}) => {
  return (
    <View style={styles.container}>
      <SectionHeader
        title={language === "ko" ? "고정 규칙" : "FROZEN RULES"}
        note={
          language === "ko"
            ? "여섯 개 규칙을 사람 말로 읽고, 어떤 피처와 원천 데이터가 동시에 필요해지는지 바로 추적합니다."
            : "Read all six frozen rules in plain language and trace which processed features and raw inputs they depend on."
        }
        action={<Button label="?" tone="ghost" onPress={onOpenHelp} style={styles.helpButton} />}
        compact
      />

      <View style={styles.stack}>
        {rules.map((rule) => {
          const requiredFeatures = unique(rule.activeConditions.flatMap((token) => scannerTokenFeatureMap[token] ?? []));
          const requiredRawData = unique(rule.activeConditions.flatMap((token) => scannerTokenRawDataMap[token] ?? []));
          return (
            <LogicLevelCard
              key={rule.ruleSignatureHash}
              title={humanRuleTitle(language, rule)}
              pills={
                <>
                  <MetaPill label={rule.sector} tone="info" />
                  <MetaPill label={rule.family} />
                  <MetaPill label={localizedPriority(language, rule.appPriority)} />
                </>
              }
            >
              <Text style={styles.classification}>{rule.classification}</Text>
              <View style={styles.detailGroup}>
                <Text style={styles.label}>{language === "ko" ? "규칙 ID" : "Rule ID"}</Text>
                <Text style={styles.metaValue}>{rule.ruleId}</Text>
              </View>
              <View style={styles.detailGroup}>
                <Text style={styles.label}>{language === "ko" ? "오늘 동시에 충족되어야 할 조건" : "What must be true today"}</Text>
                <View style={styles.bulletStack}>
                  {rule.activeConditions.map((token) => (
                    <Text key={`${rule.ruleId}-${token}`} style={styles.bulletText}>
                      • {conditionSentence(language, rule, token)}
                    </Text>
                  ))}
                </View>
              </View>
              <View style={styles.detailGroup}>
                <Text style={styles.label}>{language === "ko" ? "필요한 처리 피처" : "Required processed features"}</Text>
                <View style={styles.pillRow}>
                  {requiredFeatures.map((feature) => (
                    <MetaPill key={`${rule.ruleId}-${feature}`} label={featureLabel(language, feature)} tone="info" />
                  ))}
                </View>
              </View>
              <View style={styles.detailGroup}>
                <Text style={styles.label}>{language === "ko" ? "필요한 원천 데이터" : "Required raw data"}</Text>
                <View style={styles.pillRow}>
                  {requiredRawData.map((rawField) => (
                    <MetaPill key={`${rule.ruleId}-${rawField}`} label={rawLabel(language, rawField)} />
                  ))}
                </View>
              </View>
              <View style={styles.detailGroup}>
                <Text style={styles.label}>{language === "ko" ? "파라미터" : "Parameters"}</Text>
                <View style={styles.pillRow}>
                  {rule.parameters.ddThresh !== undefined ? <MetaPill label={`dd_thresh ${rule.parameters.ddThresh}`} /> : null}
                  <MetaPill label={`window ${rule.parameters.window}`} />
                  {rule.parameters.reclaimDays !== undefined ? <MetaPill label={`reclaim_days ${rule.parameters.reclaimDays}`} /> : null}
                </View>
              </View>
              <View style={styles.detailGroup}>
                <Text style={styles.label}>{language === "ko" ? "증거 요약" : "Proof summary"}</Text>
                <View style={styles.pillRow}>
                  <MetaPill label={`disc 30 ${rule.proofSummary.discoveryMedian30.toFixed(3)}`} />
                  <MetaPill label={`holdout 30 ${rule.proofSummary.holdoutMedian30.toFixed(3)}`} />
                  <MetaPill label={`lockbox 30 ${rule.proofSummary.lockboxMedian30.toFixed(3)}`} />
                  <MetaPill label={rule.proofSummary.latestEraStatus} tone="success" />
                </View>
              </View>
              <View style={styles.detailGroup}>
                <Text style={styles.label}>{language === "ko" ? "위험 경고" : "Risk warnings"}</Text>
                <View style={styles.pillRow}>
                  {rule.riskWarnings.map((warning) => (
                    <MetaPill key={`${rule.ruleId}-${warning}`} label={localizedWarning(language, warning)} tone="risk" />
                  ))}
                </View>
              </View>
              <View style={styles.detailGroup}>
                <Text style={styles.label}>{language === "ko" ? "서명 해시" : "Signature hash"}</Text>
                <Text style={styles.hash}>{rule.ruleSignatureHash}</Text>
              </View>
            </LogicLevelCard>
          );
        })}
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
  classification: {
    fontSize: 12,
    lineHeight: 18,
    color: "#334155",
    fontWeight: "700",
  },
  detailGroup: {
    gap: 5,
  },
  label: {
    fontSize: 10,
    fontWeight: "900",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  metaValue: {
    fontSize: 11,
    lineHeight: 16,
    color: "#334155",
    fontWeight: "700",
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  bulletStack: {
    gap: 5,
  },
  bulletText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#0f172a",
    fontWeight: "700",
  },
  hash: {
    fontSize: 11,
    lineHeight: 16,
    color: "#334155",
    fontWeight: "700",
  },
});
