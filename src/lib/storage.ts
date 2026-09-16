import AsyncStorage from "../platform/keyValueStore";
import { validateAppData } from "../domain/appDataSchema";
import { seedData } from "./seed";
import type { AppData } from "../types";
import { createId } from "../platform/identity";
import { contentHash } from "../domain/contentHash";

export const STORAGE_KEYS = {
  current: "stockledger.appData.v2", legacy: "stockledger.appData.v1",
  previous: "stockledger.appData.v2.previous", legacyBackup: "stockledger.appData.v1.original",
} as const;
export { parseExport, serializeExport } from "../domain/backupFormat";
import { parseExport, serializeExport, type StorageEnvelope } from "../domain/backupFormat";
export class StorageRecoveryError extends Error {
  constructor(message: string) { super(message); this.name = "StorageRecoveryError"; }
}
export const createEmptyAppData = (): AppData => ({
  workspaceId: createId("workspace"),
  stocks: [], recipes: [], customMetrics: [], logicRules: [], logicSets: [], eyes: [], alerts: [], decisions: [], outcomes: [], snapshots: [], rawBarArchives: [], universeSnapshots: [], processedFeatures: [], scanRuns: [], scanSignals: [], reviewLogs: [], forwardProofLedger: [],
  scannerSettings: { universeMode: "frozen_research_universe", fallbackToFrozenUniverse: false, providerDelayMinutesAfterClose: 45, notifyNearMatches: false },
});
export const createDemoAppData = (): AppData => ({ ...JSON.parse(JSON.stringify(seedData)) as AppData, workspaceId: createId("demo") });
let loadedRevision: number | null = null;

export const loadAppData = async (): Promise<AppData> => {
  const current = await AsyncStorage.getItem(STORAGE_KEYS.current);
  if (current !== null) {
    try {
      const data = parseExport(current); const envelope = JSON.parse(current) as StorageEnvelope;
      if (envelope.format !== "stockledger" || !Number.isSafeInteger(envelope.revision)) throw new Error("Invalid stored revision.");
      loadedRevision = envelope.revision; return { ...data, workspaceId: data.workspaceId ?? `workspace-${contentHash(data)}` };
    }
    catch (error) { throw new StorageRecoveryError(`Saved data needs recovery. Original data is intact. ${error instanceof Error ? error.message : "Validation failed."}`); }
  }
  const legacy = await AsyncStorage.getItem(STORAGE_KEYS.legacy);
  if (legacy === null) { loadedRevision = 0; return createEmptyAppData(); }
  try {
    const parsed = parseExport(legacy);
    const data = { ...parsed, workspaceId: parsed.workspaceId ?? `workspace-${contentHash(parsed)}` };
    if (await AsyncStorage.getItem(STORAGE_KEYS.legacyBackup) === null) await AsyncStorage.setItem(STORAGE_KEYS.legacyBackup, legacy);
    await AsyncStorage.compareAndSetItem(STORAGE_KEYS.current, null, serializeExport(data, 1), STORAGE_KEYS.previous);
    loadedRevision = 1;
    return data;
  } catch (error) {
    throw new StorageRecoveryError(`Legacy data needs recovery. No records were replaced. ${error instanceof Error ? error.message : "Validation failed."}`);
  }
};

let writes: Promise<void> = Promise.resolve();
export const saveAppData = (data: AppData): Promise<void> => {
  // Snapshot before queueing so caller mutations cannot change a pending save.
  const validated = validateAppData(data);
  const snapshot = JSON.parse(JSON.stringify(validated)) as AppData;
  const write = writes.then(async () => {
    const previous = await AsyncStorage.getItem(STORAGE_KEYS.current);
    let revision = 1;
    if (previous !== null) {
      parseExport(previous); // refuse to overwrite unrecovered invalid data
      revision = (JSON.parse(previous) as StorageEnvelope).revision + 1;

    }
    if (loadedRevision !== null && loadedRevision !== revision - 1) throw new Error("Another session saved changes. Reload to protect those changes.");
    await AsyncStorage.compareAndSetItem(STORAGE_KEYS.current, previous, serializeExport(snapshot, revision), STORAGE_KEYS.previous);
    loadedRevision = revision;
  });
  writes = write.catch(() => {});
  return write;
};
export const readRecoveryData = async () => ({
  current: await AsyncStorage.getItem(STORAGE_KEYS.current),
  previous: await AsyncStorage.getItem(STORAGE_KEYS.previous),
  legacy: await AsyncStorage.getItem(STORAGE_KEYS.legacy),
});

/** Explicit recovery only: keep corrupt bytes before restoring a validated copy. */
export const restorePreviousBackup = async (): Promise<void> => {
  await writes;
  const previous = await AsyncStorage.getItem(STORAGE_KEYS.previous);
  if (previous === null) throw new Error("No previous saved copy is available. Keep the recovery export for manual repair.");
  const data = parseExport(previous);
  const current = await AsyncStorage.getItem(STORAGE_KEYS.current);
  let currentRevision = 0;
  try { const value = JSON.parse(current ?? "null")?.revision; if (Number.isSafeInteger(value) && value > 0) currentRevision = value; } catch { /* preserve corrupt bytes in the transaction below */ }
  const revision = Math.max(currentRevision, (JSON.parse(previous) as StorageEnvelope).revision) + 1;
  await AsyncStorage.compareAndSetItem(STORAGE_KEYS.current, current, serializeExport(data, revision), `stockledger.recovery.${Date.now()}`);
  loadedRevision = revision;
};
