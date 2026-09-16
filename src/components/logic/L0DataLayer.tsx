import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { FrozenScannerRule, scannerTokenRawDataMap } from "../../lib/frozenScannerRules";
import { AppLanguage } from "../../lib/i18n";
import { LogicLevelCard } from "./LogicLevelCard";

interface L0DataLayerProps {
  language: AppLanguage;
  dataSources: readonly any[];
  rules: FrozenScannerRule[];
  MetaPill: React.FC<any>;
  SectionHeader: React.FC<any>;
  Button: React.FC<any>;
  onOpenHelp: () => void;
}

type L0FieldDefinition = {
  key: string;
  title: string;
  definition: string;
  meaning: string;
  importance: string;
  exampleFormat: string;
  reference: string;
};

const fieldRegistry = (language: AppLanguage): L0FieldDefinition[] => [
  {
    key: "priceHistorySeries",
    title: language === "ko" ? "가격 시계열" : "Price history series",
    definition: language === "ko" ? "가공되지 않은 종가 흐름 원본 배열입니다." : "Raw close-price series before any logic is applied.",
    meaning: language === "ko" ? "가격 원본 흐름" : "Primary price source",
    importance: language === "ko" ? "하락폭, 수익률, 이동평균 거리 같은 거의 모든 L1 수식의 출발점입니다." : "Starting point for drawdown, returns, moving-average distance, and most L1 formulas.",
    exampleFormat: language === "ko" ? "[142.3, 141.8, 140.9, ...]" : "[142.3, 141.8, 140.9, ...]",
    reference: language === "ko" ? "시세 시계열" : "Market price feed",
  },
  {
    key: "ohlcBarSeries",
    title: language === "ko" ? "OHLC 바 시계열" : "OHLC bar series",
    definition: language === "ko" ? "시가·고가·저가·종가 바 원본입니다." : "Raw open/high/low/close bars.",
    meaning: language === "ko" ? "세부 가격 바 원본" : "Detailed bar source",
    importance: language === "ko" ? "일중 변동폭, 종가 회복력, 갭 같은 세부 수식의 기반입니다." : "Base for intraday range, close recovery, and gap formulas.",
    exampleFormat: language === "ko" ? "[{o,h,l,c}, ...]" : "[{o,h,l,c}, ...]",
    reference: language === "ko" ? "가격 바 레지스트리" : "OHLC series registry",
  },
  {
    key: "volumeHistorySeries",
    title: language === "ko" ? "거래량 시계열" : "Volume history series",
    definition: language === "ko" ? "기간별 거래량 원본 배열입니다." : "Raw volume series by period.",
    meaning: language === "ko" ? "거래 강도 원본" : "Raw trading-intensity source",
    importance: language === "ko" ? "거래량 급증, 수급 확인, 안정화 확인 수식의 입력입니다." : "Feeds volume-spike, participation, and stabilization formulas.",
    exampleFormat: language === "ko" ? "[4.2M, 5.1M, 6.8M, ...]" : "[4.2M, 5.1M, 6.8M, ...]",
    reference: language === "ko" ? "거래량 시계열" : "Volume feed",
  },
  {
    key: "volatilityHistorySeries",
    title: language === "ko" ? "변동폭 시계열" : "Volatility range series",
    definition: language === "ko" ? "일중 혹은 일간 변동폭의 원시 배열입니다." : "Raw daily or intraday range series.",
    meaning: language === "ko" ? "변동성 원본" : "Raw volatility source",
    importance: language === "ko" ? "변동폭 압축과 안정화 확인 수식을 만드는 핵심 입력입니다." : "Core source for volatility-compression and stabilization formulas.",
    exampleFormat: language === "ko" ? "[5.2, 4.9, 4.7, ...] %" : "[5.2, 4.9, 4.7, ...] %",
    reference: language === "ko" ? "변동폭 레지스트리" : "Range-volatility registry",
  },
  {
    key: "benchmarkHistorySeries",
    title: language === "ko" ? "벤치마크 시계열" : "Benchmark history series",
    definition: language === "ko" ? "SPY 같은 기준 지수의 원시 시계열입니다." : "Raw benchmark/index price series such as SPY.",
    meaning: language === "ko" ? "시장 비교 기준" : "Market comparison source",
    importance: language === "ko" ? "시장 대비 상대강도 수식의 기준축입니다." : "Reference series for market-relative strength formulas.",
    exampleFormat: language === "ko" ? "252개 일봉 배열" : "252 daily bars",
    reference: language === "ko" ? "벤치마크 시계열" : "Benchmark feed",
  },
  {
    key: "sectorBenchmarkSeries",
    title: language === "ko" ? "섹터 벤치마크 시계열" : "Sector benchmark series",
    definition: language === "ko" ? "섹터 ETF 또는 업종 지수 원시 시계열입니다." : "Raw sector ETF or sector index series.",
    meaning: language === "ko" ? "업종 비교 기준" : "Sector-relative benchmark source",
    importance: language === "ko" ? "업종 대비 상대강도 수식을 만들 때 필요합니다." : "Feeds sector-relative strength formulas.",
    exampleFormat: language === "ko" ? "섹터 ETF 일봉 배열" : "Sector ETF daily bars",
    reference: language === "ko" ? "섹터 벤치마크 레지스트리" : "Sector benchmark registry",
  },
  {
    key: "financialStatementSnapshot",
    title: language === "ko" ? "재무 스냅샷" : "Financial statement snapshot",
    definition: language === "ko" ? "재무제표에서 끌어온 핵심 수치 묶음입니다." : "Source financial fields bundle from statements.",
    meaning: language === "ko" ? "재무 원문 묶음" : "Source finance bundle",
    importance: language === "ko" ? "매출 성장률, 마진 변화, 부채 위험 같은 L1 수식의 직접 입력입니다." : "Direct source for revenue, margin, and debt formulas.",
    exampleFormat: language === "ko" ? "{매출, 마진, 순부채 ...}" : "{revenue, margin, net debt ...}",
    reference: language === "ko" ? "재무 원천 스냅샷" : "Financial snapshot source",
  },
  {
    key: "incomeStatementSnapshot",
    title: language === "ko" ? "손익계산서 원천값" : "Income statement fields",
    definition: language === "ko" ? "매출과 이익 관련 원천 필드입니다." : "Raw revenue and profit statement fields.",
    meaning: language === "ko" ? "손익계산서 원본" : "Income statement source",
    importance: language === "ko" ? "매출 성장률, 마진 변화의 세부 수식에 연결됩니다." : "Feeds revenue-growth and margin-change formulas.",
    exampleFormat: language === "ko" ? "{매출, 매출총이익, 영업이익}" : "{revenue, gross profit, operating income}",
    reference: language === "ko" ? "재무 원천 스냅샷" : "Financial statements source",
  },
  {
    key: "balanceSheetSnapshot",
    title: language === "ko" ? "대차대조표 원천값" : "Balance sheet fields",
    definition: language === "ko" ? "현금, 부채, 자본 구조의 원천값입니다." : "Raw cash, debt, and balance-sheet fields.",
    meaning: language === "ko" ? "재무상태표 원본" : "Balance-sheet source",
    importance: language === "ko" ? "부채 위험과 재무 건전성 수식의 핵심 기반입니다." : "Core input for debt-risk and balance-sheet formulas.",
    exampleFormat: language === "ko" ? "{현금, 총부채, 유동비율}" : "{cash, total debt, current ratio}",
    reference: language === "ko" ? "재무 원천 스냅샷" : "Financial statements source",
  },
  {
    key: "cashFlowSnapshot",
    title: language === "ko" ? "현금흐름 원천값" : "Cash flow fields",
    definition: language === "ko" ? "영업·투자·재무 현금흐름의 원천값입니다." : "Raw operating, investing, and financing cash-flow fields.",
    meaning: language === "ko" ? "현금흐름 원본" : "Cash-flow source",
    importance: language === "ko" ? "현금창출력과 질적 검증 수식에 연결됩니다." : "Feeds cash-generation and quality-check formulas.",
    exampleFormat: language === "ko" ? "{영업현금흐름, CAPEX, 자유현금흐름}" : "{operating cash flow, capex, free cash flow}",
    reference: language === "ko" ? "재무 원천 스냅샷" : "Financial statements source",
  },
  {
    key: "valuationSnapshot",
    title: language === "ko" ? "밸류에이션 스냅샷" : "Valuation snapshot",
    definition: language === "ko" ? "현재 멀티플과 비교 기준의 원천값입니다." : "Raw current valuation inputs.",
    meaning: language === "ko" ? "현재 밸류에이션 원본" : "Current valuation source",
    importance: language === "ko" ? "현재 할인 여부를 계산하는 수식의 입력입니다." : "Input for current discount-vs-baseline formulas.",
    exampleFormat: language === "ko" ? "{현재 PER, EV/EBITDA}" : "{current P/E, EV/EBITDA}",
    reference: language === "ko" ? "밸류에이션 스냅샷" : "Valuation source",
  },
  {
    key: "valuationHistorySeries",
    title: language === "ko" ? "밸류에이션 이력 시계열" : "Valuation history series",
    definition: language === "ko" ? "과거 밸류에이션 레벨의 원시 시계열입니다." : "Raw historical valuation series.",
    meaning: language === "ko" ? "과거 밸류에이션 기준" : "Historical valuation source",
    importance: language === "ko" ? "역사적 할인/프리미엄 수식의 기준선입니다." : "Baseline for historical valuation discount/premium formulas.",
    exampleFormat: language === "ko" ? "[18.2, 17.4, 16.9, ...]" : "[18.2, 17.4, 16.9, ...]",
    reference: language === "ko" ? "밸류에이션 이력 레지스트리" : "Valuation history registry",
  },
  {
    key: "eventCalendar",
    title: language === "ko" ? "이벤트 캘린더" : "Event calendar",
    definition: language === "ko" ? "실적 발표, 투자자 행사 같은 일정 원천값입니다." : "Raw schedule for earnings and major events.",
    meaning: language === "ko" ? "일정 원본" : "Event schedule source",
    importance: language === "ko" ? "실적 임박, 이벤트 전후 경계 수식의 입력입니다." : "Feeds earnings-soon and event-risk formulas.",
    exampleFormat: language === "ko" ? "{다음 실적일, 행사일}" : "{next earnings date, event date}",
    reference: language === "ko" ? "이벤트 레지스트리" : "Event registry",
  },
  {
    key: "guidanceEvents",
    title: language === "ko" ? "가이던스 이벤트" : "Guidance events",
    definition: language === "ko" ? "가이던스 상향·하향 같은 이벤트 원문입니다." : "Raw guidance-related events.",
    meaning: language === "ko" ? "가이던스 변경 원본" : "Guidance event source",
    importance: language === "ko" ? "이벤트 훼손 여부, 논리 흔들림 수식의 보조 입력입니다." : "Supports event-damage and thesis-risk formulas.",
    exampleFormat: language === "ko" ? "[상향, 유지, 하향]" : "[raise, maintain, cut]",
    reference: language === "ko" ? "이벤트 레지스트리" : "Event registry",
  },
  {
    key: "newsRiskFlags",
    title: language === "ko" ? "뉴스·위험 플래그" : "News / risk flags",
    definition: language === "ko" ? "뉴스, 공시, 검토에서 잡아낸 원천 위험 태그입니다." : "Raw risk tags from news, filings, or review.",
    meaning: language === "ko" ? "위험 태그 원문" : "Risk-tag source",
    importance: language === "ko" ? "강제 제외, 경고, 논리 훼손 조건의 재료가 됩니다." : "Feeds warning, disqualifier, and thesis-risk rules.",
    exampleFormat: language === "ko" ? "[가이던스 압박, 회계 검토]" : "[guidance pressure, accounting review]",
    reference: language === "ko" ? "뉴스·이벤트 레지스트리" : "News/event registry",
  },
  {
    key: "shortInterestSnapshot",
    title: language === "ko" ? "공매도 잔고 스냅샷" : "Short interest snapshot",
    definition: language === "ko" ? "공매도 비중과 변화의 원천값입니다." : "Raw short-interest snapshot fields.",
    meaning: language === "ko" ? "공매도 원본" : "Short-interest source",
    importance: language === "ko" ? "수급 스트레스와 위험 경고 수식에 연결됩니다." : "Feeds crowding and squeeze-risk formulas.",
    exampleFormat: language === "ko" ? "{공매도 비중, 일수}" : "{short float, days to cover}",
    reference: language === "ko" ? "공매도 스냅샷" : "Short-interest source",
  },
  {
    key: "ownershipSnapshot",
    title: language === "ko" ? "보유 구조 스냅샷" : "Ownership snapshot",
    definition: language === "ko" ? "기관/내부자 보유 구조의 원천값입니다." : "Raw ownership structure fields.",
    meaning: language === "ko" ? "보유 구조 원본" : "Ownership source",
    importance: language === "ko" ? "수급 질과 구조적 리스크 해석에 사용됩니다." : "Used in participation-quality and structural-risk formulas.",
    exampleFormat: language === "ko" ? "{기관비중, 내부자비중}" : "{institutional %, insider %}",
    reference: language === "ko" ? "보유 구조 스냅샷" : "Ownership source",
  },
  {
    key: "thesisText",
    title: language === "ko" ? "투자 논리 원문" : "Thesis text",
    definition: language === "ko" ? "사용자가 적은 논리 원문입니다." : "Raw user thesis text.",
    meaning: language === "ko" ? "사용자 논리 원본" : "User-thesis source",
    importance: language === "ko" ? "논리 일치, 검토 기준, 수동 경고의 근거가 됩니다." : "Base for thesis-match and review logic.",
    exampleFormat: language === "ko" ? "\"일시적 리셋인지 확인\"" : "\"Check whether this is a temporary reset\"",
    reference: language === "ko" ? "사용자 입력" : "User input",
  },
  {
    key: "plannedEntryRange",
    title: language === "ko" ? "계획 진입 구간" : "Planned entry range",
    definition: language === "ko" ? "사용자가 정한 행동 가격 구간입니다." : "User-defined action price band.",
    meaning: language === "ko" ? "행동 기준 가격 원본" : "Action-price source",
    importance: language === "ko" ? "진입 구간 내부/이탈 같은 타이밍 수식의 핵심 입력입니다." : "Feeds timing formulas such as price-inside-entry-zone.",
    exampleFormat: language === "ko" ? "136 - 145" : "136 - 145",
    reference: language === "ko" ? "사용자 입력" : "User input",
  },
  {
    key: "invalidationRule",
    title: language === "ko" ? "무효화 기준" : "Invalidation rule",
    definition: language === "ko" ? "논리가 깨졌다고 보는 사용자 기준입니다." : "Raw user invalidation rule.",
    meaning: language === "ko" ? "논리 파기 기준 원본" : "Thesis-break source",
    importance: language === "ko" ? "강한 위험 경고와 수동 검토의 기준이 됩니다." : "Manual basis for hard risk and thesis-break review.",
    exampleFormat: language === "ko" ? "\"수요 가설 붕괴 시 재검토\"" : "\"Revisit if demand thesis breaks\"",
    reference: language === "ko" ? "사용자 입력" : "User input",
  },
  {
    key: "lastThesisReviewAt",
    title: language === "ko" ? "마지막 논리 검토 시점" : "Last thesis review time",
    definition: language === "ko" ? "논리를 마지막으로 다시 본 시점 메타데이터입니다." : "Timestamp of the latest thesis review.",
    meaning: language === "ko" ? "검토 시점 원본" : "Review-timestamp source",
    importance: language === "ko" ? "검토 노후화와 재검토 트리거 수식의 입력입니다." : "Feeds stale-review and follow-up review formulas.",
    exampleFormat: language === "ko" ? "2026-05-17T09:30:00Z" : "2026-05-17T09:30:00Z",
    reference: language === "ko" ? "사용자 입력" : "User input",
  },
  {
    key: "manualRiskFlags",
    title: language === "ko" ? "수동 위험 플래그" : "Manual risk flags",
    definition: language === "ko" ? "사용자가 직접 적은 위험 태그입니다." : "User-entered risk flags.",
    meaning: language === "ko" ? "수동 위험 태그 원본" : "Manual risk source",
    importance: language === "ko" ? "강제 제외와 고위험 검토 규칙의 원천입니다." : "Source for disqualifier and high-risk manual rules.",
    exampleFormat: language === "ko" ? "[회계 이슈, 경영진 신뢰 훼손]" : "[accounting issue, management credibility break]",
    reference: language === "ko" ? "사용자 입력" : "User input",
  },
];

