import type { MockSnapshot, Stock, VisualEvidenceCard, VisualEvidenceGroup } from "../types";
import type { AppLanguage } from "./preferences";
import { getMetricContract } from "./metricCatalog";
/** Real-data cards never infer unavailable fundamentals, events or sector prices. */
export function providerEvidence(stock: Stock, snapshot: MockSnapshot, language: AppLanguage): VisualEvidenceGroup[] {
  const ko = language === "ko";
  const valid = Boolean(snapshot.provenance) && snapshot.freshness !== "Unavailable";
  const sessions = (key: string) => getMetricContract(key)?.windowSessions ?? 0;
  const threshold = (key: string, name: string) => getMetricContract(key)?.thresholds?.[name];
  const metric = (key: string, name: string, family: VisualEvidenceCard["family"], value: number | boolean | undefined, unit = "%", series?: number[]): VisualEvidenceCard => ({
    id: `${stock.id}-${key}`, family, title: name, role: "Supporting Evidence",
    status: value === undefined || !valid ? "Unavailable" : snapshot.freshness === "Stale" ? "Stale" : snapshot.freshness === "Partial" ? "Partial" : "Passed",
    summary: value === undefined || !valid ? (ko ? "검증된 입력 데이터가 부족합니다." : "Verified inputs are not available for this metric.") : `${name}: ${typeof value === "number" ? value.toFixed(2) + unit : value ? "Yes" : "No"}`,
    effect: ko ? "실제 관심 상태는 연결된 레시피 조건에 따라 결정됩니다." : "The attached recipe determines whether this observation meets your conditions.",
    whyItMatters: ko ? "누락된 값은 추정하지 않습니다." : "Unavailable inputs remain unknown; they are never estimated from price patterns.",
    freshness: snapshot.freshness, sourceType: "Provider Adapter",
    metric: { currentLabel: value === undefined || !valid ? "Unavailable" : typeof value === "number" ? value.toFixed(2) + unit : value ? "Yes" : "No", comparisonLabel: snapshot.provenance?.observedDate },
    visual: series?.length && valid ? { kind: "mini_trend", series } : { kind: "checklist", items: [{ label: snapshot.sourceName, tone: "neutral" }] },
  });
  const cards: VisualEvidenceCard[] = [
    metric("price", ko ? "종가" : "Closing price", "Price Damage", valid ? snapshot.price : undefined, " USD", snapshot.priceHistorySeries),
    metric("drawdown", ko ? `${sessions("drawdown_from_recent_high")}일 고점 대비` : `Drawdown from ${sessions("drawdown_from_recent_high")}-session closing high`, "Price Damage", (snapshot.priceHistorySeries?.length ?? 0) >= (getMetricContract("drawdown_from_recent_high")?.warmupSessions ?? Number.MAX_SAFE_INTEGER) ? snapshot.drawdownPct : undefined),
    metric("ma20", `${sessions("distance_from_ma_20")}-session moving-average distance`, "Trend & Stabilization", snapshot.movingAverage20DistancePct),
    metric("ma50", `${sessions("distance_from_ma_50")}-session moving-average distance`, "Trend & Stabilization", snapshot.movingAverage50DistancePct),
    metric("ma200", `${sessions("distance_from_ma_200")}-session moving-average distance`, "Trend & Stabilization", snapshot.movingAverage200DistancePct),
    metric("relative-strength", `${sessions("relative_strength_vs_spy")}-session excess return vs SPY`, "Relative Strength", snapshot.relativeStrengthVsSpyPct, " pp"),
    metric("volume", `Volume > ${threshold("volume_spike", "spikeMultiple")} × prior ${getMetricContract("volume_spike")?.warmupSessions! - 1}-session mean`, "Volume & Volatility", snapshot.volumeSpike, "", snapshot.volumeHistorySeries),
    metric("range", `${sessions("average_range_pct")}-session mean high/low range`, "Volume & Volatility", snapshot.averageRangePct, "%", snapshot.volatilityHistorySeries),
    metric("valuation", "Valuation discount", "Valuation", snapshot.valuationDiscount),
    metric("revenue", ko ? "매출 성장률" : "Revenue growth", "Financial Quality", snapshot.revenueGrowthYoY),
    metric("earnings", "Days until earnings", "Earnings & Events", snapshot.daysUntilEarnings, " days"),
  ];
  return [...new Set(cards.map(card => card.family))].map(family => ({ key: family, title: family, note: `${snapshot.sourceName} · ${snapshot.provenance?.observedDate ?? "Unverified legacy data"}`, cards: cards.filter(card => card.family === family) }));
}
