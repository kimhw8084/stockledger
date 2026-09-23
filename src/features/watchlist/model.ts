import type { AppLanguage } from "../../lib/preferences";
import {
  formatLocaleDateTime,
  formatLocaleDate,
  formatLocaleNumber,
  localizedDecisionAction,
  localizedEyeState,
  localizedFreshness,
  localizedSourceType,
  localizedStatus,
  localizedSuggestionTrust,
  t,
} from "../../lib/i18n";
import type { Decision, Eye, EyeState, FreshnessStatus, MockSnapshot, Stock, VisualEvidenceCard } from "../../types";
import type {
  WatchlistBoardMode,
  WatchlistBenchmark,
  WatchlistLookback,
  WatchlistSelectedStock,
  WatchlistStatusFilter,
  WatchlistStockOption,
} from "./WatchlistScreen";

export interface WatchlistStockSummary {
  stock: Stock;
  eyes: Eye[];
  snapshot?: MockSnapshot;
  dominantEye?: Eye;
}

export interface WatchlistModel {
  statusChoices: readonly { value: WatchlistStatusFilter; label: string }[];
  boardChoices: readonly { value: WatchlistBoardMode; label: string }[];
  lookbackChoices: readonly { value: WatchlistLookback; label: string }[];
  benchmarkChoices: readonly { value: WatchlistBenchmark; label: string }[];
  recent: WatchlistStockOption[];
  candidates: WatchlistStockOption[];
  available: WatchlistStockOption[];
  selected: WatchlistSelectedStock | null;
}

export const stockMetricPreferenceKey = (stockId: string, cardId: string) => `${stockId}:${cardId}`;

const reviewTone = (state?: EyeState): WatchlistSelectedStock["reviewTone"] => {
  if (state === "Thesis Broken" || state === "Attention Needed") return "negative";
  if (state === "Thesis Risk Rising") return "warning";
  if (state === "Opportunity Zone Forming") return "positive";
  if (state === "Watch Closely") return "info";
  return "neutral";
};

const freshnessTone = (freshness?: FreshnessStatus): WatchlistSelectedStock["freshnessTone"] => {
  if (freshness === "Fresh") return "positive";
  if (freshness === "Delayed" || freshness === "Partial" || freshness === "Mock Data") return "warning";
  if (freshness === "Stale" || freshness === "Unavailable") return "negative";
  return "neutral";
};

const evidenceTone = (status: VisualEvidenceCard["status"]): WatchlistSelectedStock["evidence"][number]["tone"] => {
  if (status === "Passed") return "positive";
  if (status === "Near Trigger") return "info";
  if (status === "Blocked") return "negative";
  if (status === "Warning" || status === "Stale" || status === "Partial" || status === "Mock") return "warning";
  return "neutral";
};

const toOption = (language: AppLanguage, item: Pick<WatchlistStockSummary, "stock" | "snapshot">): WatchlistStockOption => ({
  id: item.stock.id,
  symbol: item.stock.symbol,
  name: item.stock.name,
  provenance: localizedSuggestionTrust(language, item.snapshot),
});

export const buildWatchlistModel = ({
  language,
  recentStocks,
  stockSuggestions,
  selectedStock,
  decisions,
  eyes,
  evidenceCards,
  pinnedMetricKeys,
}: {
  language: AppLanguage;
  recentStocks: readonly Pick<WatchlistStockSummary, "stock" | "snapshot">[];
  stockSuggestions: readonly Pick<WatchlistStockSummary, "stock" | "snapshot">[];
  selectedStock: WatchlistStockSummary | null | undefined;
  decisions: readonly Decision[];
  eyes: readonly Eye[];
  evidenceCards: readonly VisualEvidenceCard[];
  pinnedMetricKeys: readonly string[];
}): WatchlistModel => {
  const pinned = new Set(pinnedMetricKeys);
  return build(language, recentStocks, stockSuggestions, selectedStock, decisions, eyes, evidenceCards, pinned);
};

