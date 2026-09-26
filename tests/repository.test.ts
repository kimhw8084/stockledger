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
    async compareAndSetItem(key, expected, next, backupKey, initialBackup) {
      if (failCompare) throw new Error("interrupted write");
      if ((values.get(key) ?? null) !== expected) throw new Error("stale revision");
      if (expected !== null) values.set(backupKey, expected);
      else if (initialBackup !== undefined && !values.has(backupKey)) values.set(backupKey, initialBackup);
      values.set(key, next);
    },
  };
  return { store, values, interruptWrites: () => { failCompare = true; }, resumeWrites: () => { failCompare = false; } };
};

const savedData = (workspaceId: string): AppData => ({ ...createEmptyAppData(), workspaceId });
const repositoryFor = (store: KeyValueStore): WorkspaceRepository => createWorkspaceRepository(store);
const expectEmptyRecoveryCopy = (raw: string) => {
  const recovered = parseExport(raw);
  expect(recovered.stocks).toEqual([]);
  expect(recovered.eyes).toEqual([]);
  expect(recovered.alerts).toEqual([]);
  expect(recovered.decisions).toEqual([]);
  expect(recovered.outcomes).toEqual([]);
  expect(recovered.snapshots).toEqual([]);
};
const withoutWorkspaceId = (data: AppData) => {
  const { workspaceId: _workspaceId, ...rest } = data;
  return rest;
};

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

