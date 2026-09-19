import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  isExactCommitSha,
  verifyReleaseEvidence,
  type ReleaseArtifactIdentity,
  type ReleaseMigrationIdentity,
  type ReleaseVerificationFacts,
} from "../../src/operations/releaseEvidence";

type PackageManifest = { version: string; engines?: { node?: string } };

const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();

const artifactFiles = (root: string): ReleaseArtifactIdentity[] => {
  const paths: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory).sort()) {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) visit(path);
      else paths.push(path);
    }
  };
  visit(root);
  return paths.map(path => ({ path: path.slice(resolve(root).length + 1), sha256: sha256(path), bytes: statSync(path).size }));
};

export const readReleasePackage = (): PackageManifest => JSON.parse(readFileSync(resolve("package.json"), "utf8")) as PackageManifest;

export const readReleaseMigrations = (): ReleaseMigrationIdentity[] => readdirSync(resolve("supabase/migrations"))
  .filter(file => file.endsWith(".sql"))
  .sort()
  .map((file, order) => ({ path: `supabase/migrations/${file}`, sha256: sha256(resolve("supabase/migrations", file)), order }));

export function resolveProtectedBase(explicit?: string): string {
  const argumentBase = explicit?.trim() || "";
  const environmentBase = process.env.STOCKLEDGER_PROTECTED_BASE?.trim() || "";
  if (argumentBase && environmentBase && argumentBase !== environmentBase) throw new Error("--base does not match STOCKLEDGER_PROTECTED_BASE.");
  const base = argumentBase || environmentBase;
  if (!base) throw new Error("Release proof requires an explicit --base or STOCKLEDGER_PROTECTED_BASE; no historical default is available.");
  if (!isExactCommitSha(base)) throw new Error("Protected release base must be an exact 40-hex commit SHA.");
  return base;
}

export function gitCommitExists(commit: string): boolean {
  if (!isExactCommitSha(commit)) return false;
  try {
    return git("rev-parse", "--verify", `${commit}^{commit}`).toLowerCase() === commit.toLowerCase();
  } catch {
    return false;
  }
}

export function isAncestorCommit(baseCommit: string, sourceCommit: string): boolean {
  if (!gitCommitExists(baseCommit) || !gitCommitExists(sourceCommit)) return false;
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", baseCommit, sourceCommit], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function collectReleaseVerificationFacts(baseCommit: string, options: { sourceCommit?: string; sourceTree?: string; artifactsRoot?: string } = {}): ReleaseVerificationFacts {
  const packageJson = readReleasePackage();
  const sourceCommit = options.sourceCommit ?? git("rev-parse", "HEAD");
  const sourceTree = options.sourceTree ?? git("rev-parse", "HEAD^{tree}");
  const artifactsRoot = options.artifactsRoot ? resolve(options.artifactsRoot) : undefined;
  const artifacts = artifactsRoot && existsSync(artifactsRoot) ? artifactFiles(artifactsRoot) : [];
  return {
    appVersion: packageJson.version,
    nodeRequirement: packageJson.engines?.node ?? "unknown",
    nodeRuntime: process.version,
    baseCommit,
    sourceCommit,
    sourceTree,
    baseCommitIsAncestor: isAncestorCommit(baseCommit, sourceCommit),
    migrations: readReleaseMigrations(),
    packageLockSha256: sha256(resolve("package-lock.json")),
    artifacts,
  };
}

export function establishCurrentSourceIdentity(): { commit: string; tree: string; dirty: boolean } | null {
  const environmentCommit = process.env.STOCKLEDGER_SOURCE_COMMIT?.trim() || process.env.GITHUB_SHA?.trim() || "";
  const environmentTree = process.env.STOCKLEDGER_SOURCE_TREE?.trim() || "";
  if (environmentCommit || environmentTree) {
    if (isExactCommitSha(environmentCommit) && isExactCommitSha(environmentTree)) return { commit: environmentCommit, tree: environmentTree, dirty: false };
  }
  try {
    return { commit: git("rev-parse", "HEAD"), tree: git("rev-parse", "HEAD^{tree}"), dirty: Boolean(git("status", "--porcelain")) };
  } catch {
    return null;
  }
}

export interface RuntimeReleaseIdentity {
  state: "known" | "unavailable" | "mismatched";
  reason: "release_identity_verified" | "release_identity_unavailable" | "release_identity_mismatched";
  sourceCommit: string | null;
  sourceTree: string | null;
}

export function verifyRuntimeReleaseEvidence(evidence: unknown, explicitBase?: string): RuntimeReleaseIdentity {
  const current = establishCurrentSourceIdentity();
  if (!current) return { state: "unavailable", reason: "release_identity_unavailable", sourceCommit: null, sourceTree: null };
  let base: string;
  try {
    base = resolveProtectedBase(explicitBase);
  } catch {
    return { state: "unavailable", reason: "release_identity_unavailable", sourceCommit: current.commit, sourceTree: current.tree };
  }
  if (current.dirty) return { state: "mismatched", reason: "release_identity_mismatched", sourceCommit: current.commit, sourceTree: current.tree };
  const facts = collectReleaseVerificationFacts(base, { sourceCommit: current.commit, sourceTree: current.tree });
  const result = verifyReleaseEvidence(evidence, facts);
  return result.ok
    ? { state: "known", reason: "release_identity_verified", sourceCommit: current.commit, sourceTree: current.tree }
    : { state: "mismatched", reason: "release_identity_mismatched", sourceCommit: current.commit, sourceTree: current.tree };
}