const build = (
  language: AppLanguage,
  recentStocks: readonly Pick<WatchlistStockSummary, "stock" | "snapshot">[],
  stockSuggestions: readonly Pick<WatchlistStockSummary, "stock" | "snapshot">[],
  selectedStock: WatchlistStockSummary | null | undefined,
  decisions: readonly Decision[],
  eyes: readonly Eye[],
  evidenceCards: readonly VisualEvidenceCard[],
  pinnedMetricKeys: ReadonlySet<string>,
): WatchlistModel => {
  const statusChoices = [
    { value: "All Statuses", label: language === "ko" ? "전체" : "All" },
    { value: "Passed", label: language === "ko" ? "통과" : "Passed" },
    { value: "Near Trigger", label: language === "ko" ? "근접" : "Near trigger" },
    { value: "Warning", label: language === "ko" ? "경고" : "Warning" },
    { value: "Blocked", label: language === "ko" ? "차단" : "Blocked" },
    { value: "Needs Review", label: language === "ko" ? "검토 필요" : "Needs review" },
  ] as const;
  const boardChoices = [
    { value: "Pinned First", label: language === "ko" ? "고정 우선" : "Pinned first" },
    { value: "Status", label: language === "ko" ? "상태" : "Status" },
    { value: "Family", label: language === "ko" ? "분류" : "Family" },
  ] as const;
  const lookbackChoices = [
    { value: "20D", label: language === "ko" ? "20일" : "20 days" },
    { value: "3M", label: language === "ko" ? "3개월" : "3 months" },
    { value: "6M", label: language === "ko" ? "6개월" : "6 months" },
  ] as const;
  const benchmarkChoices = [
    { value: "SPY", label: "SPY" },
    { value: "QQQ", label: "QQQ" },
    { value: "Sector ETF", label: language === "ko" ? "섹터 ETF" : "Sector ETF" },
  ] as const;
  const selected = selectedStock ? {
    id: selectedStock.stock.id,
    symbol: selectedStock.stock.symbol,
    name: selectedStock.stock.name,
    reviewState: selectedStock.dominantEye?.lastEvaluation?.currentState
      ? localizedEyeState(language, selectedStock.dominantEye.lastEvaluation.currentState)
      : language === "ko" ? "평가 대기" : "Not evaluated",
    reviewTone: reviewTone(selectedStock.dominantEye?.lastEvaluation?.currentState),
    freshness: localizedFreshness(language, selectedStock.snapshot?.freshness ?? "Unavailable"),
    freshnessTone: freshnessTone(selectedStock.snapshot?.freshness),
    sourceAndTime: selectedStock.snapshot
      ? `${selectedStock.snapshot.sourceName} · ${formatLocaleDateTime(language, selectedStock.snapshot.updatedAt)}`
      : language === "ko" ? "확인 가능한 원천 관측값이 없습니다." : "No source observation is available.",
    coverage: selectedStock.snapshot?.provenance?.coverageState
      ? `${language === "ko" ? "범위" : "Coverage"}: ${selectedStock.snapshot.provenance.coverageState}`
      : language === "ko" ? "데이터 범위가 별도로 기록되지 않았습니다." : "Data coverage is not separately recorded.",
    price: selectedStock.snapshot
      ? formatLocaleNumber(language, selectedStock.snapshot.price, { style: "currency", currency: "USD", maximumFractionDigits: 2 })
      : t(language, "stocks.data.noData"),
    evidenceSummary: selectedStock.dominantEye?.lastEvaluation?.whyNow ??
      (language === "ko" ? "최근 평가 요약이 없습니다. 원천 데이터와 적용 가능한 근거를 확인하세요." : "No recent evaluation summary is available. Inspect the source data and applicable evidence."),
    sample: Boolean(selectedStock.snapshot?.isMock),
    eyesCount: selectedStock.eyes.length,
    metricsCount: evidenceCards.length,
    evidence: evidenceCards.map((card) => ({
      id: card.id,
      family: card.family,
      title: card.title,
      status: localizedStatus(language, card.status),
      tone: evidenceTone(card.status),
      summary: card.summary,
      value: card.metric.currentLabel,
      context: [card.metric.thresholdLabel, card.metric.comparisonLabel, localizedFreshness(language, card.freshness), localizedSourceType(language, card.sourceType)]
        .filter(Boolean)
        .join(" · "),
      pinned: pinnedMetricKeys.has(stockMetricPreferenceKey(selectedStock.stock.id, card.id)),
    })),
    decisions: (() => {
      const eyeIds = new Set(eyes.filter((eye) => eye.stockId === selectedStock.stock.id).map((eye) => eye.id));
      return decisions
        .filter((decision) => !decision.archivedAt && eyeIds.has(decision.eyeId))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 4)
        .map((decision) => ({
          id: decision.id,
          action: localizedDecisionAction(language, decision.action),
          recordedAt: formatLocaleDate(language, decision.createdAt),
          stateAtDecision: decision.stateAtDecision ? localizedEyeState(language, decision.stateAtDecision) : t(language, "journal.detail.noState"),
          dataQuality: decision.dataQuality || t(language, "journal.detail.noData"),
          note: decision.note || t(language, "journal.detail.noNote"),
          concern: decision.concern || t(language, "journal.detail.noConcern"),
        }));
    })(),
  } satisfies WatchlistSelectedStock : null;

  return {
    statusChoices,
    boardChoices,
    lookbackChoices,
    benchmarkChoices,
    recent: recentStocks.map((item) => toOption(language, item)),
    candidates: stockSuggestions.map((item) => toOption(language, item)),
    available: stockSuggestions.map((item) => toOption(language, item)),
    selected,
  };
};
