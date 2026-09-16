import { useEffect, useMemo, useRef, useState } from "react";

import { evaluateEye } from "../lib/evaluateEye";
import { buildMockSnapshot } from "../lib/mockSnapshot";
import { getProviderHealth } from "../lib/providerHealth";
import { seedData } from "../lib/seed";
import { loadAppData, saveAppData } from "../lib/storage";
import { latestCompletedTradingDate, shouldRunAfterClose } from "../lib/marketCalendar";
import { createReviewLogEntry, runDailyStockConditionScan } from "../lib/stockConditionScanner";
import {
  Alert,
  AppData,
  Decision,
  DecisionAction,
  Eye,
  Evaluation,
  LogicRule,
  LogicSet,
  MetricDefinition,
  Outcome,
  ProviderHealthEntry,
  Recipe,
  RecipeCondition,
  Stock,
} from "../types";
import { metricCatalog } from "../lib/metricCatalog";

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
  const allMetrics = [...metricCatalog, ...(data.customMetrics ?? [])];
  const eyes = data.eyes.map((eye) => {
    const recipe = data.recipes.find((item) => item.id === eye.recipeId);
    const snapshot = data.snapshots.find((item) => item.stockId === eye.stockId);
    const stock = data.stocks.find((item) => item.id === eye.stockId);

    if (!recipe || !snapshot) {
      return eye;
    }

    const evaluation = evaluateEye(eye, recipe, snapshot, allMetrics);
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

const materializeRecipeFromLogicSet = (
  logicSet: LogicSet,
  logicRules: LogicRule[],
): Recipe => ({
  id: logicSet.id,
  lineageId: logicSet.lineageId ?? logicSet.id,
  version: logicSet.version,
  name: logicSet.name,
  purpose: logicSet.purpose,
  opportunityType: logicSet.opportunityType,
  timeHorizon: logicSet.timeHorizon,
  intendedUseCase: logicSet.intendedUseCase,
  notes: logicSet.notes,
  createdAt: logicSet.createdAt,
  retiredAt: logicSet.retiredAt,
  reviewConfig: logicSet.reviewConfig,
  alertConfig: logicSet.alertConfig,
  outcomeConfig: logicSet.outcomeConfig,
  conditions: logicRules
    .filter((rule) => rule.setId === logicSet.id)
    .map((rule) => ({
      id: rule.id,
      label: rule.label,
      kind: rule.kind,
      role: rule.role,
      metricKey: rule.metricKey,
      formulaKey: rule.formulaKey,
      operator: rule.operator,
      value: rule.value,
      unit: rule.unit,
      humanDescription: rule.humanDescription,
      notes: rule.notes,
      availability: rule.availability,
    })),
});

const syncLogicModel = (prev: AppData, nextRecipes: Recipe[]) => {
  const nextLogicSets: LogicSet[] = nextRecipes.map((recipe) => ({
    id: recipe.id,
    lineageId: recipe.lineageId ?? recipe.id,
    version: recipe.version,
    name: recipe.name,
    purpose: recipe.purpose,
    opportunityType: recipe.opportunityType,
    timeHorizon: recipe.timeHorizon,
    intendedUseCase: recipe.intendedUseCase,
    notes: recipe.notes,
    createdAt: recipe.createdAt,
    retiredAt: recipe.retiredAt,
    reviewConfig: recipe.reviewConfig,
    alertConfig: recipe.alertConfig,
    outcomeConfig: recipe.outcomeConfig,
  }));
  const nextLogicRules: LogicRule[] = nextRecipes.flatMap((recipe) =>
    recipe.conditions.map((condition) => ({
      id: condition.id,
      lineageId: prev.logicRules.find((rule) => rule.id === condition.id)?.lineageId ?? condition.id,
      setId: recipe.id,
      setVersion: recipe.version,
      label: condition.label,
      kind: condition.kind,
      role: condition.role,
      metricKey: condition.metricKey,
      formulaKey: condition.formulaKey,
      operator: condition.operator,
      value: condition.value,
      unit: condition.unit,
      humanDescription: condition.humanDescription,
      notes: condition.notes,
      availability: condition.availability,
      createdAt: prev.logicRules.find((rule) => rule.id === condition.id)?.createdAt ?? recipe.createdAt,
      updatedAt: new Date().toISOString(),
    })),
  );
  return {
    ...prev,
    recipes: nextRecipes,
    logicSets: nextLogicSets,
    logicRules: nextLogicRules,
  };
};

export const useAppModel = () => {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [providerHealth, setProviderHealth] = useState<ProviderHealthEntry[]>([]);
  const [providerHealthLoading, setProviderHealthLoading] = useState(true);
  const dataRef = useRef<AppData | null>(null);
  const autoScanStartedRef = useRef(false);

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

  useEffect(() => {
    const current = dataRef.current;
    if (!current || autoScanStartedRef.current) return;
    if (!shouldRunAfterClose(new Date(), current.scannerSettings.providerDelayMinutesAfterClose)) return;
    const latestCompleted = latestCompletedTradingDate(
      new Date(),
      current.scannerSettings.providerDelayMinutesAfterClose,
    );
    const lastRun = current.scanRuns[0]?.scanDate;
    if (lastRun === latestCompleted) return;
    autoScanStartedRef.current = true;
    runDailyStockConditionScan({
      existingBatches: current.rawBarArchives,
      existingSignals: current.scanSignals,
      existingForwardProof: current.forwardProofLedger,
      scannerSettings: current.scannerSettings,
      previousUniverseSnapshot: current.universeSnapshots[0],
    })
      .then(async (result) => {
        await commit((prev) => ({
          ...prev,
          rawBarArchives: result.rawArchiveBatch
            ? [result.rawArchiveBatch, ...prev.rawBarArchives.filter((entry) => entry.id !== result.rawArchiveBatch!.id)]
            : prev.rawBarArchives,
          universeSnapshots: [
            result.universeSnapshot,
            ...prev.universeSnapshots.filter((entry) => entry.id !== result.universeSnapshot.id),
          ],
          processedFeatures: [
            ...result.processedFeatures,
            ...prev.processedFeatures.filter(
              (entry) => !result.processedFeatures.some((next) => next.id === entry.id),
            ),
          ],
          scanRuns: [result.scanRun, ...prev.scanRuns.filter((entry) => entry.id !== result.scanRun.id)],
          scanSignals: result.scanSignals,
          forwardProofLedger: result.forwardProofLedger,
        }));
      })
      .finally(() => {
        autoScanStartedRef.current = false;
      });
  }, [loading]);

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
      async addEye(input: {
        symbol: string;
        name: string;
        thesis: string;
        recipeId: string;
        plannedEntryLow?: number;
        plannedEntryHigh?: number;
        invalidationRule?: string;
        lastReviewedAt?: string;
      }) {
        const current = dataRef.current;
        if (!current) return;
        const normalizedSymbol = input.symbol.trim().toUpperCase();
        
        let stock = current.stocks.find(s => s.symbol === normalizedSymbol);
        if (!stock) {
          stock = {
            id: createId("stock"),
            symbol: normalizedSymbol,
            name: input.name.trim() || normalizedSymbol,
            thesis: input.thesis.trim(),
            createdAt: new Date().toISOString(),
          };
        }

        const recipe = current.recipes.find((item) => item.id === input.recipeId);
        const existing = current.eyes.find(
          (eye) => eye.stockId === stock!.id && eye.recipeId === input.recipeId,
        );
        const reviewAt = input.lastReviewedAt ?? new Date().toISOString();

        await commit((prev) => {
          const nextEye: Eye = existing
            ? {
                ...existing,
                thesisSnapshot: input.thesis.trim() || existing.thesisSnapshot,
                recipeVersionAtCreation: recipe?.version ?? existing.recipeVersionAtCreation,
                plannedEntryLow: input.plannedEntryLow ?? existing.plannedEntryLow,
                plannedEntryHigh: input.plannedEntryHigh ?? existing.plannedEntryHigh,
                invalidationRule: input.invalidationRule?.trim() || existing.invalidationRule,
                lastReviewedAt: reviewAt,
              }
            : {
                id: createId("eye"),
                stockId: stock!.id,
                recipeId: input.recipeId,
                thesisSnapshot: input.thesis.trim(),
                recipeVersionAtCreation: recipe?.version,
                plannedEntryLow: input.plannedEntryLow,
                plannedEntryHigh: input.plannedEntryHigh,
                invalidationRule: input.invalidationRule?.trim(),
                lastReviewedAt: reviewAt,
                createdAt: new Date().toISOString(),
              };

          const existingSnapshot = prev.snapshots.find(s => s.stockId === stock!.id);
          const nextSnapshot = existingSnapshot 
            ? {
                ...existingSnapshot,
                plannedEntryLow: nextEye.plannedEntryLow ?? existingSnapshot.plannedEntryLow,
                plannedEntryHigh: nextEye.plannedEntryHigh ?? existingSnapshot.plannedEntryHigh,
                lastThesisReviewAt: reviewAt,
              }
            : buildSnapshotForStock(stock!, { 
                plannedEntryLow: nextEye.plannedEntryLow, 
                plannedEntryHigh: nextEye.plannedEntryHigh, 
                lastThesisReviewAt: reviewAt 
              } as any);

          return {
            ...prev,
            stocks: stock!.id.startsWith("stock-") && !prev.stocks.some(s => s.id === stock!.id) 
              ? [stock!, ...prev.stocks] 
              : prev.stocks,
            eyes: [nextEye, ...prev.eyes.filter((eye) => eye.id !== nextEye.id)],
            snapshots: [nextSnapshot, ...prev.snapshots.filter(s => s.stockId !== stock!.id)],
          };
        });
      },
      async updateEye(
        eyeId: string,
        input: {
          recipeId: string;
          thesisSnapshot: string;
          plannedEntryLow?: number;
          plannedEntryHigh?: number;
          invalidationRule?: string;
          lastReviewedAt?: string;
        },
      ) {
        const current = dataRef.current;
        if (!current) return;
        const eye = current.eyes.find((item) => item.id === eyeId);
        if (!eye) return;
        const recipe = current.recipes.find((item) => item.id === input.recipeId);
        const reviewAt = input.lastReviewedAt ?? eye.lastReviewedAt ?? new Date().toISOString();
        await commit((prev) => ({
          ...prev,
          eyes: prev.eyes.map((item) =>
            item.id === eyeId
              ? {
                  ...item,
                  recipeId: input.recipeId,
                  thesisSnapshot: input.thesisSnapshot.trim(),
                  recipeVersionAtCreation: recipe?.version ?? item.recipeVersionAtCreation,
                  plannedEntryLow: input.plannedEntryLow,
                  plannedEntryHigh: input.plannedEntryHigh,
                  invalidationRule: input.invalidationRule?.trim(),
                  lastReviewedAt: reviewAt,
                }
              : item,
          ),
          snapshots: prev.snapshots.map((snapshot) =>
            snapshot.stockId === eye.stockId
              ? {
                  ...snapshot,
                  plannedEntryLow: input.plannedEntryLow ?? snapshot.plannedEntryLow,
                  plannedEntryHigh: input.plannedEntryHigh ?? snapshot.plannedEntryHigh,
                  lastThesisReviewAt: reviewAt,
                }
              : snapshot,
          ),
        }));
      },
      async runDailyScanner() {
        const current = dataRef.current;
        if (!current) return;
        const result = await runDailyStockConditionScan({
          existingBatches: current.rawBarArchives,
          existingSignals: current.scanSignals,
          existingForwardProof: current.forwardProofLedger,
          scannerSettings: current.scannerSettings,
          previousUniverseSnapshot: current.universeSnapshots[0],
        });
        await commit((prev) => ({
          ...prev,
          rawBarArchives: result.rawArchiveBatch
            ? [result.rawArchiveBatch, ...prev.rawBarArchives.filter((entry) => entry.id !== result.rawArchiveBatch!.id)]
            : prev.rawBarArchives,
          universeSnapshots: [
            result.universeSnapshot,
            ...prev.universeSnapshots.filter((entry) => entry.id !== result.universeSnapshot.id),
          ],
          processedFeatures: [
            ...result.processedFeatures,
            ...prev.processedFeatures.filter(
              (entry) => !result.processedFeatures.some((next) => next.id === entry.id),
            ),
          ],
          scanRuns: [result.scanRun, ...prev.scanRuns.filter((entry) => entry.id !== result.scanRun.id)],
          scanSignals: result.scanSignals,
          forwardProofLedger: result.forwardProofLedger,
        }));
      },
      async addSignalReviewLog(input: {
        signalId: string;
        userDecision: "watch" | "ignore" | "bought" | "skipped" | "sold" | "other";
        manualReason: string;
        convictionScoreOptional?: number;
        notes?: string;
        entryPriceOptional?: number;
        exitPriceOptional?: number;
        resultNotes?: string;
      }) {
        const current = dataRef.current;
        if (!current) return;
        const reviewLog = createReviewLogEntry({
          signalId: input.signalId,
          reviewedAt: new Date().toISOString(),
          userDecision: input.userDecision,
          manualReason: input.manualReason,
          convictionScoreOptional: input.convictionScoreOptional,
          notes: input.notes,
          entryPriceOptional: input.entryPriceOptional,
          exitPriceOptional: input.exitPriceOptional,
          resultNotes: input.resultNotes,
        });
        await commit((prev) => ({
          ...prev,
          reviewLogs: [reviewLog, ...prev.reviewLogs.filter((entry) => entry.id !== reviewLog.id)],
        }));
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
        const recipeId = createId("recipe");
        const recipe: Recipe = {
          id: recipeId,
          lineageId: recipeId,
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
                    label: "User-defined rule.",
                    kind: "required",
                  },
                ],
        };
        await commit((prev) => syncLogicModel(prev, [recipe, ...prev.recipes]));
      },
      async updateRecipe(
        recipeId: string,
        input: {
          name: string;
          purpose: string;
          opportunityType: string;
          timeHorizon: string;
          intendedUseCase: string;
          notes: string;
          reviewCadenceDays: number;
          alertCooldownHours: number;
          conditions?: RecipeCondition[];
        },
      ) {
        const current = dataRef.current;
        if (!current) return;
        await commit((prev) =>
          syncLogicModel(
            prev,
            prev.recipes.map((recipe) =>
              recipe.id === recipeId
                ? {
                    ...recipe,
                    name: input.name.trim(),
                    purpose: input.purpose.trim(),
                    opportunityType: input.opportunityType.trim(),
                    timeHorizon: input.timeHorizon.trim(),
                    intendedUseCase: input.intendedUseCase.trim(),
                    notes: input.notes.trim(),
                    reviewConfig: {
                      cadenceDays: input.reviewCadenceDays,
                      reviewTriggers: recipe.reviewConfig?.reviewTriggers ?? ["state_change", "manual_review_due"],
                    },
                    alertConfig: {
                      cooldownHours: input.alertCooldownHours,
                      dedupeKey: recipe.alertConfig?.dedupeKey ?? "state_change",
                      priorityOnAttention: recipe.alertConfig?.priorityOnAttention ?? "High",
                      priorityOnRisk: recipe.alertConfig?.priorityOnRisk ?? "High",
                    },
                    conditions:
                      input.conditions && input.conditions.length > 0
                        ? input.conditions.map((condition) => ({
                            ...condition,
                            id: condition.id || createId("condition"),
                          }))
                        : recipe.conditions,
                  }
                : recipe,
            ),
          ),
        );
      },
      async addMetric(metric: MetricDefinition) {
        const current = dataRef.current;
        if (!current) return;
        await commit((prev) => {
          const existing = prev.customMetrics.find((item) => item.key === metric.key);
          const nextMetric: MetricDefinition = {
            ...metric,
            origin: "custom",
            createdAt: metric.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
          };
          return {
            ...prev,
            customMetrics: existing
              ? [nextMetric, ...prev.customMetrics.filter((item) => item.key !== metric.key)]
              : [nextMetric, ...prev.customMetrics],
          };
        });
      },
      async deleteMetric(metricKey: string) {
        const current = dataRef.current;
        if (!current) return false;
        const inUse = current.recipes.some((recipe) =>
          recipe.conditions.some((condition) => condition.metricKey === metricKey),
        );
        if (inUse) return false;
        await commit((prev) => ({
          ...prev,
          customMetrics: prev.customMetrics.filter((metric) => metric.key !== metricKey),
        }));
        return true;
      },
      async duplicateRecipe(recipeId: string, nextName?: string) {
        const current = dataRef.current;
        if (!current) return;
        const source = current.recipes.find((recipe) => recipe.id === recipeId);
        if (!source) return;
        const nextId = createId("recipe");
        const duplicated: Recipe = {
          ...source,
          id: nextId,
          lineageId: nextId,
          version: 1,
          name: nextName?.trim() || `${source.name} Copy`,
          retiredAt: undefined,
          createdAt: new Date().toISOString(),
          conditions: source.conditions.map((condition) => ({
            ...condition,
            id: createId("condition"),
          })),
        };
        await commit((prev) => syncLogicModel(prev, [duplicated, ...prev.recipes]));
        return duplicated.id;
      },
      async createRecipeVersion(recipeId: string) {
        const current = dataRef.current;
        if (!current) return;
        const source = current.recipes.find((recipe) => recipe.id === recipeId);
        if (!source) return;
        const lineageId = source.lineageId ?? source.id;
        const nextVersion =
          Math.max(
            ...current.recipes
              .filter((recipe) => (recipe.lineageId ?? recipe.id) === lineageId)
              .map((recipe) => recipe.version),
          ) + 1;
        const nextId = createId("recipe");
        const versioned: Recipe = {
          ...source,
          id: nextId,
          lineageId,
          version: nextVersion,
          retiredAt: undefined,
          createdAt: new Date().toISOString(),
          conditions: source.conditions.map((condition) => ({
            ...condition,
            id: createId("condition"),
          })),
        };
        await commit((prev) => syncLogicModel(prev, [versioned, ...prev.recipes]));
        return versioned.id;
      },
      async restoreRecipeVersion(recipeId: string) {
        const current = dataRef.current;
        if (!current) return;
        const source = current.recipes.find((recipe) => recipe.id === recipeId);
        if (!source) return;
        const lineageId = source.lineageId ?? source.id;
        const nextVersion =
          Math.max(
            ...current.recipes
              .filter((recipe) => (recipe.lineageId ?? recipe.id) === lineageId)
              .map((recipe) => recipe.version),
          ) + 1;
        const nextId = createId("recipe");
        const restored: Recipe = {
          ...source,
          id: nextId,
          lineageId,
          version: nextVersion,
          retiredAt: undefined,
          createdAt: new Date().toISOString(),
          conditions: source.conditions.map((condition) => ({
            ...condition,
            id: createId("condition"),
          })),
        };
        await commit((prev) => syncLogicModel(prev, [restored, ...prev.recipes]));
        return restored.id;
      },
      async deleteRecipe(recipeId: string) {
        const current = dataRef.current;
        if (!current) return false;
        const linkedEyeIds = current.eyes.filter((eye) => eye.recipeId === recipeId).map((eye) => eye.id);
        const hasLinkedHistory =
          linkedEyeIds.length > 0 ||
          current.decisions.some((decision) => decision.recipeId === recipeId || linkedEyeIds.includes(decision.eyeId));
        if (hasLinkedHistory) return false;
        await commit((prev) =>
          syncLogicModel(
            prev,
            prev.recipes.filter((recipe) => recipe.id !== recipeId),
          ),
        );
        return true;
      },
      async retireRecipe(recipeId: string) {
        const current = dataRef.current;
        if (!current) return;
        await commit((prev) =>
          syncLogicModel(
            prev,
            prev.recipes.map((recipe) =>
              recipe.id === recipeId
                ? {
                    ...recipe,
                    retiredAt: recipe.retiredAt ?? new Date().toISOString(),
                  }
                : recipe,
            ),
          ),
        );
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
          reviewWindow: "30일",
          status: "Pending",
          priceChangeNote: "TBD",
          maxRunupNote: "TBD",
          maxDrawdownNote: "TBD",
          lesson: "Review thesis maintainability.",
          recipeSuggestion: "Accumulate more outcomes before evolving logic.",
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
      async updateDecision(
        decisionId: string,
        input: {
          eyeId: string;
          alertId?: string;
          action: DecisionAction;
          note: string;
          concern: string;
          thesisValid: "Yes" | "Partly" | "No";
          timing: "Early" | "On Time" | "Late";
        },
      ) {
        const current = dataRef.current;
        if (!current) return;
        const eye = current.eyes.find((item) => item.id === input.eyeId);
        if (!eye) return;
        await commit((prev) => ({
          ...prev,
          decisions: prev.decisions.map((decision) =>
            decision.id === decisionId
              ? {
                  ...decision,
                  ...input,
                  recipeId: eye.recipeId,
                  recipeVersion: eye.lastEvaluation?.recipeVersion ?? eye.recipeVersionAtCreation,
                  stateAtDecision: eye.lastEvaluation?.currentState,
                  conditionResults: eye.lastEvaluation?.conditionResults,
                  dataQuality: eye.lastEvaluation?.dataQuality,
                }
              : decision,
          ),
        }));
      },
      async deleteDecision(decisionId: string) {
        const current = dataRef.current;
        if (!current) return;
        await commit((prev) => ({
          ...prev,
          decisions: prev.decisions.filter((decision) => decision.id !== decisionId),
          outcomes: prev.outcomes.filter((outcome) => outcome.decisionId !== decisionId),
        }));
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
