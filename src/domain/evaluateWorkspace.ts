import type { Alert, AppData, Evaluation, Eye, Recipe } from "../types";
import { evaluateEye } from "../lib/evaluateEye";
import { FINANCIAL_TRUTH_ENGINE_VERSION, metricCatalog } from "../lib/metricCatalog";
import { contentHash } from "./contentHash";
import { latestCompletedTradingDate } from "../lib/marketCalendar";

export function evaluateWorkspace(data: AppData, now = new Date()): AppData {
  const completedSession = latestCompletedTradingDate(now);
  const snapshots = data.snapshots.map(snapshot => !snapshot.isMock && snapshot.provenance ? {
    ...snapshot, freshness: snapshot.provenance.observedDate < completedSession ? "Stale" as const
      : snapshot.provenance.observedDate > completedSession || snapshot.provenance.adjustment !== "adjusted" ? "Partial" as const : "Delayed" as const,
  } : snapshot);
  const alerts = [...data.alerts], evaluations = [...(data.evaluations ?? [])];
  const definitions = [...metricCatalog, ...data.customMetrics];
  const eyes = data.eyes.map(eye => {
    const stock = data.stocks.find(item => item.id === eye.stockId);
    const recipe = data.recipes.find(item => item.id === eye.recipeId);
    const snapshot = snapshots.find(item => item.stockId === eye.stockId);
    if (!stock || stock.archivedAt || eye.archivedAt || !recipe || !snapshot) return eye;
    const key = contentHash({ engine: FINANCIAL_TRUTH_ENGINE_VERSION, eye: { ...eye, lastEvaluation: undefined }, recipe, snapshot, definitions, completedSession, reviewDate: now.toISOString().slice(0, 10) });
    if (eye.lastEvaluation?.inputHash === key) return eye;
    const evaluation: Evaluation = { ...evaluateEye(eye, recipe, snapshot, definitions, now), id: `evaluation-${key}`, inputHash: key };
    if (!evaluations.some(item => item.id === evaluation.id)) evaluations.push(evaluation);
    if (evaluation.alertSuggested) {
      const stateChange = `${evaluation.previousState} -> ${evaluation.currentState}`;
      const cooldownMs = (recipe.alertConfig?.cooldownHours ?? 24) * 3600000;
      const duplicate = alerts.some(alert => alert.eyeId === eye.id && alert.recipeId === recipe.id
        && now.getTime() - Date.parse(alert.createdAt) < cooldownMs
        && (recipe.alertConfig?.dedupeKey === "current_state" ? alert.evaluationContext?.currentState === evaluation.currentState : alert.stateChange === stateChange));
      const exactDuplicate = alerts.some(alert => alert.evaluationId === evaluation.id);
      if (!duplicate && !exactDuplicate) alerts.unshift(alertFromEvaluation(eye, recipe, evaluation, stock.symbol, now));
      else evaluation.alertSuppressedReason = "An equivalent alert is within this recipe's cooldown window.";
    }
    return { ...eye, lastEvaluation: evaluation };
  });
  return { ...data, snapshots, eyes, alerts, evaluations };
}
function alertFromEvaluation(eye: Eye, recipe: Recipe, evaluation: Evaluation, symbol: string, now: Date): Alert {
  const risk = ["Thesis Broken", "Thesis Risk Rising"].includes(evaluation.currentState);
  return {
    id: `alert-${evaluation.inputHash}`, evaluationId: evaluation.id, eyeId: eye.id, recipeId: recipe.id, recipeVersion: recipe.version,
    title: `${evaluation.currentState} for ${symbol}`, stateChange: `${evaluation.previousState} -> ${evaluation.currentState}`, whyNow: evaluation.whyNow,
    supportingEvidence: evaluation.supportingEvidence, risks: [...evaluation.contradictingEvidence, ...(evaluation.riskWarnings ?? []), ...(evaluation.hardDisqualifiers ?? [])], dataQuality: evaluation.dataQuality,
    evaluationContext: { currentState: evaluation.currentState, conditionResults: evaluation.conditionResults, staleData: evaluation.staleData, missingData: evaluation.missingData },
    priority: risk ? recipe.alertConfig?.priorityOnRisk ?? "High" : recipe.alertConfig?.priorityOnAttention ?? "High",
    createdAt: now.toISOString(), reviewed: false,
  };
}
