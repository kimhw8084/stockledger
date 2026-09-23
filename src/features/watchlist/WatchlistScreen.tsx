import React from "react";
import type { AppLanguage } from "../../lib/preferences";
import {
  Badge,
  Button,
  Card,
  Disclosure,
  Divider,
  HStack,
  PageHeader,
  SegmentedControl,
  StatusIndicator,
  StyleSheet,
  Text,
  TextInput,
  VStack,
  View,
} from "../../ui";

export type WatchlistStatusFilter = "All Statuses" | "Passed" | "Near Trigger" | "Warning" | "Blocked" | "Needs Review";
export type WatchlistBoardMode = "Pinned First" | "Status" | "Family";
export type WatchlistLookback = "20D" | "3M" | "6M";
export type WatchlistBenchmark = "SPY" | "QQQ" | "Sector ETF";

export interface WatchlistChoice<T extends string> {
  value: T;
  label: string;
}

export interface WatchlistStockOption {
  id: string;
  symbol: string;
  name: string;
  provenance: string;
}

export interface WatchlistEvidenceRow {
  id: string;
  family: string;
  title: string;
  status: string;
  tone: "positive" | "warning" | "negative" | "neutral" | "info";
  summary: string;
  value: string;
  context: string;
  pinned: boolean;
}

export interface WatchlistSelectedStock {
  id: string;
  symbol: string;
  name: string;
  reviewState: string;
  reviewTone: "positive" | "warning" | "negative" | "neutral" | "info";
  freshness: string;
  freshnessTone: "positive" | "warning" | "negative" | "neutral" | "info";
  sourceAndTime: string;
  coverage: string;
  price: string;
  evidenceSummary: string;
  sample: boolean;
  eyesCount: number;
  metricsCount: number;
  evidence: WatchlistEvidenceRow[];
}

export interface WatchlistScreenProps {
  language: AppLanguage;
  query: string;
  onQueryChange: (query: string) => void;
  candidates: WatchlistStockOption[];
  recent: WatchlistStockOption[];
  available: WatchlistStockOption[];
  hasMore: boolean;
  onShowMore: () => void;
  selected: WatchlistSelectedStock | null;
  queryHasResults: boolean;
  searchHasQuery: boolean;
  onSelectStock: (stockId: string) => void;
  onClearRecent: () => void;
  onAddStock: () => void;
  onEditStock: () => void;
  onClearSelection: () => void;
  onRegisterEye: () => void;
  onManageEyes: () => void;
  onOpenMetric: (metricId: string) => void;
  statusFilter: WatchlistStatusFilter;
  statusChoices: readonly WatchlistChoice<WatchlistStatusFilter>[];
  onStatusFilterChange: (value: WatchlistStatusFilter) => void;
  boardMode: WatchlistBoardMode;
  boardChoices: readonly WatchlistChoice<WatchlistBoardMode>[];
  onBoardModeChange: (value: WatchlistBoardMode) => void;
  lookback: WatchlistLookback;
  lookbackChoices: readonly WatchlistChoice<WatchlistLookback>[];
  onLookbackChange: (value: WatchlistLookback) => void;
  benchmark: WatchlistBenchmark;
  benchmarkChoices: readonly WatchlistChoice<WatchlistBenchmark>[];
  onBenchmarkChange: (value: WatchlistBenchmark) => void;
  controlsDirty: boolean;
  onResetControls: () => void;
}

