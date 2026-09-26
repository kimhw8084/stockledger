import { validateAppData } from "./appDataSchema";
import { contentHash } from "./contentHash";
import type {
  Alert,
  AppData,
  Eye,
  WorkerAppHandoffState,
  WorkerHandoffEvidence,
  WorkerHandoffEvidenceRecord,
  WorkerAppHandoffStatus,
} from "../types";

export const WORKER_APP_HANDOFF_CONTRACT = "stockledger-worker-app-handoff-v1" as const;

export type WorkerHandoffScheduler = {
  state: "healthy" | "blocked" | "missed" | "stopped";
  lastInvocationAtUtc: string | null;
  lastSuccessfulRunAtUtc: string | null;
  latestExpectedCompletedSession: string;
  latestSuccessfulSession: string | null;
  missedSessions: string[];
  partialSessions: string[];
  schedulerInstalled: false;
};

export type WorkerHandoffBatch = {
  contractVersion: typeof WORKER_APP_HANDOFF_CONTRACT;
  workspaceId: string;
  sequence: number;
  batchId: string;
  createdAt: string;
  workerRevision: number;
  sourceJobId: string;
  evidence: WorkerHandoffEvidence[];
};

export type WorkerHandoffManifest = {
  contractVersion: typeof WORKER_APP_HANDOFF_CONTRACT;
  revision: 1;
  workspaceId: string;
  generatedAt: string;
  workerRevision: number;
  latestSequence: number;
  coverage: "complete" | "partial";
  scheduler: WorkerHandoffScheduler;
  batches: WorkerHandoffBatch[];
  checksum: string;
};

export type WorkerHandoffAck = {
  contractVersion: typeof WORKER_APP_HANDOFF_CONTRACT;
  workspaceId: string;
  sequence: number;
  batchId: string;
  checksum: string;
};

export type WorkerHandoffApplyResult = {
  data: AppData;
  status: WorkerAppHandoffStatus;
  touchedEyeIds: string[];
  appliedBatchIds: string[];
  errorCode?: WorkerAppHandoffState["errorCode"];
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const validDate = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const validId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value);

export const eyeOwnerIdentityHash = (eye: Eye): string => {
  const { lastEvaluation: _lastEvaluation, ...ownerFields } = eye;
  return contentHash(ownerFields);
};

const alertIdentityHash = (alert: Alert) => {
  const { reviewed: _reviewed, snoozedUntil: _snoozedUntil, usefulness: _usefulness, ...immutableFields } = alert;
  return contentHash(immutableFields);
};

const validateEvidence = (raw: unknown): WorkerHandoffEvidence => {
  if (!isObject(raw) || !isObject(raw.eye) || !isObject(raw.stock) || !isObject(raw.recipe) || !isObject(raw.evaluation) || !isObject(raw.snapshot)) {
    throw new Error("invalid_handoff_evidence");
  }
  const evidence = raw as unknown as WorkerHandoffEvidence;
  if (!Array.isArray(evidence.customMetrics) || !/^[a-f0-9]{64}$/.test(evidence.eyeIdentityHash)
    || !/^[a-f0-9]{64}$/.test(evidence.recipeHash) || !/^[a-f0-9]{64}$/.test(evidence.snapshotHash)) {
    throw new Error("invalid_handoff_evidence");
  }
  if (evidence.expectedPreviousEvaluationId !== evidence.eye.lastEvaluation?.id
    || evidence.eyeIdentityHash !== eyeOwnerIdentityHash(evidence.eye)
    || evidence.recipeHash !== contentHash(evidence.recipe)
    || evidence.snapshotHash !== contentHash(evidence.snapshot)
    || evidence.evaluation.eyeId !== evidence.eye.id
    || evidence.evaluation.recipeId !== evidence.recipe.id
    || evidence.evaluation.recipeVersion !== evidence.recipe.version
    || evidence.snapshot.stockId !== evidence.eye.stockId
    || evidence.stock.id !== evidence.eye.stockId
    || (evidence.alert && (evidence.alert.eyeId !== evidence.eye.id || evidence.alert.evaluationId !== evidence.evaluation.id))) {
    throw new Error("invalid_handoff_identity");
  }
  validateAppData({
    workspaceId: "worker-handoff-validation",
    logicRules: [], logicSets: [], decisions: [], outcomes: [], rawBarArchives: [], universeSnapshots: [],
    processedFeatures: [], scanRuns: [], scanSignals: [], reviewLogs: [], forwardProofLedger: [],
    scannerSettings: { universeMode: "frozen_research_universe", fallbackToFrozenUniverse: false, providerDelayMinutesAfterClose: 45, notifyNearMatches: false },
    stocks: [evidence.stock], recipes: [evidence.recipe], customMetrics: evidence.customMetrics,
    eyes: [evidence.eye], snapshots: [evidence.snapshot], alerts: evidence.alert ? [evidence.alert] : [],
    evaluations: [evidence.evaluation],
  });
  return evidence;
};

