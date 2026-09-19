import { useEffect, useMemo, useRef, useState } from "react";

import { contentHash } from "../domain/contentHash";
import { normalizeNotificationPreferences } from "../domain/notificationPreferences";
import { validateEntryRange } from "../domain/inputValidation";
import { mergeWatchlist, parseWatchlistCsv } from "../domain/watchlistImport";
import { publishRecipeRevision } from "../domain/recipeRevision";
import { getProviderHealth } from "../lib/providerHealth";
import { seedData } from "../lib/seed";
import { createDemoAppData, createEmptyAppData } from "../data/workspaceDefaults";
import { createWorkspaceApplicationService } from "../application/workspaceApplicationService";
import { unavailableSnapshot, snapshotFromBars } from "../domain/marketSnapshot";
import { normalizeToSchema, write_raw_archive } from "../lib/eodDataProvider";
import { buildSnapshotsFromAdapters } from "../lib/providerSnapshot";
import { createReviewLogEntry } from "../lib/stockConditionScanner";
import {
  AppData,
  Decision,
  DecisionAction,
  Eye,
  LogicRule,
  LogicSet,
  MetricDefinition,
  Outcome,
  ProviderHealthEntry,
  Recipe,
  RecipeCondition,
  Stock,
  NotificationPreferences,
} from "../types";
import { createId } from "../platform/identity";

