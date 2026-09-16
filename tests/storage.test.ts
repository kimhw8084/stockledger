import { beforeEach, expect, it, vi } from "vitest";
const memory = vi.hoisted(() => new Map<string, string>());
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {
  getItem: vi.fn(async (key: string) => memory.get(key) ?? null),
  setItem: vi.fn(async (key: string, value: string) => { memory.set(key, value); }),
  removeItem: vi.fn(async (key: string) => { memory.delete(key); }),
} }));
import { loadAppData, saveAppData, STORAGE_KEYS, restorePreviousBackup } from "../src/lib/storage";
import { seedData } from "../src/lib/seed";
const key = "stockledger.appData.v1";
beforeEach(async () => { memory.clear(); await loadAppData(); });
it("round trips user edits and raw provider values without regenerating seed content", async () => {
  const data = structuredClone(seedData);
  data.stocks[0].thesis = "My edited thesis";
  data.recipes[0].name = "My edited recipe";
  data.snapshots[0] = { ...data.snapshots[0], price: 220, sourceName: "FixtureProvider", isMock: false, priceHistorySeries: [218,219,220] };
  data.alerts = []; data.decisions = []; data.outcomes = [];
  await saveAppData(data);
  const loaded = await loadAppData();
  const { workspaceId, ...originalFields } = loaded;
  expect(workspaceId).toMatch(/^workspace-/);
  expect(originalFields).toEqual(data);
});
it("keeps malformed bytes and reports recovery instead of replacing them", async () => {
  memory.set(key, "{incomplete");
  await expect(loadAppData()).rejects.toThrow();
  expect(memory.get(key)).toBe("{incomplete");
});
it("rejects malformed nested data without dropping records", async () => {
  const data = structuredClone(seedData) as any;
  data.recipes[0].conditions = [null];
  const original = JSON.stringify(data);
  memory.set(key, original);
  await expect(loadAppData()).rejects.toThrow();
  expect(memory.get(key)).toBe(original);
});

it("restores the previous copy while retaining corrupt current bytes", async () => {
  await saveAppData(seedData);
  const updated = structuredClone(seedData); updated.stocks[0].name = "Changed";
  await saveAppData(updated);
  memory.set(STORAGE_KEYS.current, "corrupt-v2");
  await restorePreviousBackup();
  expect((await loadAppData()).stocks[0].name).toBe(seedData.stocks[0].name);
  expect([...memory.values()]).toContain("corrupt-v2");
});
