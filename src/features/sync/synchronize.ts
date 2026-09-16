import { z } from "zod";
import type { AppData } from "../../types";
import { contentHash } from "../../domain/contentHash";
import store from "../../platform/keyValueStore";
import { cloud, cloudEndpoint } from "./client";
import { applyRecords, baselineFor, planSync, syncCollections, type CloudRecord, type SyncBaseline, type SyncConflict, type SyncResolution } from "./syncPlan";
const rowSchema = z.object({ collection: z.enum(syncCollections), record_id: z.string(), revision: z.number().int().positive(), payload: z.record(z.string(), z.unknown()), deleted: z.boolean() });
export class SyncConflictError extends Error {
  constructor(public conflicts: SyncConflict[]) { super(`${conflicts.length} records changed on both devices. Choose which version to keep.`); }
}
export async function synchronize(data: AppData, adoptLocal: boolean, persist: (next: AppData) => Promise<unknown>, resolutions: Record<string, SyncResolution> = {}) {
  if (!cloud) throw new Error("Cloud sync is not configured.");
  if (data.snapshots.some(snapshot => snapshot.isMock)) throw new Error("Sample workspaces cannot sync to a personal account. Export any notes, then start a clean personal workspace.");
  const { data: identity, error: authError } = await cloud.auth.getUser();
  if (authError || !identity.user) throw new Error("Sign in again before syncing.");
  const metadataKey = `stockledger.sync.${contentHash(cloudEndpoint)}.${identity.user.id}.${data.workspaceId ?? "legacy"}`;
  const rawBaseline = await store.getItem(metadataKey);
  if (!rawBaseline && !adoptLocal) throw new Error("Confirm that this local workspace belongs to the signed-in account before first sync.");
  const baseline: SyncBaseline = rawBaseline ? z.record(z.string(), z.object({ hash: z.string(), revision: z.number().int().positive() })).parse(JSON.parse(rawBaseline)) : {};
  const remote: CloudRecord[] = [];
  for (let from = 0; from <= 5000; from += 500) {
    const { data: rows, error } = await cloud.from("ledger_records").select("collection,record_id,revision,payload,deleted").in("collection", [...syncCollections]).order("collection").order("record_id").range(from, from + 499);
    if (error) throw new Error(error.message);
    remote.push(...z.array(rowSchema).parse(rows));
    if ((rows?.length ?? 0) < 500) break;
  }
  const plan = planSync(data, remote, baseline, resolutions);
  if (plan.conflicts.length) throw new SyncConflictError(plan.conflicts);
  const merged = applyRecords(data, plan.merged); // validate the complete graph before any upload
  if (plan.changes.length > 500) throw new Error("This sync exceeds the 500-record pilot batch limit. Export a backup before migrating a larger workspace.");
  if (plan.changes.length) {
    const digest = contentHash({ user: identity.user.id, changes: plan.changes });
    const mutation = `${digest.slice(0,8)}-${digest.slice(8,12)}-4${digest.slice(13,16)}-8${digest.slice(17,20)}-${digest.slice(20,32)}`;
    const { data: response, error } = await cloud.rpc("apply_ledger_batch", { p_mutation_id: mutation, p_changes: plan.changes });
    if (error) throw new Error(error.code === "40001" ? "Another device saved changes during sync. Retry to review conflicts." : error.message);
    const revisions = z.array(z.object({ collection: z.string(), recordId: z.string(), revision: z.number().int().positive() })).parse(response);
    for (const change of plan.changes) {
      const revision = revisions.find(row => row.collection === change.collection && row.recordId === change.recordId)?.revision;
      if (!revision) throw new Error("Cloud acknowledgement is incomplete. Your local workspace is intact.");
      const record: CloudRecord = { collection: change.collection as CloudRecord["collection"], record_id: change.recordId, revision, payload: change.payload, deleted: change.deleted };
      const index = remote.findIndex(row => row.collection === record.collection && row.record_id === record.record_id);
      if (index < 0) remote.push(record); else remote[index] = record;
    }
  }
  await persist(merged); // only acknowledge locally after the workspace is durable
  await store.setItem(metadataKey, JSON.stringify(baselineFor(remote)));
  return { uploaded: plan.changes.length, records: remote.length };
}
