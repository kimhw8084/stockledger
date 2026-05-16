import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { VisualEvidenceCard } from "../../types";

const DetailedVisualHero = ({
  card,
  compactLayout = false,
  styles,
}: {
  card: VisualEvidenceCard;
  compactLayout?: boolean;
  styles: any;
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
        <Text style={styles.detailHeroFootnote}>{card.metric.thresholdLabel ?? "Context"}</Text>
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
          <Text style={styles.detailCountdownUnit}>days</Text>
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
          <Text style={styles.detailHeroLegendText}>Lower risk</Text>
          <Text style={styles.detailHeroLegendText}>Higher risk</Text>
        </View>
        <Text style={styles.detailHeroFootnote}>{card.metric.thresholdLabel ?? "Context"}</Text>
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
        <Text style={styles.detailHeroFootnote}>{card.metric.thresholdLabel ?? "Planned zone"}</Text>
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
      ? `Point ${selectedPoint + 1}`
      : "Latest";

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
        <Text style={styles.detailHeroLegendText}>{card.metric.thresholdLabel ?? "Threshold"}</Text>
        <Text style={styles.detailHeroLegendText}>{visual.markerLabel ?? card.metric.comparisonLabel ?? "Series"}</Text>
      </View>
      <Text style={styles.detailHeroFootnote}>
        Tap the chart bars to inspect earlier points without leaving the stock metric sheet.
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
}) => {
  const [showFormulaDetails, setShowFormulaDetails] = useState(false);

  return (
    <>
      <DetailedVisualHero card={card} compactLayout={compactLayout} styles={styles} />
      <View style={[styles.detailNarrativePanel, compactLayout ? styles.detailNarrativePanelCompact : null]}>
        <View style={[styles.detailNarrativeHeader, compactLayout ? styles.detailNarrativeHeaderCompact : null]}>
          <Text style={styles.formulaTitle}>What stands out now</Text>
          <MetaPill label={`${selectedEvidenceIndex >= 0 ? selectedEvidenceIndex + 1 : 1} of ${total}`} />
        </View>
        <Text style={styles.detailNarrativeLead}>{card.summary}</Text>
        <View style={[styles.detailNarrativeSplit, compactLayout ? styles.detailNarrativeSplitCompact : null]}>
          <View style={styles.detailNarrativeBlock}>
            <Text style={styles.detailNarrativeLabel}>Effect</Text>
            <Text style={styles.formulaMeta}>{card.effect}</Text>
          </View>
          <View style={styles.detailNarrativeBlock}>
            <Text style={styles.detailNarrativeLabel}>Why it matters</Text>
            <Text style={styles.formulaMeta}>{card.whyItMatters}</Text>
          </View>
        </View>
        {card.relatedConditionLabel ? <MetaPill label={`Recipe: ${card.relatedConditionLabel}`} /> : null}
      </View>
      <View style={[styles.detailMetricStrip, compactLayout ? styles.detailMetricStripCompact : null]}>
        <DenseStat label="Current" value={card.metric.currentLabel} tone="strong" />
        <DenseStat label="Threshold" value={card.metric.thresholdLabel ?? "Context"} />
        <DenseStat
          label="Freshness"
          value={card.freshness === "Mock Data" ? "Dummy" : card.freshness}
          tone={card.freshness === "Fresh" ? "strong" : "neutral"}
        />
        <DenseStat
          label="Source"
          value={
            card.sourceType === "Mock Adapter"
              ? "Dummy"
              : card.sourceType === "Provider Adapter"
                ? "Provider"
                : "Manual"
          }
        />
      </View>
      <View style={[styles.detailSheetActionRow, compactLayout ? styles.detailSheetActionRowCompact : null]}>
        <Button label={compactLayout ? "Prev" : "Previous"} tone="secondary" onPress={onPrevious} disabled={selectedEvidenceIndex <= 0} />
        <Button label={isPinned ? "Unpin" : "Pin"} tone="ghost" onPress={onTogglePin} />
        <Button label="Next" tone="secondary" onPress={onNext} disabled={selectedEvidenceIndex < 0 || selectedEvidenceIndex >= total - 1} />
      </View>
      <View style={[styles.detailJumpSection, compactLayout ? styles.detailJumpSectionCompact : null]}>
        <Text style={styles.detailJumpTitle}>Browse more metrics</Text>
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
          <Text style={styles.formulaTitle}>{showFormulaDetails ? "Hide formula detail" : "Show formula detail"}</Text>
          <Text style={styles.formulaMeta} numberOfLines={showFormulaDetails ? undefined : 1}>
            {card.formulaName ?? "How this metric is calculated"}
          </Text>
        </View>
        <Text style={styles.groupHeaderToggle}>{showFormulaDetails ? "Hide" : "Show"}</Text>
      </Pressable>
      {showFormulaDetails ? (
        <View style={styles.formulaPanel}>
          <Text style={styles.formulaTitle}>{card.formulaName ?? "Formula detail"}</Text>
          <Text style={styles.formulaBody}>
            {card.formulaDescription ?? "No extra formula detail available."}
          </Text>
          <Text style={styles.formulaMeta}>
            Inputs: {card.formulaInputs?.join(", ") ?? "No explicit inputs recorded"}
          </Text>
        </View>
      ) : null}
    </>
  );
};
