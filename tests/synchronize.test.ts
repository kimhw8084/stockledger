import { expect, it, vi } from "vitest";
import { createEmptyAppData } from "../src/data/workspaceDefaults";
import { contentHash } from "../src/domain/contentHash";
import { baselineFor, type CloudRecord } from "../src/features/sync/syncPlan";
import { seedData } from "../src/lib/seed";
import type { AppData } from "../src/types";

const ownerId = "11111111-1111-4111-8111-111111111111";
const endpoint = "http://127.0.0.1:55421";

const mock = vi.hoisted(() => {
  const rpc = vi.fn();
  const cloud = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "11111111-1111-4111-8111-111111111111" } }, error: null })) },
    rpc,
  };
  return { cloud, rpc };
});

vi.mock("../src/features/sync/client", () => ({ cloud: mock.cloud, cloudEndpoint: endpoint }));

const createStore = () => {
  const values = new Map<string, string>();
  const history: string[] = [];
  return {
    values,
    history,
    get: async (key: string) => values.get(key) ?? null,
    set: async (key: string, value: string) => { values.set(key, value); history.push(value); },
    remove: async (key: string) => { values.delete(key); },
  };
};
type Store = ReturnType<typeof createStore>;

const stateKey = (workspaceId: string) => `stockledger.sync.v1.${contentHash({ endpoint, userId: ownerId, workspaceId })}`;
const stockPayload = (id: string, name = id) => ({ ...seedData.stocks[0], id, name });
const stockRow = (id: string, name = id, revision = 1, cursor = 10): CloudRecord => ({ collection: "stocks", record_id: id, revision, payload: stockPayload(id, name), deleted: false, cursor });
const workspace = (workspaceId: string, rows: CloudRecord[]): AppData => ({
  ...createEmptyAppData(),
  workspaceId,
  stocks: rows.filter(row => !row.deleted).map(row => row.payload as unknown as AppData["stocks"][number]),
});

const seedState = async (workspaceId: string, rows: CloudRecord[], cursor = 10) => {
  const state = createStore();
  await state.set(stateKey(workspaceId), JSON.stringify({
    contractVersion: "stockledger-personal-sync-v1",
    cursor,
    baseline: baselineFor(rows, cursor),
    records: rows,
    outbox: [],
  }));
  return state;
};

type ServerOptions = {
  intervening?: "write" | "delete";
  ambiguous?: boolean;
  expiryErrors?: number;
  sameRecordConflict?: boolean;
  postAckSameRecordChange?: boolean;
  crashBeforeCatchUp?: boolean;
};

