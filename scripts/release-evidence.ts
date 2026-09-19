import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { buildReleaseEvidence, type ReleaseArtifactIdentity, type ReleaseMigrationIdentity } from "../src/operations/releaseEvidence";

const arg = (name: string, fallback?: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};
const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();
const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as { version: string; engines?: { node?: string } };
const migrations: ReleaseMigrationIdentity[] = readdirSync(resolve("supabase/migrations")).filter(file => file.endsWith(".sql")).sort().map((file, order) => ({ path: `supabase/migrations/${file}`, sha256: sha256(resolve("supabase/migrations", file)), order }));
const artifactRoot = arg("--artifacts");
const artifactFiles = (root: string): ReleaseArtifactIdentity[] => {
  const paths: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory).sort()) {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) visit(path); else paths.push(path);
    }
  };
  visit(root);
  return paths.map(path => ({ path: path.slice(resolve(root).length + 1), sha256: sha256(path), bytes: statSync(path).size }));
};
const allowDirty = process.argv.includes("--allow-dirty");
const status = git("status", "--porcelain");
if (status && !allowDirty) throw new Error("Release evidence requires a clean source tree. Use --allow-dirty only for local inspection, not release proof.");
const output = resolve(arg("--output", "artifacts/release-evidence.json")!);
const evidence = buildReleaseEvidence({
  appVersion: packageJson.version,
  nodeRequirement: packageJson.engines?.node ?? "unknown",
  nodeRuntime: process.version,
  baseCommit: arg("--base", process.env.STOCKLEDGER_PROTECTED_BASE ?? "62c21af2f781b3ff53505f4582d86e24fead528d")!,
  sourceCommit: git("rev-parse", "HEAD"),
  sourceTree: git("rev-parse", "HEAD^{tree}"),
  migrations,
  packageLockSha256: sha256(resolve("package-lock.json")),
  artifacts: artifactRoot && existsSync(resolve(artifactRoot)) ? artifactFiles(resolve(artifactRoot)) : [],
});
mkdirSync(dirname(output), { recursive: true, mode: 0o700 });
writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ generated: true, contractVersion: evidence.contractVersion, revision: evidence.revision, sourceCommit: evidence.source.commit, sourceTree: evidence.source.tree, output }, null, 2));