const copy = (language: AppLanguage) => language === "ko" ? {
  description: "종목을 찾고 데이터 상태와 근거를 확인한 뒤 다음 검토를 선택합니다.",
  search: "종목 검색 또는 다시 열기",
  placeholder: "티커 또는 회사명",
  recent: "최근 종목",
  allStocks: "추적 중인 종목",
  showMore: "더 보기",
  clearRecent: "최근 목록 지우기",
  noResultsTitle: "일치하는 종목이 없습니다",
  noResults: "티커나 회사명을 바꾸거나 종목을 직접 추가하세요.",
  noSelectionTitle: "검토할 종목을 선택하세요",
  noSelection: "검색 결과나 최근 종목을 선택하면 데이터 출처, 신선도, 근거를 확인할 수 있습니다.",
  addStock: "종목 추가",
  evidence: "현재 근거",
  evidenceDescription: "상태, 값, 맥락을 확인하고 필요한 항목의 상세 정보를 엽니다.",
  controls: "보드 필터와 표시 방식",
  controlsDescription: "검색과 종목 확인을 마친 뒤 보드 범위를 조정합니다.",
  status: "근거 상태",
  board: "정렬 기준",
  lookback: "기간",
  benchmark: "비교 기준",
  reset: "기본값 복원",
  register: "관찰 항목 등록",
  edit: "종목 수정",
  clear: "선택 해제",
  inspect: "근거 상세",
  noMetrics: "이 선택과 필터에 표시할 근거가 없습니다.",
  sample: "샘플 데이터입니다. 실제 시장 관측값으로 해석하지 마세요.",
  notSelected: "없음",
} : {
  description: "Find a stock, check its data state and evidence, then choose a deliberate next review.",
  search: "Search or resume a stock",
  placeholder: "Ticker or company name",
  recent: "Recent stocks",
  allStocks: "Tracked stocks",
  showMore: "Show more stocks",
  clearRecent: "Clear recent list",
  noResultsTitle: "No matching stocks",
  noResults: "Change the ticker or company name, or add a stock directly.",
  noSelectionTitle: "Choose a stock to review",
  noSelection: "Select a search result or recent stock to inspect its source, freshness, and evidence.",
  addStock: "Add stock",
  evidence: "Current evidence",
  evidenceDescription: "Scan each status, value, and context before opening a focused detail.",
  controls: "Board filters and display",
  controlsDescription: "Adjust the board after finding the stock you want to review.",
  status: "Evidence status",
  board: "Sort by",
  lookback: "Lookback",
  benchmark: "Benchmark",
  reset: "Reset to defaults",
  register: "Register Eye",
  edit: "Edit stock",
  clear: "Clear selection",
  inspect: "Evidence detail",
  noMetrics: "No evidence matches this selection and filter.",
  sample: "Sample data. Do not treat these values as live market observations.",
  notSelected: "None",
};

const StatusChoice = <T extends string>({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: T;
  choices: readonly WatchlistChoice<T>[];
  onChange: (value: T) => void;
}) => (
  <VStack gap="xs">
    <SegmentedControl label={label} value={value} options={choices} onChange={(next) => onChange(next as T)} />
  </VStack>
);