const installServer = (initialRows: CloudRecord[], options: ServerOptions = {}) => {
  const rows = new Map(initialRows.map(row => [`${row.collection}/${row.record_id}`, row]));
  const changes: CloudRecord[] = [];
  const mutationAcks = new Map<string, Array<{ collection: "stocks"; recordId: string; revision: number; cursor: number }>>();
  const applyCalls: Record<string, unknown>[][] = [];
  const mutationIds: string[] = [];
  let cursor = Math.max(10, ...initialRows.map(row => row.cursor ?? 0));
  let expiryErrors = options.expiryErrors ?? 0;
  let injectedInterleaving = false;
  let postAckSameRecordInjected = false;
  let crashBeforeCatchUp = options.crashBeforeCatchUp ?? false;
  const server = { rows, changes, applyCalls, mutationIds, preSubmitPulled: false, bootstrapCalls: 0, postSubmitFeedCalls: 0 };

  const appendChange = (row: CloudRecord) => {
    cursor += 1;
    const changed = { ...row, cursor };
    rows.set(`${changed.collection}/${changed.record_id}`, changed);
    changes.push(changed);
    return changed;
  };

  mock.rpc.mockImplementation(async (name: string, args: Record<string, unknown> = {}) => {
    if (name === "get_ledger_bootstrap_page") {
      server.bootstrapCalls += 1;
      return { data: { contractVersion: "stockledger-personal-sync-v1", cursor, nextOffset: 0, complete: true, records: [...rows.values()] }, error: null };
    }
    if (name === "get_ledger_high_water_cursor") {
      if (applyCalls.length > 0 && crashBeforeCatchUp) {
        crashBeforeCatchUp = false;
        return { data: null, error: { message: "simulated crash before post-submit catch-up" } };
      }
      return { data: { contractVersion: "stockledger-personal-sync-v1", cursor }, error: null };
    }
    if (name === "get_ledger_changes") {
      const after = Number(args.p_after_cursor);
      if (after === 10 && applyCalls.length === 0) server.preSubmitPulled = true;
      if (applyCalls.length > 0) server.postSubmitFeedCalls += 1;
      if (after === 10 && applyCalls.length > 0 && expiryErrors > 0) {
        expiryErrors -= 1;
        return { data: null, error: { code: "P0001", message: "CURSOR_EXPIRED: re-bootstrap is required" } };
      }
      const page = changes.filter(change => (change.cursor ?? 0) > after);
      return {
        data: {
          contractVersion: "stockledger-personal-sync-v1",
          highWaterCursor: cursor,
          nextCursor: page.at(-1)?.cursor ?? cursor,
          hasMore: false,
          changes: page,
        },
        error: null,
      };
    }
    if (name !== "apply_ledger_batch") throw new Error(`Unexpected RPC ${name}`);
    const mutationId = String(args.p_mutation_id);
    const request = args.p_changes as Record<string, unknown>[];
    applyCalls.push(request);
    mutationIds.push(mutationId);
    if (mutationAcks.has(mutationId)) return { data: mutationAcks.get(mutationId), error: null };

    if (options.sameRecordConflict) {
      const item = request[0];
      const key = `${item.collection}/${item.recordId}`;
      const current = rows.get(key);
      appendChange({ collection: "stocks", record_id: String(item.recordId), revision: Number(current?.revision ?? 0) + 1, payload: stockPayload(String(item.recordId), "Concurrent cloud edit"), deleted: false });
      return { data: null, error: { code: "40001", message: "Revision conflict for stocks/stock-conflict" } };
    }

    if (!injectedInterleaving && options.intervening) {
      injectedInterleaving = true;
      if (options.intervening === "write") appendChange(stockRow("stock-b", "B device write", 1, cursor));
      else {
        const current = rows.get("stocks/stock-delete-me");
        if (!current) throw new Error("Delete fixture is missing its target.");
        appendChange({ ...current, deleted: true, revision: current.revision + 1 });
      }
    }

    const acknowledgement: Array<{ collection: "stocks"; recordId: string; revision: number; cursor: number }> = [];
    for (const item of request) {
      const key = `${item.collection}/${item.recordId}`;
      const current = rows.get(key);
      const expectedRevision = Number(item.expectedRevision);
      if (Number(current?.revision ?? 0) !== expectedRevision) return { data: null, error: { code: "40001", message: "Revision conflict" } };
      const changed = appendChange({
        collection: "stocks",
        record_id: String(item.recordId),
        revision: expectedRevision + 1,
        payload: item.payload as Record<string, unknown>,
        deleted: Boolean(item.deleted),
      });
      acknowledgement.push({ collection: "stocks", recordId: changed.record_id, revision: changed.revision, cursor: changed.cursor! });
    }
    mutationAcks.set(mutationId, acknowledgement);
    if (options.postAckSameRecordChange && !postAckSameRecordInjected) {
      postAckSameRecordInjected = true;
      const acknowledged = rows.get(`stocks/${String(request[0].recordId)}`)!;
      appendChange({ ...acknowledged, revision: acknowledged.revision + 1, payload: stockPayload(acknowledged.record_id, "Concurrent cloud edit") });
    }
    if (options.ambiguous) return { data: null, error: { message: "network lost after server commit" } };
    return { data: acknowledgement, error: null };
  });
  return server;
};

const stateJson = async (state: Store, workspaceId: string) => JSON.parse((await state.get(stateKey(workspaceId)))!);

it("reconciles an unrelated write made after A's pre-submit pull and retains both records", async () => {
  const workspaceId = "cursor-interleave-write";
  const base = stockRow("stock-base", "Base");
  const newLocal = stockRow("stock-a", "A device write", 0, 0);
  const server = installServer([base], { intervening: "write" });
  const state = await seedState(workspaceId, [base]);
  let saved: AppData | undefined;
  const { synchronize } = await import("../src/features/sync/synchronize");

  const result = await synchronize(workspace(workspaceId, [base, newLocal]), true, async next => { saved = next; }, {}, { stateStore: state });

  expect(server.preSubmitPulled).toBe(true);
  expect(saved?.stocks.map(stock => stock.id)).toEqual(expect.arrayContaining(["stock-base", "stock-a", "stock-b"]));
  expect(result.cursor).toBe(12);
  expect((await stateJson(state, workspaceId)).cursor).toBeGreaterThanOrEqual(12);
  expect(server.changes.map(change => change.cursor)).toEqual([11, 12]);
});

