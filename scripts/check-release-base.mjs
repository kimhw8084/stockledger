import { execFileSync } from "node:child_process";

const base = process.env.STOCKLEDGER_PROTECTED_BASE?.trim() ?? "";
if (!/^[a-f0-9]{40}$/i.test(base)) throw new Error("STOCKLEDGER_PROTECTED_BASE must be an exact 40-hex commit SHA.");

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
let resolved;
try {
  resolved = git("rev-parse", "--verify", `${base}^{commit}`);
} catch {
  throw new Error("STOCKLEDGER_PROTECTED_BASE must resolve to a commit in the checkout.");
}
if (resolved.toLowerCase() !== base.toLowerCase()) throw new Error("STOCKLEDGER_PROTECTED_BASE did not resolve to the requested commit.");

try {
  execFileSync("git", ["merge-base", "--is-ancestor", base, "HEAD"], { stdio: "ignore" });
} catch {
  throw new Error("STOCKLEDGER_PROTECTED_BASE must be an ancestor of the checked source.");
}

console.log(JSON.stringify({ protectedBase: base, sourceCommit: git("rev-parse", "HEAD"), baseCommitIsAncestor: true }));
