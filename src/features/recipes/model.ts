import type { AppLanguage } from "../../lib/preferences";
import {
  formatLocaleDate,
  localizedConditionRole,
  localizedFreshness,
  localizedMetricAvailability,
  localizedScanRunStatus,
  localizedScannerDescription,
  localizedScannerStatus,
  localizedTimeHorizon,
  localizedUseCase,
} from "../../lib/i18n";
import type { FreshnessStatus, MetricDefinition, Recipe, RecipeCondition, ScanRun, ScanSignal } from "../../types";
import type {
  RecipeFormulaRow,
  RecipeLayerChoice,
  RecipeRawSourceRow,
  RecipeRuleRow,
  RecipeSetRow,
  RecipeSignalRow,
} from "./RecipesScreen";

interface LogicDataSource {
  key: string;
  title: string;
  reliability: string;
  status: string;
  provider: string;
  api: string;
  freshnessLabel: string;
  fields: readonly string[];
}

export interface RecipesModel {
  layerChoices: readonly RecipeLayerChoice[];
  rawSources: readonly RecipeRawSourceRow[];
  formulas: readonly RecipeFormulaRow[];
  rules: readonly RecipeRuleRow[];
  sets: readonly RecipeSetRow[];
  signals: readonly RecipeSignalRow[];
  scanner: {
    lastRun: string;
    matched: number;
    near: number;
    blocked: number;
    ruleCount: number;
    running: boolean;
  };
}

const freshnessLabel = (language: AppLanguage, value: string) => {
  if (["Fresh", "Delayed", "Partial", "Unavailable", "Stale", "Mock Data"].includes(value)) {
    return localizedFreshness(language, value as FreshnessStatus);
  }
  if (language === "ko") {
    const labels: Record<string, string> = {
      "Near Real Time": "실시간에 가까움",
      Daily: "일간",
      Quarterly: "분기",
      "Review Cadence": "검토 주기",
    };
    return labels[value] ?? value;
  }
  return value;
};

export const buildRecipesModel = ({
  language,
  sources,
  metrics,
  rules,
  sets,
  signals,
  reviewLogsBySignal,
  latestScanRun,
  matchedCount,
  nearCount,
  blockedCount,
  scannerRuleCount,
  scannerRunning,
  rawFieldLabel,
}: {
  language: AppLanguage;
  sources: readonly LogicDataSource[];
  metrics: readonly MetricDefinition[];
  rules: readonly { recipeId: string; recipeName: string; recipeVersion: number; condition: RecipeCondition }[];
  sets: readonly Recipe[];
  signals: readonly ScanSignal[];
  reviewLogsBySignal: ReadonlyMap<string, unknown>;
  latestScanRun?: ScanRun;
  matchedCount: number;
  nearCount: number;
  blockedCount: number;
  scannerRuleCount: number;
  scannerRunning: boolean;
  rawFieldLabel: (language: AppLanguage, field: string) => string;
}): RecipesModel => {
  const layerChoices = [
    { value: "Raw Data", label: language === "ko" ? "원천 데이터 · L0" : "Raw data · L0" },
    { value: "Formulas", label: language === "ko" ? "수식 · L1" : "Formula · L1" },
    { value: "Rules", label: language === "ko" ? "규칙 · L1.5" : "Rule · L1.5" },
    { value: "Sets", label: language === "ko" ? "세트 · L2" : "Set · L2" },
  ] as const;
  const rawSources: RecipeRawSourceRow[] = sources.map((source) => ({
    id: source.key,
    title: source.title,
    description: `${source.reliability} · ${source.status}`,
    source: `${source.provider} · ${source.api}`,
    freshness: source.freshnessLabel,
    fields: source.fields.map((field) => rawFieldLabel(language, field)),
  }));
  const formulas: RecipeFormulaRow[] = metrics.map((metric) => ({
    id: metric.key,
    name: metric.name,
    meaning: metric.humanMeaning,
    requiredData: metric.requiredData.map((field) => rawFieldLabel(language, field)),
    availability: localizedMetricAvailability(language, metric.availability),
    freshness: freshnessLabel(language, metric.freshnessExpectation),
    editable: true,
  }));
  const ruleRows: RecipeRuleRow[] = rules.map((row) => ({
    id: row.condition.id,
    recipeId: row.recipeId,
    label: row.condition.humanDescription ?? row.condition.label,
    recipeName: row.recipeName,
    version: row.recipeVersion,
    role: localizedConditionRole(language, row.condition.role ?? "Supporting Evidence"),
    availability: localizedMetricAvailability(language, row.condition.availability),
  }));
  const setRows: RecipeSetRow[] = sets.map((recipe) => ({
    id: recipe.id,
    name: recipe.name,
    version: recipe.version,
    purpose: recipe.purpose,
    intendedUse: localizedUseCase(language, recipe.intendedUseCase),
    timeHorizon: localizedTimeHorizon(language, recipe.timeHorizon),
    cadence: recipe.reviewConfig
      ? language === "ko" ? `${recipe.reviewConfig.cadenceDays}일` : `Every ${recipe.reviewConfig.cadenceDays} days`
      : language === "ko" ? "주기 미설정" : "Cadence not set",
    ruleCount: recipe.conditions.length,
    scannerState: latestScanRun
      ? `${localizedScanRunStatus(language, latestScanRun.status)} · ${formatLocaleDate(language, latestScanRun.scanDate)}`
      : language === "ko" ? "저장된 스캔 실행 없음" : "No saved scanner run",
  }));
  const signalRows: RecipeSignalRow[] = signals.map((signal) => ({
    id: signal.signalId,
    ticker: signal.ticker,
    status: localizedScannerStatus(language, signal.status),
    rule: signal.ruleId,
    description: localizedScannerDescription(language, signal.status),
    evidenceSummary: language === "ko"
      ? `통과 ${signal.matchedConditionsJson.length}개 · 실패 ${signal.failedConditionsJson.length}개 · 누락 ${signal.missingConditionsJson.length}개`
      : `${signal.matchedConditionsJson.length} passed · ${signal.failedConditionsJson.length} failed · ${signal.missingConditionsJson.length} missing`,
    sector: signal.sector,
    reviewLogged: reviewLogsBySignal.has(signal.signalId),
  }));
  return {
    layerChoices,
    rawSources,
    formulas,
    rules: ruleRows,
    sets: setRows,
    signals: signalRows,
    scanner: {
      lastRun: latestScanRun
        ? `${formatLocaleDate(language, latestScanRun.scanDate)} · ${localizedScanRunStatus(language, latestScanRun.status)}`
        : language === "ko" ? "저장된 스캔 실행 없음" : "No saved scanner run",
      matched: matchedCount,
      near: nearCount,
      blocked: blockedCount,
      ruleCount: scannerRuleCount,
      running: scannerRunning,
    },
  };
};