export function WatchlistScreen(props: WatchlistScreenProps) {
  const text = copy(props.language);
  const recent = props.recent.filter((item) => item.id !== props.selected?.id);
  const candidates = props.candidates;
  const recentIds = new Set(recent.map((item) => item.id));
  const available = props.available.filter((item) => !recentIds.has(item.id) && item.id !== props.selected?.id);
  return (
    <View style={styles.root} nativeID="watchlist-primary-surface">
      <PageHeader
        title={props.language === "ko" ? "관심 종목" : "Watchlist"}
        description={text.description}
        actions={(
          <View style={styles.identityActions}>
            <Button label={text.addStock} iconStart="plus" variant="secondary" onPress={props.onAddStock} responsiveWidth="compact-full" />
            <Button label={props.language === "ko" ? "관찰 항목 관리" : "Manage Eyes"} variant="ghost" onPress={props.onManageEyes} responsiveWidth="compact-full" />
          </View>
        )}
      />

      <Card variant="elevated">
        <VStack gap="md">
          <Text variant="h3">{text.search}</Text>
          <TextInput
          accessibilityLabel={text.search}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={text.placeholder}
            value={props.query}
            onChangeText={props.onQueryChange}
            style={styles.searchInput}
          />
          {props.searchHasQuery ? (
            props.queryHasResults ? (
              <VStack gap="xs">
                {candidates.map((stock) => (
                  <Button
                    key={stock.id}
                    label={`${stock.symbol} · ${stock.name}`}
                    variant="secondary"
                    fullWidth
                    responsiveWidth="compact-full"
                    onPress={() => props.onSelectStock(stock.id)}
                  />
                ))}
              </VStack>
            ) : (
              <View style={styles.emptyCopy}>
                <Text variant="label">{text.noResultsTitle}</Text>
                <Text tone="secondary">{text.noResults}</Text>
                <Button label={text.addStock} iconStart="plus" onPress={props.onAddStock} responsiveWidth="compact-full" />
              </View>
            )
          ) : (
            <View style={styles.recentHeader}>
              <Text variant="label">{text.recent}</Text>
              {recent.length > 0 ? <Button label={text.clearRecent} variant="ghost" size="sm" onPress={props.onClearRecent} /> : null}
            </View>
          )}
          {!props.searchHasQuery && recent.length > 0 ? (
            <View style={styles.stockOptions}>
              {recent.slice(0, 5).map((stock) => (
                <Button
                  key={stock.id}
                  label={`${stock.symbol} · ${stock.name}`}
                  variant="secondary"
                  responsiveWidth="compact-full"
                  fullWidth
                  onPress={() => props.onSelectStock(stock.id)}
                />
              ))}
            </View>
          ) : null}
          {!props.searchHasQuery && available.length > 0 ? (
            <VStack gap="xs">
              <Text variant="label">{text.allStocks}</Text>
              <View style={styles.stockOptions}>
                {available.map((stock) => (
                  <Button
                    key={stock.id}
                    label={`${stock.symbol} · ${stock.name}`}
                    variant="secondary"
                    responsiveWidth="compact-full"
                    fullWidth
                    onPress={() => props.onSelectStock(stock.id)}
                  />
                ))}
              </View>
              {props.hasMore ? <Button label={text.showMore} variant="ghost" onPress={props.onShowMore} responsiveWidth="compact-full" /> : null}
            </VStack>
          ) : null}
        </VStack>
      </Card>

      {props.selected ? (
        <VStack gap="lg">
          <View style={styles.identity}>
            <View style={styles.identityCopy}>
              <HStack gap="sm" align="center">
                <Text variant="h1" numeric direction="ltr">{props.selected.symbol}</Text>
                <Badge label={props.selected.reviewState} tone={props.selected.reviewTone} />
              </HStack>
              <Text variant="bodyLg">{props.selected.name}</Text>
              <Text tone="secondary">{props.selected.evidenceSummary}</Text>
            </View>
            <View style={styles.identityActions}>
              <Button label={text.register} iconStart="eye" onPress={props.onRegisterEye} responsiveWidth="compact-full" />
              <Button label={text.clear} variant="secondary" onPress={props.onClearSelection} responsiveWidth="compact-full" />
              <Button label={text.edit} variant="ghost" onPress={props.onEditStock} responsiveWidth="compact-full" />
            </View>
          </View>

          <Card variant="subtle" padding="compact">
            <VStack gap="md">
              <View style={styles.facts}>
                <View style={styles.priceFact}>
                  <Text variant="micro" tone="secondary">{props.language === "ko" ? "최근 가격" : "Latest price"}</Text>
                  <Text variant="h2" numeric direction="ltr">{props.selected.price}</Text>
                </View>
                <StatusIndicator label={props.selected.freshness} description={props.selected.sourceAndTime} tone={props.selected.freshnessTone} />
              </View>
              <View style={styles.coverageRow}>
                <Text variant="caption" tone="secondary">{props.selected.coverage}</Text>
                {props.selected.sample ? <Badge label={text.sample} tone="warning" /> : null}
              </View>
              <Text variant="caption" tone="secondary">
                {props.selected.eyesCount} {props.language === "ko" ? "관찰 항목" : "Eyes"} · {props.selected.metricsCount} {props.language === "ko" ? "근거 항목" : "evidence items"}
              </Text>
            </VStack>
          </Card>

          <View>
            <PageHeader title={text.evidence} description={text.evidenceDescription} />
            {props.selected.evidence.length === 0 ? (
              <Card variant="subtle"><Text tone="secondary">{text.noMetrics}</Text></Card>
            ) : (
              <View style={styles.evidenceList}>
                {props.selected.evidence.map((item, index) => (
                  <React.Fragment key={item.id}>
                    {index > 0 ? <Divider inset="start" /> : null}
                    <View style={styles.evidenceRow}>
                      <View style={styles.evidenceCopy}>
                        <Text variant="micro" tone="secondary">{item.family}</Text>
                        <HStack gap="sm" align="center">
                          <Text variant="h3">{item.title}</Text>
                          <Badge label={item.status} tone={item.tone} />
                          {item.pinned ? <Badge label={props.language === "ko" ? "고정" : "Pinned"} tone="info" /> : null}
                        </HStack>
                        <Text>{item.summary}</Text>
                        <Text variant="caption" tone="secondary">{item.value} · {item.context}</Text>
                      </View>
                      <Button label={text.inspect} iconEnd="arrowRight" variant="ghost" onPress={() => props.onOpenMetric(item.id)} responsiveWidth="compact-full" />
                    </View>
                  </React.Fragment>
                ))}
              </View>
            )}
          </View>

          <Disclosure
            id="watchlist-board-controls"
            title={text.controls}
            description={text.controlsDescription}
          >
            <View style={styles.controls}>
              <VStack gap="lg">
                <StatusChoice label={text.status} value={props.statusFilter} choices={props.statusChoices} onChange={props.onStatusFilterChange} />
                <StatusChoice label={text.board} value={props.boardMode} choices={props.boardChoices} onChange={props.onBoardModeChange} />
                <StatusChoice label={text.lookback} value={props.lookback} choices={props.lookbackChoices} onChange={props.onLookbackChange} />
                <StatusChoice label={text.benchmark} value={props.benchmark} choices={props.benchmarkChoices} onChange={props.onBenchmarkChange} />
                {props.controlsDirty ? <Button label={text.reset} variant="outline" onPress={props.onResetControls} /> : null}
              </VStack>
            </View>
          </Disclosure>
        </VStack>
      ) : (
        <Card variant="subtle">
          <VStack gap="sm">
            <Text variant="h3">{text.noSelectionTitle}</Text>
            <Text tone="secondary">{text.noSelection}</Text>
            {!props.searchHasQuery && recent.length === 0 ? <Text variant="caption" tone="secondary">{text.notSelected}</Text> : null}
          </VStack>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { minWidth: 0, gap: theme.spacing.xl },
  searchInput: {
    minWidth: 0,
    width: "100%",
    minHeight: theme.controlHeights.lg,
    paddingHorizontal: theme.spacing.md,
    borderWidth: theme.strokeWidths.standard,
    borderColor: theme.colors.border.default,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.background.surface,
    color: theme.colors.text.primary,
    fontSize: theme.typography.body.fontSize,
  },
  emptyCopy: { minWidth: 0, gap: theme.spacing.sm, alignItems: "flex-start" },
  recentHeader: { minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  stockOptions: { minWidth: 0, gap: theme.spacing.xs },
  identity: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, alignItems: { compact: "stretch", medium: "flex-start" }, justifyContent: "space-between", gap: theme.spacing.lg },
  identityCopy: { minWidth: 0, flex: 1, gap: theme.spacing.xs },
  identityActions: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, flexWrap: "wrap", gap: theme.spacing.xs },
  facts: { flexWrap: "wrap", alignItems: "center" },
  priceFact: { minWidth: 120, gap: theme.spacing.xxs },
  coverageRow: { minWidth: 0, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: theme.spacing.sm },
  evidenceList: { marginTop: theme.spacing.md },
  evidenceRow: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, alignItems: { compact: "stretch", medium: "center" }, justifyContent: "space-between", gap: theme.spacing.md, paddingVertical: theme.spacing.lg },
  evidenceCopy: { minWidth: 0, flex: 1, gap: theme.spacing.xs },
  controls: { paddingTop: theme.spacing.md },
}));
