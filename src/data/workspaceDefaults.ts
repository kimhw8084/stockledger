import { createId } from "../platform/identity";
import { seedData } from "../lib/seed";
import type { AppData } from "../types";

export const createEmptyAppData = (): AppData => ({
  workspaceId: createId("workspace"),
  stocks: [], recipes: [], customMetrics: [], logicRules: [], logicSets: [], eyes: [], alerts: [], decisions: [], outcomes: [], snapshots: [], rawBarArchives: [], universeSnapshots: [], processedFeatures: [], scanRuns: [], scanSignals: [], reviewLogs: [], forwardProofLedger: [],
  scannerSettings: { universeMode: "frozen_research_universe", fallbackToFrozenUniverse: false, providerDelayMinutesAfterClose: 45, notifyNearMatches: false },
});

export const createDemoAppData = (): AppData => ({ ...JSON.parse(JSON.stringify(seedData)) as AppData, workspaceId: createId("demo") });
