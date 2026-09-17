import { beforeEach, expect, it, vi } from "vitest";
import { parseExport, serializeExport } from "../src/domain/backupFormat";
import { createWorkspaceApplicationService } from "../src/application/workspaceApplicationService";
import { createRepresentativeWorkspaceFixture } from "../src/data/representativeWorkspaceFixture";
import { profileWorkspace } from "../src/data/workspaceFootprint";
import { RETENTION_CONTRACT, STORAGE_LAYOUT_CONTRACT } from "../src/data/workspaceContract";
import { createEmptyAppData } from "../src/data/workspaceDefaults";
import { createWorkspaceRepository, STORAGE_KEYS, type WorkspaceRepository } from "../src/data/repositories/workspaceRepository";
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

it("profiles a deterministic representative fixture without applying an implicit retention rule", () => {
  const fixture = createRepresentativeWorkspaceFixture();
  const first = profileWorkspace(fixture);
  const second = profileWorkspace(createRepresentativeWorkspaceFixture());
  expect(first).toEqual(second);
  expect(first.serializedWorkspaceBytes).toBeGreaterThan(0);
  expect(first.bootstrapSerializedBytes).toBe(first.serializedWorkspaceBytes);
  expect(first.dominantDomains[0].domain).toBe("rawBarArchives");
  expect(STORAGE_LAYOUT_CONTRACT.currentLayout).toBe("single-v2-envelope");
  expect(RETENTION_CONTRACT.rawBarArchives).toEqual({ bootstrap: "included", export: "full", retention: "retain-until-explicit-follow-up" });
});
