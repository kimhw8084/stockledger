import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { buildReleaseEvidence } from "../src/operations/releaseEvidence";
import { collectReleaseVerificationFacts, gitCommitExists, isAncestorCommit, readReleaseMigrations, resolveProtectedBase } from "../server/worker/releaseEvidenceRuntime";

const arg = (name: string, fallback?: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};
const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();
const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as { version: string; engines?: { node?: string } };
const artifactRoot = arg("--artifacts");
const facts = collectReleaseVerificationFacts(resolveProtectedBase(arg("--base")), { artifactsRoot: artifactRoot });
const allowDirty = process.argv.includes("--allow-dirty");
const status = git("status", "--porcelain");
if (status && !allowDirty) throw new Error("Release evidence requires a clean source tree. Use --allow-dirty only for local inspection, not release proof.");
const output = resolve(arg("--output", "artifacts/release-evidence.json")!);
if (!gitCommitExists(facts.baseCommit) || !isAncestorCommit(facts.baseCommit, facts.sourceCommit)) throw new Error("Protected release base must be an existing ancestor of the candidate source commit.");
const evidence = buildReleaseEvidence({
  appVersion: packageJson.version,
  nodeRequirement: packageJson.engines?.node ?? "unknown",
  nodeRuntime: process.version,
  baseCommit: facts.baseCommit,
  sourceCommit: facts.sourceCommit,
  sourceTree: facts.sourceTree,
  migrations: readReleaseMigrations(),
  packageLockSha256: sha256(resolve("package-lock.json")),
  artifacts: artifactRoot && existsSync(resolve(artifactRoot)) ? facts.artifacts : [],
});
mkdirSync(dirname(output), { recursive: true, mode: 0o700 });
writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ generated: true, contractVersion: evidence.contractVersion, revision: evidence.revision, sourceCommit: evidence.source.commit, sourceTree: evidence.source.tree, output }, null, 2));
