import { expect, it } from "vitest";
import { applyRecords, baselineFor, localRecords, planSync, type CloudRecord } from "../src/features/sync/syncPlan";
import { createEmptyAppData } from "../src/lib/storage";
import { seedData } from "../src/lib/seed";
const stock = seedData.stocks[0];
const workspace = () => ({ ...createEmptyAppData(), stocks: [stock] });
const remote = (name = stock.name, revision = 1): CloudRecord => ({ collection: "stocks", record_id: stock.id, revision, payload: { ...stock, name }, deleted: false });
it("uploads new local records and acknowledges identical remote records without duplication", () => {
  const data = workspace();
  expect(planSync(data, [], {}).changes).toHaveLength(1);
  expect(planSync(data, [remote()], {}).changes).toHaveLength(0);
  expect(planSync(data, [remote()], {}).conflicts).toHaveLength(0);
});
it("merges independent changes and preserves local price archives", () => {
  const data = workspace();
  const base = baselineFor([remote()]);
  const plan = planSync(data, [remote("Changed on another device", 2)], base);
  expect(plan.conflicts).toHaveLength(0);
  const next = applyRecords(data, plan.merged);
  expect(next.stocks[0].name).toBe("Changed on another device");
  expect(next.snapshots[0].freshness).toBe("Unavailable");
  expect(next.rawBarArchives).toEqual(data.rawBarArchives);
});
it("requires an explicit resolution bound to the exact conflicting revisions", () => {
  const data = workspace(); data.stocks = [{ ...stock, name: "Local edit" }];
  const base = baselineFor([remote()]); const cloud = remote("Cloud edit", 2);
  const conflict = planSync(data, [cloud], base).conflicts[0];
  expect(conflict.key).toBe(`stocks/${stock.id}`);
  const resolutions = { [conflict.key]: { choice: "local" as const, localHash: conflict.localHash, remoteHash: conflict.remoteHash, remoteRevision: conflict.remoteRevision, cursor: conflict.cursor } };
  expect(planSync(data, [cloud], base, resolutions).changes[0].expectedRevision).toBe(2);
  expect(planSync(data, [remote("Newer edit", 3)], base, resolutions).conflicts).toHaveLength(1);
  resolutions[conflict.key].choice = "remote" as any;
  expect(applyRecords(data, planSync(data, [cloud], base, resolutions).merged).stocks[0].name).toBe("Cloud edit");
  expect(planSync(data, [cloud], base, { [conflict.key]: { ...resolutions[conflict.key], cursor: conflict.cursor + 1 } }).conflicts).toHaveLength(1);
});
it("uses tombstones and detects delete-versus-edit conflicts", () => {
  const base = baselineFor([remote()]); const local = createEmptyAppData();
  expect(planSync(local, [remote()], base).changes[0]).toMatchObject({ deleted: true, expectedRevision: 1 });
  expect(planSync(local, [remote("An edit", 2)], base).conflicts).toHaveLength(1);
  const deleted = { ...remote(), deleted: true, revision: 2 };
  expect(applyRecords(workspace(), planSync(workspace(), [deleted], base).merged).stocks).toEqual([]);
});
it("validates the merged graph and retains historical evaluations without IDs", () => {
  const data = structuredClone(seedData);
  const merged = localRecords(data);
  expect(applyRecords(data, merged).evaluations).toEqual(data.evaluations ?? []);
  merged.delete(`stocks/${data.eyes[0].stockId}`);
  expect(() => applyRecords(data, merged)).toThrow(/missing stock/);
});
it("keeps provider-heavy archives out of the personal sync contract", () => {
  const data = structuredClone(seedData);
  const records = localRecords(data);
  expect([...records.values()].every(record => ["stocks", "recipes", "customMetrics", "eyes", "alerts", "decisions", "outcomes", "evaluations", "reviewLogs"].includes(record.collection))).toBe(true);
  expect(records.size).toBeGreaterThan(0);
  expect(records.has("rawBarArchives/undefined")).toBe(false);
});
