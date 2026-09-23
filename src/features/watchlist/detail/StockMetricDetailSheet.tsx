import React, { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Disclosure,
  HStack,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  VStack,
} from "../../../ui";
import { formatLocaleNumber, t } from "../../../lib/i18n";
import type { AppLanguage } from "../../../lib/preferences";
import type { VisualEvidenceCard } from "../../../types";

interface StockMetricDetailSheetProps {
  card: VisualEvidenceCard;
  selectedEvidenceIndex: number;
  total: number;
  sortedCards: VisualEvidenceCard[];
  isPinned: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onTogglePin: () => void;
  onSelectCard: (next: VisualEvidenceCard) => void;
  language: AppLanguage;
}

export function StockMetricDetailSheet({
  card,
  selectedEvidenceIndex,
  total,
  sortedCards,
  isPinned,
  onPrevious,
  onNext,
  onTogglePin,
  onSelectCard,
  language,
}: StockMetricDetailSheetProps) {
  const [showFormulaDetails, setShowFormulaDetails] = useState(false);
  const [focusedMetricId, setFocusedMetricId] = useState<string | null>(null);
  const indexLabel = `${selectedEvidenceIndex >= 0 ? selectedEvidenceIndex + 1 : 1} ${language === "ko" ? "/" : "of"} ${total}`;
  const freshness = card.freshness === "Mock Data" ? t(language, "stocks.data.dummy") : card.freshness;
  const source = card.sourceType === "Mock Adapter"
    ? t(language, "stocks.data.dummy")
    : card.sourceType === "Provider Adapter"
      ? t(language, "stocks.data.provider")
      : t(language, "stocks.data.manual");

  return (
    <View style={styles.root}>
    <VStack gap="md">
      <MetricVisualHero card={card} language={language} />

      <View style={styles.evidenceFacts}>
        <Fact label={t(language, "common.current")} value={card.metric.currentLabel} emphasized />
        <Fact label={t(language, "common.threshold")} value={card.metric.thresholdLabel ?? t(language, "stocks.detail.context")} />
        <Fact label={t(language, "common.freshness")} value={freshness} emphasized={card.freshness === "Fresh"} />
        <Fact label={t(language, "common.source")} value={source} />
      </View>

      <Card variant="surface" padding="compact">
        <VStack gap="sm">
          <View style={styles.narrativeHeader}>
            <Text variant="h3">{t(language, "stocks.detail.whatStandsOut")}</Text>
            <Badge label={indexLabel} tone="info" />
          </View>
          <Text variant="bodyLg">{card.summary}</Text>
          <View style={styles.narrativeSplit}>
            <View style={styles.narrativeBlock}>
              <Text variant="micro" tone="secondary">{t(language, "stocks.detail.effect")}</Text>
              <Text>{card.effect}</Text>
            </View>
            <View style={styles.narrativeBlock}>
              <Text variant="micro" tone="secondary">{t(language, "stocks.detail.whyItMatters")}</Text>
              <Text>{card.whyItMatters}</Text>
            </View>
          </View>
          {card.relatedConditionLabel ? <Badge label={t(language, "stocks.detail.recipeLink", { label: card.relatedConditionLabel })} tone="neutral" /> : null}
        </VStack>
      </Card>

      <View style={styles.actions}>
        <Button label={t(language, "common.previous")} variant="outline" onPress={onPrevious} disabled={selectedEvidenceIndex <= 0} responsiveWidth="compact-full" />
        <Button label={isPinned ? t(language, "common.unpin") : t(language, "common.pin")} variant={isPinned ? "secondary" : "ghost"} onPress={onTogglePin} responsiveWidth="compact-full" />
        <Button label={t(language, "common.next")} variant="outline" onPress={onNext} disabled={selectedEvidenceIndex < 0 || selectedEvidenceIndex >= total - 1} responsiveWidth="compact-full" />
      </View>

      <Disclosure
        id="metric-detail-browse-more"
        title={t(language, "stocks.detail.browseMore")}
        description={language === "ko" ? "현재 근거를 닫지 않고 인접한 근거를 선택합니다." : "Select adjacent evidence while keeping the current explanation in view."}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.jumpRow}>
          {sortedCards.map((jumpCard) => (
            <Pressable
              key={`jump-${jumpCard.id}`}
              accessibilityRole="button"
              accessibilityLabel={jumpCard.title}
              accessibilityState={{ selected: card.id === jumpCard.id }}
              onPress={() => onSelectCard(jumpCard)}
              onFocus={() => setFocusedMetricId(jumpCard.id)}
              onBlur={() => setFocusedMetricId((current) => current === jumpCard.id ? null : current)}
              style={[styles.jumpChip, card.id === jumpCard.id ? styles.jumpChipActive : null, focusedMetricId === jumpCard.id ? styles.focused : null]}
            >
              <Text variant="label" numberOfLines={2}>{jumpCard.title}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Disclosure>

      <Disclosure
        id="metric-detail-formula"
        title={showFormulaDetails ? t(language, "stocks.detail.hideFormula") : t(language, "stocks.detail.showFormula")}
        description={card.formulaName ?? t(language, "stocks.detail.formulaFallback")}
        onExpandedChange={setShowFormulaDetails}
        expanded={showFormulaDetails}
      >
        <View style={styles.formulaContent}>
        <VStack gap="sm">
          <Text variant="h3">{card.formulaName ?? t(language, "stocks.detail.formulaDetail")}</Text>
          <Text selectable>{card.formulaDescription ?? t(language, "stocks.detail.formulaMissing")}</Text>
          <Text variant="caption" tone="secondary">
            {t(language, "stocks.detail.inputs", {
              inputs: card.formulaInputs?.join(", ") ?? (language === "ko" ? "기록된 입력값 없음" : "No explicit inputs recorded"),
            })}
          </Text>
        </VStack>
        </View>
      </Disclosure>
    </VStack>
    </View>
  );
}

function MetricVisualHero({ card, language }: { card: VisualEvidenceCard; language: AppLanguage }) {
  const visual = card.visual;
  const series = visual.series ?? [];
  const secondary = visual.secondarySeries ?? [];
  const tertiary = visual.tertiarySeries ?? [];
  const [selectedPoint, setSelectedPoint] = useState(Math.max(series.length - 1, 0));
  const [focusedPoint, setFocusedPoint] = useState<number | null>(null);

  useEffect(() => {
    setSelectedPoint(Math.max(series.length - 1, 0));
  }, [card.id, series.length]);

  if (visual.kind === "checklist") {
    return (
      <Card variant="subtle" padding="compact">
        <VStack gap="sm">
          <HeroHeading card={card} value={card.metric.currentLabel} />
          <View style={styles.checkList}>
            {(visual.items ?? []).map((item) => (
              <View key={item.label} style={styles.checkRow}>
                <Badge label={item.tone === "good" ? (language === "ko" ? "충족" : "Met") : item.tone === "warning" ? (language === "ko" ? "주의" : "Caution") : item.tone === "danger" ? (language === "ko" ? "위험" : "Risk") : (language === "ko" ? "정보" : "Info")} tone={item.tone === "good" ? "positive" : item.tone === "warning" ? "warning" : item.tone === "danger" ? "negative" : "neutral"} />
                <View style={styles.flexOne}><Text>{item.label}</Text></View>
              </View>
            ))}
          </View>
          <Text variant="caption" tone="secondary">{card.metric.thresholdLabel ?? t(language, "stocks.detail.context")}</Text>
        </VStack>
      </Card>
    );
  }

  if (visual.kind === "event_countdown") {
    return (
      <Card variant="subtle" padding="compact">
        <VStack gap="sm">
          <HeroHeading card={card} value={visual.countdownLabel ?? card.metric.currentLabel} />
          <HStack gap="xs" align="center">
            <Text variant="h1" numeric>{visual.countdownDays ?? "--"}</Text>
            <Text tone="secondary">{t(language, "stocks.detail.days")}</Text>
          </HStack>
          <Text tone="secondary">{card.summary}</Text>
        </VStack>
      </Card>
    );
  }

  if (visual.kind === "risk_gauge") {
    const min = visual.min ?? 0;
    const max = visual.max ?? 100;
    const currentPct = visual.current === undefined ? undefined : percent(visual.current, min, max);
    const thresholdPct = visual.threshold === undefined ? undefined : percent(visual.threshold, min, max);
    return (
      <Card variant="subtle" padding="compact">
        <VStack gap="md">
          <HeroHeading card={card} value={card.metric.currentLabel} />
          <View style={styles.gauge}>
            {thresholdPct === undefined ? null : <View style={[styles.gaugeMarker, { left: `${thresholdPct}%` }]} />}
            {currentPct === undefined ? null : <View style={[styles.gaugeCurrent, { left: `${currentPct}%` }]} />}
          </View>
          <View style={styles.legend}>
            <Text variant="caption">{t(language, "stocks.detail.lowerRisk")}</Text>
            <Text variant="caption">{t(language, "stocks.detail.higherRisk")}</Text>
          </View>
          <Text variant="caption" tone="secondary">{card.metric.thresholdLabel ?? t(language, "stocks.detail.context")}</Text>
        </VStack>
      </Card>
    );
  }

  if (visual.kind === "entry_zone") {
    const low = visual.low;
    const high = visual.high;
    if (low === undefined || high === undefined) {
      return (
        <Card variant="subtle" padding="compact">
          <VStack gap="sm">
            <HeroHeading card={card} value={card.metric.currentLabel} />
            <Text tone="secondary">{language === "ko" ? "계획한 진입 구간이 기록되지 않았습니다." : "The planned entry range is not recorded."}</Text>
            <Text variant="caption" tone="secondary">{card.metric.thresholdLabel ?? t(language, "stocks.detail.plannedZone")}</Text>
          </VStack>
        </Card>
      );
    }
    const min = Math.max(0, low * 0.92);
    const max = high * 1.08 || 1;
    const start = percent(low, min, max);
    const end = percent(high, min, max);
    const marker = visual.current === undefined ? undefined : percent(visual.current, min, max);
    return (
      <Card variant="subtle" padding="compact">
        <VStack gap="md">
          <HeroHeading card={card} value={card.metric.currentLabel} />
          <View style={styles.zone}>
            <View style={[styles.zoneBand, { left: `${start}%`, width: `${Math.max(6, end - start)}%` }]} />
            {marker === undefined ? null : <View style={[styles.zoneMarker, { left: `${marker}%` }]} />}
          </View>
          <View style={styles.legend}>
            <Text variant="caption" numeric>${formatLocaleNumber(language, low, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            {visual.current === undefined ? null : <Text variant="caption" numeric>${formatLocaleNumber(language, visual.current, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>}
            <Text variant="caption" numeric>${formatLocaleNumber(language, high, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </View>
          <Text variant="caption" tone="secondary">{card.metric.thresholdLabel ?? t(language, "stocks.detail.plannedZone")}</Text>
        </VStack>
      </Card>
    );
  }

  if (series.length === 0) {
    return (
      <Card variant="subtle" padding="compact">
        <VStack gap="sm">
          <HeroHeading card={card} value={card.metric.currentLabel} />
          <Text tone="secondary">{language === "ko" ? "이 지표의 차트 기록을 사용할 수 없습니다." : "Chart history is unavailable for this metric."}</Text>
          <Text variant="caption" tone="secondary">{card.metric.thresholdLabel ?? t(language, "stocks.detail.context")}</Text>
        </VStack>
      </Card>
    );
  }

  const displaySeries = series;
  const safeSelected = Math.max(0, Math.min(selectedPoint, displaySeries.length - 1));
  const selectedValue = displaySeries[safeSelected]!;
  const min = visual.min ?? Math.min(...displaySeries);
  const max = visual.max ?? Math.max(...displaySeries);
  const selectedPct = percent(selectedValue, min, max);
  const thresholdPct = visual.threshold === undefined ? undefined : percent(visual.threshold, min, max);
  const latest = safeSelected === displaySeries.length - 1;
  const selectedPointLabel = latest
    ? t(language, "stocks.detail.latest")
    : language === "ko" ? `${safeSelected + 1}번째 지점` : `Point ${safeSelected + 1}`;
  const chartWidth = Math.max(296, displaySeries.length * 44);

  return (
    <Card variant="subtle" padding="compact">
      <VStack gap="sm">
        <View style={styles.chartHeading}>
          <View style={styles.flexOne}>
            <Text variant="micro" tone="secondary">{card.family}</Text>
            <Text variant="h3">{card.title}</Text>
          </View>
          <Badge label={selectedPointLabel} tone="info" />
        </View>
        <View style={styles.selectedValue}>
          <Text variant="h2" numeric>{formatLocaleNumber(language, selectedValue, { maximumFractionDigits: 2 })}</Text>
          <Text variant="caption" tone="secondary">{t(language, "stocks.detail.selectPoint", { index: safeSelected + 1 })}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={[styles.chartScroller, { width: chartWidth }]}>
          <View style={styles.chart}>
            <View style={[styles.gridLine, { top: "25%" }]} />
            <View style={[styles.gridLine, { top: "50%" }]} />
            <View style={[styles.gridLine, { top: "75%" }]} />
            <View style={styles.bars}>
              {displaySeries.map((point, index) => (
                <Pressable
                  key={`${card.id}-series-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={t(language, "stocks.detail.selectPoint", { index: index + 1 })}
                  accessibilityState={{ selected: index === safeSelected }}
                  onPress={() => setSelectedPoint(index)}
                  onFocus={() => setFocusedPoint(index)}
                  onBlur={() => setFocusedPoint((current) => current === index ? null : current)}
                  style={[styles.barHit, index === safeSelected ? styles.barHitActive : null, focusedPoint === index ? styles.focused : null]}
                >
                  <View style={[styles.bar, { height: `${Math.max(12, percent(point, min, max))}%` }, index === safeSelected ? styles.barActive : null]} />
                </Pressable>
              ))}
            </View>
            {thresholdPct === undefined ? null : <View pointerEvents="none" style={[styles.thresholdLine, { bottom: `${thresholdPct}%` }]} />}
            <View pointerEvents="none" style={[styles.currentLine, { bottom: `${selectedPct}%` }]} />
            {secondary.length > 0 ? <SeriesDots series={secondary} min={min} max={max} muted={false} /> : null}
            {tertiary.length > 0 ? <SeriesDots series={tertiary} min={min} max={max} muted /> : null}
          </View>
        </ScrollView>
        <View style={styles.legend}>
          <Text variant="caption">{card.metric.thresholdLabel ?? t(language, "stocks.detail.threshold")}</Text>
          <Text variant="caption">{visual.markerLabel ?? card.metric.comparisonLabel ?? t(language, "stocks.detail.series")}</Text>
        </View>
        <Text variant="caption" tone="secondary">{t(language, "stocks.detail.tapChart")}</Text>
      </VStack>
    </Card>
  );
}

function HeroHeading({ card, value }: { card: VisualEvidenceCard; value: string }) {
  return (
    <View style={styles.chartHeading}>
      <View style={styles.flexOne}>
        <Text variant="micro" tone="secondary">{card.family}</Text>
        <Text variant="h3">{card.title}</Text>
      </View>
      <Text variant="h2">{value}</Text>
    </View>
  );
}

function SeriesDots({ series, min, max, muted }: { series: number[]; min: number; max: number; muted: boolean }) {
  return (
    <View pointerEvents="none" style={styles.seriesOverlay}>
      {series.map((point, index) => (
        <View
          key={`${muted ? "muted" : "secondary"}-${index}`}
          style={[
            muted ? styles.seriesDotMuted : styles.seriesDot,
            { left: `${(index / Math.max(series.length - 1, 1)) * 100}%`, bottom: `${percent(point, min, max)}%` },
          ]}
        />
      ))}
    </View>
  );
}

function Fact({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <Card variant="subtle" padding="compact">
      <VStack gap="xs">
        <Text variant="micro" tone="secondary">{label}</Text>
        <Text variant="label" tone={emphasized ? "primary" : "secondary"}>{value}</Text>
      </VStack>
    </Card>
  );
}

const percent = (value: number, min: number, max: number) => Math.max(0, Math.min(100, ((value - min) / Math.max(max - min, 1)) * 100));

const styles = StyleSheet.create((theme) => ({
  root: { minWidth: 0 },
  narrativeHeader: { minWidth: 0, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  narrativeSplit: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, gap: theme.spacing.md },
  narrativeBlock: { minWidth: 0, flex: 1, gap: theme.spacing.xs, padding: theme.spacing.sm, borderRadius: theme.radii.md, backgroundColor: theme.colors.background.subtle },
  evidenceFacts: { minWidth: 0, flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs },
  actions: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, flexWrap: "wrap", gap: theme.spacing.xs },
  jumpRow: { gap: theme.spacing.xs, paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.xs },
  jumpChip: { minWidth: 112, maxWidth: 210, minHeight: 44, padding: theme.spacing.sm, borderWidth: theme.strokeWidths.standard, borderColor: theme.colors.border.default, borderRadius: theme.radii.md, justifyContent: "center", backgroundColor: theme.colors.background.surface },
  jumpChipActive: { borderColor: theme.colors.interactive.primary, backgroundColor: theme.colors.interactive.subtle },
  focused: { borderColor: theme.colors.border.focus, borderWidth: 3 },
  formulaContent: { paddingTop: theme.spacing.md },
  checkList: { gap: theme.spacing.sm },
  checkRow: { minWidth: 0, flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  flexOne: { minWidth: 0, flex: 1, gap: theme.spacing.xs },
  gauge: { minWidth: 0, height: 28, borderRadius: theme.radii.full, backgroundColor: theme.colors.background.subtle, justifyContent: "center" },
  gaugeMarker: { position: "absolute", top: 0, width: 3, height: 28, backgroundColor: theme.colors.text.secondary },
  gaugeCurrent: { position: "absolute", width: 18, height: 18, borderRadius: theme.radii.full, borderWidth: 3, borderColor: theme.colors.interactive.primary, backgroundColor: theme.colors.background.surface, marginLeft: -8 },
  zone: { minWidth: 0, height: 28, borderRadius: theme.radii.full, backgroundColor: theme.colors.background.subtle, justifyContent: "center" },
  zoneBand: { position: "absolute", top: 4, bottom: 4, borderRadius: theme.radii.full, backgroundColor: theme.colors.interactive.subtle, borderWidth: 1, borderColor: theme.colors.interactive.primary },
  zoneMarker: { position: "absolute", top: 0, width: 3, height: 28, backgroundColor: theme.colors.interactive.primary },
  legend: { minWidth: 0, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: theme.spacing.sm },
  chartHeading: { minWidth: 0, flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: theme.spacing.sm },
  selectedValue: { minWidth: 0, flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: theme.spacing.sm },
  chartScroller: { minWidth: "100%", height: 188 },
  chart: { position: "relative", flex: 1, minHeight: 160, borderRadius: theme.radii.md, backgroundColor: theme.colors.background.surface, overflow: "hidden" },
  gridLine: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: theme.colors.border.subtle },
  thresholdLine: { position: "absolute", left: 0, right: 0, borderTopWidth: 2, borderStyle: "dashed", borderColor: theme.colors.text.secondary },
  currentLine: { position: "absolute", left: 0, right: 0, borderTopWidth: 2, borderColor: theme.colors.interactive.primary },
  bars: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  barHit: { minWidth: 44, height: "100%", flex: 1, paddingHorizontal: 8, justifyContent: "flex-end", alignItems: "center" },
  barHitActive: { borderBottomWidth: 3, borderColor: theme.colors.interactive.primary },
  bar: { width: "100%", minHeight: 14, borderTopLeftRadius: theme.radii.xs, borderTopRightRadius: theme.radii.xs, backgroundColor: theme.colors.border.default },
  barActive: { backgroundColor: theme.colors.interactive.primary },
  seriesOverlay: { position: "absolute", left: 6, right: 6, top: 8, bottom: 8 },
  seriesDot: { position: "absolute", width: 8, height: 8, borderRadius: theme.radii.full, backgroundColor: theme.colors.visualization.series2 },
  seriesDotMuted: { position: "absolute", width: 6, height: 6, borderRadius: theme.radii.full, backgroundColor: theme.colors.visualization.series3 },
}));