it("reconciles an intervening tombstone instead of skipping the deleted record", async () => {
  const workspaceId = "cursor-interleave-delete";
  const base = stockRow("stock-base", "Base");
  const deleted = stockRow("stock-delete-me", "Delete me");
  const newLocal = stockRow("stock-a-delete", "A device write", 0, 0);
  const server = installServer([base, deleted], { intervening: "delete" });
  const state = await seedState(workspaceId, [base, deleted]);
  let saved: AppData | undefined;
  const { synchronize } = await import("../src/features/sync/synchronize");

  const result = await synchronize(workspace(workspaceId, [base, deleted, newLocal]), true, async next => { saved = next; }, {}, { stateStore: state });

  expect(saved?.stocks.map(stock => stock.id)).not.toContain("stock-delete-me");
  expect(result.cursor).toBe(12);
  expect((await stateJson(state, workspaceId)).records).toEqual(expect.arrayContaining([expect.objectContaining({ record_id: "stock-delete-me", deleted: true, cursor: 11 })]));
});

it("keeps the acknowledged outbox and pre-submit cursor across a crash before catch-up/workspace persistence", async () => {
  const workspaceId = "cursor-crash-after-ack";
  const base = stockRow("stock-base-crash", "Base");
  const newLocal = stockRow("stock-a-crash", "A device write", 0, 0);
  const server = installServer([base], { intervening: "write" });
  const state = await seedState(workspaceId, [base]);
  const data = workspace(workspaceId, [base, newLocal]);
  const { synchronize } = await import("../src/features/sync/synchronize");
  let failOnce = true;

  await expect(synchronize(data, true, async () => {
    if (failOnce) { failOnce = false; throw new Error("simulated workspace persistence crash"); }
  }, {}, { stateStore: state })).rejects.toThrow(/simulated/);

  const afterCrash = await stateJson(state, workspaceId);
  expect(afterCrash.cursor).toBe(10);
  expect(afterCrash.outbox[0].acknowledgement).toBeDefined();
  expect(server.applyCalls).toHaveLength(1);
  expect(state.history.map(value => JSON.parse(value).cursor)).toEqual(expect.arrayContaining([10]));

  const result = await synchronize(data, true, async () => {}, {}, { stateStore: state });
  expect(result.uploaded).toBe(0);
  expect(server.applyCalls).toHaveLength(1);
  expect((await stateJson(state, workspaceId)).cursor).toBe(12);
});

it("keeps the acknowledgement durable at the pre-submit cursor across a crash before post-submit catch-up", async () => {
  const workspaceId = "cursor-crash-before-catch-up";
  const base = stockRow("stock-base-before-catch-up", "Base");
  const newLocal = stockRow("stock-a-before-catch-up", "A device write", 0, 0);
  const server = installServer([base], { intervening: "write", crashBeforeCatchUp: true });
  const state = await seedState(workspaceId, [base]);
  const data = workspace(workspaceId, [base, newLocal]);
  const { synchronize } = await import("../src/features/sync/synchronize");

  await expect(synchronize(data, true, async () => {}, {}, { stateStore: state })).rejects.toThrow(/before post-submit catch-up/);
  const afterCrash = await stateJson(state, workspaceId);
  expect(afterCrash.cursor).toBe(10);
  expect(afterCrash.outbox[0].acknowledgement).toBeDefined();
  expect(server.postSubmitFeedCalls).toBe(0);

  await expect(synchronize(data, true, async () => {}, {}, { stateStore: state })).resolves.toMatchObject({ uploaded: 0, cursor: 12 });
  expect(server.applyCalls).toHaveLength(1);
});

it("replays an ambiguous commit with the same mutation identity and does not duplicate A's change", async () => {
  const workspaceId = "cursor-ambiguous-replay";
  const base = stockRow("stock-base-replay", "Base");
  const newLocal = stockRow("stock-a-replay", "A device write", 0, 0);
  const server = installServer([base], { intervening: "write", ambiguous: true });
  const state = await seedState(workspaceId, [base]);
  const data = workspace(workspaceId, [base, newLocal]);
  const { synchronize } = await import("../src/features/sync/synchronize");

  await expect(synchronize(data, true, async () => {}, {}, { stateStore: state })).rejects.toThrow(/network lost/);
  await expect(synchronize(data, true, async () => {}, {}, { stateStore: state })).resolves.toMatchObject({ uploaded: 0, cursor: 12 });

  expect(server.applyCalls).toHaveLength(2);
  expect(server.mutationIds[1]).toBe(server.mutationIds[0]);
  expect((await stateJson(state, workspaceId)).outbox).toEqual([]);
  expect(server.changes.filter(change => change.record_id === "stock-a-replay")).toHaveLength(1);
});

