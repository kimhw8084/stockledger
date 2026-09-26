import { afterEach, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkerStore } from "../server/worker/store";
import { runWorker } from "../server/worker/run";
import { seedData } from "../src/lib/seed";
import { previousUsTradingDate } from "../src/lib/marketCalendar";
import { contentHash } from "../src/domain/contentHash";
import { makeWorkerHandoffBatch, makeWorkerHandoffManifest, parseWorkerHandoffManifest, applyWorkerHandoff, eyeOwnerIdentityHash } from "../src/domain/workerHandoff";
import { evaluateWorkspace } from "../src/domain/evaluateWorkspace";
import { evaluateEye } from "../src/lib/evaluateEye";
import { metricCatalog } from "../src/lib/metricCatalog";
import type { AppData, WorkerHandoffEvidence } from "../src/types";

const folders: string[] = [];
const databasePath = () => { const directory = mkdtempSync(join(tmpdir(), "stockledger-handoff-")); folders.push(directory); return join(directory, "worker.sqlite"); };
afterEach(() => { for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true }); });

const fixture = () => {
  const data = structuredClone(seedData) as AppData;
  data.workspaceId = "workspace-handoff-test";
  const eye = data.eyes[0];
  const stock = data.stocks.find(item => item.id === eye.stockId)!;
  const recipe = data.recipes.find(item => item.id === eye.recipeId)!;
  const snapshot = { ...data.snapshots.find(item => item.stockId === stock.id)!, freshness: "Fresh" as const, provenance: {
    schemaVersion: 2 as const, origin: "import" as const, observedDate: "2026-09-24", retrievedAt: "2026-09-24T22:00:00.000Z",
    currency: "USD" as const, adjustment: "adjusted" as const, datasetId: "csv-import-2026-09-24", contentHash: "b".repeat(64),
  } };
  const at = new Date("2026-09-25T01:00:00.000Z");
  const evaluated = evaluateEye(eye, recipe, snapshot, [...metricCatalog, ...data.customMetrics], at);
  const evaluation = { ...evaluated, id: "evaluation-handoff-test", inputHash: "a".repeat(64), alertSuggested: true, alertReason: "Captured worker transition" };
  const alert = {
    id: "alert-handoff-test", evaluationId: evaluation.id, eyeId: eye.id, recipeId: recipe.id, recipeVersion: recipe.version,
    title: "Captured worker review", stateChange: `${evaluation.previousState} -> ${evaluation.currentState}`, whyNow: evaluation.whyNow,
    supportingEvidence: evaluation.supportingEvidence, risks: [...evaluation.contradictingEvidence, ...(evaluation.riskWarnings ?? [])],
    dataQuality: evaluation.dataQuality,
    evaluationContext: { currentState: evaluation.currentState, conditionResults: evaluation.conditionResults, staleData: evaluation.staleData, missingData: evaluation.missingData },
    priority: "High" as const, createdAt: at.toISOString(), reviewed: false,
  };
  const usedMetricKeys = new Set(recipe.conditions.flatMap(condition => condition.metricKey ? [condition.metricKey] : []));
  const evidence: WorkerHandoffEvidence = {
    eye, stock, recipe, customMetrics: data.customMetrics.filter(metric => usedMetricKeys.has(metric.key)), evaluation, snapshot, alert,
    ...(eye.lastEvaluation?.id ? { expectedPreviousEvaluationId: eye.lastEvaluation.id } : {}),
    eyeIdentityHash: eyeOwnerIdentityHash(eye), recipeHash: contentHash(recipe), snapshotHash: contentHash(snapshot),
  };
  const batch = makeWorkerHandoffBatch({ workspaceId: data.workspaceId, sequence: 1, createdAt: at.toISOString(), workerRevision: 2, sourceJobId: "evaluation-scan-test", evidence: [evidence] });
  const manifest = makeWorkerHandoffManifest({
    workspaceId: data.workspaceId, generatedAt: at.toISOString(), workerRevision: 2, latestSequence: 1, coverage: "complete",
    scheduler: { state: "healthy", lastInvocationAtUtc: at.toISOString(), lastSuccessfulRunAtUtc: at.toISOString(), latestExpectedCompletedSession: "2026-09-24", latestSuccessfulSession: "2026-09-24", missedSessions: [], partialSessions: [], schedulerInstalled: false },
    batches: [batch],
  });
  return { data, evidence, batch, manifest };
};

