import { z } from "zod";
import type { AppData } from "../../types";
import { contentHash } from "../../domain/contentHash";
import { syncStateStore, type SyncStateStore } from "../../data/repositories/workspaceRepository";
import { cloud, cloudEndpoint } from "./client";
import {
  applyRecords,
  baselineFor,
  planSync,
  recordKey,
  syncCollections,
  syncContractVersion,
  syncPageLimit,
  type CloudRecord,
  type SyncChange,
  type SyncConflict,
  type SyncResolution,
} from "./syncPlan";

const rowSchema = z.object({
  collection: z.enum(syncCollections),
  record_id: z.string().min(1).max(200),
  revision: z.number().int().positive(),
  payload: z.record(z.string(), z.unknown()),
  deleted: z.boolean(),
  cursor: z.number().int().nonnegative().optional(),
});
const bootstrapSchema = z.object({
  contractVersion: z.literal(syncContractVersion),
  cursor: z.number().int().nonnegative(),
  nextOffset: z.number().int().nonnegative(),
  complete: z.boolean(),
  records: z.array(rowSchema),
});
const changesSchema = z.object({
  contractVersion: z.literal(syncContractVersion),
  highWaterCursor: z.number().int().nonnegative(),
  nextCursor: z.number().int().nonnegative(),
  hasMore: z.boolean(),
  changes: z.array(rowSchema),
});
const highWaterSchema = z.object({
  contractVersion: z.literal(syncContractVersion),
  cursor: z.number().int().nonnegative(),
});
const acknowledgementSchema = z.array(z.object({
  collection: z.enum(syncCollections),
  recordId: z.string().min(1).max(200),
  revision: z.number().int().positive(),
  cursor: z.number().int().nonnegative(),
}));
const storedBaselineSchema = z.record(z.string(), z.object({ hash: z.string(), revision: z.number().int().nonnegative(), cursor: z.number().int().nonnegative().default(0) }));
const storedStateSchema = z.object({
  contractVersion: z.literal(syncContractVersion),
  cursor: z.number().int().nonnegative(),
  baseline: storedBaselineSchema,
  records: z.array(rowSchema),
  outbox: z.array(z.object({
    mutationId: z.string().uuid(),
    createdAt: z.string(),
    baseCursor: z.number().int().nonnegative(),
    changeHash: z.string().default(""),
    localWorkspaceHash: z.string().default(""),
    changes: z.array(z.object({
      collection: z.string(), recordId: z.string(), expectedRevision: z.number().int().nonnegative(),
      payload: z.record(z.string(), z.unknown()), deleted: z.boolean(),
      localHash: z.string(), remoteHash: z.string(), remoteRevision: z.number().int().nonnegative(), remoteCursor: z.number().int().nonnegative(),
    })),
    acknowledgement: acknowledgementSchema.optional(),
  })),
});

type SyncStoredState = z.infer<typeof storedStateSchema>;
type SyncOutboxEntry = SyncStoredState["outbox"][number];
type SynchronizeOptions = { allowRebootstrap?: boolean; stateStore?: SyncStateStore };

export class SyncConflictError extends Error {
  constructor(public conflicts: SyncConflict[]) { super(`${conflicts.length} records changed on both devices. Choose which version to keep.`); this.name = "SyncConflictError"; }
}

export class SyncCursorExpiredError extends Error {
  readonly requiresRebootstrap = true;
  constructor() { super("The cloud change cursor expired. Confirm a bounded re-bootstrap before syncing again."); this.name = "SyncCursorExpiredError"; }
}

export class SyncAcknowledgementError extends Error {
  constructor(message = "Cloud acknowledgement was incomplete. Your local intent is retained; retry sync.") { super(message); this.name = "SyncAcknowledgementError"; }
}

const stateKey = (userId: string, workspaceId: string) => `stockledger.sync.v1.${contentHash({ endpoint: cloudEndpoint, userId, workspaceId })}`;
const asError = (error: { code?: string; message?: string } | null | undefined) => {
  if (error?.message?.includes("CURSOR_EXPIRED") || error?.code === "P0001") return new SyncCursorExpiredError();
  return new Error(error?.message ?? "Cloud request failed.");
};
const emptyState = (): SyncStoredState => ({ contractVersion: syncContractVersion, cursor: 0, baseline: {}, records: [], outbox: [] });