it("requires bounded re-bootstrap when post-submit cursor history expires and never jumps to the ack cursor", async () => {
  const workspaceId = "cursor-expired-after-submit";
  const base = stockRow("stock-base-expired", "Base");
  const newLocal = stockRow("stock-a-expired", "A device write", 0, 0);
  const server = installServer([base], { intervening: "write", expiryErrors: 2 });
  const state = await seedState(workspaceId, [base]);
  const data = workspace(workspaceId, [base, newLocal]);
  const { synchronize } = await import("../src/features/sync/synchronize");

  await expect(synchronize(data, true, async () => {}, {}, { stateStore: state })).rejects.toThrow(/cursor expired/i);
  expect((await stateJson(state, workspaceId)).cursor).toBe(10);
  expect((await stateJson(state, workspaceId)).outbox[0].acknowledgement).toBeDefined();

  const result = await synchronize(data, true, async () => {}, {}, { stateStore: state, allowRebootstrap: true });
  expect(result.cursor).toBe(12);
  expect(server.bootstrapCalls).toBeGreaterThan(0);
  expect((await stateJson(state, workspaceId)).outbox).toEqual([]);
});

it("retains the outbox and surfaces the server revision conflict for a concurrent same-record write", async () => {
  const workspaceId = "cursor-same-record-conflict";
  const remote = stockRow("stock-conflict", "Original");
  const local = { ...remote, payload: stockPayload("stock-conflict", "A local edit") };
  const server = installServer([remote], { sameRecordConflict: true });
  const state = await seedState(workspaceId, [remote]);
  const { synchronize } = await import("../src/features/sync/synchronize");

  await expect(synchronize(workspace(workspaceId, [local]), true, async () => {}, {}, { stateStore: state })).rejects.toThrow(/saved changes during sync/);
  const saved = await stateJson(state, workspaceId);
  expect(saved.cursor).toBe(10);
  expect(saved.outbox[0].acknowledgement).toBeUndefined();
  expect(server.applyCalls).toHaveLength(1);
});

it("retains a newer local edit and binds the post-submit conflict to the exact remote revision and cursor", async () => {
  const workspaceId = "cursor-post-submit-same-record-conflict";
  const remote = stockRow("stock-post-conflict", "Original");
  const local = { ...remote, payload: stockPayload("stock-post-conflict", "A local edit") };
  const server = installServer([remote], { postAckSameRecordChange: true });
  const state = await seedState(workspaceId, [remote]);
  const { synchronize, SyncConflictError } = await import("../src/features/sync/synchronize");

  await expect(synchronize(workspace(workspaceId, [local]), true, async () => { throw new Error("must retain local workspace"); }, {}, { stateStore: state })).rejects.toSatisfy(error => {
    expect(error).toBeInstanceOf(SyncConflictError);
    expect((error as InstanceType<typeof SyncConflictError>).conflicts[0]).toMatchObject({
      key: "stocks/stock-post-conflict",
      remoteRevision: 3,
      cursor: 12,
    });
    return true;
  });
  const saved = await stateJson(state, workspaceId);
  expect(saved.cursor).toBe(10);
  expect(saved.outbox[0].acknowledgement).toBeDefined();
  expect(server.changes.map(change => change.cursor)).toEqual([11, 12]);
});

it("never regresses the durable cursor and does not re-upload an acknowledged change on retry", async () => {
  const workspaceId = "cursor-monotonic-idempotent";
  const base = stockRow("stock-base-monotonic", "Base");
  const newLocal = stockRow("stock-a-monotonic", "A device write", 0, 0);
  const server = installServer([base], { intervening: "write" });
  const state = await seedState(workspaceId, [base]);
  const data = workspace(workspaceId, [base, newLocal]);
  const { synchronize } = await import("../src/features/sync/synchronize");

  let saved: AppData | undefined;
  await synchronize(data, true, async next => { saved = next; }, {}, { stateStore: state });
  const applyCount = server.applyCalls.length;
  const cursorHistory = state.history.map(value => JSON.parse(value).cursor);
  await synchronize(saved!, true, async () => {}, {}, { stateStore: state });

  expect(cursorHistory.every((cursor, index) => index === 0 || cursor >= cursorHistory[index - 1])).toBe(true);
  expect(server.applyCalls).toHaveLength(applyCount);
  expect((await stateJson(state, workspaceId)).cursor).toBe(12);
});