it("preserves captured recipe, source, provenance, condition and alert identity through apply and replay", () => {
  const { data, evidence, manifest } = fixture();
  const validated = parseWorkerHandoffManifest(JSON.stringify(manifest));
  const result = applyWorkerHandoff(data, validated, new Date("2026-09-25T02:00:00.000Z"));
  expect(result.status).toBe("applied");
  expect(result.data.eyes.find(eye => eye.id === evidence.eye.id)?.lastEvaluation).toEqual(evidence.evaluation);
  expect(result.data.alerts.find(alert => alert.id === evidence.alert?.id)).toEqual(evidence.alert);
  expect(result.data.workerAppHandoff?.evidence[0].evidence.recipe).toEqual(evidence.recipe);
  expect(result.data.workerAppHandoff?.evidence[0].evidence.snapshot).toEqual(evidence.snapshot);
  expect(result.data.workerAppHandoff?.evidence[0].evidence.snapshot.provenance?.adjustment).toBe("adjusted");
  expect(result.data.workerAppHandoff?.evidence[0].evidence.evaluation.conditionResults).toEqual(evidence.evaluation.conditionResults);
  expect(result.data.evaluations).toContainEqual(evidence.evaluation);

  const replay = applyWorkerHandoff(result.data, validated, new Date("2026-09-25T02:01:00.000Z"));
  expect(replay.appliedBatchIds).toEqual([]);
  expect(replay.data.evaluations?.filter(item => item.id === evidence.evaluation.id)).toHaveLength(1);
  expect(replay.data.alerts.filter(item => item.id === evidence.alert?.id)).toHaveLength(1);
  expect(replay.data.workerAppHandoff?.evidence).toHaveLength(1);
});

it("preserves newer owner decisions, amendments, outcomes, notes and alert review state", () => {
  const { data, evidence, manifest } = fixture();
  const decision = {
    id: "decision-owner-newer", eyeId: evidence.eye.id, action: "Entered" as const,
    note: "Owner-authored after worker run", concern: "Price gap", thesisValid: "Partly" as const, timing: "On Time" as const,
    createdAt: "2026-09-25T01:30:00.000Z", amendments: [{ amendedAt: "2026-09-25T01:40:00.000Z", action: "Revised" as const, note: "Amended after review", concern: "None", thesisValid: "Yes" as const, timing: "On Time" as const }],
  };
  const ownerAlert = { ...evidence.alert!, reviewed: true, usefulness: "Useful" as const, snoozedUntil: "2026-09-27T00:00:00.000Z" };
  const before = { ...data, decisions: [decision], outcomes: [{ id: "outcome-owner-newer", decisionId: decision.id, reviewWindow: "30d", priceChangeNote: "", maxRunupNote: "", maxDrawdownNote: "", lesson: "Keep the dated source", recipeSuggestion: "", createdAt: decision.createdAt }], reviewLogs: [{ id: "review-owner-note", signalId: "signal-existing", reviewedAt: decision.createdAt, userDecision: "watch" as const, manualReason: "Owner note survives" }], alerts: [ownerAlert] };
  const result = applyWorkerHandoff(before, manifest, new Date("2026-09-25T02:00:00.000Z"));
  expect(result.status).toBe("applied");
  expect(result.data.decisions).toEqual([decision]);
  expect(result.data.outcomes).toEqual(before.outcomes);
  expect(result.data.reviewLogs).toEqual(before.reviewLogs);
  expect(result.data.alerts[0]).toEqual(ownerAlert);
});

it("surfaces an explicit conflict when owner-authored Eye state overlaps the worker update", () => {
  const { data, evidence, manifest } = fixture();
  const changed = { ...data, eyes: data.eyes.map(eye => eye.id === evidence.eye.id ? { ...eye, thesisSnapshot: "A newer owner thesis" } : eye) };
  const result = applyWorkerHandoff(changed, manifest, new Date("2026-09-25T02:00:00.000Z"));
  expect(result.status).toBe("conflict");
  expect(result.errorCode).toBe("owner_state_changed");
  expect(result.data.eyes.find(eye => eye.id === evidence.eye.id)?.thesisSnapshot).toBe("A newer owner thesis");
  expect(result.data.evaluations?.some(item => item.id === evidence.evaluation.id) ?? false).toBe(false);
});