const readState = async (store: SyncStateStore, key: string): Promise<SyncStoredState | null> => {
  const raw = await store.get(key);
  if (!raw) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("Saved cloud sync state is invalid. Export local data before resetting the cloud baseline."); }
  const current = storedStateSchema.safeParse(parsed);
  if (current.success) return {
    ...current.data,
    baseline: Object.fromEntries(Object.entries(current.data.baseline).map(([key, value]) => [key, { ...value, cursor: value.cursor ?? 0 }])),
  };
  // The pilot stored only a hash/revision baseline. Keep it as a comparison base,
  // but require a fresh bounded bootstrap before using it again.
  const legacy = storedBaselineSchema.safeParse(parsed);
  if (legacy.success) return {
    ...emptyState(),
    baseline: Object.fromEntries(Object.entries(legacy.data).map(([key, value]) => [key, { ...value, cursor: value.cursor ?? 0 }])),
  };
  throw new Error("Saved cloud sync state is invalid. Export local data before resetting the cloud baseline.");
};

const saveState = (store: SyncStateStore, key: string, state: SyncStoredState) => store.set(key, JSON.stringify(state));

async function bootstrap(): Promise<{ records: CloudRecord[]; cursor: number }> {
  if (!cloud) throw new Error("Cloud sync is not configured.");
  const records: CloudRecord[] = [];
  let offset = 0;
  let firstCursor: number | null = null;
  for (let page = 0; page < 20; page++) {
    const { data, error } = await cloud.rpc("get_ledger_bootstrap_page", { p_offset: offset, p_limit: syncPageLimit });
    if (error) throw asError(error);
    const result = bootstrapSchema.parse(data);
    firstCursor ??= result.cursor;
    records.push(...result.records);
    if (records.length > 5000) throw new Error("Cloud bootstrap exceeds the personal record limit. Export local data and reduce the workspace before retrying.");
    if (result.complete) {
      // Pages are bounded calls. Changes after the first page's cursor are
      // replayed from the ordered feed so a later page cannot hide an edit.
      const feed = await changesAfter(firstCursor);
      const byKey = new Map(records.map(record => [recordKey(record), record]));
      for (const change of feed.records) byKey.set(recordKey(change), change);
      return { records: [...byKey.values()], cursor: Math.max(result.cursor, feed.cursor) };
    }
    if (result.nextOffset <= offset) throw new Error("Cloud bootstrap pagination did not advance.");
    offset = result.nextOffset;
  }
  throw new Error("Cloud bootstrap exceeded the bounded page count. Retry after reducing the workspace.");
}

async function changesAfter(after: number): Promise<{ records: CloudRecord[]; cursor: number }> {
  if (!cloud) throw new Error("Cloud sync is not configured.");
  const records: CloudRecord[] = [];
  let cursor = after;
  for (let page = 0; page < 1000; page++) {
    const { data, error } = await cloud.rpc("get_ledger_changes", { p_after_cursor: cursor, p_limit: syncPageLimit });
    if (error) throw asError(error);
    const result = changesSchema.parse(data);
    for (const change of result.changes) {
      if (change.cursor === undefined || change.cursor <= cursor) throw new Error("Cloud change feed returned an unordered cursor.");
    }
    records.push(...result.changes);
    if (!result.hasMore) return { records, cursor: result.highWaterCursor };
    if (result.nextCursor <= cursor) throw new Error("Cloud change pagination did not advance.");
    cursor = result.nextCursor;
  }
  throw new Error("Cloud change feed exceeded the bounded page count. Retry before making more edits.");
}

async function observeHighWaterCursor(): Promise<number> {
  if (!cloud) throw new Error("Cloud sync is not configured.");
  const { data, error } = await cloud.rpc("get_ledger_high_water_cursor");
  if (error) throw asError(error);
  return highWaterSchema.parse(data).cursor;
}

const applyChangeFeed = (records: CloudRecord[], changes: CloudRecord[]) => {
  const byKey = new Map(records.map(record => [recordKey(record), record]));
  for (const change of changes) byKey.set(recordKey(change), change);
  return [...byKey.values()];
};

const validateAcknowledgement = (changes: SyncChange[], response: unknown) => {
  const acknowledgements = acknowledgementSchema.safeParse(response);
  if (!acknowledgements.success || acknowledgements.data.length !== changes.length) throw new SyncAcknowledgementError();
  const expected = new Set(changes.map(change => `${change.collection}/${change.recordId}`));
  const actual = new Set(acknowledgements.data.map(item => `${item.collection}/${item.recordId}`));
  if (actual.size !== expected.size || acknowledgements.data.some(item => !expected.has(`${item.collection}/${item.recordId}`))) throw new SyncAcknowledgementError();
  return acknowledgements.data;
};

