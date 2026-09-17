import { serializeExport } from "../domain/backupFormat";
import type { AppData } from "../types";
import { BULK_HISTORY_COLLECTIONS, WORKSPACE_COLLECTIONS, WORKSPACE_STORAGE_BUDGET_CONTRACT, type WorkspaceCollection } from "./workspaceContract";

export type WorkspaceDomainFootprint = {
  domain: WorkspaceCollection;
  records: number;
  serializedBytes: number;
  budgeted: boolean;
};

export type WorkspaceBudgetStatus = {
  contractVersion: typeof WORKSPACE_STORAGE_BUDGET_CONTRACT.version;
  currentBytes: number;
  budgetBytes: number;
  remainingBytes: number;
  utilization: number;
  overBudget: boolean;
  domains: WorkspaceDomainFootprint[];
};

export type WorkspaceFootprint = {
  serializedWorkspaceBytes: number;
  bootstrapSerializedBytes: number;
  bulkHistoryBytes: number;
  budget: WorkspaceBudgetStatus;
  domains: WorkspaceDomainFootprint[];
  dominantDomains: WorkspaceDomainFootprint[];
};

const utf8Bytes = (value: string) => new TextEncoder().encode(value).byteLength;

/** Profiles complete-envelope storage and the guarded historical footprint. */
export const profileWorkspace = (data: AppData, now = new Date("2026-09-17T00:00:00.000Z")): WorkspaceFootprint => {
  const domains = WORKSPACE_COLLECTIONS.map(domain => {
    const value = data[domain] ?? [];
    return {
      domain,
      records: Array.isArray(value) ? value.length : 1,
      serializedBytes: utf8Bytes(JSON.stringify(value)),
      budgeted: (BULK_HISTORY_COLLECTIONS as readonly string[]).includes(domain),
    };
  });
  const serializedWorkspaceBytes = utf8Bytes(serializeExport(data, 0, now));
  const dominantDomains = [...domains].sort((left, right) => right.serializedBytes - left.serializedBytes || left.domain.localeCompare(right.domain));
  const budgetedDomains = domains.filter(domain => domain.budgeted);
  const currentBytes = budgetedDomains.reduce((total, domain) => total + domain.serializedBytes, 0);
  const budgetBytes = WORKSPACE_STORAGE_BUDGET_CONTRACT.hardBudgetBytes;
  const budget: WorkspaceBudgetStatus = {
    contractVersion: WORKSPACE_STORAGE_BUDGET_CONTRACT.version,
    currentBytes,
    budgetBytes,
    remainingBytes: budgetBytes - currentBytes,
    utilization: currentBytes / budgetBytes,
    overBudget: currentBytes > budgetBytes,
    domains: budgetedDomains,
  };
  return { serializedWorkspaceBytes, bootstrapSerializedBytes: serializedWorkspaceBytes, bulkHistoryBytes: currentBytes, budget, domains, dominantDomains };
};
