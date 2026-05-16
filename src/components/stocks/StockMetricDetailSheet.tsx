import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { VisualEvidenceCard } from "../../types";
import { t } from "../../lib/i18n";
import { AppLanguage } from "../../lib/preferences";

const DetailedVisualHero = ({
  card,
  compactLayout = false,
  styles,
  language,
}: {
  card: VisualEvidenceCard;
  compactLayout?: boolean;
  styles: any;
  language: AppLanguage;
}) => {
  const visual = card.visual;
  const primarySeries = visual.series ?? [];
  const secondarySeries = visual.secondarySeries ?? [];
  const tertiarySeries = visual.tertiarySeries ?? [];
  const [selectedPoint, setSelectedPoint] = useState<number>(Math.max(primarySeries.length - 1, 0));

  useEffect(() => {
    setSelectedPoint(Math.max(primarySeries.length - 1, 0));
  }, [card.id, primarySeries.length]);

  if (visual.kind === "checklist") {
    return (
      <View style={[styles.detailHeroCard, compactLayout ? styles.detailHeroCardCompact : null]}>
        <View style={[styles.detailHeroHeader, compactLayout ? styles.detailHeroHeaderCompact : null]}>
          <Text style={styles.detailHeroEyebrow}>{card.family}</Text>
          <Text style={[styles.detailHeroValue, compactLayout ? styles.detailHeroValueCompact : null]}>{card.metric.currentLabel}</Text>
        </View>
        <View style={styles.detailChecklistStack}>
          {(visual.items ?? []).map((item) => (
            <View key={item.label} style={styles.detailChecklistRow}>
              <View
                style={[
                  styles.detailChecklistMarker,
                  item.tone === "good"
                    ? styles.detailChecklistMarkerGood
                    : item.tone === "warning"
                      ? styles.detailChecklistMarkerWarning
                      : item.tone === "danger"
                        ? styles.detailChecklistMarkerDanger
                        : styles.detailChecklistMarkerNeutral,
                ]}
              />
              <Text style={styles.detailChecklistLabel} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.detailHeroFootnote}>{card.metric.thresholdLabel ?? t(language, "stocks.detail.context")}</Text>
      </View>
    );
  }

  if (visual.kind === "event_countdown") {
    return (
      <View style={[styles.detailHeroCard, compactLayout ? styles.detailHeroCardCompact : null]}>
        <View style={[styles.detailHeroHeader, compactLayout ? styles.detailHeroHeaderCompact : null]}>
          <Text style={styles.detailHeroEyebrow}>{card.family}</Text>
          <Text style={[styles.detailHeroValue, compactLayout ? styles.detailHeroValueCompact : null]}>
            {visual.countdownLabel ?? card.metric.currentLabel}
          </Text>
        </View>
        <View style={styles.detailCountdownWrap}>
          <Text style={styles.detailCountdownDays}>{visual.countdownDays ?? "--"}</Text>
          <Text style={styles.detailCountdownUnit}>{t(language, "stocks.detail.days")}</Text>
        </View>
        <Text style={styles.detailHeroFootnote}>{card.summary}</Text>
      </View>
    );
  }

  if (visual.kind === "risk_gauge") {
    const min = visual.min ?? 0;
    const max = visual.max ?? 100;
    const current = visual.current ?? min;
    const threshold = visual.threshold ?? max;
    const currentPct = ((current - min) / Math.max(max - min, 1)) * 100;
    const thresholdPct = ((threshold - min) / Math.max(max - min, 1)) * 100;

    return (
      <View style={[styles.detailHeroCard, compactLayout ? styles.detailHeroCardCompact : null]}>
        <View style={[styles.detailHeroHeader, compactLayout ? styles.detailHeroHeaderCompact : null]}>
          <Text style={styles.detailHeroEyebrow}>{card.family}</Text>
          <Text style={[styles.detailHeroValue, compactLayout ? styles.detailHeroValueCompact : null]}>{card.metric.currentLabel}</Text>
        </View>
        <View style={styles.detailGaugeTrack}>
          <View style={styles.detailGaugeSafe} />
          <View style={styles.detailGaugeWarn} />
          <View style={styles.detailGaugeDanger} />
          <View style={[styles.detailGaugeThreshold, { left: `${Math.max(0, Math.min(100, thresholdPct))}%` }]} />
          <View style={[styles.detailGaugeCurrent, { left: `${Math.max(0, Math.min(100, currentPct))}%` }]} />
        </View>
        <View style={[styles.detailHeroLegend, compactLayout ? styles.detailHeroLegendCompact : null]}>
          <Text style={styles.detailHeroLegendText}>{t(language, "stocks.detail.lowerRisk")}</Text>
          <Text style={styles.detailHeroLegendText}>{t(language, "stocks.detail.higherRisk")}</Text>
        </View>
        <Text style={styles.detailHeroFootnote}>{card.metric.thresholdLabel ?? t(language, "stocks.detail.context")}</Text>
      </View>
    );
  }

  if (visual.kind === "entry_zone") {
    const low = visual.low ?? 0;
    const high = visual.high ?? low;
    const current = visual.current ?? low;
    const min = Math.max(0, low * 0.92);
    const max = high * 1.08 || 1;
    const start = ((low - min) / Math.max(max - min, 1)) * 100;
    const width = ((high - low) / Math.max(max - min, 1)) * 100;
    const marker = ((current - min) / Math.max(max - min, 1)) * 100;

    return (
      <View style={[styles.detailHeroCard, compactLayout ? styles.detailHeroCardCompact : null]}>
        <View style={[styles.detailHeroHeader, compactLayout ? styles.detailHeroHeaderCompact : null]}>
          <Text style={styles.detailHeroEyebrow}>{card.family}</Text>
          <Text style={[styles.detailHeroValue, compactLayout ? styles.detailHeroValueCompact : null]}>{card.metric.currentLabel}</Text>
        </View>
        <View style={styles.detailZoneTrack}>
          <View style={[styles.detailZoneBand, { left: `${Math.max(0, start)}%`, width: `${Math.max(width, 6)}%` }]} />
          <View style={[styles.detailZoneMarker, { left: `${Math.max(0, Math.min(100, marker))}%` }]} />
        </View>
        <View style={[styles.detailHeroLegend, compactLayout ? styles.detailHeroLegendCompact : null]}>
          <Text style={styles.detailHeroLegendText}>${low.toFixed(2)}</Text>
          <Text style={styles.detailHeroLegendText}>${current.toFixed(2)}</Text>
          <Text style={styles.detailHeroLegendText}>${high.toFixed(2)}</Text>
        </View>
        <Text style={styles.detailHeroFootnote}>{card.metric.thresholdLabel ?? t(language, "stocks.detail.plannedZone")}</Text>
      </View>
    );
  }

  const displaySeries = primarySeries.length > 0 ? primarySeries : [25, 32, 28, 36, 42, 40, 48, 54];
  const selectedValue = displaySeries[Math.max(0, Math.min(selectedPoint, displaySeries.length - 1))] ?? displaySeries[displaySeries.length - 1];
  const min = visual.min ?? Math.min(...displaySeries);
  const max = visual.max ?? Math.max(...displaySeries);
  const threshold = visual.threshold ?? min;
  const thresholdPct = ((threshold - min) / Math.max(max - min, 1)) * 100;
  const currentPct = ((selectedValue - min) / Math.max(max - min, 1)) * 100;
  const currentLabel =
    displaySeries.length > 1 && selectedPoint !== displaySeries.length - 1
      ? language === "ko"
        ? `${selectedPoint + 1}번째 지점`
        : `Point ${selectedPoint + 1}`
      : t(language, "stocks.detail.latest");

  return (
    <View style={[styles.detailHeroCard, compactLayout ? styles.detailHeroCardCompact : null]}>
      <View style={[styles.detailHeroHeader, compactLayout ? styles.detailHeroHeaderCompact : null]}>
        <View style={styles.flexOne}>
          <Text style={styles.detailHeroEyebrow}>{card.family}</Text>
          <Text style={[styles.detailHeroValue, compactLayout ? styles.detailHeroValueCompact : null]}>{card.metric.currentLabel}</Text>
        </View>
        <View style={styles.detailHeroBadge}>
          <Text style={styles.detailHeroBadgeText}>{currentLabel}</Text>
        </View>
      </View>
      <View style={[styles.detailHeroChart, compactLayout ? styles.detailHeroChartCompact : null]}>
        <View style={styles.detailHeroGrid}>
          <View style={styles.detailHeroGridLine} />
          <View style={styles.detailHeroGridLine} />
          <View style={styles.detailHeroGridLine} />
        </View>
        <View style={[styles.detailHeroThresholdLine, { bottom: `${Math.max(0, Math.min(100, thresholdPct))}%` }]} />
        <View style={[styles.detailHeroCurrentLine, { bottom: `${Math.max(0, Math.min(100, currentPct))}%` }]} />
        <View style={styles.detailHeroBarsRow}>
          {displaySeries.map((point, index) => {
            const pointPct = ((point - min) / Math.max(max - min, 1)) * 100;
            const seriesActive = index === selectedPoint;
            return (
              <Pressable
                key={`${card.id}-detail-series-${index}`}
                onPress={() => setSelectedPoint(index)}
                style={[styles.detailHeroBarHit, seriesActive ? styles.detailHeroBarHitActive : null]}
              >
                <View
                  style={[
                    styles.detailHeroBar,
                    { height: `${Math.max(12, pointPct)}%` },
                    seriesActive ? styles.detailHeroBarActive : null,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
        {secondarySeries.length > 0 ? (
          <View pointerEvents="none" style={styles.detailHeroLineOverlay}>
            {secondarySeries.map((point, index) => {
              const pointPct = ((point - min) / Math.max(max - min, 1)) * 100;
              return (
                <View
                  key={`${card.id}-detail-secondary-${index}`}
                  style={[
                    styles.detailHeroLineDot,
                    {
                      left: `${(index / Math.max(secondarySeries.length - 1, 1)) * 100}%`,
                      bottom: `${Math.max(0, Math.min(100, pointPct))}%`,
                    },
                  ]}
                />
              );
            })}
          </View>
        ) : null}
        {tertiarySeries.length > 0 ? (
          <View pointerEvents="none" style={styles.detailHeroLineOverlay}>
            {tertiarySeries.map((point, index) => {
              const pointPct = ((point - min) / Math.max(max - min, 1)) * 100;
              return (
                <View
                  key={`${card.id}-detail-tertiary-${index}`}
                  style={[
                    styles.detailHeroLineDotMuted,
                    {
                      left: `${(index / Math.max(tertiarySeries.length - 1, 1)) * 100}%`,
                      bottom: `${Math.max(0, Math.min(100, pointPct))}%`,
                    },
                  ]}
                />
              );
            })}
          </View>
        ) : null}
      </View>
      <View style={[styles.detailHeroLegend, compactLayout ? styles.detailHeroLegendCompact : null]}>
        <Text style={styles.detailHeroLegendText}>{card.metric.thresholdLabel ?? t(language, "stocks.detail.threshold")}</Text>
        <Text style={styles.detailHeroLegendText}>{visual.markerLabel ?? card.metric.comparisonLabel ?? t(language, "stocks.detail.series")}</Text>
      </View>
      <Text style={styles.detailHeroFootnote}>
        {t(language, "stocks.detail.tapChart")}
      </Text>
    </View>
  );
};

export const StockMetricDetailSheet = ({
  card,
  selectedEvidenceIndex,
  total,
  sortedCards,
  isPinned,
  onPrevious,
  onNext,
  onTogglePin,
  onSelectCard,
  compactLayout = false,
  styles,
  MetaPill,
  DenseStat,
  Button,
  language,
}: {
  card: VisualEvidenceCard;
  selectedEvidenceIndex: number;
  total: number;
  sortedCards: VisualEvidenceCard[];
  isPinned: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onTogglePin: () => void;
  onSelectCard: (next: VisualEvidenceCard) => void;
  compactLayout?: boolean;
  styles: any;
  MetaPill: React.ComponentType<{ label: string }>;
  DenseStat: React.ComponentType<{ label: string; value: string; tone?: "neutral" | "strong" | "risk" }>;
  Button: React.ComponentType<{
    label: string;
    onPress: () => void;
    tone?: "primary" | "secondary" | "ghost";
    disabled?: boolean;
  }>;
  language: AppLanguage;
}) => {
  const [showFormulaDetails, setShowFormulaDetails] = useState(false);

  return (
    <>
      <DetailedVisualHero card={card} compactLayout={compactLayout} styles={styles} language={language} />
      <View style={[styles.detailNarrativePanel, compactLayout ? styles.detailNarrativePanelCompact : null]}>
        <View style={[styles.detailNarrativeHeader, compactLayout ? styles.detailNarrativeHeaderCompact : null]}>
          <Text style={styles.formulaTitle}>{t(language, "stocks.detail.whatStandsOut")}</Text>
          <MetaPill label={`${selectedEvidenceIndex >= 0 ? selectedEvidenceIndex + 1 : 1} of ${total}`} />
        </View>
        <Text style={styles.detailNarrativeLead}>{card.summary}</Text>
        <View style={[styles.detailNarrativeSplit, compactLayout ? styles.detailNarrativeSplitCompact : null]}>
          <View style={styles.detailNarrativeBlock}>
            <Text style={styles.detailNarrativeLabel}>{t(language, "stocks.detail.effect")}</Text>
            <Text style={styles.formulaMeta}>{card.effect}</Text>
          </View>
          <View style={styles.detailNarrativeBlock}>
            <Text style={styles.detailNarrativeLabel}>{t(language, "stocks.detail.whyItMatters")}</Text>
            <Text style={styles.formulaMeta}>{card.whyItMatters}</Text>
          </View>
        </View>
        {card.relatedConditionLabel ? <MetaPill label={t(language, "stocks.detail.recipeLink", { label: card.relatedConditionLabel })} /> : null}
      </View>
      <View style={[styles.detailMetricStrip, compactLayout ? styles.detailMetricStripCompact : null]}>
        <DenseStat label={t(language, "common.current")} value={card.metric.currentLabel} tone="strong" />
        <DenseStat label={t(language, "common.threshold")} value={card.metric.thresholdLabel ?? t(language, "stocks.detail.context")} />
        <DenseStat
          label={t(language, "common.freshness")}
          value={card.freshness === "Mock Data" ? t(language, "stocks.data.dummy") : card.freshness}
          tone={card.freshness === "Fresh" ? "strong" : "neutral"}
        />
        <DenseStat
          label={t(language, "common.source")}
          value={
            card.sourceType === "Mock Adapter"
              ? t(language, "stocks.data.dummy")
              : card.sourceType === "Provider Adapter"
                ? t(language, "stocks.data.provider")
                : t(language, "stocks.data.manual")
          }
        />
      </View>
      <View style={[styles.detailSheetActionRow, compactLayout ? styles.detailSheetActionRowCompact : null]}>
        <Button label={compactLayout ? t(language, "common.prev") : t(language, "common.previous")} tone="secondary" onPress={onPrevious} disabled={selectedEvidenceIndex <= 0} />
        <Button label={isPinned ? t(language, "common.unpin") : t(language, "common.pin")} tone="ghost" onPress={onTogglePin} />
        <Button label={t(language, "common.next")} tone="secondary" onPress={onNext} disabled={selectedEvidenceIndex < 0 || selectedEvidenceIndex >= total - 1} />
      </View>
      <View style={[styles.detailJumpSection, compactLayout ? styles.detailJumpSectionCompact : null]}>
        <Text style={styles.detailJumpTitle}>{t(language, "stocks.detail.browseMore")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.detailJumpRow}>
          {sortedCards.map((jumpCard) => (
            <Pressable
              key={`jump-${jumpCard.id}`}
              onPress={() => onSelectCard(jumpCard)}
              style={[styles.metricJumpChip, card.id === jumpCard.id ? styles.metricJumpChipActive : null]}
            >
              <Text
                style={[styles.metricJumpChipText, card.id === jumpCard.id ? styles.metricJumpChipTextActive : null]}
                numberOfLines={1}
              >
                {jumpCard.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <Pressable onPress={() => setShowFormulaDetails((current) => !current)} style={styles.detailDisclosurePanel}>
        <View style={styles.flexOne}>
          <Text style={styles.formulaTitle}>{showFormulaDetails ? t(language, "stocks.detail.hideFormula") : t(language, "stocks.detail.showFormula")}</Text>
          <Text style={styles.formulaMeta} numberOfLines={showFormulaDetails ? undefined : 1}>
            {card.formulaName ?? t(language, "stocks.detail.formulaFallback")}
          </Text>
        </View>
        <Text style={styles.groupHeaderToggle}>{showFormulaDetails ? t(language, "stocks.detail.hideFormula") : t(language, "stocks.detail.showFormula")}</Text>
      </Pressable>
      {showFormulaDetails ? (
        <View style={styles.formulaPanel}>
          <Text style={styles.formulaTitle}>{card.formulaName ?? t(language, "stocks.detail.formulaDetail")}</Text>
          <Text style={styles.formulaBody}>
            {card.formulaDescription ?? t(language, "stocks.detail.formulaMissing")}
          </Text>
          <Text style={styles.formulaMeta}>
            {t(language, "stocks.detail.inputs", {
              inputs: card.formulaInputs?.join(", ") ?? (language === "ko" ? "기록된 입력값 없음" : "No explicit inputs recorded"),
            })}
          </Text>
        </View>
      ) : null}
    </>
  );
};
