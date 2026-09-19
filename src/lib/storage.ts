/**
 * Compatibility exports for existing callers. New application code uses the
 * workspace repository/application service boundary directly.
 */
export { parseExport, serializeExport, serializeUserExport } from "../domain/backupFormat";
export { createDemoAppData, createEmptyAppData } from "../data/workspaceDefaults";
export {
  STORAGE_KEYS,
  StorageRecoveryError,
  WorkspaceStorageBudgetError,
  workspaceRepository,
  createWorkspaceRepository,
  prepareLegacyMigration,
  type RecoveryData,
  type WorkspaceRepository,
} from "../data/repositories/workspaceRepository";

import { workspaceRepository } from "../data/repositories/workspaceRepository";

export const loadAppData = () => workspaceRepository.load();
export const saveAppData = (data: Parameters<typeof workspaceRepository.save>[0]) => workspaceRepository.save(data);
export const readRecoveryData = () => workspaceRepository.readRecoveryData();
export const restorePreviousBackup = () => workspaceRepository.restorePreviousBackup();