export const makeWorkerHandoffBatch = (input: Omit<WorkerHandoffBatch, "batchId" | "contractVersion">): WorkerHandoffBatch => {
  const body = {
    ...input,
    contractVersion: WORKER_APP_HANDOFF_CONTRACT,
    evidence: input.evidence.map(validateEvidence),
  };
  return { ...body, batchId: contentHash(body) };
};

export const validateWorkerHandoffBatch = (raw: unknown): WorkerHandoffBatch => {
  if (!isObject(raw) || raw.contractVersion !== WORKER_APP_HANDOFF_CONTRACT || !validId(raw.workspaceId)
    || !Number.isSafeInteger(raw.sequence) || Number(raw.sequence) < 1 || !validId(raw.batchId)
    || !validDate(raw.createdAt) || !Number.isSafeInteger(raw.workerRevision) || Number(raw.workerRevision) < 1
    || !validId(raw.sourceJobId) || !Array.isArray(raw.evidence) || raw.evidence.length === 0) {
    throw new Error("invalid_handoff_batch");
  }
  const { batchId, ...body } = raw as unknown as WorkerHandoffBatch;
  if (batchId !== contentHash(body)) throw new Error("invalid_handoff_checksum");
  return { ...(raw as unknown as WorkerHandoffBatch), evidence: raw.evidence.map(validateEvidence) };
};

const validScheduler = (value: unknown): value is WorkerHandoffScheduler => isObject(value)
  && ["healthy", "blocked", "missed", "stopped"].includes(String(value.state))
  && (value.lastInvocationAtUtc === null || validDate(value.lastInvocationAtUtc))
  && (value.lastSuccessfulRunAtUtc === null || validDate(value.lastSuccessfulRunAtUtc))
  && typeof value.latestExpectedCompletedSession === "string"
  && (value.latestSuccessfulSession === null || typeof value.latestSuccessfulSession === "string")
  && Array.isArray(value.missedSessions) && value.missedSessions.every(item => typeof item === "string")
  && Array.isArray(value.partialSessions) && value.partialSessions.every(item => typeof item === "string")
  && value.schedulerInstalled === false;

export const makeWorkerHandoffManifest = (input: Omit<WorkerHandoffManifest, "contractVersion" | "revision" | "checksum">): WorkerHandoffManifest => {
  const body = { ...input, contractVersion: WORKER_APP_HANDOFF_CONTRACT, revision: 1 as const };
  return { ...body, checksum: contentHash(body) };
};

export const parseWorkerHandoffManifest = (raw: string): WorkerHandoffManifest => {
  const parsed: unknown = JSON.parse(raw);
  if (!isObject(parsed) || parsed.contractVersion !== WORKER_APP_HANDOFF_CONTRACT || parsed.revision !== 1
    || !validId(parsed.workspaceId) || !validDate(parsed.generatedAt)
    || !Number.isSafeInteger(parsed.workerRevision) || Number(parsed.workerRevision) < 0
    || !Number.isSafeInteger(parsed.latestSequence) || Number(parsed.latestSequence) < 0
    || !["complete", "partial"].includes(String(parsed.coverage))
    || !validScheduler(parsed.scheduler) || !Array.isArray(parsed.batches)
    || typeof parsed.checksum !== "string" || !/^[a-f0-9]{64}$/.test(parsed.checksum)) {
    throw new Error("invalid_handoff_manifest");
  }
  const { checksum, ...body } = parsed;
  if (checksum !== contentHash(body)) throw new Error("invalid_handoff_checksum");
  const batches = parsed.batches.map(validateWorkerHandoffBatch);
  if (batches.some((batch, index) => batch.workspaceId !== parsed.workspaceId || (index > 0 && batches[index - 1].sequence >= batch.sequence))) {
    throw new Error("invalid_handoff_sequence");
  }
  if (batches.length && Number(parsed.latestSequence) < batches.at(-1)!.sequence) throw new Error("invalid_handoff_sequence");
  return { ...(parsed as unknown as WorkerHandoffManifest), batches };
};

