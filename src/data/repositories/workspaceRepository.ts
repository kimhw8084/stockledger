import { validateAppData } from "../../domain/appDataSchema";
import { parseExport, serializeExport, type StorageEnvelope } from "../../domain/backupFormat";
import { contentHash } from "../../domain/contentHash";
import store from "../../platform/keyValueStore";
import type { KeyValueStore } from "../../platform/keyValueStore";
import type { AppData } from "../../types";
import { createEmptyAppData } from "../workspaceDefaults";
import { profileWorkspace, type WorkspaceBudgetStatus } from "../workspaceFootprint";
import { STORAGE_LAYOUT_CONTRACT } from "../workspaceContract";

export const STORAGE_KEYS = {
  current: "stockledger.appData.v2", legacy: "stockledger.appData.v1",
  previous: "stockledger.appData.v2.previous", legacyBackup: "stockledger.appData.v1.original",
} as const;

export class StorageRecoveryError extends Error {
  constructor(message: string) { super(message); this.name = "StorageRecoveryError"; }
}

export class WorkspaceStorageBudgetError extends Error {
  readonly code = "WORKSPACE_STORAGE_BUDGET_EXCEEDED" as const;

  constructor(
    readonly current: WorkspaceBudgetStatus,
    readonly attempted: WorkspaceBudgetStatus,
  ) {
    super(`Workspace storage budget exceeded: guarded bulk history would grow from ${current.currentBytes} to ${attempted.currentBytes} UTF-8 bytes, over the ${attempted.budgetBytes}-byte hard budget. Reduce guarded history through an explicit reduction operation before adding more historical evidence.`);
    this.name = "WorkspaceStorageBudgetError";
  }
}

export type RecoveryData = {
  current: string | null;
  previous: string | null;
  legacy: string | null;
};

export interface WorkspaceRepository {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
  restoreFullBackup(data: AppData): Promise<void>;
  readRecoveryData(): Promise<RecoveryData>;
  restorePreviousBackup(): Promise<void>;
}

/** Sync metadata is local-only and deliberately lives outside the workspace export. */
export type SyncStateStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};

export const createSyncStateStore = (keyValueStore: KeyValueStore = store): SyncStateStore => ({
  get: key => keyValueStore.getItem(key),
  set: (key, value) => keyValueStore.setItem(key, value),
  remove: key => keyValueStore.removeItem(key),
});

export const syncStateStore = createSyncStateStore();

/** The only supported migration currently promotes a legacy v1 payload. */
export const prepareLegacyMigration = (legacy: string, revision = 1) => {
  const parsed = parseExport(legacy);
  const data = { ...parsed, workspaceId: parsed.workspaceId ?? `workspace-${contentHash(parsed)}` };
  return {
    from: STORAGE_LAYOUT_CONTRACT.migrations[0].from,
    to: STORAGE_LAYOUT_CONTRACT.migrations[0].to,
    data,
    serialized: serializeExport(data, revision),
  } as const;
};

