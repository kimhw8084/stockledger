import { beforeEach, expect, it, vi } from "vitest";
import { parseExport, serializeExport } from "../src/domain/backupFormat";
import { createWorkspaceApplicationService } from "../src/application/workspaceApplicationService";
import { createRepresentativeWorkspaceFixture } from "../src/data/representativeWorkspaceFixture";
import { profileWorkspace } from "../src/data/workspaceFootprint";
import { RETENTION_CONTRACT, STORAGE_LAYOUT_CONTRACT, WORKSPACE_STORAGE_BUDGET_CONTRACT } from "../src/data/workspaceContract";
import { createEmptyAppData } from "../src/data/workspaceDefaults";
import { createWorkspaceRepository, STORAGE_KEYS, WorkspaceStorageBudgetError, type WorkspaceRepository } from "../src/data/repositories/workspaceRepository";
import type { KeyValueStore } from "../src/platform/keyValueStore";
import type { AppData } from "../src/types";

vi.mock("@react-native-async-storage/async-storage", () => ({ default: {
  getItem: vi.fn(async () => null),
  setItem: vi.fn(async () => undefined),
  removeItem: vi.fn(async () => undefined),
} }));

const makeStore = () => {
  const values = new Map<string, string>();
  let failCompare = false;
  const store: KeyValueStore = {
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
    async removeItem(key) { values.delete(key); },
    async compareAndSetItem(key, expected, next, backupKey) {
      if (failCompare) throw new Error("interrupted write");
      if ((values.get(key) ?? null) !== expected) throw new Error("stale revision");
      if (expected !== null) values.set(backupKey, expected);
      values.set(key, next);
    },
  };
  return { store, values, interruptWrites: () => { failCompare = true; }, resumeWrites: () => { failCompare = false; } };
};

const savedData = (workspaceId: string): AppData => ({ ...createEmptyAppData(), workspaceId });
const repositoryFor = (store: KeyValueStore): WorkspaceRepository => createWorkspaceRepository(store);

const workspaceAtBulkHistoryBytes = (target: number): AppData => {
  const source = createRepresentativeWorkspaceFixture();
  const sourceBytes = profileWorkspace(source).budget.currentBytes;
  const originalReasonLength = source.reviewLogs[0]?.manualReason?.length ?? 0;
  const withReasonLength = (length: number): AppData => ({
    ...source,
    reviewLogs: source.reviewLogs.map((entry, index) => index === 0 ? { ...entry, manualReason: "x".repeat(length) } : entry),
  });
  const result = withReasonLength(originalReasonLength + target - sourceBytes);
  if (profileWorkspace(result).budget.currentBytes !== target) throw new Error(`Could not build exact test fixture at ${target} bytes.`);
  return result;
};

const exactBoundaryWorkspace = workspaceAtBulkHistoryBytes(WORKSPACE_STORAGE_BUDGET_CONTRACT.hardBudgetBytes);
const oversizedWorkspace = workspaceAtBulkHistoryBytes(WORKSPACE_STORAGE_BUDGET_CONTRACT.hardBudgetBytes + 1);

beforeEach(() => vi.clearAllMocks());

it("loads current v2 stores, older supported exports, and export-import round trips", async () => {
  const { store, values } = makeStore();
  const data = createRepresentativeWorkspaceFixture();
  values.set(STORAGE_KEYS.current, serializeExport(data, 7, new Date("2026-09-17T00:00:00.000Z")));
  expect(await repositoryFor(store).load()).toEqual(data);
  const olderExport = JSON.stringify(data);
  expect(parseExport(olderExport)).toEqual(data);

  const serviceState = { current: data };
  const service = createWorkspaceApplicationService({
    repository: repositoryFor(store),
    getCurrent: () => serviceState.current,
    publish: next => { serviceState.current = next; },
  });
  const exported = service.exportBackup();
  expect(parseExport(exported)).toEqual(data);
  await service.importBackup(exported);
  expect(serviceState.current.stocks).toEqual(data.stocks);
  expect(serviceState.current.rawBarArchives).toEqual(data.rawBarArchives);
  expect(serviceState.current.processedFeatures).toEqual(data.processedFeatures);
  expect(serviceState.current.forwardProofLedger).toEqual(data.forwardProofLedger);
  await service.importBackup(olderExport);
  expect(serviceState.current.scanSignals).toEqual(data.scanSignals);
});

