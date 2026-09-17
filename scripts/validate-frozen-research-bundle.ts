import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateFrozenResearchBundle } from "../src/lib/frozenScannerRules";

const bundlePath = resolve(process.cwd(), "docs/v12_3_app_import_bundle.json");
const result = validateFrozenResearchBundle(JSON.parse(readFileSync(bundlePath, "utf8")));

if (!result.valid) {
  throw new Error(`Frozen research bundle structural parity failed:\n${result.errors.join("\n")}`);
}

console.log(JSON.stringify({
  bundle: bundlePath,
  status: result.status,
  releaseBlocked: result.releaseBlocked,
  checkedRuleCount: result.checkedRuleCount,
  limitations: result.limitations,
}, null, 2));
