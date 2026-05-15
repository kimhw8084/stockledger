import { useEffect, useMemo, useRef, useState } from "react";

import { evaluateEye } from "../lib/evaluateEye";
import { buildMockSnapshot } from "../lib/mockSnapshot";
import { getProviderHealth } from "../lib/providerHealth";
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
  ProviderHealthEntry,
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

const buildSnapshotForStock = (stock: Stock, existing?: AppData["snapshots"][number]) => {
  const generated = buildMockSnapshot(stock);
  return {
    ...generated,
    plannedEntryLow: existing?.plannedEntryLow,
    plannedEntryHigh: existing?.plannedEntryHigh,
    lastThesisReviewAt: existing?.lastThesisReviewAt,
    riskFlags: existing?.riskFlags ?? generated.riskFlags,
  };
};

export const useAppModel = () => {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [providerHealth, setProviderHealth] = useState<ProviderHealthEntry[]>([]);
  const [providerHealthLoading, setProviderHealthLoading] = useState(true);
  const dataRef = useRef<AppData | null>(null);

  useEffect(() => {
    loadAppData()
      .then((loaded) => {
        const evaluated = evaluateAllEyes(loaded);
        dataRef.current = evaluated;
        setData(evaluated);
        return saveAppData(evaluated);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    getProviderHealth()
      .then(setProviderHealth)
      .catch(() => setProviderHealth([]))
      .finally(() => setProviderHealthLoading(false));
  }, []);

  const commit = async (next: AppData | ((current: AppData) => AppData)) => {
    const current = dataRef.current;
    if (!current && typeof next === "function") return;
    const resolved = typeof next === "function" ? next(current as AppData) : next;
    const evaluated = evaluateAllEyes(resolved);
    dataRef.current = evaluated;
    setData(evaluated);
    await saveAppData(evaluated);
  };

  const actions = useMemo(
    () => ({
      async addStock(input: { symbol: string; name: string; thesis: string }) {
        const current = dataRef.current;
        if (!current) return;
        const normalizedSymbol = input.symbol.trim().toUpperCase();
        const existing = current.stocks.find((stock) => stock.symbol.toUpperCase() === normalizedSymbol);
        if (existing) {
          await commit((prev) => {
            const updatedStock: Stock = {
              ...existing,
              name: input.name.trim() || existing.name,
              thesis: input.thesis.trim() || existing.thesis,
            };
            const existingSnapshot = prev.snapshots.find((snapshot) => snapshot.stockId === existing.id);
            const nextSnapshot = existingSnapshot ?? buildSnapshotForStock(updatedStock);
            return {
              ...prev,
              stocks: [updatedStock, ...prev.stocks.filter((stock) => stock.id !== existing.id)],
              snapshots: [nextSnapshot, ...prev.snapshots.filter((snapshot) => snapshot.stockId !== existing.id)],
            };
          });
          return;
        }

        const stock: Stock = {
          id: createId("stock"),
          symbol: normalizedSymbol,
          name: input.name.trim(),
          thesis: input.thesis.trim(),
          createdAt: new Date().toISOString(),
        };
        const snapshot = buildSnapshotForStock(stock);
        await commit((prev) => ({
          ...prev,
          stocks: [stock, ...prev.stocks],
          snapshots: [snapshot, ...prev.snapshots],
        }));
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
        const current = dataRef.current;
        if (!current) return;
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
        await commit((prev) => ({
          ...prev,
          recipes: [recipe, ...prev.recipes],
        }));
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
        const current = dataRef.current;
        if (!current) return;
        const recipe = current.recipes.find((item) => item.id === input.recipeId);
        const existing = current.eyes.find(
          (eye) => eye.stockId === input.stockId && eye.recipeId === input.recipeId,
        );
        const reviewAt = input.lastReviewedAt ?? new Date().toISOString();

        await commit((prev) => {
          const nextEye: Eye = existing
            ? {
                ...existing,
                thesisSnapshot: input.thesisSnapshot.trim() || existing.thesisSnapshot,
                recipeVersionAtCreation: recipe?.version ?? existing.recipeVersionAtCreation,
                plannedEntryLow: input.plannedEntryLow ?? existing.plannedEntryLow,
                plannedEntryHigh: input.plannedEntryHigh ?? existing.plannedEntryHigh,
                invalidationRule: input.invalidationRule?.trim() || existing.invalidationRule,
                lastReviewedAt: reviewAt,
              }
            : {
                id: createId("eye"),
                stockId: input.stockId,
                recipeId: input.recipeId,
                thesisSnapshot: input.thesisSnapshot.trim(),
                recipeVersionAtCreation: recipe?.version,
                plannedEntryLow: input.plannedEntryLow,
                plannedEntryHigh: input.plannedEntryHigh,
                invalidationRule: input.invalidationRule?.trim(),
                lastReviewedAt: reviewAt,
                createdAt: new Date().toISOString(),
              };

          const nextSnapshots = prev.snapshots.map((snapshot) =>
            snapshot.stockId === input.stockId
              ? {
                  ...snapshot,
                  plannedEntryLow: nextEye.plannedEntryLow ?? snapshot.plannedEntryLow,
                  plannedEntryHigh: nextEye.plannedEntryHigh ?? snapshot.plannedEntryHigh,
                  lastThesisReviewAt: reviewAt,
                }
              : snapshot,
          );

          return {
            ...prev,
            eyes: [nextEye, ...prev.eyes.filter((eye) => eye.id !== nextEye.id)],
            snapshots: nextSnapshots,
          };
        });
      },
      async deleteEye(eyeId: string) {
        const current = dataRef.current;
        if (!current) return;
        const removedDecisionIds = current.decisions
          .filter((decision) => decision.eyeId === eyeId)
          .map((decision) => decision.id);
        await commit((prev) => ({
          ...prev,
          eyes: prev.eyes.filter((eye) => eye.id !== eyeId),
          alerts: prev.alerts.filter((alert) => alert.eyeId !== eyeId),
          decisions: prev.decisions.filter((decision) => decision.eyeId !== eyeId),
          outcomes: prev.outcomes.filter((outcome) => !removedDecisionIds.includes(outcome.decisionId)),
        }));
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
        const current = dataRef.current;
        if (!current) return;
        const eye = current.eyes.find((item) => item.id === input.eyeId);
        if (!eye) return;
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
          status: "Pending",
          priceChangeNote: "Follow up with the next price review.",
          maxRunupNote: "Review run-up after the follow-up window.",
          maxDrawdownNote: "Review drawdown after the follow-up window.",
          lesson: "Review whether the thesis held and whether timing discipline improved.",
          recipeSuggestion: "Adjust the recipe only after enough reviewed outcomes accumulate.",
          createdAt: new Date().toISOString(),
        };
        await commit((prev) => ({
          ...prev,
          decisions: [decision, ...prev.decisions],
          outcomes: [outcome, ...prev.outcomes],
          alerts: prev.alerts.map((alert) =>
            alert.id === input.alertId ? { ...alert, reviewed: true } : alert,
          ),
        }));
        return decision.id;
      },
      async markAlertReviewed(alertId: string) {
        const current = dataRef.current;
        if (!current) return;
        await commit((prev) => ({
          ...prev,
          alerts: prev.alerts.map((alert) =>
            alert.id === alertId ? { ...alert, reviewed: true } : alert,
          ),
        }));
      },
      async snoozeAlert(alertId: string, hours: number) {
        const current = dataRef.current;
        if (!current) return;
        const snoozedUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
        await commit((prev) => ({
          ...prev,
          alerts: prev.alerts.map((alert) =>
            alert.id === alertId ? { ...alert, snoozedUntil } : alert,
          ),
        }));
      },
      async setAlertFeedback(alertId: string, usefulness: "Useful" | "Not Useful") {
        const current = dataRef.current;
        if (!current) return;
        await commit((prev) => ({
          ...prev,
          alerts: prev.alerts.map((alert) =>
            alert.id === alertId ? { ...alert, usefulness } : alert,
          ),
        }));
      },
      async markEyesReviewed(input: { stockId: string; recipeId?: string }) {
        const current = dataRef.current;
        if (!current) return;
        const reviewedAt = new Date().toISOString();
        await commit((prev) => ({
          ...prev,
          eyes: prev.eyes.map((eye) =>
            eye.stockId === input.stockId && (!input.recipeId || eye.recipeId === input.recipeId)
              ? { ...eye, lastReviewedAt: reviewedAt }
              : eye,
          ),
          snapshots: prev.snapshots.map((snapshot) =>
            snapshot.stockId === input.stockId
              ? { ...snapshot, lastThesisReviewAt: reviewedAt }
              : snapshot,
          ),
        }));
      },
      async setOutcomeStatus(outcomeId: string, status: "Pending" | "Reviewed") {
        const current = dataRef.current;
        if (!current) return;
        await commit((prev) => ({
          ...prev,
          outcomes: prev.outcomes.map((outcome) =>
            outcome.id === outcomeId ? { ...outcome, status } : outcome,
          ),
        }));
      },
      async refreshMockData() {
        const current = dataRef.current;
        if (!current) return;
        const refreshed = current.stocks.map((stock) =>
          buildSnapshotForStock(
            stock,
            current.snapshots.find((snapshot) => snapshot.stockId === stock.id),
          ),
        );
        await commit((prev) => ({
          ...prev,
          snapshots: refreshed,
        }));
      },
      async resetToSeed() {
        await commit(JSON.parse(JSON.stringify(seedData)) as AppData);
      },
      async refreshProviderHealth() {
        setProviderHealthLoading(true);
        try {
          const next = await getProviderHealth();
          setProviderHealth(next);
        } catch {
          setProviderHealth([]);
        } finally {
          setProviderHealthLoading(false);
        }
      },
    }),
    [],
  );

  return {
    data,
    loading,
    providerHealth,
    providerHealthLoading,
    actions,
  };
};
