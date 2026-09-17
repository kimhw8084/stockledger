import type { AppData } from "../types";

/** Collections currently loaded with the v2 workspace bootstrap. */
export const WORKSPACE_COLLECTIONS = [
  "stocks",
  "recipes",
  "customMetrics",
  "logicRules",
  "logicSets",
  "eyes",
  "alerts",
  "decisions",
  "outcomes",
  "snapshots",
  "rawBarArchives",
  "universeSnapshots",
  "processedFeatures",
  "scanRuns",
  "scanSignals",
  "reviewLogs",
  "forwardProofLedger",
  "evaluations",
] as const satisfies ReadonlyArray<keyof AppData>;

export type WorkspaceCollection = (typeof WORKSPACE_COLLECTIONS)[number];

/** High-volume historical evidence guarded by the versioned storage budget. */
export const BULK_HISTORY_COLLECTIONS = [
  "rawBarArchives",
  "universeSnapshots",
  "processedFeatures",
  "scanRuns",
  "scanSignals",
  "reviewLogs",
  "forwardProofLedger",
] as const satisfies ReadonlyArray<WorkspaceCollection>;

export type BulkHistoryCollection = (typeof BULK_HISTORY_COLLECTIONS)[number];

const REPRESENTATIVE_FIXTURE_BULK_HISTORY_BYTES = 555815;
const ENGINEERING_HEADROOM_MULTIPLIER = 2;

/**
 * The hard boundary is measured from the deterministic representative fixture,
 * with explicit engineering headroom. It is a safety boundary, not a user
 * count, capacity, or forecast claim.
 */
export const WORKSPACE_STORAGE_BUDGET_CONTRACT = {
  version: 1,
  id: "workspace-bulk-history-v1",
  unit: "utf8-serialized-collection-bytes",
  measuredFrom: "representative-workspace-fixture",
  representativeFixture: {
    bulkHistoryBytes: REPRESENTATIVE_FIXTURE_BULK_HISTORY_BYTES,
  },
  engineeringHeadroom: {
    multiplier: ENGINEERING_HEADROOM_MULTIPLIER,
    rationale: "Two times the deterministic fixture measurement leaves implementation headroom for ordinary historical growth.",
  },
  hardBudgetBytes: REPRESENTATIVE_FIXTURE_BULK_HISTORY_BYTES * ENGINEERING_HEADROOM_MULTIPLIER,
  guardedCollections: BULK_HISTORY_COLLECTIONS,
  policy: {
    noSilentDeletion: true,
    oversizedExistingWorkspace: "load-recover-export-and-non-growing-edits-allowed",
    overBudgetGrowth: "reject-before-write-with-last-valid-state-preserved",
    reduction: "explicit-reduction-is-allowed",
  },
} as const;

/**
 * CHG-91 deliberately keeps the complete v2 envelope intact. This is a
 * contract for the migration seam, not a claim about user capacity.
 */
export const STORAGE_LAYOUT_CONTRACT = {
  repositoryVersion: 1,
  envelopeSchemaVersion: 2,
  currentLayout: "single-v2-envelope",
  bootstrap: {
    includes: WORKSPACE_COLLECTIONS,
    excludes: [],
  },
  migrations: [{ from: 1, to: 2, id: "legacy-v1-to-envelope-v2", preservesSource: true, atomicCurrentWrite: true }],
  storageBudget: {
    contractId: WORKSPACE_STORAGE_BUDGET_CONTRACT.id,
    version: WORKSPACE_STORAGE_BUDGET_CONTRACT.version,
    representativeFixtureBytes: WORKSPACE_STORAGE_BUDGET_CONTRACT.representativeFixture.bulkHistoryBytes,
    engineeringHeadroomMultiplier: WORKSPACE_STORAGE_BUDGET_CONTRACT.engineeringHeadroom.multiplier,
    hardBudgetBytes: WORKSPACE_STORAGE_BUDGET_CONTRACT.hardBudgetBytes,
    guardedCollections: BULK_HISTORY_COLLECTIONS,
  },
} as const;

/** No collection is silently truncated, evicted, or removed from exports. */
const retentionEntries = Object.fromEntries(
  WORKSPACE_COLLECTIONS.map(collection => {
    const budgeted = (BULK_HISTORY_COLLECTIONS as readonly string[]).includes(collection);
    return [collection, {
      bootstrap: "included" as const,
      export: "full" as const,
      retention: budgeted ? "full-until-workspace-storage-budget" as const : "full-until-explicit-reduction" as const,
      storageBudgetVersion: budgeted ? WORKSPACE_STORAGE_BUDGET_CONTRACT.version : null,
    }];
  }),
) as Record<WorkspaceCollection, {
  bootstrap: "included";
  export: "full";
  retention: "full-until-workspace-storage-budget" | "full-until-explicit-reduction";
  storageBudgetVersion: number | null;
}>;

export const RETENTION_CONTRACT = {
  ...retentionEntries,
  contractVersion: 2,
  noSilentDataLoss: true,
  storageBudgetContractId: WORKSPACE_STORAGE_BUDGET_CONTRACT.id,
} as typeof retentionEntries & {
  contractVersion: 2;
  noSilentDataLoss: true;
  storageBudgetContractId: typeof WORKSPACE_STORAGE_BUDGET_CONTRACT.id;
};
