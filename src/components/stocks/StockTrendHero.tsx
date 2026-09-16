import React from "react";
import { Animated, Pressable, Text, View } from "react-native";

import { FreshnessStatus, MockSnapshot, Stock } from "../../types";
import { localizedFreshness, t } from "../../lib/i18n";
import { AppLanguage } from "../../lib/preferences";
import { MotionSwap } from "../MotionSwap";

export const StockTrendHero = ({
  styles,
  stock,
  snapshot,
  eyesCount,
  pinnedCount,
  metricCount,
  analysisLookback,
  analysisBenchmark,
  selectedHeroPrice,
  selectedHeroPointLabel,
  selectedHeroBenchmarkDelta,
  selectedStockHeroRange,
  selectedStockTrendDisplaySeries,
  selectedStockBenchmarkDisplaySeries,
  safeSelectedHeroPointIndex,
  setSelectedHeroPointIndex,
  isCompactPhone,
  freshnessTone,
  stockSnapshotModeLabel,
  Button,
  onClearStock,
  onEditStock,
  onDeleteStock,
  lookbackControl,
  benchmarkControl,
  language,
}: {
  styles: any;
  stock: Stock;
  snapshot?: MockSnapshot;
  eyesCount: number;
  pinnedCount: number;
  metricCount: number;
  analysisLookback: string;
  analysisBenchmark: string;
  selectedHeroPrice: number | undefined;
  selectedHeroPointLabel: string;
  selectedHeroBenchmarkDelta: number | undefined;
  selectedStockHeroRange: { low: number; high: number; latest: number } | null;
  selectedStockTrendDisplaySeries: number[];
  selectedStockBenchmarkDisplaySeries: number[];
  safeSelectedHeroPointIndex: number;
  setSelectedHeroPointIndex: (index: number) => void;
  isCompactPhone: boolean;
  freshnessTone: (freshness: FreshnessStatus) => any;
  stockSnapshotModeLabel: (snapshot?: { isMock: boolean } | null) => string;
  Button: React.ComponentType<any>;
  onClearStock: () => void;
  onEditStock: () => void;
  onDeleteStock: () => void;
  lookbackControl: React.ReactNode;
  benchmarkControl: React.ReactNode;
  language: AppLanguage;
}) => (
  <>
    <MotionSwap
      swapKey={`shell-${stock.id}-${analysisLookback}-${analysisBenchmark}-${selectedHeroPointLabel}`}
      y={10}
      scaleFrom={0.992}
    >
      <View style={[styles.stockShellHeader, isCompactPhone ? styles.stockShellHeaderCompact : null]}>
        <View style={styles.stockShellIdentity}>
          <Text style={styles.stockHeroSymbol}>{stock.symbol}</Text>
          <Text style={styles.stockHeroName}>{stock.name}</Text>
          <View style={styles.stockShellMetaRow}>
            <Text style={styles.stockBoardMetaText}>{metricCount} {t(language, "common.metrics")}</Text>
            <Text style={styles.stockBoardMetaDivider}>•</Text>
            <Text style={styles.stockBoardMetaText}>{eyesCount} {t(language, "common.eyes")}</Text>
            <Text style={styles.stockBoardMetaDivider}>•</Text>
            <Text style={styles.stockBoardMetaText}>{pinnedCount} {t(language, "common.pinned")}</Text>
            <Text style={styles.stockBoardMetaDivider}>•</Text>
            <Text style={styles.stockBoardMetaText}>{stockSnapshotModeLabel(snapshot)}</Text>
          </View>
        </View>
        <View style={styles.stockShellHeaderActions}>
          <View style={freshnessTone(snapshot?.freshness ?? "Unavailable")}>
            <Text style={styles.freshnessBadgeText}>
              {localizedFreshness(language, snapshot?.freshness ?? "Unavailable")}
            </Text>
          </View>
          <Button label={language === "ko" ? "수정" : "Edit"} tone="ghost" onPress={onEditStock} />
          <Button label={language === "ko" ? "삭제" : "Delete"} tone="ghost" onPress={onDeleteStock} />
          <Button label={t(language, "stocks.hero.clear")} tone="ghost" onPress={onClearStock} />
        </View>
      </View>
    </MotionSwap>
    <MotionSwap
      swapKey={`hero-${stock.id}-${analysisLookback}-${analysisBenchmark}-${safeSelectedHeroPointIndex}`}
      y={12}
      scaleFrom={0.99}
    >
      <View style={[styles.stockTrendHero, isCompactPhone ? styles.stockTrendHeroCompact : null]}>
        <View style={[styles.stockTrendHeader, isCompactPhone ? styles.stockTrendHeaderCompact : null]}>
          <View style={styles.flexOne}>
            <Text style={[styles.stockTrendPrice, isCompactPhone ? styles.stockTrendPriceCompact : null]}>
              {selectedHeroPrice !== undefined ? `$${selectedHeroPrice.toFixed(2)}` : "--"}
            </Text>
            <Text style={styles.stockTrendCaption}>{selectedHeroPointLabel}</Text>
          </View>
          <View style={[styles.stockTrendSummaryMini, isCompactPhone ? styles.stockTrendSummaryMiniCompact : null]}>
            <View style={[styles.stockTrendSummaryMiniBlock, isCompactPhone ? styles.stockTrendSummaryMiniBlockCompact : null]}>
              <Text style={styles.stockTrendSummaryMiniLabel}>{t(language, "common.range")}</Text>
              <Text style={styles.stockTrendSummaryMiniValue}>
                {selectedStockHeroRange
                  ? language === "ko"
                    ? `${Math.round(selectedStockHeroRange.high - selectedStockHeroRange.low)}포인트`
                    : `${Math.round(selectedStockHeroRange.high - selectedStockHeroRange.low)} pts`
                  : "--"}
              </Text>
            </View>
            <View style={[styles.stockTrendSummaryMiniBlock, isCompactPhone ? styles.stockTrendSummaryMiniBlockCompact : null]}>
              <Text style={styles.stockTrendSummaryMiniLabel}>{t(language, "stocks.hero.vs", { benchmark: analysisBenchmark })}</Text>
              <Text style={styles.stockTrendSummaryMiniValue}>
                {selectedHeroBenchmarkDelta !== undefined ? `${selectedHeroBenchmarkDelta >= 0 ? "+" : ""}${selectedHeroBenchmarkDelta.toFixed(2)}` : "--"}
              </Text>
            </View>
          </View>
        </View>
        <View style={[styles.stockHeroControlRow, isCompactPhone ? styles.stockHeroControlRowCompact : null]}>
          <View style={[styles.stockHeroControlBlock, isCompactPhone ? styles.stockHeroControlBlockCompact : null]}>
            <Text style={styles.stockHeroControlLabel}>{t(language, "stocks.hero.lookback")}</Text>
            {lookbackControl}
          </View>
          <View style={[styles.stockHeroControlBlock, isCompactPhone ? styles.stockHeroControlBlockCompact : null]}>
            <Text style={styles.stockHeroControlLabel}>{t(language, "stocks.hero.benchmark")}</Text>
            {benchmarkControl}
          </View>
        </View>
        <View style={[styles.stockTrendChart, isCompactPhone ? styles.stockTrendChartCompact : null]}>
          <View style={styles.stockTrendGrid}>
            <View style={styles.stockTrendGridLine} />
            <View style={styles.stockTrendGridLine} />
            <View style={styles.stockTrendGridLine} />
          </View>
          {selectedStockTrendDisplaySeries.map((point, index) => (
            <Pressable
              key={`trend-${stock.id}-${index}`}
              onPress={() => setSelectedHeroPointIndex(index)}
              style={[styles.stockTrendBarHit, index === safeSelectedHeroPointIndex ? styles.stockTrendBarHitActive : null]}
            >
              <Animated.View
                style={[
                  styles.stockTrendBar,
                  {
                    height: `${Math.max(16, point)}%`,
                    opacity: index === safeSelectedHeroPointIndex ? 1 : 0.52,
                  },
                  index === safeSelectedHeroPointIndex ? styles.stockTrendBarActive : null,
                ]}
              />
            </Pressable>
          ))}
          <View style={styles.stockTrendLineOverlay}>
            {selectedStockTrendDisplaySeries.map((point, index) => (
              <View
                key={`trend-dot-${stock.id}-${index}`}
                style={[
                  styles.stockTrendLineDot,
                  {
                    left: `${(index / Math.max(selectedStockTrendDisplaySeries.length - 1, 1)) * 100}%`,
                    bottom: `${Math.max(6, Math.min(96, point))}%`,
                  },
                  index === safeSelectedHeroPointIndex ? styles.stockTrendLineDotActive : null,
                ]}
              />
            ))}
            {selectedStockBenchmarkDisplaySeries.map((point, index) => (
              <View
                key={`benchmark-dot-${stock.id}-${index}`}
                style={[
                  styles.stockTrendBenchmarkDot,
                  {
                    left: `${(index / Math.max(selectedStockBenchmarkDisplaySeries.length - 1, 1)) * 100}%`,
                    bottom: `${Math.max(6, Math.min(96, point))}%`,
                  },
                ]}
              />
            ))}
          </View>
          {selectedStockHeroRange ? (
            <View
              style={[
                styles.stockTrendCurrentMarker,
                {
                  bottom: `${Math.max(6, Math.min(96, selectedStockTrendDisplaySeries[safeSelectedHeroPointIndex] ?? 50))}%`,
                },
              ]}
            />
          ) : null}
        </View>
        <View style={[styles.stockTrendLegend, isCompactPhone ? styles.stockTrendLegendCompact : null]}>
          <Text style={styles.stockTrendLegendText}>{selectedHeroPointLabel}</Text>
          <Text style={styles.stockTrendLegendText}>
            {t(language, "stocks.hero.drawdown", { value: snapshot ? `${snapshot.drawdownPct}%` : "N/A" })}
          </Text>
          <Text style={styles.stockTrendLegendText}>
            {language === "ko" ? `${analysisLookback} · ${analysisBenchmark} 비교` : `${analysisLookback} vs ${analysisBenchmark}`}
          </Text>
        </View>
      </View>
    </MotionSwap>
  </>
);