const buildSnapshotForStock = (stock: Stock, existing?: AppData["snapshots"][number]) => {
  const generated = unavailableSnapshot(stock);
  return {
    ...generated,
    plannedEntryLow: existing?.plannedEntryLow,
    plannedEntryHigh: existing?.plannedEntryHigh,
    lastThesisReviewAt: existing?.lastThesisReviewAt,
    riskFlags: existing?.riskFlags ?? generated.riskFlags,
  };
};

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
      lineageId: condition.lineageId ?? prev.logicRules.find((rule) => rule.id === condition.id)?.lineageId ?? condition.id,
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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const pendingWrites = useRef(0);
  const applicationServiceRef = useRef<ReturnType<typeof createWorkspaceApplicationService> | null>(null);
  if (!applicationServiceRef.current) applicationServiceRef.current = createWorkspaceApplicationService({
    getCurrent: () => dataRef.current,
    publish: next => { dataRef.current = next; setData(next); },
  });
  const applicationService = applicationServiceRef.current!;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    applicationService.load().then(async loaded => {
      if (!active) return;
      dataRef.current = loaded;
      setData(loaded);
      const evaluated = applicationService.evaluate(loaded);
      if (contentHash(evaluated) !== contentHash(loaded)) await commit(current => current);
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not load saved data.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadAttempt]);

  useEffect(() => {
    getProviderHealth()
      .then(setProviderHealth)
      .catch(() => setProviderHealth([]))
      .finally(() => setProviderHealthLoading(false));
  }, []);

  const commit = async (next: AppData | ((current: AppData) => AppData)) => {
    pendingWrites.current += 1;
    setSaving(true);
    setError(null);
    try {
      return await applicationService.commit(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed. Your last saved data is intact.");
      throw cause;
    } finally { pendingWrites.current -= 1; setSaving(pendingWrites.current > 0); }
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
        validateEntryRange(input.plannedEntryLow, input.plannedEntryHigh);
        const normalizedSymbol = input.symbol.trim().toUpperCase();
        if (!/^[A-Z0-9][A-Z0-9.-]{0,15}$/.test(normalizedSymbol)) throw new Error("Enter a valid ticker.");
        await commit((prev) => {
        let stock = prev.stocks.find(s => s.symbol === normalizedSymbol);
        if (!stock) {
          stock = {
            id: createId("stock"),
            symbol: normalizedSymbol,
            name: input.name.trim() || normalizedSymbol,
            thesis: input.thesis.trim(),
            createdAt: new Date().toISOString(),
          };
        }

        const recipe = prev.recipes.find((item) => item.id === input.recipeId && !item.retiredAt);
        if (!recipe) throw new Error("Choose an active recipe.");
        const existing = prev.eyes.find(
          (eye) => eye.stockId === stock!.id && eye.recipeId === input.recipeId,
        );
        const reviewAt = input.lastReviewedAt ?? new Date().toISOString();

          const nextEye: Eye = existing
            ? {
                ...existing,
                archivedAt: undefined,
                thesisSnapshot: input.thesis.trim() || existing.thesisSnapshot,
                recipeVersionAtCreation: existing.recipeVersionAtCreation,
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
        validateEntryRange(input.plannedEntryLow, input.plannedEntryHigh);
        await commit(prev => {
          const eye = prev.eyes.find(item => item.id === eyeId);
          const recipe = prev.recipes.find(item => item.id === input.recipeId && !item.retiredAt);
          if (!eye || !recipe) throw new Error("Select an existing Eye and active recipe.");
          const now = new Date().toISOString();
          const changingRecipe = eye.recipeId !== recipe.id;
          const updated: Eye = { ...eye, ...input, thesisSnapshot: input.thesisSnapshot.trim(),
            id: changingRecipe ? createId("eye") : eye.id,
            createdAt: changingRecipe ? now : eye.createdAt,
            recipeVersionAtCreation: changingRecipe ? recipe.version : eye.recipeVersionAtCreation,
            lastEvaluation: changingRecipe ? undefined : eye.lastEvaluation,
            archivedAt: undefined, lastReviewedAt: input.lastReviewedAt ?? eye.lastReviewedAt ?? now,
          };
          return { ...prev, eyes: changingRecipe
            ? [updated, ...prev.eyes.map(item => item.id === eyeId ? { ...item, archivedAt: now } : item)]
            : prev.eyes.map(item => item.id === eyeId ? updated : item),
          snapshots: prev.snapshots.map(snapshot => snapshot.stockId === eye.stockId ? { ...snapshot, plannedEntryLow: input.plannedEntryLow, plannedEntryHigh: input.plannedEntryHigh, lastThesisReviewAt: updated.lastReviewedAt } : snapshot) };
        });
      },
      async runDailyScanner() {
        if (autoScanStartedRef.current) return;
        autoScanStartedRef.current = true;
        setScanning(true);
        setError(null);
        try {
          await applicationService.runDailyScanner();
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Scan failed. History was preserved.");
        } finally { autoScanStartedRef.current = false; setScanning(false); }
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
        await commit(prev => ({ ...prev, eyes: prev.eyes.map(eye => eye.id === eyeId ? { ...eye, archivedAt: new Date().toISOString() } : eye) }));
      },
      async restoreEye(eyeId: string) {
        await commit(prev => ({ ...prev, eyes: prev.eyes.map(eye => eye.id === eyeId ? { ...eye, archivedAt: undefined } : eye) }));
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
        let nextId = "";
        await commit(prev => {
          const source = prev.recipes.find(recipe => recipe.id === recipeId);
          if (!source) throw new Error("Recipe not found.");
          const revised = publishRecipeRevision(prev.recipes, source, {
            name: input.name.trim(), purpose: input.purpose.trim(), opportunityType: input.opportunityType.trim(),
            timeHorizon: input.timeHorizon.trim(), intendedUseCase: input.intendedUseCase.trim(), notes: input.notes.trim(),
            conditions: input.conditions ?? source.conditions,
            reviewConfig: { cadenceDays: input.reviewCadenceDays, reviewTriggers: source.reviewConfig?.reviewTriggers ?? ["state_change", "manual_review_due"] },
            alertConfig: { cooldownHours: input.alertCooldownHours, dedupeKey: source.alertConfig?.dedupeKey ?? "state_change", priorityOnAttention: source.alertConfig?.priorityOnAttention ?? "High", priorityOnRisk: source.alertConfig?.priorityOnRisk ?? "High" },
          }, createId("recipe"));
          nextId = revised.id;
          return syncLogicModel(prev, [revised, ...prev.recipes]);
        });
        return nextId;
      },
      async addMetric(metric: MetricDefinition) {
        const current = dataRef.current;
        if (!current) return;
        await commit((prev) => {
          const existing = prev.customMetrics.find((item) => item.key === metric.key);
          if (existing && prev.recipes.some(recipe => recipe.conditions.some(condition => condition.metricKey === metric.key))) throw new Error("This metric belongs to published recipes. Duplicate it before changing its definition.");
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
        const id = createId("recipe");
        await commit(prev => {
          const source = prev.recipes.find(recipe => recipe.id === recipeId);
          if (!source) throw new Error("Recipe not found.");
          return syncLogicModel(prev, [publishRecipeRevision(prev.recipes, source, {}, id), ...prev.recipes]);
        });
        return id;
      },
      async restoreRecipeVersion(recipeId: string) {
        const id = createId("recipe");
        await commit(prev => {
          const source = prev.recipes.find(recipe => recipe.id === recipeId);
          if (!source) throw new Error("Recipe not found.");
          return syncLogicModel(prev, [publishRecipeRevision(prev.recipes, source, {}, id), ...prev.recipes]);
        });
        return id;
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
          alertId: input.alertId || undefined,
          evaluationId: eye.lastEvaluation?.id,
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
          reviewWindow: "30 trading sessions",
          status: "Pending",
          priceChangeNote: "",
          maxRunupNote: "",
          maxDrawdownNote: "",
          lesson: "",
          recipeSuggestion: "",
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
                  amendments: [...(decision.amendments ?? []), { amendedAt: new Date().toISOString(), action: decision.action, note: decision.note, concern: decision.concern, thesisValid: decision.thesisValid, timing: decision.timing }],
                  eyeId: decision.eyeId,
                  alertId: decision.alertId,
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
          decisions: prev.decisions.map(decision => decision.id === decisionId ? { ...decision, archivedAt: new Date().toISOString() } : decision),
        }));
      },
      async restoreDecision(decisionId: string) {
        await commit(prev => ({ ...prev, decisions: prev.decisions.map(decision => decision.id === decisionId ? { ...decision, archivedAt: undefined } : decision) }));
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
      async markAlertsReviewed(ids: string[]) {
        const selected = new Set(ids);
        await commit(prev => ({ ...prev, alerts: prev.alerts.map(alert => selected.has(alert.id) ? { ...alert, reviewed: true } : alert) }));
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
      async updateOutcome(outcomeId: string, input: Pick<Outcome, "reviewWindow" | "priceChangeNote" | "maxRunupNote" | "maxDrawdownNote" | "lesson" | "recipeSuggestion">) {
        if (!input.lesson.trim()) throw new Error("Add a lesson before completing the review.");
        await commit(prev => ({ ...prev, outcomes: prev.outcomes.map(outcome => outcome.id === outcomeId ? {
          ...outcome, reviewWindow: input.reviewWindow.trim(), priceChangeNote: input.priceChangeNote.trim(), maxRunupNote: input.maxRunupNote.trim(), maxDrawdownNote: input.maxDrawdownNote.trim(), lesson: input.lesson.trim(), recipeSuggestion: input.recipeSuggestion.trim(), status: "Reviewed",
        } : outcome) }));
      },
      async refreshMarketData() {
        const current = dataRef.current;
        if (!current) return;
        const results = await buildSnapshotsFromAdapters(current.stocks.filter(stock => !stock.archivedAt));
        await commit(prev => ({ ...prev, snapshots: prev.snapshots.map(existing => {
          const result = results.find(item => item.stockId === existing.stockId);
          if (!result?.snapshot) return existing;
          return { ...result.snapshot, plannedEntryLow: existing.plannedEntryLow, plannedEntryHigh: existing.plannedEntryHigh, lastThesisReviewAt: existing.lastThesisReviewAt, riskFlags: existing.riskFlags };
        }) }));
        const failed = results.filter(result => result.error);
        if (failed.length) setError(`${failed.length} symbol(s) could not refresh. Their saved data was preserved.`);
      },
      async evaluateSavedData() { await commit(current => current); },
      async saveStock(input: { id?: string; symbol: string; name: string; thesis: string }) {
        const symbol = input.symbol.trim().toUpperCase();
        if (!/^[A-Z0-9][A-Z0-9.-]{0,15}$/.test(symbol)) throw new Error("Enter a valid US ticker (up to 16 characters).");
        if (!input.name.trim()) throw new Error("Company name is required.");
        let savedId = "";
        await commit(prev => {
          const existing = prev.stocks.find(stock => stock.id === input.id || stock.symbol === symbol);
          if (existing && existing.symbol !== symbol) throw new Error("Create a separate stock to change its ticker; historical identity is retained.");
          const stock: Stock = { ...existing, id: existing?.id ?? createId("stock"), symbol, name: input.name.trim(), thesis: input.thesis.trim(), createdAt: existing?.createdAt ?? new Date().toISOString(), archivedAt: undefined };
          savedId = stock.id;
          return { ...prev, stocks: [stock, ...prev.stocks.filter(item => item.id !== stock.id)], snapshots: prev.snapshots.some(snapshot => snapshot.stockId === stock.id) ? prev.snapshots : [...prev.snapshots, unavailableSnapshot(stock)] };
        });
        return savedId;
      },
      async archiveStock(stockId: string) {
        await commit(prev => ({ ...prev, stocks: prev.stocks.map(stock => stock.id === stockId ? { ...stock, archivedAt: new Date().toISOString() } : stock) }));
      },
      async importWatchlist(csv: string) {
        const rows = parseWatchlistCsv(csv);
        await commit(prev => mergeWatchlist(prev, rows));
      },
      async importPriceCsv(stockId: string, csv: string, adjustment: "adjusted" | "unadjusted" | "unknown", benchmarkCsv = "") {
        await commit(prev => {
          const stock = prev.stocks.find(item => item.id === stockId);
          if (!stock) throw new Error("Select a stock first.");
          const bars = normalizeToSchema(stock.symbol, csv);
          const benchmark = benchmarkCsv.trim() ? normalizeToSchema("SPY", benchmarkCsv) : [];
          const imported = snapshotFromBars(stock, bars, benchmark, { source: "User CSV import", origin: "import", adjustment, datasetId: "pending" });
          const { batch } = write_raw_archive("User CSV import", [{ symbol: stock.symbol, rows: bars }, ...(benchmark.length && stock.symbol !== "SPY" ? [{ symbol: "SPY", rows: benchmark }] : [])], imported.provenance!.observedDate, prev.rawBarArchives, adjustment);
          batch.adjustedStatus = adjustment;
          imported.provenance!.datasetId = batch.id;
          const existing = prev.snapshots.find(item => item.stockId === stock.id);
          return { ...prev, rawBarArchives: [batch, ...prev.rawBarArchives.filter(existing => existing.id !== batch.id)], snapshots: [{ ...imported, plannedEntryLow: existing?.plannedEntryLow, plannedEntryHigh: existing?.plannedEntryHigh, lastThesisReviewAt: existing?.lastThesisReviewAt, riskFlags: existing?.riskFlags ?? [] }, ...prev.snapshots.filter(item => item.stockId !== stockId)] };
        });
      },
      async resetToSeed() {
        if (dataRef.current?.stocks.length || dataRef.current?.decisions.length) throw new Error("Demo data can only be loaded into an empty workspace.");
        await commit(createDemoAppData());
      },
      async addStarterRecipes() {
        await commit(prev => syncLogicModel(prev, [...prev.recipes, ...seedData.recipes.filter(recipe => !prev.recipes.some(existing => existing.id === recipe.id))]));
      },
      async importBackup(raw: string) {
        await applicationService.importBackup(raw);
      },
      async startPersonalWorkspace() {
        if (!dataRef.current?.snapshots.some(snapshot => snapshot.isMock)) throw new Error("This action is only for leaving the sample workspace.");
        await commit(createEmptyAppData());
      },
      async applyCloudData(expectedHash: string, next: AppData) {
        await commit(prev => {
          if (contentHash(prev) !== expectedHash) throw new Error("The workspace changed while syncing. Your edits are saved; retry sync.");
          return next;
        });
      },
      async updateNotificationPreferences(change: Partial<NotificationPreferences>) {
        await commit(prev => ({
          ...prev,
          notificationPreferences: normalizeNotificationPreferences({
            ...prev.notificationPreferences,
            ...change,
            quietHours: { ...prev.notificationPreferences.quietHours, ...(change.quietHours ?? {}) },
            updatedAt: new Date().toISOString(),
          }),
        }));
      },
      exportBackup() {
        return applicationService.exportBackup();
      },
      readRecoveryData() { return applicationService.readRecoveryData(); },
      restorePreviousBackup() { return applicationService.restorePreviousBackup(); },
      retryLoad() { setLoadAttempt(value => value + 1); },
      dismissError() { setError(null); },
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
    error, saving, scanning,
    providerHealth,
    providerHealthLoading,
    actions,
  };
};
