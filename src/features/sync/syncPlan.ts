import type { AppData, LogicRule, LogicSet } from "../../types";
import { validateAppData } from "../../domain/appDataSchema";
import { contentHash } from "../../domain/contentHash";
import { unavailableSnapshot } from "../../domain/marketSnapshot";
export const syncCollections = ["stocks", "recipes", "customMetrics", "eyes", "alerts", "decisions", "outcomes", "evaluations", "reviewLogs"] as const;
export type SyncCollection = typeof syncCollections[number];
export type CloudRecord = { collection: SyncCollection; record_id: string; revision: number; payload: Record<string, unknown>; deleted: boolean };
export type SyncBaseline = Record<string, { hash: string; revision: number }>;
export type SyncChange = { collection: string; recordId: string; expectedRevision: number; payload: Record<string, unknown>; deleted: boolean };
export type SyncConflict = { key: string; local?: CloudRecord; remote?: CloudRecord; localHash: string; remoteHash: string };
export type SyncResolution = { choice: "local" | "remote"; localHash: string; remoteHash: string };
const keyFor = (record: Pick<CloudRecord, "collection" | "record_id">) => `${record.collection}/${record.record_id}`;
const hashFor = (record?: Pick<CloudRecord, "payload" | "deleted">) => !record || record.deleted ? "deleted" : contentHash(record.payload);
export function localRecords(data: AppData): Map<string, CloudRecord> {
  const records = new Map<string, CloudRecord>();
  for (const collection of syncCollections) for (const value of data[collection] ?? []) {
    const payload = value as unknown as Record<string, unknown>;
    const recordId = collection === "customMetrics" ? payload.key : payload.id;
    if (typeof recordId !== "string") continue; // old evaluations without identities stay local
    const record: CloudRecord = { collection, record_id: recordId, revision: 0, payload, deleted: false };
    records.set(keyFor(record), record);
  }
  return records;
}
export function planSync(local: AppData, remoteRows: CloudRecord[], baseline: SyncBaseline, resolutions: Record<string, SyncResolution> = {}) {
  const localMap = localRecords(local), remoteMap = new Map(remoteRows.filter(row => syncCollections.includes(row.collection)).map(row => [keyFor(row), row]));
  const merged = new Map(localMap), changes: SyncChange[] = [], conflicts: SyncConflict[] = [];
  for (const key of new Set([...localMap.keys(), ...remoteMap.keys(), ...Object.keys(baseline)])) {
    const current = localMap.get(key), remote = remoteMap.get(key), base = baseline[key];
    const localHash = hashFor(current), remoteHash = hashFor(remote), baseHash = base?.hash ?? "deleted";
    const localChanged = localHash !== baseHash, remoteChanged = remoteHash !== baseHash;
    if (localChanged && remoteChanged && localHash !== remoteHash) {
      const resolution = resolutions[key];
      if (!resolution || resolution.localHash !== localHash || resolution.remoteHash !== remoteHash) { conflicts.push({ key, local: current, remote, localHash, remoteHash }); continue; }
      if (resolution.choice === "remote") { if (remote && !remote.deleted) merged.set(key, remote); else merged.delete(key); continue; }
    }
    if (localChanged && localHash !== remoteHash) {
      const identity = current ?? remote;
      if (identity) changes.push({ collection: identity.collection, recordId: identity.record_id, expectedRevision: remote?.revision ?? 0, payload: current?.payload ?? remote!.payload, deleted: !current });
    } else if (remote) {
      if (remote.deleted) merged.delete(key); else merged.set(key, remote);
    }
  }
  return { changes, conflicts, merged };
}
export function applyRecords(local: AppData, records: Map<string, CloudRecord>): AppData {
  const next = { ...local } as AppData;
  for (const collection of syncCollections) {
    (next as unknown as Record<string, unknown>)[collection] = [...records.values()].filter(row => row.collection === collection && !row.deleted).map(row => row.payload);
  }
  next.evaluations = [...(next.evaluations ?? []), ...(local.evaluations ?? []).filter(row => !row.id)];
  const stocks = new Set(next.stocks.map(stock => stock.id));
  next.snapshots = next.snapshots.filter(snapshot => stocks.has(snapshot.stockId));
  for (const stock of next.stocks) if (!next.snapshots.some(snapshot => snapshot.stockId === stock.id)) next.snapshots.push(unavailableSnapshot(stock));
  next.logicSets = next.recipes.map(({ conditions, ...recipe }) => ({ ...recipe, lineageId: recipe.lineageId ?? recipe.id })) as LogicSet[];
  next.logicRules = next.recipes.flatMap(recipe => recipe.conditions.map(condition => ({ ...condition, setId: recipe.id, setVersion: recipe.version, createdAt: recipe.createdAt }))) as LogicRule[];
  return validateAppData(next);
}
export function baselineFor(records: CloudRecord[]): SyncBaseline {
  return Object.fromEntries(records.map(record => [keyFor(record), { hash: hashFor(record), revision: record.revision }]));
}