export const makeWorkerHandoffAck = (workspaceId: string, sequence: number, batchId: string): WorkerHandoffAck => {
  const body = { contractVersion: WORKER_APP_HANDOFF_CONTRACT, workspaceId, sequence, batchId };
  return { ...body, checksum: contentHash(body) };
};

export const parseWorkerHandoffAck = (raw: string): WorkerHandoffAck => {
  const parsed: unknown = JSON.parse(raw);
  if (!isObject(parsed) || parsed.contractVersion !== WORKER_APP_HANDOFF_CONTRACT || !validId(parsed.workspaceId)
    || !Number.isSafeInteger(parsed.sequence) || Number(parsed.sequence) < 1 || !validId(parsed.batchId)
    || typeof parsed.checksum !== "string") throw new Error("invalid_handoff_ack");
  const { checksum, ...body } = parsed;
  if (checksum !== contentHash(body)) throw new Error("invalid_handoff_ack");
  return parsed as unknown as WorkerHandoffAck;
};

const conflict = (data: AppData, status: WorkerAppHandoffStatus, errorCode: WorkerAppHandoffState["errorCode"], pendingBatchCount: number): WorkerHandoffApplyResult => ({
  data: {
    ...data,
    workerAppHandoff: {
      ...(data.workerAppHandoff ?? { evidence: [] }),
      contractVersion: WORKER_APP_HANDOFF_CONTRACT,
      revision: 1,
      status,
      pendingBatchCount,
      errorCode,
    } as WorkerAppHandoffState,
  },
  status,
  touchedEyeIds: [],
  appliedBatchIds: [],
  errorCode,
});