it("keeps the initially empty workspace as a recoverable first-save copy", async () => {
  const { store, values } = makeStore();
  const repository = repositoryFor(store);
  await repository.load();
  await repository.save(savedData("first-save"));
  expectEmptyRecoveryCopy(values.get(STORAGE_KEYS.previous)!);
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
  expectEmptyRecoveryCopy(values.get(STORAGE_KEYS.previous)!);
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

it("imports a complete oversized backup into a fresh store without losing authored history", async () => {
  const { store, values } = makeStore();
  const repository = repositoryFor(store);
  const state: { current: AppData | null } = { current: null };
  const service = createWorkspaceApplicationService({
    repository,
    getCurrent: () => state.current,
    publish: next => { state.current = next; },
  });
  await service.load().then(loaded => { state.current = loaded; });

  await service.importBackup(serializeExport(oversizedWorkspace, 42));

  expect(state.current).not.toBeNull();
  expect(withoutWorkspaceId(state.current!)).toEqual(withoutWorkspaceId(oversizedWorkspace));
  expect(state.current!.workspaceId).toMatch(/^restored-/);
  expect(profileWorkspace(state.current!).budget.currentBytes).toBeGreaterThan(WORKSPACE_STORAGE_BUDGET_CONTRACT.hardBudgetBytes);
  expect((JSON.parse(values.get(STORAGE_KEYS.current)!) as { revision: number }).revision).toBe(1);
  expectEmptyRecoveryCopy(values.get(STORAGE_KEYS.previous)!);
});

it("restores an oversized backup over valid state while preserving the prior current copy", async () => {
  const { store, values } = makeStore();
  const repository = repositoryFor(store);
  const prior = savedData("prior-current");
  await repository.load();
  await repository.save(prior);
  const state = { current: prior };
  const service = createWorkspaceApplicationService({
    repository,
    getCurrent: () => state.current,
    publish: next => { state.current = next; },
  });

  await service.importBackup(serializeExport(oversizedWorkspace, 42));

  expect(withoutWorkspaceId(state.current)).toEqual(withoutWorkspaceId(oversizedWorkspace));
  expect(state.current.workspaceId).toMatch(/^restored-/);
  expect(parseExport(values.get(STORAGE_KEYS.previous)!)).toEqual(prior);
  expect((JSON.parse(values.get(STORAGE_KEYS.current)!) as { revision: number }).revision).toBe(2);
  await repository.restorePreviousBackup();
  expect(parseExport(values.get(STORAGE_KEYS.current)!)).toEqual(prior);
});

it("rejects invalid or corrupt oversized input without replacing valid current state", async () => {
  const { store, values } = makeStore();
  const repository = repositoryFor(store);
  const current = savedData("valid-current");
  await repository.load();
  await repository.save(current);
  const before = values.get(STORAGE_KEYS.current);
  const state = { current };
  const service = createWorkspaceApplicationService({
    repository,
    getCurrent: () => state.current,
    publish: next => { state.current = next; },
  });
  const validEnvelope = JSON.parse(serializeExport(oversizedWorkspace, 42)) as Record<string, unknown>;
  const invalidSchema = JSON.stringify({ ...validEnvelope, data: { ...oversizedWorkspace, stocks: "not-an-array" } });
  const corruptJson = serializeExport(oversizedWorkspace, 42).slice(0, -1);

  await expect(service.importBackup(invalidSchema)).rejects.toThrow();
  await expect(service.importBackup(corruptJson)).rejects.toThrow();
  expect(values.get(STORAGE_KEYS.current)).toBe(before);
  expect(state.current).toEqual(current);
  expectEmptyRecoveryCopy(values.get(STORAGE_KEYS.previous)!);
});

it("resumes ordinary budget enforcement after oversized restore", async () => {
  const { store, values } = makeStore();
  const repository = repositoryFor(store);
  await repository.load();
  const state: { current: AppData | null } = { current: await repository.load() };
  const service = createWorkspaceApplicationService({
    repository,
    getCurrent: () => state.current,
    publish: next => { state.current = next; },
  });
  await service.importBackup(serializeExport(oversizedWorkspace, 42));

  await service.commit(prev => ({ ...prev, workspaceId: "restored-non-growing-edit" }));
  const revisionAfterNonGrowingEdit = (JSON.parse(values.get(STORAGE_KEYS.current)!) as { revision: number }).revision;
  const restoredBeforeGrowth = values.get(STORAGE_KEYS.current);
  const growth = service.commit(prev => ({
    ...prev,
    reviewLogs: prev.reviewLogs.map((entry, index) => index === 0 ? { ...entry, manualReason: `${entry.manualReason}x` } : entry),
  }));
  await expect(growth).rejects.toBeInstanceOf(WorkspaceStorageBudgetError);
  expect(values.get(STORAGE_KEYS.current)).toBe(restoredBeforeGrowth);
  expect((JSON.parse(values.get(STORAGE_KEYS.current)!) as { revision: number }).revision).toBe(revisionAfterNonGrowingEdit);
  await expect(repository.save({
    ...state.current!,
    reviewLogs: state.current!.reviewLogs.map((entry, index) => index === 0 ? { ...entry, manualReason: `${entry.manualReason}x` } : entry),
  })).rejects.toBeInstanceOf(WorkspaceStorageBudgetError);

  const reduced = await service.commit(prev => ({ ...prev, rawBarArchives: prev.rawBarArchives.slice(0, 3) }));
  expect(profileWorkspace(reduced).budget.currentBytes).toBeLessThan(WORKSPACE_STORAGE_BUDGET_CONTRACT.hardBudgetBytes);
  expect((JSON.parse(values.get(STORAGE_KEYS.current)!) as { revision: number }).revision).toBe(revisionAfterNonGrowingEdit + 1);
});

it("serializes full restores and rejects a stale full-backup revision", async () => {
  const { store, values } = makeStore();
  const repository = repositoryFor(store);
  await repository.load();
  await Promise.all([repository.restoreFullBackup(savedData("first-restore")), repository.restoreFullBackup(savedData("second-restore"))]);
  expect(parseExport(values.get(STORAGE_KEYS.current)!)).toEqual(savedData("second-restore"));
  expect(parseExport(values.get(STORAGE_KEYS.previous)!)).toEqual(savedData("first-restore"));
  expect((JSON.parse(values.get(STORAGE_KEYS.current)!) as { revision: number }).revision).toBe(2);

  const concurrentA = repositoryFor(store);
  const concurrentB = repositoryFor(store);
  await concurrentA.load();
  await concurrentB.load();
  await concurrentA.restoreFullBackup(savedData("third-restore"));
  await expect(concurrentB.restoreFullBackup(savedData("stale-restore"))).rejects.toThrow(/Another session saved changes/);
  expect(parseExport(values.get(STORAGE_KEYS.current)!)).toEqual(savedData("third-restore"));
});

it("serializes a full-backup import with an ordinary application commit", async () => {
  const { store, values } = makeStore();
  const repository = repositoryFor(store);
  const state: { current: AppData | null } = { current: await repository.load() };
  const service = createWorkspaceApplicationService({
    repository,
    getCurrent: () => state.current,
    publish: next => { state.current = next; },
  });
  const importCommand = service.importBackup(serializeExport(savedData("imported"), 42));
  const editCommand = service.commit(prev => ({ ...prev, workspaceId: "edited-after-import" }));
  await Promise.all([importCommand, editCommand]);

  expect(state.current).toMatchObject({ ...savedData("imported"), workspaceId: "edited-after-import" });
  const imported = parseExport(values.get(STORAGE_KEYS.previous)!);
  expect(withoutWorkspaceId(imported)).toEqual(withoutWorkspaceId(savedData("imported")));
  expect(imported.workspaceId).toMatch(/^restored-/);
  expect((JSON.parse(values.get(STORAGE_KEYS.current)!) as { revision: number }).revision).toBe(2);
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
