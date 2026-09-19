import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runRecoveryDrill } from "../server/worker/recovery";

const main = async () => {
  const outputArg = process.argv.find((value, index) => value === "--output" && process.argv[index + 1]) ? process.argv[process.argv.indexOf("--output") + 1] : ".local/chg-96-recovery-result.json";
  const result = await runRecoveryDrill();
  const raw = JSON.stringify(result, null, 2);
  mkdirSync(dirname(resolve(outputArg)), { recursive: true, mode: 0o700 });
  writeFileSync(resolve(outputArg), `${raw}\n`, { mode: 0o600 });
  console.log(raw);
  if (result.failureClassification.some(value => value !== "none")) process.exitCode = 1;
};
main().catch(error => { console.error(error instanceof Error ? error.message : "Recovery drill failed"); process.exitCode = 1; });
