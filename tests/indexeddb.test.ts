import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";
const legacy = vi.hoisted(() => new Map<string, string>());
vi.mock("@react-native-async-storage/async-storage", () => ({ default: { getItem: async (key: string) => legacy.get(key) ?? null, removeItem: async (key: string) => { legacy.delete(key); } } }));
import store from "../src/platform/keyValueStore.web";
beforeEach(() => legacy.clear());
it("migrates prototype data without overwriting an existing document", async () => {
  legacy.set("legacy", "original");
  expect(await store.getItem("legacy")).toBe("original");
  legacy.set("legacy", "stale");
  expect(await store.getItem("legacy")).toBe("original");
});
it("commits current data and recovery backup in one transaction", async () => {
  await store.setItem("atomic", "one");
  await store.compareAndSetItem("atomic", "one", "two", "atomic.previous");
  expect(await store.getItem("atomic")).toBe("two");
  expect(await store.getItem("atomic.previous")).toBe("one");
});
it("permits only one concurrent tab to save against a revision", async () => {
  await store.setItem("tabs", "before");
  const results = await Promise.allSettled([store.compareAndSetItem("tabs", "before", "first", "tabs.previous"), store.compareAndSetItem("tabs", "before", "second", "tabs.previous")]);
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect(await store.getItem("tabs")).toBe("first");
  expect(await store.getItem("tabs.previous")).toBe("before");
});