async function submitMutation(entry: SyncOutboxEntry): Promise<z.infer<typeof acknowledgementSchema>> {
  if (!cloud) throw new Error("Cloud sync is not configured.");
  if (entry.changeHash && entry.changeHash !== contentHash(entry.changes)) throw new SyncAcknowledgementError("Saved sync intent failed its integrity check. Local data is preserved.");
  const { data, error } = await cloud.rpc("apply_ledger_batch", { p_mutation_id: entry.mutationId, p_changes: entry.changes });
  if (error) {
    if (error.code === "40001") throw new Error("Another device saved changes during sync. Retry to review conflicts.");
    throw asError(error);
  }
  return validateAcknowledgement(entry.changes, data);
}

export async function synchronize(
  data: AppData,
  adoptLocal: boolean,
  persist: (next: AppData) => Promise<unknown>,
  resolutions: Record<string, SyncResolution> = {},
  options: SynchronizeOptions = {},
) {
  if (!cloud) throw new Error("Cloud sync is not configured.");
  if (data.snapshots.some(snapshot => snapshot.isMock)) throw new Error("Sample workspaces cannot sync to a personal account. Export any notes, then start a clean personal workspace.");
  const { data: identity, error: authError } = await cloud.auth.getUser();
  if (authError || !identity.user) throw new Error("Sign in again before syncing.");
  const store = options.stateStore ?? syncStateStore;
  const key = stateKey(identity.user.id, data.workspaceId ?? "legacy");
  let state = await readState(store, key);
  const hadState = Boolean(state);
  if (!state && !adoptLocal) throw new Error("Confirm that this local workspace belongs to the signed-in account before first sync.");
  state ??= emptyState();

  let remoteRecords: CloudRecord[];
  let remoteCursor: number;
  const existingOutbox = state.outbox[0];
  if (existingOutbox) {
    // The outbox snapshot is the complete remote state at the cursor held just
    // before this mutation was submitted. Do not pull from a later cursor: the
    // post-submit reconciliation must replay from baseCursor, including any
    // changes that raced the RPC and the acknowledged mutation itself.
    remoteRecords = state.records;
    remoteCursor = state.cursor;
  } else {
    try {
      if (!hadState || (state.cursor === 0 && state.records.length === 0 && Object.keys(state.baseline).length > 0)) {
        const bootstrapped = await bootstrap();
        remoteRecords = bootstrapped.records;
        remoteCursor = bootstrapped.cursor;
      } else {
        const feed = await changesAfter(state.cursor);
        remoteRecords = applyChangeFeed(state.records, feed.records);
        remoteCursor = feed.cursor;
      }
    } catch (error) {
      if (!(error instanceof SyncCursorExpiredError) || !options.allowRebootstrap) throw error;
      const bootstrapped = await bootstrap();
      remoteRecords = bootstrapped.records;
      remoteCursor = bootstrapped.cursor;
    }
  }

  if (!hadState && adoptLocal && Object.keys(state.baseline).length === 0) state.baseline = {};
  let entry = existingOutbox;
  let acknowledgement = existingOutbox?.acknowledgement;
  let uploaded = 0;

  if (!entry) {
    const plan = planSync(data, remoteRecords, state.baseline, resolutions);
    if (plan.conflicts.length) throw new SyncConflictError(plan.conflicts);
    if (plan.changes.length > syncPageLimit) throw new Error("This sync exceeds the 500-record mutation limit. Retry in smaller local edits or export a backup before migrating a larger workspace.");
    if (!plan.changes.length) {
      const merged = applyRecords(data, plan.merged);
      await persist(merged);
      await saveState(store, key, { contractVersion: syncContractVersion, cursor: remoteCursor, records: remoteRecords, baseline: baselineFor(remoteRecords, remoteCursor), outbox: [] });
      return { uploaded: 0, records: remoteRecords.length, cursor: remoteCursor, bootstrapped: !hadState || options.allowRebootstrap === true };
    }
    entry = {
      mutationId: globalThis.crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      baseCursor: remoteCursor,
      changeHash: contentHash(plan.changes),
      localWorkspaceHash: contentHash(data),
      changes: plan.changes,
    };
    // This is the durable pre-submit snapshot. In particular, baseCursor is
    // the exact catch-up starting point, even if another device writes before
    // the RPC begins or while it is committing.
    await saveState(store, key, { ...state, cursor: remoteCursor, records: remoteRecords, outbox: [entry] });
    acknowledgement = await submitMutation(entry);
    uploaded = plan.changes.length;
    // Persist the acknowledgement without advancing the cursor. The feed
    // replay below is the only operation allowed to establish a new baseline.
    const acknowledgedState: SyncStoredState = {
      ...state,
      cursor: Math.max(state.cursor, entry.baseCursor),
      records: remoteRecords,
      outbox: [{ ...entry, acknowledgement }],
    };
    await saveState(store, key, acknowledgedState);
    state = acknowledgedState;
  } else if (!acknowledgement) {
    acknowledgement = await submitMutation(entry);
    const acknowledgedState: SyncStoredState = {
      ...state,
      cursor: Math.max(state.cursor, entry.baseCursor),
      records: remoteRecords,
      outbox: [{ ...entry, acknowledgement }],
    };
    await saveState(store, key, acknowledgedState);
    state = acknowledgedState;
  }

  const catchUpStart = entry.baseCursor;
  const acknowledgementCursor = Math.max(...acknowledgement.map(item => item.cursor));
  let reconciledRecords: CloudRecord[];
  let reconciledCursor: number;
  try {
    const observedHighWater = await observeHighWaterCursor();
    const feed = await changesAfter(catchUpStart);
    if (feed.cursor < observedHighWater || feed.cursor < acknowledgementCursor) throw new SyncAcknowledgementError("The cloud change feed did not reach the acknowledged server high-water mark. Local intent is retained; retry sync.");
    reconciledRecords = applyChangeFeed(state.records, feed.records);
    for (const item of acknowledgement) {
      const acknowledgedChange = feed.records.some(candidate => recordKey(candidate) === `${item.collection}/${item.recordId}` && candidate.revision === item.revision && candidate.cursor === item.cursor);
      if (!acknowledgedChange) throw new SyncAcknowledgementError("The ordered change feed did not include the acknowledged mutation. Local intent is retained; retry sync.");
    }
    reconciledCursor = Math.max(state.cursor, feed.cursor);
  } catch (error) {
    if (!(error instanceof SyncCursorExpiredError) || !options.allowRebootstrap) throw error;
    const bootstrapped = await bootstrap();
    if (bootstrapped.cursor < acknowledgementCursor) throw new SyncAcknowledgementError("Bounded re-bootstrap did not reach the acknowledged server cursor. Local intent is retained; retry sync.");
    reconciledRecords = bootstrapped.records;
    reconciledCursor = Math.max(state.cursor, bootstrapped.cursor);
  }

  // Recompute from the complete post-submit remote state. This applies
  // unrelated device changes locally and retains any newer local edits as
  // exact, version-bound conflicts instead of overwriting them.
  const reconciledPlan = planSync(data, reconciledRecords, state.baseline, resolutions);
  if (reconciledPlan.conflicts.length) throw new SyncConflictError(reconciledPlan.conflicts);
  const merged = applyRecords(data, reconciledPlan.merged);
  await persist(merged);
  // Workspace persistence is intentionally before clearing the acknowledged
  // outbox. A crash here leaves a replayable acknowledgement for the next run.
  await saveState(store, key, { contractVersion: syncContractVersion, cursor: reconciledCursor, records: reconciledRecords, baseline: baselineFor(reconciledRecords, reconciledCursor), outbox: [] });
  return { uploaded, records: reconciledRecords.length, cursor: reconciledCursor, bootstrapped: !hadState || options.allowRebootstrap === true };
}