it("promotes a legacy v1 payload without deleting the source and retries a partial migration", async () => {
  const { store, values, interruptWrites, resumeWrites } = makeStore();
  const data = savedData("legacy-workspace");
  const legacy = JSON.stringify(data);
  values.set(STORAGE_KEYS.legacy, legacy);
  interruptWrites();
  await expect(repositoryFor(store).load()).rejects.toThrow(/Legacy data needs recovery/);
  expect(values.get(STORAGE_KEYS.legacy)).toBe(legacy);
  expect(values.get(STORAGE_KEYS.current)).toBeUndefined();
  expect(values.get(STORAGE_KEYS.legacyBackup)).toBe(legacy);

  resumeWrites();
  const repository = repositoryFor(store);
  expect(await repository.load()).toEqual({ ...data, workspaceId: "legacy-workspace" });
  expect(values.get(STORAGE_KEYS.legacy)).toBe(legacy);
  expect(parseExport(values.get(STORAGE_KEYS.current)!)).toEqual(data);
});

it("keeps corrupt current bytes and restores the previous validated copy", async () => {
  const { store, values } = makeStore();
  const repository = repositoryFor(store);
  const first = savedData("first");
  const second = savedData("second");
  await repository.load();
  await repository.save(first);
  await repository.save(second);
  values.set(STORAGE_KEYS.current, "corrupt-v2");
  await repository.restorePreviousBackup();
  expect(parseExport(values.get(STORAGE_KEYS.current)!)).toEqual(first);
  expect(values.get(STORAGE_KEYS.current)).not.toBe("corrupt-v2");
  expect([...values.values()]).toContain("corrupt-v2");
});

it("serializes authored writes in order and rejects a stale repository revision", async () => {
  const { store, values } = makeStore();
  const repository = repositoryFor(store);
  await repository.load();
  const first = savedData("first");
  const second = savedData("second");
  await Promise.all([repository.save(first), repository.save(second)]);
  expect(parseExport(values.get(STORAGE_KEYS.current)!)).toEqual(second);
  expect((JSON.parse(values.get(STORAGE_KEYS.current)!) as { revision: number }).revision).toBe(2);
  expect(parseExport(values.get(STORAGE_KEYS.previous)!)).toEqual(first);

  const concurrentA = repositoryFor(store);
  const concurrentB = repositoryFor(store);
  await concurrentA.load();
  await concurrentB.load();
  const third = savedData("third");
  await concurrentA.save(third);
  await expect(concurrentB.save(savedData("stale"))).rejects.toThrow(/Another session saved changes/);
  expect(parseExport(values.get(STORAGE_KEYS.current)!)).toEqual(third);
});

it("allows below-budget growth and exact-boundary writes", async () => {
  const { store, values } = makeStore();
  const repository = repositoryFor(store);
  await repository.load();
  const fixture = createRepresentativeWorkspaceFixture();
  const grown = { ...fixture, reviewLogs: fixture.reviewLogs.map((entry, index) => index === 0 ? { ...entry, manualReason: `${entry.manualReason}x` } : entry) };
  expect(profileWorkspace(grown).budget.currentBytes).toBeGreaterThan(profileWorkspace(fixture).budget.currentBytes);
  expect(profileWorkspace(grown).budget.overBudget).toBe(false);
  await repository.save(grown);
  expect(parseExport(values.get(STORAGE_KEYS.current)!)).toEqual(grown);

  const exactRepository = repositoryFor(makeStore().store);
  await exactRepository.load();
  await exactRepository.save(exactBoundaryWorkspace);
  expect(profileWorkspace(exactBoundaryWorkspace).budget.currentBytes).toBe(WORKSPACE_STORAGE_BUDGET_CONTRACT.hardBudgetBytes);
  await expect(exactRepository.save(oversizedWorkspace)).rejects.toBeInstanceOf(WorkspaceStorageBudgetError);
});

it("rejects only attempted over-budget growth and preserves the last valid revision", async () => {
  const { store, values } = makeStore();
  const repository = repositoryFor(store);
  await repository.load();
  const fixture = createRepresentativeWorkspaceFixture();
  await repository.save(fixture);
  const before = values.get(STORAGE_KEYS.current);
  const failedWrite = repository.save(oversizedWorkspace);
  await expect(failedWrite).rejects.toBeInstanceOf(WorkspaceStorageBudgetError);
  try { await failedWrite; } catch (error) { expect((error as WorkspaceStorageBudgetError).code).toBe("WORKSPACE_STORAGE_BUDGET_EXCEEDED"); }
  expect(values.get(STORAGE_KEYS.current)).toBe(before);
  expect((JSON.parse(values.get(STORAGE_KEYS.current)!) as { revision: number }).revision).toBe(1);
  expect(values.get(STORAGE_KEYS.previous)).toBeUndefined();
});

