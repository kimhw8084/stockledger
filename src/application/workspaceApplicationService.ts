import { evaluateWorkspace } from "../domain/evaluateWorkspace";
import { parseExport, serializeExport } from "../domain/backupFormat";
import { createCommandQueue } from "../domain/commandQueue";
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
  const commandQueue = createCommandQueue<AppData>(
    dependencies.getCurrent,
    next => repository.save(next),
    dependencies.publish,
  );

  const commit = (change: AppDataChange) => commandQueue(current => evaluateWorkspace(typeof change === "function" ? change(current) : change));

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
      await commit({ ...imported, workspaceId: createId("restored") });
    },
    exportBackup() {
      const current = dependencies.getCurrent();
      if (!current) throw new Error("Workspace is not loaded.");
      return serializeExport(current);
    },
    readRecoveryData: () => repository.readRecoveryData(),
    restorePreviousBackup: () => repository.restorePreviousBackup(),
  };
};
