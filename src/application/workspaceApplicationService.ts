import { evaluateWorkspace } from "../domain/evaluateWorkspace";
import { parseExport, serializeUserExport } from "../domain/backupFormat";
import { runDailyStockConditionScan } from "../lib/stockConditionScanner";
import { createId } from "../platform/identity";
import type { AppData } from "../types";
import { workspaceRepository, type RecoveryData, type WorkspaceRepository } from "../data/repositories/workspaceRepository";

type AppDataChange = AppData | ((current: AppData) => AppData);

export interface WorkspaceApplicationService {
  load(): Promise<AppData>;
  evaluate(data: AppData): AppData;
  commit(change: AppDataChange): Promise<AppData>;
  runDailyScanner(): Promise<void>;
  importBackup(raw: string): Promise<void>;
  exportBackup(): string;
  readRecoveryData(): Promise<RecoveryData>;
  restorePreviousBackup(): Promise<void>;
}

export const createWorkspaceApplicationService = (dependencies: {
  repository?: WorkspaceRepository;
  getCurrent: () => AppData | null;
  publish: (next: AppData) => void;
}): WorkspaceApplicationService => {
  const repository = dependencies.repository ?? workspaceRepository;
  let commandTail: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const command = commandTail.then(operation);
    commandTail = command.catch(() => {});
    return command;
  };

  const commit = (change: AppDataChange) => enqueue(async () => {
    const current = dependencies.getCurrent();
    if (current === null && typeof change === "function") throw new Error("Workspace is not loaded.");
    const next = evaluateWorkspace(typeof change === "function" ? change(current as AppData) : change);
    await repository.save(next);
    dependencies.publish(next);
    return next;
  });

  return {
    load: () => repository.load(),
    evaluate: evaluateWorkspace,
    commit,
    async runDailyScanner() {
      const current = dependencies.getCurrent();
      if (!current) return;
      const result = await runDailyStockConditionScan({
        existingBatches: current.rawBarArchives,
        existingSignals: current.scanSignals,
        existingForwardProof: current.forwardProofLedger,
        scannerSettings: current.scannerSettings,
        previousUniverseSnapshot: current.universeSnapshots[0],
      });
      await commit(prev => ({
        ...prev,
        rawBarArchives: result.rawArchiveBatch
          ? [result.rawArchiveBatch, ...prev.rawBarArchives.filter(entry => entry.id !== result.rawArchiveBatch!.id)]
          : prev.rawBarArchives,
        universeSnapshots: [
          result.universeSnapshot,
          ...prev.universeSnapshots.filter(entry => entry.id !== result.universeSnapshot.id),
        ],
        processedFeatures: [
          ...result.processedFeatures,
          ...prev.processedFeatures.filter(entry => !result.processedFeatures.some(next => next.id === entry.id)),
        ],
        scanRuns: [result.scanRun, ...prev.scanRuns.filter(entry => entry.id !== result.scanRun.id)],
        scanSignals: result.scanSignals,
        forwardProofLedger: result.forwardProofLedger,
      }));
    },
    async importBackup(raw: string) {
      const imported = parseExport(raw);
      const restored = { ...imported, workspaceId: createId("restored") };
      await enqueue(async () => {
        await repository.restoreFullBackup(restored);
        dependencies.publish(restored);
      });
    },
    exportBackup() {
      const current = dependencies.getCurrent();
      if (!current) throw new Error("Workspace is not loaded.");
      return serializeUserExport(current);
    },
    readRecoveryData: () => repository.readRecoveryData(),
    restorePreviousBackup: () => repository.restorePreviousBackup(),
  };
};
