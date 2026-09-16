import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const walk = path => readdirSync(path).flatMap(name => { const next = join(path, name); return statSync(next).isDirectory() ? walk(next) : [next]; });
const errors = [];
const allowed = new Set(["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "EXPO_PUBLIC_STOCKLEDGER_API_URL"]);
for (const file of ["App.tsx", ...walk("src")].filter(path => /\.[cm]?[jt]sx?$/.test(path))) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g)) if (!allowed.has(match[1])) errors.push(`${file}: unapproved client environment variable ${match[1]}`);
  if (/\b(?:eval\s*\(|new\s+Function\s*\()/.test(source)) errors.push(`${file}: runtime JavaScript execution`);
  if (/from\s+["'][^"']*(?:server\/|node:)/.test(source)) errors.push(`${file}: server-only import in client tree`);
}
if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; }
else console.log("Client secret boundary, runtime parser, and server imports checked.");