export const applyWorkerHandoff = (data: AppData, manifest: WorkerHandoffManifest, now = new Date()): WorkerHandoffApplyResult => {
  if (!data.workspaceId || data.workspaceId !== manifest.workspaceId) return conflict(data, "conflict", "workspace_mismatch", manifest.batches.length);
  const oldState = data.workerAppHandoff;
  if (oldState?.workerWorkspaceId && oldState.workerWorkspaceId !== manifest.workspaceId) return conflict(data, "conflict", "workspace_mismatch", manifest.batches.length);
  let cursor = oldState?.lastAppliedSequence ?? 0;
  let lastBatchId = oldState?.lastAppliedBatchId;
  const stocks = new Map(data.stocks.map(stock => [stock.id, stock]));
  let eyes = [...data.eyes];
  const evaluations = [...(data.evaluations ?? [])];
  const alerts = [...data.alerts];
  const evidence = [...(oldState?.evidence ?? [])];
  const touchedEyeIds = new Set((oldState?.evidence ?? []).map(record => record.evidence.eye.id));
  const appliedBatchIds: string[] = [];
  let lastAppliedAt = oldState?.lastAppliedAt;

  for (const batch of manifest.batches) {
    if (batch.sequence <= cursor) {
      if (batch.sequence === cursor && lastBatchId && batch.batchId !== lastBatchId) return conflict(data, "conflict", "identity_collision", manifest.batches.length);
      for (const item of batch.evidence) touchedEyeIds.add(item.eye.id);
      continue;
    }
    if (batch.sequence !== cursor + 1 || batch.workspaceId !== data.workspaceId) return conflict(data, "conflict", "sequence_gap", manifest.batches.length);
    for (const item of batch.evidence) {
      const currentEye = eyes.find(eye => eye.id === item.eye.id);
      const currentStock = stocks.get(item.stock.id);
      const currentRecipe = data.recipes.find(recipe => recipe.id === item.recipe.id);
      const referencedMetricsMatch = item.customMetrics.every(metric => {
        const current = data.customMetrics.find(candidate => candidate.key === metric.key);
        return current !== undefined && contentHash(current) === contentHash(metric);
      });
      if (!currentEye || !currentStock || eyeOwnerIdentityHash(currentEye) !== item.eyeIdentityHash
        || contentHash(currentStock) !== contentHash(item.stock)
        || !currentRecipe || contentHash(currentRecipe) !== item.recipeHash
        || !referencedMetricsMatch
        || (currentEye.lastEvaluation?.id !== item.expectedPreviousEvaluationId && currentEye.lastEvaluation?.id !== item.evaluation.id)) {
        return conflict(data, "conflict", "owner_state_changed", manifest.batches.length);
      }
      const existingEvaluation = evaluations.find(row => row.id === item.evaluation.id);
      if (existingEvaluation && contentHash(existingEvaluation) !== contentHash(item.evaluation)) return conflict(data, "conflict", "identity_collision", manifest.batches.length);
      if (item.alert) {
        const existingAlert = alerts.find(row => row.id === item.alert!.id);
        if (existingAlert && alertIdentityHash(existingAlert) !== alertIdentityHash(item.alert)) return conflict(data, "conflict", "identity_collision", manifest.batches.length);
      }
    }
    for (const item of batch.evidence) {
      if (!evaluations.some(row => row.id === item.evaluation.id)) evaluations.push(item.evaluation);
      if (item.alert && !alerts.some(row => row.id === item.alert!.id)) alerts.unshift(item.alert);
      eyes = eyes.map(eye => eye.id === item.eye.id
        ? { ...eye, lastEvaluation: eye.lastEvaluation?.id === item.evaluation.id ? eye.lastEvaluation : item.evaluation }
        : eye);
      if (!evidence.some(row => row.batchId === batch.batchId && row.evidence.evaluation.id === item.evaluation.id)) {
        evidence.push({ batchId: batch.batchId, sequence: batch.sequence, capturedAt: item.evaluation.evaluatedAt, sourceJobId: batch.sourceJobId, evidence: item } satisfies WorkerHandoffEvidenceRecord);
      }
      touchedEyeIds.add(item.eye.id);
    }
    cursor = batch.sequence;
    lastBatchId = batch.batchId;
    lastAppliedAt = now.toISOString();
    appliedBatchIds.push(batch.batchId);
  }

  const lastSuccessfulRun = manifest.scheduler.lastSuccessfulRunAtUtc ?? manifest.generatedAt;
  const isStale = Date.parse(lastSuccessfulRun) < now.getTime() - 48 * 60 * 60 * 1000;
  const status: WorkerAppHandoffStatus = manifest.coverage === "partial" ? "partial"
    : manifest.scheduler.state === "missed" || manifest.scheduler.missedSessions.length > 0 || manifest.scheduler.partialSessions.length > 0 ? "missed"
      : isStale ? "stale" : cursor > (oldState?.lastAppliedSequence ?? 0) || cursor > 0 ? "applied" : "pending";
  const next: AppData = {
    ...data, eyes, evaluations, alerts,
    workerAppHandoff: {
      contractVersion: WORKER_APP_HANDOFF_CONTRACT,
      revision: 1,
      status,
      workerWorkspaceId: manifest.workspaceId,
      ...(cursor ? { lastAppliedSequence: cursor, lastAppliedBatchId: lastBatchId, lastAppliedAt } : {}),
      ...(manifest.scheduler.lastSuccessfulRunAtUtc ? { lastWorkerRunAt: manifest.scheduler.lastSuccessfulRunAtUtc } : {}),
      latestWorkerRevision: manifest.workerRevision,
      pendingBatchCount: Math.max(0, manifest.latestSequence - cursor),
      evidence,
    },
  };
  return { data: next, status, touchedEyeIds: [...touchedEyeIds], appliedBatchIds };
};
