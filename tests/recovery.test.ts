import { expect, it } from "vitest";
import { runRecoveryDrill } from "../server/worker/recovery";

it("preserves authored and durable state and rejects damaged/incompatible candidates", async () => {
  const result = await runRecoveryDrill();
  expect(result.synthetic).toBe(true);
  expect(result.source.integrity).toBe(true);
  expect(result.restored.integrity).toBe(true);
  expect(result.restored.exportParsed).toBe(true);
  expect(Object.values(result.retainedStateChecks).every(Boolean)).toBe(true);
  expect(result.rejectedCandidates.corrupted.rejected).toBe(true);
  expect(result.rejectedCandidates.incompatible.rejected).toBe(true);
  expect(result.rpo.committedRevisionLossAtConsistentSnapshot).toBe(0);
  expect(result.rpo.lossSinceLastOperatorBackup).toBe("unknown-unbounded-without-configured-cadence");
  expect(result.rto.evidenceOnly).toBe(true);
  expect(result.failureClassification).toEqual(["none"]);
});
