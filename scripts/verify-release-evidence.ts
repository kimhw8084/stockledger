import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { verifyReleaseEvidence, type ReleaseArtifactIdentity, type ReleaseMigrationIdentity } from "../src/operations/releaseEvidence";

const arg = (name: string, fallback?: string) => { const index = process.argv.indexOf(name); return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback; };
const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();
const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as { version: string; engines?: { node?: string } };
const migrations: ReleaseMigrationIdentity[] = readdirSync(resolve("supabase/migrations")).filter(file => file.endsWith(".sql")).sort().map((file, order) => ({ path: `supabase/migrations/${file}`, sha256: sha256(resolve("supabase/migrations", file)), order }));
const artifactRoot = arg("--artifacts");
const artifacts: ReleaseArtifactIdentity[] = [];
if (artifactRoot && existsSync(resolve(artifactRoot))) {
  const paths: string[] = [];
  const visit = (directory: string) => { for (const entry of readdirSync(directory).sort()) { const path = join(directory, entry); if (statSync(path).isDirectory()) visit(path); else paths.push(path); } };
  visit(resolve(artifactRoot));
  artifacts.push(...paths.map(path => ({ path: path.slice(resolve(artifactRoot).length + 1), sha256: sha256(path), bytes: statSync(path).size })));
}
const input = resolve(arg("--input", "artifacts/release-evidence.json")!);
const evidence = JSON.parse(readFileSync(input, "utf8"));
const result = verifyReleaseEvidence(evidence, { appVersion: packageJson.version, nodeRequirement: packageJson.engines?.node ?? "unknown", baseCommit: arg("--base", process.env.STOCKLEDGER_PROTECTED_BASE ?? "62c21af2f781b3ff53505f4582d86e24fead528d")!, sourceCommit: git("rev-parse", "HEAD"), sourceTree: git("rev-parse", "HEAD^{tree}"), migrations, packageLockSha256: sha256(resolve("package-lock.json")), artifacts });
if (git("status", "--porcelain")) result.reasons.push("dirty-source-tree");
if (result.reasons.length) result.reasons = [...new Set(result.reasons)].sort();
console.log(JSON.stringify({ verified: result.ok, reasons: result.reasons }, null, 2));
if (!result.ok) process.exitCode = 1;
