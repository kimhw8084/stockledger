import { serializeExport } from "../domain/backupFormat";
import type { AppData } from "../types";
import { WORKSPACE_COLLECTIONS, type WorkspaceCollection } from "./workspaceContract";

export type WorkspaceDomainFootprint = {
  domain: WorkspaceCollection;
  records: number;
  serializedBytes: number;
};

export type WorkspaceFootprint = {
  serializedWorkspaceBytes: number;
  bootstrapSerializedBytes: number;
  domains: WorkspaceDomainFootprint[];
  dominantDomains: WorkspaceDomainFootprint[];
};

const utf8Bytes = (value: string) => new TextEncoder().encode(value).byteLength;

/** Profiles the current complete-envelope bootstrap; it does not estimate capacity. */
export const profileWorkspace = (data: AppData, now = new Date("2026-09-17T00:00:00.000Z")): WorkspaceFootprint => {
  const domains = WORKSPACE_COLLECTIONS.map(domain => {
    const value = data[domain] ?? [];
    return { domain, records: Array.isArray(value) ? value.length : 1, serializedBytes: utf8Bytes(JSON.stringify(value)) };
  });
  const serializedWorkspaceBytes = utf8Bytes(serializeExport(data, 0, now));
  const dominantDomains = [...domains].sort((left, right) => right.serializedBytes - left.serializedBytes || left.domain.localeCompare(right.domain));
  return { serializedWorkspaceBytes, bootstrapSerializedBytes: serializedWorkspaceBytes, domains, dominantDomains };
};
