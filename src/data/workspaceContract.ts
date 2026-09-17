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
} as const;

/** No collection is silently truncated, evicted, or removed from exports. */
export const RETENTION_CONTRACT = Object.fromEntries(
  WORKSPACE_COLLECTIONS.map(collection => [collection, { bootstrap: "included", export: "full", retention: "retain-until-explicit-follow-up" }]),
) as Record<WorkspaceCollection, { bootstrap: "included"; export: "full"; retention: "retain-until-explicit-follow-up" }>;
