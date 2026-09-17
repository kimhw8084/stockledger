import { createRepresentativeWorkspaceFixture } from "../src/data/representativeWorkspaceFixture";
import { profileWorkspace } from "../src/data/workspaceFootprint";
import { RETENTION_CONTRACT, STORAGE_LAYOUT_CONTRACT } from "../src/data/workspaceContract";

const profile = profileWorkspace(createRepresentativeWorkspaceFixture());
console.log(JSON.stringify({
  contract: STORAGE_LAYOUT_CONTRACT,
  retention: RETENTION_CONTRACT,
  fixture: {
    deterministic: true,
    purpose: "representative measurement only; not a real-user capacity estimate",
  },
  serializedWorkspaceBytes: profile.serializedWorkspaceBytes,
  bootstrapSerializedBytes: profile.bootstrapSerializedBytes,
  domains: profile.domains,
  dominantDomains: profile.dominantDomains.slice(0, 7),
}, null, 2));
