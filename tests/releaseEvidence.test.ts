import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { buildReleaseEvidence, computeReleaseEvidenceHash, finalizeReleaseVerification, verifyReleaseEvidence, type ReleaseEvidence } from "../src/operations/releaseEvidence";

const facts = {
  appVersion: "0.2.0", nodeRequirement: ">=22.23.2", nodeRuntime: "v22.23.2", baseCommit: "e".repeat(40), sourceCommit: "a".repeat(40), sourceTree: "b".repeat(40), baseCommitIsAncestor: true,
  migrations: [{ path: "supabase/migrations/1.sql", sha256: "c".repeat(64), order: 0 }], packageLockSha256: "d".repeat(64), artifacts: [],
};

const rehash = (evidence: ReleaseEvidence): ReleaseEvidence => {
  const { evidenceHash: _ignored, ...withoutHash } = evidence;
  return { ...withoutHash, evidenceHash: computeReleaseEvidenceHash(withoutHash) };
};

it("binds release evidence to source, schema, contracts, migrations and lockfile", () => {
  const evidence = buildReleaseEvidence({ ...facts, baseCommit: "e".repeat(40), artifacts: [] });
  expect(verifyReleaseEvidence(evidence, facts)).toEqual({ ok: true, reasons: [] });
  expect(verifyReleaseEvidence({ ...evidence, source: { ...evidence.source, commit: "f".repeat(40) } }, facts).ok).toBe(false);
  expect(verifyReleaseEvidence({ ...evidence, migrations: { ...evidence.migrations, files: [{ ...evidence.migrations.files[0], sha256: "0".repeat(64) }] } }, facts).reasons).toContain("evidence-hash-mismatch");
});

it("rejects stale, unrelated and non-ancestor protected bases", () => {
  const evidence = buildReleaseEvidence({ ...facts, baseCommit: "e".repeat(40), artifacts: [] });
  expect(verifyReleaseEvidence(evidence, { ...facts, baseCommit: "f".repeat(40), baseCommitIsAncestor: true }).reasons).toContain("protected-base-mismatch");
  expect(verifyReleaseEvidence(evidence, { ...facts, baseCommitIsAncestor: false }).reasons).toContain("protected-base-not-ancestor");
});

it("rejects migration, lockfile, contract and artifact mismatches even after re-hashing", () => {
  const evidence = buildReleaseEvidence({ ...facts, baseCommit: "e".repeat(40), artifacts: [] });
  const migrationTampered = rehash({ ...evidence, migrations: { ...evidence.migrations, files: [{ ...evidence.migrations.files[0], sha256: "0".repeat(64) }] } });
  const lockTampered = rehash({ ...evidence, packageLock: { sha256: "0".repeat(64) } });
  const contractTampered = rehash({ ...evidence, versions: { ...evidence.versions, notification: { ...evidence.versions.notification, digestRevision: evidence.versions.notification.digestRevision + 1 } } });
  const artifactTampered = rehash({ ...evidence, artifacts: { generated: true, files: [{ path: "bundle.js", sha256: "0".repeat(64), bytes: 1 }] } });
  expect(verifyReleaseEvidence(migrationTampered, facts).reasons).toContain("migration-order-or-digest-mismatch");
  expect(verifyReleaseEvidence(lockTampered, facts).reasons).toContain("package-lock-mismatch");
  expect(verifyReleaseEvidence(contractTampered, facts).reasons).toContain("contract-snapshot-mismatch");
  expect(verifyReleaseEvidence(artifactTampered, facts).reasons).toContain("artifact-digest-mismatch");
});

it("rejects tampered hashes and re-hashed unsafe rollback semantics", () => {
  const evidence = buildReleaseEvidence({ ...facts, baseCommit: "e".repeat(40), artifacts: [] });
  expect(verifyReleaseEvidence({ ...evidence, evidenceHash: "0".repeat(64) }, facts).reasons).toContain("evidence-hash-mismatch");
  const unsafeVariants = [
    { ...evidence.rollback, safeRollback: [...evidence.rollback.safeRollback, "destructive-downgrade"] },
    { ...evidence.rollback, forwardMigrationRequired: [] },
    { ...evidence.rollback, incompatibleAssertions: evidence.rollback.incompatibleAssertions.slice(0, 1) },
    { ...evidence.rollback, incompatibleAssertions: [...evidence.rollback.incompatibleAssertions, "allow-unsupported-rollback"] },
  ];
  for (const rollback of unsafeVariants) {
    const tampered = rehash({ ...evidence, rollback });
    const result = verifyReleaseEvidence(tampered, facts);
    expect(result.ok).toBe(false);
    expect(result.reasons).toContain("rollback-semantics-mismatch");
    expect(result.reasons).not.toContain("evidence-hash-mismatch");
  }
});

it("makes dirty-source verification terminal", () => {
  expect(finalizeReleaseVerification({ ok: true, reasons: [] }, true)).toEqual({ verified: false, reasons: ["dirty-source-tree"] });
  expect(finalizeReleaseVerification({ ok: false, reasons: ["package-lock-mismatch"] }, true)).toEqual({ verified: false, reasons: ["dirty-source-tree", "package-lock-mismatch"] });
});

it("enforces the release workflow's first-party action pins", () => {
  expect(() => execFileSync("node", ["scripts/check-release-workflow.mjs"], { encoding: "utf8" })).not.toThrow();
  const workflow = readFileSync(".github/workflows/check.yml", "utf8");
  const refs = [...workflow.matchAll(/^\s*-\s*uses:\s*(actions\/[^\s#]+)\s*(?:#.*)?$/gm)].map(match => match[1]);
  expect(refs.every(ref => /^[^@]+@[a-f0-9]{40}$/.test(ref))).toBe(true);
});
