import { useMemo, useRef, useState } from "react";
import { Button, Card, Pressable, StyleSheet, Text, TextInput, View } from "../../../ui";
import { scannerTokenRawDataMap, type FrozenScannerRule } from "../../../lib/frozenScannerRules";
import type { AppLanguage } from "../../../lib/preferences";

interface RawDataRegistryProps {
  language: AppLanguage;
  dataSources: readonly RawDataSource[];
  rules: readonly FrozenScannerRule[];
}

interface RawDataSource {
  key: string;
  title: string;
  status: string;
  freshnessLabel: string;
  reliability: string;
  mode: string;
  provider: string;
  api?: string;
  fields: readonly string[];
  metrics: readonly { name: string }[];
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

export function RawDataRegistry({ language, dataSources, rules }: RawDataRegistryProps) {
  const [query, setQuery] = useState("");
  const [expandedKey, setExpandedKey] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const helpButtonRef = useRef<any>(null);
  const closeHelp = () => {
    setHelpOpen(false);
    setTimeout(() => helpButtonRef.current?.focus?.(), 0);
  };
  const fields = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return fieldRegistry(language);
    return fieldRegistry(language).filter((field) =>
      [field.key, field.title, field.meaning, field.definition, field.importance, field.reference]
        .some((value) => value.toLocaleLowerCase().includes(normalized)),
    );
  }, [language, query]);
  const sourceByField = useMemo(() => {
    const result = new Map<string, RawDataSource[]>();
    dataSources.forEach((source) => source.fields.forEach((field) => {
      result.set(field, [...(result.get(field) ?? []), source]);
    }));
    return result;
  }, [dataSources]);

  return (
    <View style={styles.stack}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text variant="h3">{language === "ko" ? "원천 데이터" : "Raw input registry"}</Text>
          <Text variant="caption" tone="secondary">{language === "ko"
            ? "정의된 소스 정보이며 현재 프로바이더 가용성이나 상태를 나타내지 않습니다."
            : "Declared source metadata only; this view does not show current provider availability or health."}</Text>
        </View>
        <Pressable
          ref={helpButtonRef}
          accessibilityRole="button"
          accessibilityLabel={language === "ko" ? "레지스트리 도움말" : "Registry help"}
          accessibilityState={{ expanded: helpOpen }}
          aria-expanded={helpOpen}
          onPress={() => setHelpOpen((current) => !current)}
          style={({ focused }: any) => [styles.helpButton, focused && styles.focused]}
        >
          <Text variant="label" tone="accent">{language === "ko" ? "레지스트리 도움말" : "Registry help"}</Text>
        </Pressable>
      </View>
      {helpOpen ? (
        <Card variant="subtle">
          <View style={styles.helpCopy}>
            <Text variant="h3">{language === "ko" ? "레지스트리 읽는 방법" : "How to read this registry"}</Text>
            <Text variant="body">{language === "ko"
              ? "각 항목은 정의된 입력과 의미, 기대되는 소스·API, 선언된 커버리지, 갱신 기대, 연결된 처리 피처와 규칙을 설명합니다. 선언된 범위는 현재 프로바이더의 설정·연결·상태를 나타내지 않습니다."
              : "Each row describes an input, its meaning, expected source or API, declared coverage, refresh expectation, and linked features or rules. Declared scope does not report current provider configuration, reachability, or health."}</Text>
            <Button label={language === "ko" ? "도움말 닫기" : "Close help"} onPress={closeHelp} variant="secondary" />
          </View>
        </Card>
      ) : null}
      <View style={styles.searchField}>
        <Text variant="label">{language === "ko" ? "필드 검색" : "Search fields"}</Text>
        <TextInput
          accessibilityLabel={language === "ko" ? "필드 검색" : "Search fields"}
          onChangeText={setQuery}
          placeholder={language === "ko" ? "식별자, 의미, 소스 검색" : "Search identifier, meaning, or source"}
          placeholderTextColor="#64748b"
          value={query}
          style={styles.searchInput}
        />
      </View>
      {fields.length === 0 ? (
        <Card variant="subtle"><Text variant="body">{language === "ko" ? "일치하는 필드 정의가 없습니다. 검색어를 바꿔 보세요." : "No field definitions match. Change the search term and try again."}</Text></Card>
      ) : fields.map((field) => {
        const sources = sourceByField.get(field.key) ?? [];
        const expanded = expandedKey === field.key;
        const dependentMetrics = Array.from(new Set(sources.flatMap((source) => source.metrics.map((metric) => metric.name))));
        const linkedRules = rules.filter((rule) => rule.activeConditions.some((token) => (scannerTokenRawDataMap[token] ?? []).includes(field.key)));
        return (
          <Card key={`raw-field-${field.key}`} variant="surface">
            <View style={styles.fieldCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${field.title}, ${field.key}`}
                accessibilityState={{ expanded }}
                aria-expanded={expanded}
                onPress={() => setExpandedKey((current) => current === field.key ? "" : field.key)}
                style={({ focused }: any) => [styles.fieldHeader, focused && styles.focused]}
              >
                <View style={styles.fieldTitle}>
                  <Text variant="h3">{field.title}</Text>
                  <Text selectable variant="code">{field.key}</Text>
                  <Text variant="body">{field.meaning}</Text>
                </View>
                <Text variant="label" tone="accent">{expanded ? "−" : "+"}</Text>
              </Pressable>
              <View style={styles.sourceSummary}>
                <Text variant="label">{language === "ko" ? "정의된 소스와 커버리지" : "Declared source and coverage"}</Text>
                <Text variant="body">{field.reference}</Text>
                {sources.length ? sources.map((source) => (
                  <View key={`${field.key}-${source.key}`} style={styles.sourceLine}>
                    <Text variant="body">{source.provider} · {source.title}</Text>
                    {source.api ? <Text selectable variant="caption" tone="secondary">{source.api}</Text> : null}
                    <Text variant="caption" tone="secondary">
                      {(language === "ko" ? "선언된 범위" : "Declared coverage")}: {source.status} · {source.freshnessLabel} · {source.mode}
                    </Text>
                    <Text variant="caption" tone="secondary">{source.reliability}</Text>
                  </View>
                )) : (
                  <Text variant="caption" tone="secondary">{language === "ko"
                    ? "레지스트리에 프로바이더 매핑이 없습니다. 실제 데이터 사용 가능 여부는 여기서 판단할 수 없습니다."
                    : "No provider mapping is declared in the registry. Actual data availability is not determined here."}</Text>
                )}
              </View>
              {expanded ? (
                <View style={styles.details}>
                  <View style={styles.detailGroup}>
                    <Text variant="label">{language === "ko" ? "정의" : "Meaning"}</Text>
                    <Text variant="body">{field.definition}</Text>
                  </View>
                  <View style={styles.detailGroup}>
                    <Text variant="label">{language === "ko" ? "왜 중요한가" : "Why it matters"}</Text>
                    <Text variant="body">{field.importance}</Text>
                  </View>
                  <View style={styles.detailGroup}>
                    <Text variant="label">{language === "ko" ? "예시 형식" : "Example format"}</Text>
                    <Text selectable variant="code">{field.exampleFormat}</Text>
                  </View>
                  <View style={styles.detailGroup}>
                    <Text variant="label">{language === "ko" ? "연결된 처리 피처" : "Downstream processed features"}</Text>
                    {dependentMetrics.length ? dependentMetrics.map((metricName) => (
                      <Text key={`${field.key}-${metricName}`} selectable variant="body">{metricName}</Text>
                    )) : <Text variant="caption" tone="secondary">{language === "ko" ? "직접 연결된 처리 피처가 없습니다." : "No processed features are linked directly."}</Text>}
                  </View>
                  <View style={styles.detailGroup}>
                    <Text variant="label">{language === "ko" ? "연결된 고정 규칙" : "Downstream frozen rules"}</Text>
                    {linkedRules.length ? linkedRules.map((rule) => (
                      <Text key={`${field.key}-${rule.ruleId}`} variant="body">{humanRuleTitle(language, rule)}</Text>
                    )) : <Text variant="caption" tone="secondary">{language === "ko" ? "직접 연결된 고정 규칙이 없습니다." : "No frozen rules depend directly on this field."}</Text>}
                  </View>
                </View>
              ) : null}
            </View>
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  stack: { minWidth: 0, gap: theme.spacing.md, paddingBottom: theme.spacing.md },
  header: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, alignItems: { compact: "stretch", medium: "center" }, justifyContent: "space-between", gap: theme.spacing.md },
  headerCopy: { minWidth: 0, flex: 1, gap: theme.spacing.xs },
  helpButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: theme.spacing.md, borderRadius: theme.radii.sm, borderWidth: theme.strokeWidths.standard, borderColor: theme.colors.border.default, backgroundColor: theme.colors.background.surface },
  helpCopy: { minWidth: 0, gap: theme.spacing.md },
  searchField: { minWidth: 0, gap: theme.spacing.xs },
  searchInput: { width: "100%", minHeight: theme.controlHeights.md, borderWidth: theme.strokeWidths.standard, borderColor: theme.colors.border.default, borderRadius: theme.radii.sm, backgroundColor: theme.colors.background.surface, color: theme.colors.text.primary, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, fontSize: theme.typography.body.fontSize },
  fieldCard: { minWidth: 0, gap: theme.spacing.md },
  fieldHeader: { minWidth: 0, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: theme.spacing.md },
  fieldTitle: { minWidth: 0, flex: 1, gap: theme.spacing.xs },
  sourceSummary: { minWidth: 0, gap: theme.spacing.xs, padding: theme.spacing.md, borderRadius: theme.radii.md, backgroundColor: theme.colors.background.subtle },
  sourceLine: { minWidth: 0, gap: theme.spacing.xs, borderTopWidth: theme.strokeWidths.standard, borderTopColor: theme.colors.border.subtle, paddingTop: theme.spacing.sm },
  details: { minWidth: 0, gap: theme.spacing.md, paddingTop: theme.spacing.xs },
  detailGroup: { minWidth: 0, gap: theme.spacing.xs },
  focused: { borderWidth: theme.strokeWidths.emphasis, borderColor: theme.colors.border.focus, borderRadius: theme.radii.sm },
}));