const humanRuleTitle = (language: AppLanguage, rule: FrozenScannerRule) => {
  if (rule.family === "DeepDiscount") {
    return language === "ko" ? `${rule.sector} 깊은 할인 회복` : `${rule.sector} Deep Discount Recovery`;
  }
  return language === "ko" ? `${rule.sector} 실패한 하향 이탈 회복` : `${rule.sector} Failed Breakdown Recovery`;
};

export const L0DataLayer: React.FC<L0DataLayerProps> = ({
  language,
  dataSources,
  rules,
  MetaPill,
  SectionHeader,
  Button,
  onOpenHelp,
}) => {
  const sourceByField = new Map<string, any[]>();
  dataSources.forEach((source) => {
    source.fields.forEach((field: string) => {
      sourceByField.set(field, [...(sourceByField.get(field) ?? []), source]);
    });
  });

  return (
    <View style={styles.container}>
      <SectionHeader
        title={language === "ko" ? "원천 데이터" : "RAW DATA"}
        action={
          <Button
            label="?"
            tone="ghost"
            onPress={onOpenHelp}
            style={styles.helpButton}
          />
        }
        compact
      />
      <View style={styles.stack}>
        {fieldRegistry(language).map((field) => {
          const sources = sourceByField.get(field.key) ?? [];
          const dependentMetrics = Array.from(
            new Set(
              sources.flatMap((source) =>
                (source.metrics ?? []).map((metric: any) => metric.name),
              ),
            ),
          );
          const linkedRules = rules.filter((rule) =>
            rule.activeConditions.some((token) => (scannerTokenRawDataMap[token] ?? []).includes(field.key)),
          );

          return (
            <LogicLevelCard
              key={`l0-field-${field.key}`}
              title={field.title}
              pills={
                <>
                  <MetaPill label={field.meaning} tone="info" />
                  <MetaPill
                    label={
                      language === "ko"
                        ? `피처 ${dependentMetrics.length} · 규칙 ${linkedRules.length}`
                        : `${dependentMetrics.length} features · ${linkedRules.length} rules`
                    }
                  />
                  {sources[0]?.mode ? <MetaPill label={sources[0].mode} /> : null}
                </>
              }
            >
              <View style={styles.detailGroup}>
                <Text style={styles.label}>{language === "ko" ? "정의" : "Definition"}</Text>
                <Text style={styles.value}>{field.definition}</Text>
              </View>
              <View style={styles.detailGroup}>
                <Text style={styles.label}>{language === "ko" ? "왜 중요한가" : "Why it matters"}</Text>
                <Text style={styles.value}>{field.importance}</Text>
              </View>
              <View style={styles.detailGroup}>
                <Text style={styles.label}>{language === "ko" ? "예시 형식" : "Example format"}</Text>
                <Text style={styles.valueMono}>{field.exampleFormat}</Text>
              </View>
              <View style={styles.detailGroup}>
                <Text style={styles.label}>{language === "ko" ? "참조 / 소스" : "Reference / source"}</Text>
                <Text style={styles.value}>{field.reference}</Text>
                <View style={styles.pillRow}>
                  {sources.map((source) => (
                    <MetaPill key={`${field.key}-${source.key}`} label={source.title} />
                  ))}
                </View>
              </View>
              <View style={styles.detailGroup}>
                <Text style={styles.label}>{language === "ko" ? "프로바이더 / API" : "Provider / API"}</Text>
                <View style={styles.providerStack}>
                  {sources.map((source) => (
                    <View key={`${field.key}-${source.key}-provider`} style={styles.providerCard}>
                      <Text style={styles.providerTitle}>{source.provider}</Text>
                      {source.api ? <Text style={styles.providerMeta}>{source.api}</Text> : null}
                      <Text style={styles.providerMeta}>
                        {source.mode} · {source.freshnessLabel} · {source.status}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.detailGroup}>
                <Text style={styles.label}>{language === "ko" ? "연결된 처리 피처" : "Dependent processed features"}</Text>
                <View style={styles.pillRow}>
                  {dependentMetrics.length > 0 ? (
                    dependentMetrics.map((metricName) => (
                      <MetaPill key={`${field.key}-${metricName}`} label={metricName} tone="info" />
                    ))
                  ) : (
                    <Text style={styles.emptyText}>
                      {language === "ko" ? "아직 연결된 처리 피처가 없습니다." : "No dependent processed features yet."}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.detailGroup}>
                <Text style={styles.label}>{language === "ko" ? "이 원천을 쓰는 고정 규칙" : "Frozen rules fed by this raw data"}</Text>
                <View style={styles.pillRow}>
                  {linkedRules.length > 0 ? (
                    linkedRules.map((rule) => (
                      <MetaPill key={`${field.key}-${rule.ruleId}`} label={humanRuleTitle(language, rule)} tone="info" />
                    ))
                  ) : (
                    <Text style={styles.emptyText}>
                      {language === "ko" ? "아직 직접 연결된 고정 규칙이 없습니다." : "No frozen rule depends directly on this raw field yet."}
                    </Text>
                  )}
                </View>
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
  stack: {
    gap: 10,
  },
  helpButton: {
    minWidth: 38,
    height: 38,
    paddingHorizontal: 0,
  },
  detailGroup: {
    gap: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: "900",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  value: {
    fontSize: 13,
    lineHeight: 19,
    color: "#334155",
    fontWeight: "600",
  },
  valueMono: {
    fontSize: 12,
    lineHeight: 18,
    color: "#0f172a",
    fontWeight: "700",
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  emptyText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
    lineHeight: 18,
  },
  providerStack: {
    gap: 8,
  },
  providerCard: {
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  providerTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0f172a",
  },
  providerMeta: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    lineHeight: 16,
  },
});
