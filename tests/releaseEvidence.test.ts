import { expect, it } from "vitest";
import { buildReleaseEvidence, verifyReleaseEvidence } from "../src/operations/releaseEvidence";

const facts = {
  appVersion: "0.2.0", nodeRequirement: ">=22.23.2", baseCommit: "e".repeat(40), sourceCommit: "a".repeat(40), sourceTree: "b".repeat(40),
  migrations: [{ path: "supabase/migrations/1.sql", sha256: "c".repeat(64), order: 0 }], packageLockSha256: "d".repeat(64), artifacts: [], nodeRuntime: "v22.23.2",
};

it("binds release evidence to source, schema, contracts, migrations and lockfile", () => {
  const evidence = buildReleaseEvidence({ ...facts, baseCommit: "e".repeat(40), artifacts: [] });
  expect(verifyReleaseEvidence(evidence, facts)).toEqual({ ok: true, reasons: [] });
  expect(verifyReleaseEvidence({ ...evidence, source: { ...evidence.source, commit: "f".repeat(40) } }, facts).ok).toBe(false);
  expect(verifyReleaseEvidence({ ...evidence, migrations: { ...evidence.migrations, files: [{ ...evidence.migrations.files[0], sha256: "0".repeat(64) }] } }, facts).reasons).toContain("evidence-hash-mismatch");
});

it("fails closed on destructive or incompatible rollback assertions", () => {
  const evidence = buildReleaseEvidence({ ...facts, baseCommit: "e".repeat(40), artifacts: [] });
  const tampered = { ...evidence, rollback: { ...evidence.rollback, policy: "destructive-downgrade" as "additive-forward-only" } };
  expect(verifyReleaseEvidence(tampered, facts).ok).toBe(false);
  expect(verifyReleaseEvidence(tampered, facts).reasons).toContain("evidence-hash-mismatch");
});