export const createWorkspaceRepository = (keyValueStore: KeyValueStore = store): WorkspaceRepository => {
  let loadedRevision: number | null = null;
  let writes: Promise<void> = Promise.resolve();

  const load = async (): Promise<AppData> => {
    const current = await keyValueStore.getItem(STORAGE_KEYS.current);
    if (current !== null) {
      try {
        const data = parseExport(current);
        const envelope = JSON.parse(current) as StorageEnvelope;
        if (envelope.format !== "stockledger" || !Number.isSafeInteger(envelope.revision)) throw new Error("Invalid stored revision.");
        loadedRevision = envelope.revision;
        return { ...data, workspaceId: data.workspaceId ?? `workspace-${contentHash(data)}` };
      } catch (error) {
        throw new StorageRecoveryError(`Saved data needs recovery. Original data is intact. ${error instanceof Error ? error.message : "Validation failed."}`);
      }
    }

    const legacy = await keyValueStore.getItem(STORAGE_KEYS.legacy);
    if (legacy === null) { loadedRevision = 0; return createEmptyAppData(); }
    try {
      const migration = prepareLegacyMigration(legacy);
      // The source is never deleted. A retry can complete after any failure
      // between the backup copy and the atomic current-key promotion.
      if (await keyValueStore.getItem(STORAGE_KEYS.legacyBackup) === null) await keyValueStore.setItem(STORAGE_KEYS.legacyBackup, legacy);
      await keyValueStore.compareAndSetItem(STORAGE_KEYS.current, null, migration.serialized, STORAGE_KEYS.previous);
      loadedRevision = 1;
      return migration.data;
    } catch (error) {
      throw new StorageRecoveryError(`Legacy data needs recovery. No records were replaced. ${error instanceof Error ? error.message : "Validation failed."}`);
    }
  };

  const save = (data: AppData): Promise<void> => {
    const validated = validateAppData(data);
    // Snapshot before queueing so caller mutations cannot change a pending save.
    const snapshot = JSON.parse(JSON.stringify(validated)) as AppData;
    const write = writes.then(async () => {
      const previous = await keyValueStore.getItem(STORAGE_KEYS.current);
      let currentData = createEmptyAppData();
      let revision = 1;
      if (previous !== null) {
        currentData = parseExport(previous); // refuse to overwrite unrecovered invalid data
        revision = (JSON.parse(previous) as StorageEnvelope).revision + 1;
      }
      if (loadedRevision !== null && loadedRevision !== revision - 1) throw new Error("Another session saved changes. Reload to protect those changes.");
      const currentBudget = profileWorkspace(currentData).budget;
      const attemptedBudget = profileWorkspace(snapshot).budget;
      if (attemptedBudget.overBudget && attemptedBudget.currentBytes > currentBudget.currentBytes) {
        throw new WorkspaceStorageBudgetError(currentBudget, attemptedBudget);
      }
      const initialBackup = previous === null && loadedRevision === 0 ? serializeExport(createEmptyAppData(), 0) : undefined;
      await keyValueStore.compareAndSetItem(STORAGE_KEYS.current, previous, serializeExport(snapshot, revision), STORAGE_KEYS.previous, initialBackup);
      loadedRevision = revision;
    });
    writes = write.catch(() => {});
    return write;
  };

  /** Explicit full-backup restore only: preserve the complete validated payload, including an oversized history. */
  const restoreFullBackup = (data: AppData): Promise<void> => {
    const snapshot = JSON.parse(JSON.stringify(validateAppData(data))) as AppData;
    const write = writes.then(async () => {
      const current = await keyValueStore.getItem(STORAGE_KEYS.current);
      const currentRevision = current === null ? 0 : (() => {
        try {
          const revision = (JSON.parse(current) as Partial<StorageEnvelope>).revision;
          return typeof revision === "number" && Number.isSafeInteger(revision) && revision >= 0 ? revision : (loadedRevision ?? 0);
        } catch {
          return loadedRevision ?? 0;
        }
      })();
      if (loadedRevision !== null && currentRevision !== loadedRevision) throw new Error("Another session saved changes. Reload to protect those changes.");
      const previous = await keyValueStore.getItem(STORAGE_KEYS.previous);
      const previousRevision = previous === null ? 0 : (() => {
        try {
          const revision = (JSON.parse(previous) as Partial<StorageEnvelope>).revision;
          return typeof revision === "number" && Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
        } catch {
          return 0;
        }
      })();
      const revision = Math.max(currentRevision, previousRevision) + 1;
      const initialBackup = current === null && (loadedRevision === null || loadedRevision === 0) ? serializeExport(createEmptyAppData(), 0) : undefined;
      await keyValueStore.compareAndSetItem(STORAGE_KEYS.current, current, serializeExport(snapshot, revision), STORAGE_KEYS.previous, initialBackup);
      loadedRevision = revision;
    });
    writes = write.catch(() => {});
    return write;
  };

  const readRecoveryData = async (): Promise<RecoveryData> => ({
    current: await keyValueStore.getItem(STORAGE_KEYS.current),
    previous: await keyValueStore.getItem(STORAGE_KEYS.previous),
    legacy: await keyValueStore.getItem(STORAGE_KEYS.legacy),
  });

  /** Explicit recovery only: keep corrupt bytes before restoring a validated copy. */
  const restorePreviousBackup = async (): Promise<void> => {
    await writes;
    const previous = await keyValueStore.getItem(STORAGE_KEYS.previous);
    if (previous === null) throw new Error("No previous saved copy is available. Keep the recovery export for manual repair.");
    const data = parseExport(previous);
    const current = await keyValueStore.getItem(STORAGE_KEYS.current);
    let currentRevision = 0;
    try { const value = JSON.parse(current ?? "null")?.revision; if (Number.isSafeInteger(value) && value > 0) currentRevision = value; } catch { /* preserve corrupt bytes in the transaction below */ }
    const revision = Math.max(currentRevision, (JSON.parse(previous) as StorageEnvelope).revision) + 1;
    await keyValueStore.compareAndSetItem(STORAGE_KEYS.current, current, serializeExport(data, revision), `stockledger.recovery.${Date.now()}`);
    loadedRevision = revision;
  };

  return { load, save, restoreFullBackup, readRecoveryData, restorePreviousBackup };
};

export const workspaceRepository = createWorkspaceRepository();
