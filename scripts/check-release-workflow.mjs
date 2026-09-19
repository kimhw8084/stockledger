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

for (const value of refs) {
  const separator = value.lastIndexOf("@");
  const action = separator > 0 ? value.slice(0, separator) : value;
  const ref = separator > 0 ? value.slice(separator + 1) : "";
  if (!action.startsWith("actions/")) continue;
  if (!/^[a-f0-9]{40}$/.test(ref)) throw new Error(`First-party action ${action} must use an exact 40-hex commit SHA.`);
  const expected = expectedPins.get(action);
  if (expected && ref !== expected) throw new Error(`Known-good pin changed for ${action}.`);
}

console.log(JSON.stringify({ workflow: workflowPath, firstPartyActionRefs: refs.filter(ref => ref.startsWith("actions/")), valid: true }));
