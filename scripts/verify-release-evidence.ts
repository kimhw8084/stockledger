import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { finalizeReleaseVerification, verifyReleaseEvidence } from "../src/operations/releaseEvidence";
import { collectReleaseVerificationFacts, resolveProtectedBase } from "../server/worker/releaseEvidenceRuntime";

const arg = (name: string, fallback?: string) => { const index = process.argv.indexOf(name); return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback; };
const artifactRoot = arg("--artifacts");
const input = resolve(arg("--input", "artifacts/release-evidence.json")!);
const evidence = JSON.parse(readFileSync(input, "utf8")) as unknown;
const facts = collectReleaseVerificationFacts(resolveProtectedBase(arg("--base")), { artifactsRoot: artifactRoot });
const result = verifyReleaseEvidence(evidence, facts);
const finalized = finalizeReleaseVerification(result, Boolean(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()));
console.log(JSON.stringify(finalized, null, 2));
if (!finalized.verified) process.exitCode = 1;
