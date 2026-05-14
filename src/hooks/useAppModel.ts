import { useEffect, useMemo, useState } from "react";

import { evaluateEye } from "../lib/evaluateEye";
import { buildMockSnapshot } from "../lib/mockSnapshot";
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

const buildAlertFromEvaluation = (eye: Eye, evaluation: Evaluation): Alert => ({
  id: createId("alert"),
  eyeId: eye.id,
  title: `${evaluation.currentState} for ${eye.id.replace("eye-", "").toUpperCase()}`,
  stateChange: `${evaluation.previousState} -> ${evaluation.currentState}`,
  whyNow: evaluation.whyNow,
  supportingEvidence: evaluation.supportingEvidence,
  risks: evaluation.contradictingEvidence,
  dataQuality: evaluation.dataQuality,
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
        alerts.unshift(buildAlertFromEvaluation(eye, evaluation));
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
        const snapshot = buildMockSnapshot(stock);
        await commit({
          ...data,
          stocks: [stock, ...data.stocks],
          snapshots: [snapshot, ...data.snapshots],
        });
      },
      async addRecipe(input: {
        name: string;
        purpose: string;
        timeHorizon: string;
        intendedUseCase: string;
        notes: string;
        conditions?: RecipeCondition[];
      }) {
        if (!data) return;
        const recipe: Recipe = {
          id: createId("recipe"),
          version: 1,
          name: input.name.trim(),
          purpose: input.purpose.trim(),
          timeHorizon: input.timeHorizon.trim(),
          intendedUseCase: input.intendedUseCase.trim(),
          notes: input.notes.trim(),
          createdAt: new Date().toISOString(),
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
      async addEye(input: { stockId: string; recipeId: string; thesisSnapshot: string }) {
        if (!data) return;
        const eye: Eye = {
          id: createId("eye"),
          stockId: input.stockId,
          recipeId: input.recipeId,
          thesisSnapshot: input.thesisSnapshot.trim(),
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
        const decision: Decision = {
          id: createId("decision"),
          ...input,
          createdAt: new Date().toISOString(),
        };
        const outcome: Outcome = {
          id: createId("outcome"),
          decisionId: decision.id,
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
      async refreshMockData() {
        if (!data) return;
        const refreshed = data.stocks.map(buildMockSnapshot);
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
