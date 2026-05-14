import { useEffect, useMemo, useState } from "react";

import { evaluateEye } from "../lib/evaluateEye";
import { buildProviderSnapshot, buildSnapshotsFromAdapters } from "../lib/providerSnapshot";
import { seedData } from "../lib/seed";
import { loadAppData, saveAppData } from "../lib/storage";
import {
  Alert,
  AppData,
  Decision,
  DecisionAction,
  Eye,
  Evaluation,
  Outcome,
  Recipe,
  RecipeCondition,
  Stock,
} from "../types";

const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const buildAlertFromEvaluation = (
  eye: Eye,
  evaluation: Evaluation,
  stockSymbol: string,
): Alert => ({
  id: createId("alert"),
  eyeId: eye.id,
  recipeId: evaluation.recipeId,
  recipeVersion: evaluation.recipeVersion,
  title: `${evaluation.currentState} for ${stockSymbol}`,
  stateChange: `${evaluation.previousState} -> ${evaluation.currentState}`,
  whyNow: evaluation.whyNow,
  supportingEvidence: evaluation.supportingEvidence,
  risks: [
    ...evaluation.contradictingEvidence,
    ...(evaluation.riskWarnings ?? []),
    ...(evaluation.hardDisqualifiers ?? []),
  ],
  dataQuality: evaluation.dataQuality,
  evaluationContext: {
    currentState: evaluation.currentState,
    conditionResults: evaluation.conditionResults,
    staleData: evaluation.staleData,
    missingData: evaluation.missingData,
  },
  priority:
    evaluation.currentState === "Attention Needed" || evaluation.currentState === "Thesis Broken"
      ? "High"
      : "Medium",
  createdAt: evaluation.evaluatedAt,
  reviewed: false,
});

const evaluateAllEyes = (data: AppData): AppData => {
  const alerts = [...data.alerts];
  const eyes = data.eyes.map((eye) => {
    const recipe = data.recipes.find((item) => item.id === eye.recipeId);
    const snapshot = data.snapshots.find((item) => item.stockId === eye.stockId);
    const stock = data.stocks.find((item) => item.id === eye.stockId);

    if (!recipe || !snapshot) {
      return eye;
    }

    const evaluation = evaluateEye(eye, recipe, snapshot);
    if (evaluation.alertSuggested) {
      const hasDuplicate = alerts.some(
        (alert) =>
          alert.eyeId === eye.id &&
          alert.stateChange === `${evaluation.previousState} -> ${evaluation.currentState}`,
      );
      if (!hasDuplicate) {
        alerts.unshift(buildAlertFromEvaluation(eye, evaluation, stock?.symbol ?? "Unknown"));
      }
    }

    return {
      ...eye,
      lastEvaluation: evaluation,
    };
  });

  return {
    ...data,
    eyes,
    alerts,
  };
};

