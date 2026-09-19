import { readFileSync } from "node:fs";

const workflowPath = ".github/workflows/check.yml";
const workflow = readFileSync(workflowPath, "utf8");
const expectedPins = new Map([
  ["actions/checkout", "d23441a48e516b6c34aea4fa41551a30e30af803"],
  ["actions/setup-node", "249970729cb0ef3589644e2896645e5dc5ba9c38"],
  ["actions/upload-artifact", "b7c566a772e6b6bfb58ed0dc250532a479d7789f"],
]);
const refs = [...workflow.matchAll(/^\s*-\s*uses:\s*([^\s#]+)\s*(?:#.*)?$/gm)].map(match => match[1]);
if (!refs.length) throw new Error(`No action references found in ${workflowPath}.`);

const operationsStart = workflow.indexOf("\n  operations:\n");
if (operationsStart < 0) throw new Error("Operations job is missing from the release workflow.");
const operationsWorkflow = workflow.slice(operationsStart);
const operationsCheckout = operationsWorkflow.match(/^\s*-\s*uses:\s*actions\/checkout@[a-f0-9]{40}[^\n]*\n\s+with:\n\s+fetch-depth:\s*0\s*$/m);
if (!operationsCheckout) throw new Error("Operations checkout must use fetch-depth: 0 for protected-base ancestry verification.");
const baseCheck = operationsWorkflow.indexOf("npm run check:release-base");
const evidenceGeneration = operationsWorkflow.indexOf("npm run release:evidence");
if (baseCheck < 0 || evidenceGeneration < 0 || baseCheck > evidenceGeneration) throw new Error("Operations must verify protected-base resolution and ancestry before release:evidence.");

for (const value of refs) {
  const separator = value.lastIndexOf("@");
  const action = separator > 0 ? value.slice(0, separator) : value;
  const ref = separator > 0 ? value.slice(separator + 1) : "";
  if (!action.startsWith("actions/")) continue;
  if (!/^[a-f0-9]{40}$/.test(ref)) throw new Error(`First-party action ${action} must use an exact 40-hex commit SHA.`);
  const expected = expectedPins.get(action);
  if (expected && ref !== expected) throw new Error(`Known-good pin changed for ${action}.`);
}

console.log(JSON.stringify({ workflow: workflowPath, firstPartyActionRefs: refs.filter(ref => ref.startsWith("actions/")), operationsCheckout: "fetch-depth: 0", protectedBaseCheck: "before release:evidence", valid: true }));