it("keeps the captured worker evaluation stable across app saves and conflicts after an Eye edit", () => {
  const { data, evidence, manifest } = fixture();
  const first = applyWorkerHandoff(data, manifest, new Date("2026-09-25T02:00:00.000Z"));
  const decision = { id: "decision-between-worker-runs", eyeId: evidence.eye.id, action: "Entered" as const, note: "Owner note", concern: "None", thesisValid: "Yes" as const, timing: "On Time" as const, createdAt: "2026-09-25T02:10:00.000Z" };
  const appSaved = evaluateWorkspace({ ...first.data, decisions: [decision] }, new Date("2026-09-25T02:11:00.000Z"));
  expect(appSaved.eyes.find(eye => eye.id === evidence.eye.id)?.lastEvaluation).toEqual(evidence.evaluation);
  expect(appSaved.decisions).toEqual([decision]);

  const nextEvaluation = { ...evidence.evaluation, id: "evaluation-handoff-next", inputHash: "d".repeat(64), evaluatedAt: "2026-09-25T03:00:00.000Z" };
  const nextSnapshot = { ...evidence.snapshot, updatedAt: nextEvaluation.evaluatedAt };
  const nextEvidence: WorkerHandoffEvidence = {
    ...evidence, eye: { ...evidence.eye, lastEvaluation: evidence.evaluation }, evaluation: nextEvaluation, snapshot: nextSnapshot,
    alert: evidence.alert ? { ...evidence.alert, id: "alert-handoff-next", evaluationId: nextEvaluation.id, createdAt: nextEvaluation.evaluatedAt } : undefined,
    expectedPreviousEvaluationId: evidence.evaluation.id, snapshotHash: contentHash(nextSnapshot),
  };
  const nextBatch = makeWorkerHandoffBatch({ workspaceId: data.workspaceId!, sequence: 2, createdAt: nextEvaluation.evaluatedAt, workerRevision: 3, sourceJobId: "evaluation-scan-next", evidence: [nextEvidence] });
  const nextManifest = makeWorkerHandoffManifest({ workspaceId: data.workspaceId!, generatedAt: nextEvaluation.evaluatedAt, workerRevision: 3, latestSequence: 2, coverage: "complete", scheduler: { ...manifest.scheduler, lastInvocationAtUtc: nextEvaluation.evaluatedAt, lastSuccessfulRunAtUtc: nextEvaluation.evaluatedAt }, batches: [nextBatch] });
  const second = applyWorkerHandoff(appSaved, nextManifest, new Date("2026-09-25T03:01:00.000Z"));
  expect(second.status).toBe("applied");
  expect(second.data.decisions).toEqual([decision]);
  expect(second.data.eyes.find(eye => eye.id === evidence.eye.id)?.lastEvaluation).toEqual(nextEvaluation);

  const edited = evaluateWorkspace({ ...appSaved, eyes: appSaved.eyes.map(eye => eye.id === evidence.eye.id ? { ...eye, thesisSnapshot: "Owner changed the thesis" } : eye) }, new Date("2026-09-25T02:20:00.000Z"));
  expect(edited.eyes.find(eye => eye.id === evidence.eye.id)?.lastEvaluation?.id).not.toBe(evidence.evaluation.id);
  const conflict = applyWorkerHandoff(edited, nextManifest, new Date("2026-09-25T03:01:00.000Z"));
  expect(conflict.status).toBe("conflict");
  expect(conflict.errorCode).toBe("owner_state_changed");
  expect(conflict.data.decisions).toEqual([decision]);
});

it("rejects malformed and interrupted handoff bytes without mutating the app input", () => {
  const { data, manifest } = fixture();
  const broken = JSON.stringify({ ...manifest, checksum: "0".repeat(64) });
  expect(() => parseWorkerHandoffManifest(broken)).toThrow(/checksum/);
  expect(() => parseWorkerHandoffManifest("{interrupted" )).toThrow();
  expect(data.workerAppHandoff).toBeUndefined();
  expect(data.evaluations).toEqual(seedData.evaluations);
});

it("creates a durable worker batch once and clears it only after a matching receipt", async () => {
  const store = new WorkerStore(databasePath());
  const data = structuredClone(seedData) as AppData;
  const targetEye = data.eyes[0];
  const targetStock = data.stocks.find(stock => stock.id === targetEye.stockId)!;
  const targetRecipe = data.recipes.find(recipe => recipe.id === targetEye.recipeId)!;
  data.stocks = [targetStock];
  data.eyes = [targetEye];
  data.recipes = [targetRecipe];
  data.snapshots = data.snapshots.filter(snapshot => snapshot.stockId === targetStock.id);
  data.alerts = [];
  data.decisions = [];
  data.outcomes = [];
  data.evaluations = [];
  data.scannerSettings = { ...data.scannerSettings, universeMode: "frozen_research_universe", frozenUniverseBySector: { XLK: [data.stocks[0].symbol] } };
  store.import(data, 0);
  const dates = ["2026-09-14"];
  while (dates.length < 260) dates.unshift(previousUsTradingDate(dates[0]));
  const histories = [...new Set([data.stocks[0].symbol, "SPY", "XLK"])].map(symbol => ({ symbol, rows: dates.map((date, index) => ({ symbol, date, open: 100 + index, close: 100 + index, high: 101 + index, low: 99 + index, volume: 1000 })) }));
  const options = { source: "handoff test CSV", adjustment: "adjusted" as const, now: new Date("2026-09-14T22:00:00.000Z") };
  await runWorker(store, histories, options);
  const workspaceId = store.load()!.data.workspaceId!;
  const first = store.workerHandoffBatches(workspaceId);
  expect(first.length).toBeGreaterThan(0);
  expect(first.flatMap(batch => batch.evidence).some(item => item.snapshot.sourceName === "handoff test CSV" && item.snapshot.provenance?.origin === "import")).toBe(true);
  expect(first[0].evidence[0].recipe.version).toBe(first[0].evidence[0].evaluation.recipeVersion);
  expect((await runWorker(store, histories, options)).status).toBe("already_claimed_or_completed");
  expect(store.workerHandoffBatches(workspaceId).map(batch => batch.batchId)).toEqual(first.map(batch => batch.batchId));
  store.acknowledgeWorkerHandoff({ workspaceId, sequence: first.at(-1)!.sequence, batchId: first.at(-1)!.batchId });
  store.acknowledgeWorkerHandoff({ workspaceId, sequence: first.at(-1)!.sequence, batchId: first.at(-1)!.batchId });
  expect(store.workerHandoffBatches(workspaceId)).toEqual([]);
  store.close();
});