export const useAppModel = () => {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAppData()
      .then((loaded) => {
        const evaluated = evaluateAllEyes(loaded);
        setData(evaluated);
        void buildSnapshotsFromAdapters(loaded.stocks).then((snapshots) => {
          const providerEvaluated = evaluateAllEyes({
            ...loaded,
            snapshots,
          });
          setData(providerEvaluated);
          void saveAppData(providerEvaluated);
        });
        return saveAppData(evaluated);
      })
      .finally(() => setLoading(false));
  }, []);

  const commit = async (next: AppData) => {
    const evaluated = evaluateAllEyes(next);
    setData(evaluated);
    await saveAppData(evaluated);
  };

  const actions = useMemo(
    () => ({
      async addStock(input: { symbol: string; name: string; thesis: string }) {
        if (!data) return;
        const stock: Stock = {
          id: createId("stock"),
          symbol: input.symbol.trim().toUpperCase(),
          name: input.name.trim(),
          thesis: input.thesis.trim(),
          createdAt: new Date().toISOString(),
        };
        const snapshot = await buildProviderSnapshot(stock);
        await commit({
          ...data,
          stocks: [stock, ...data.stocks],
          snapshots: [snapshot, ...data.snapshots],
        });
      },
      async addRecipe(input: {
        name: string;
        purpose: string;
        opportunityType: string;
        timeHorizon: string;
        intendedUseCase: string;
        notes: string;
        reviewCadenceDays: number;
        alertCooldownHours: number;
        conditions?: RecipeCondition[];
      }) {
        if (!data) return;
        const recipe: Recipe = {
          id: createId("recipe"),
          version: 1,
          name: input.name.trim(),
          purpose: input.purpose.trim(),
          opportunityType: input.opportunityType.trim(),
          timeHorizon: input.timeHorizon.trim(),
          intendedUseCase: input.intendedUseCase.trim(),
          notes: input.notes.trim(),
          createdAt: new Date().toISOString(),
          reviewConfig: {
            cadenceDays: input.reviewCadenceDays,
            reviewTriggers: ["state_change", "manual_review_due"],
          },
          alertConfig: {
            cooldownHours: input.alertCooldownHours,
            dedupeKey: "state_change",
            priorityOnAttention: "High",
            priorityOnRisk: "High",
          },
          conditions:
            input.conditions && input.conditions.length > 0
              ? input.conditions.map((condition) => ({
                  ...condition,
                  id: condition.id || createId("condition"),
                }))
              : [
                  {
                    id: createId("condition"),
                    label: "User-defined rule set. Expand this recipe in future iterations.",
                    kind: "required",
                  },
                ],
        };
        await commit({
          ...data,
          recipes: [recipe, ...data.recipes],
        });
      },
      async addEye(input: {
        stockId: string;
        recipeId: string;
        thesisSnapshot: string;
        plannedEntryLow?: number;
        plannedEntryHigh?: number;
        invalidationRule?: string;
        lastReviewedAt?: string;
      }) {
        if (!data) return;
        const recipe = data.recipes.find((item) => item.id === input.recipeId);
        const eye: Eye = {
          id: createId("eye"),
          stockId: input.stockId,
          recipeId: input.recipeId,
          thesisSnapshot: input.thesisSnapshot.trim(),
          recipeVersionAtCreation: recipe?.version,
          plannedEntryLow: input.plannedEntryLow,
          plannedEntryHigh: input.plannedEntryHigh,
          invalidationRule: input.invalidationRule?.trim(),
          lastReviewedAt: input.lastReviewedAt,
          createdAt: new Date().toISOString(),
        };
        await commit({
          ...data,
          eyes: [eye, ...data.eyes],
        });
      },
      async logDecision(input: {
        eyeId: string;
        alertId?: string;
        action: DecisionAction;
        note: string;
        concern: string;
        thesisValid: "Yes" | "Partly" | "No";
        timing: "Early" | "On Time" | "Late";
      }) {
        if (!data) return;
        const eye = data.eyes.find((item) => item.id === input.eyeId);
        const decision: Decision = {
          id: createId("decision"),
          ...input,
          recipeId: eye?.recipeId,
          recipeVersion: eye?.lastEvaluation?.recipeVersion ?? eye?.recipeVersionAtCreation,
          stateAtDecision: eye?.lastEvaluation?.currentState,
          conditionResults: eye?.lastEvaluation?.conditionResults,
          dataQuality: eye?.lastEvaluation?.dataQuality,
          createdAt: new Date().toISOString(),
        };
        const outcome: Outcome = {
          id: createId("outcome"),
          decisionId: decision.id,
          recipeId: decision.recipeId,
          recipeVersion: decision.recipeVersion,
          reviewWindow: "30 days",
          priceChangeNote: "Pending later real price review.",
          maxRunupNote: "Pending provider-backed outcome metrics.",
          maxDrawdownNote: "Pending provider-backed outcome metrics.",
          lesson: "Capture whether the thesis held and whether timing discipline improved.",
          recipeSuggestion: "Refine false positives once enough outcomes accumulate.",
          createdAt: new Date().toISOString(),
        };
        await commit({
          ...data,
          decisions: [decision, ...data.decisions],
          outcomes: [outcome, ...data.outcomes],
          alerts: data.alerts.map((alert) =>
            alert.id === input.alertId ? { ...alert, reviewed: true } : alert,
          ),
        });
      },
      async markAlertReviewed(alertId: string) {
        if (!data) return;
        await commit({
          ...data,
          alerts: data.alerts.map((alert) =>
            alert.id === alertId ? { ...alert, reviewed: true } : alert,
          ),
        });
      },
      async markEyesReviewed(input: { stockId: string; recipeId?: string }) {
        if (!data) return;
        const reviewedAt = new Date().toISOString();
        await commit({
          ...data,
          eyes: data.eyes.map((eye) =>
            eye.stockId === input.stockId && (!input.recipeId || eye.recipeId === input.recipeId)
              ? { ...eye, lastReviewedAt: reviewedAt }
              : eye,
          ),
        });
      },
      async refreshMockData() {
        if (!data) return;
        const refreshed = await buildSnapshotsFromAdapters(data.stocks);
        await commit({
          ...data,
          snapshots: refreshed,
        });
      },
      async resetToSeed() {
        await commit(seedData);
      },
    }),
    [data],
  );

  return {
    data,
    loading,
    actions,
  };
};