it("loads, exports, recovers, and permits unrelated edits for an existing oversized workspace", async () => {
  const { store, values } = makeStore();
  const previous = workspaceAtBulkHistoryBytes(WORKSPACE_STORAGE_BUDGET_CONTRACT.hardBudgetBytes + 2);
  values.set(STORAGE_KEYS.current, serializeExport(oversizedWorkspace, 4, new Date("2026-09-17T00:00:00.000Z")));
  values.set(STORAGE_KEYS.previous, serializeExport(previous, 3, new Date("2026-09-17T00:00:00.000Z")));
  const repository = repositoryFor(store);
  const loaded = await repository.load();
  expect(loaded.rawBarArchives).toEqual(oversizedWorkspace.rawBarArchives);
  const service = createWorkspaceApplicationService({ repository, getCurrent: () => loaded, publish: () => undefined });
  expect(parseExport(service.exportBackup())).toEqual(oversizedWorkspace);

  await repository.restorePreviousBackup();
  expect(parseExport(values.get(STORAGE_KEYS.current)!)).toEqual(previous);
  expect(parseExport(values.get(STORAGE_KEYS.current)!).rawBarArchives).toEqual(previous.rawBarArchives);

  const unrelatedEdit = { ...previous, workspaceId: "oversized-edited" };
  await repository.save(unrelatedEdit);
  expect(parseExport(values.get(STORAGE_KEYS.current)!)).toEqual(unrelatedEdit);
  expect((JSON.parse(values.get(STORAGE_KEYS.current)!) as { revision: number }).revision).toBe(6);
});

it("allows an explicit reduction of an oversized guarded history", async () => {
  const { store, values } = makeStore();
  const repository = repositoryFor(store);
  values.set(STORAGE_KEYS.current, serializeExport(oversizedWorkspace, 4));
  const loaded = await repository.load();
  const reduced = { ...loaded, rawBarArchives: loaded.rawBarArchives.slice(0, 3) };
  expect(profileWorkspace(reduced).budget.currentBytes).toBeLessThan(profileWorkspace(loaded).budget.currentBytes);
  await repository.save(reduced);
  expect(parseExport(values.get(STORAGE_KEYS.current)!)).toEqual(reduced);
});

it("profiles a deterministic representative fixture without applying an implicit retention rule", () => {
  const fixture = createRepresentativeWorkspaceFixture();
  const first = profileWorkspace(fixture);
  const second = profileWorkspace(createRepresentativeWorkspaceFixture());
  expect(first).toEqual(second);
  expect(first.serializedWorkspaceBytes).toBeGreaterThan(0);
  expect(first.bootstrapSerializedBytes).toBe(first.serializedWorkspaceBytes);
  expect(first.budget.currentBytes).toBe(WORKSPACE_STORAGE_BUDGET_CONTRACT.representativeFixture.bulkHistoryBytes);
  expect(first.budget.budgetBytes).toBe(WORKSPACE_STORAGE_BUDGET_CONTRACT.hardBudgetBytes);
  expect(first.budget.remainingBytes).toBe(WORKSPACE_STORAGE_BUDGET_CONTRACT.hardBudgetBytes - first.budget.currentBytes);
  expect(first.budget.utilization).toBe(0.5);
  expect(first.budget.overBudget).toBe(false);
  expect(first.budget.domains.map(domain => domain.domain)).toEqual([...WORKSPACE_STORAGE_BUDGET_CONTRACT.guardedCollections]);
  expect(first.dominantDomains[0].domain).toBe("rawBarArchives");
  expect(STORAGE_LAYOUT_CONTRACT.currentLayout).toBe("single-v2-envelope");
  expect(STORAGE_LAYOUT_CONTRACT.storageBudget.version).toBe(WORKSPACE_STORAGE_BUDGET_CONTRACT.version);
  expect(STORAGE_LAYOUT_CONTRACT.storageBudget.hardBudgetBytes).toBe(WORKSPACE_STORAGE_BUDGET_CONTRACT.hardBudgetBytes);
  expect(RETENTION_CONTRACT.contractVersion).toBe(2);
  expect(RETENTION_CONTRACT.rawBarArchives).toEqual({ bootstrap: "included", export: "full", retention: "full-until-workspace-storage-budget", storageBudgetVersion: 1 });
});