export async function exportPersonalCloudData(): Promise<string> {
  if (!cloud) throw new Error("Cloud sync is not configured.");
  const { data: identity, error } = await cloud.auth.getUser();
  if (error || !identity.user) throw new Error("Sign in again before exporting cloud data.");
  const result = await bootstrap();
  return JSON.stringify({
    contractVersion: syncContractVersion,
    exportedAt: new Date().toISOString(),
    accountId: identity.user.id,
    cursor: result.cursor,
    records: result.records,
  }, null, 2);
}

export type AccountDeletionStatus = "requested" | "in_progress" | "completed" | "failed";
const deletionStatusSchema = z.object({ status: z.enum(["requested", "in_progress", "completed", "failed"]), requestedAt: z.string(), startedAt: z.string().nullable().optional(), completedAt: z.string().nullable().optional(), failedAt: z.string().nullable().optional(), failureCode: z.string().nullable().optional(), authUserDeletion: z.enum(["unproven", "completed"]).optional() });

export async function requestAccountDeletion() {
  if (!cloud) throw new Error("Cloud sync is not configured.");
  const { data, error } = await cloud.rpc("request_account_deletion");
  if (error) throw asError(error);
  return deletionStatusSchema.parse(data);
}

export async function getAccountDeletionStatus() {
  if (!cloud) return null;
  const { data, error } = await cloud.rpc("get_account_deletion_status");
  if (error) throw asError(error);
  return data ? deletionStatusSchema.parse(data) : null;
}
