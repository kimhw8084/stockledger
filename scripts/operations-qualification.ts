import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runOperationsQualification } from "../server/worker/qualification";

const main = async () => {
  const index = process.argv.indexOf("--output");
  const output = resolve(index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : ".local/chg-96-operations-qualification.json");
  const result = await runOperationsQualification();
  const raw = JSON.stringify(result, null, 2);
  mkdirSync(dirname(output), { recursive: true, mode: 0o700 });
  writeFileSync(output, `${raw}\n`, { mode: 0o600 });
  console.log(raw);
  if (!result.dailyWorkload.withinBudget || !result.restore.withinBudget || !result.backlogAndRetrySurge.attemptBudgetPreserved) process.exitCode = 1;
};
main().catch(error => { console.error(error instanceof Error ? error.message : "Operations qualification failed"); process.exitCode = 1; });
