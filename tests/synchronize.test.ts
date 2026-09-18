import { expect, it, vi } from "vitest";
import { createEmptyAppData } from "../src/data/workspaceDefaults";
import { seedData } from "../src/lib/seed";

const mock = vi.hoisted(() => {
  const rpc = vi.fn();
  const cloud = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "11111111-1111-4111-8111-111111111111" } }, error: null })) },
    rpc,
  };
  return { cloud, rpc };
});

vi.mock("../src/features/sync/client", () => ({ cloud: mock.cloud, cloudEndpoint: "http://127.0.0.1:55421" }));

const store = () => {
  const values = new Map<string, string>();
  return {
    values,
    get: async (key: string) => values.get(key) ?? null,
    set: async (key: string, value: string) => { values.set(key, value); },
    remove: async (key: string) => { values.delete(key); },
  };
};

const configureEmptyRemote = () => {
  mock.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === "get_ledger_bootstrap_page") return { data: { contractVersion: "stockledger-personal-sync-v1", cursor: 0, nextOffset: 0, complete: true, records: [] }, error: null };
    if (name === "get_ledger_changes") return { data: { contractVersion: "stockledger-personal-sync-v1", highWaterCursor: args.p_after_cursor === 1 ? 1 : 0, nextCursor: args.p_after_cursor, hasMore: false, changes: [] }, error: null };
    if (name === "apply_ledger_batch") return { data: [{ collection: "stocks", recordId: "stock-1", revision: 1, cursor: 1 }], error: null };
    throw new Error(`Unexpected RPC ${name}`);
  });
};

it("retains an acknowledged outbox intent across a crash before local acknowledgement", async () => {
  configureEmptyRemote();
  const state = store();
  const data = { ...createEmptyAppData(), workspaceId: "outbox-crash", stocks: [{ ...seedData.stocks[0], id: "stock-1" }] };
  const { synchronize } = await import("../src/features/sync/synchronize");
  let failOnce = true;
  await expect(synchronize(data, true, async () => { if (failOnce) { failOnce = false; throw new Error("simulated local acknowledgement crash"); } }, {}, { stateStore: state })).rejects.toThrow(/simulated/);
  const serialized = [...state.values.values()][0];
  expect(serialized).toMatch(/"acknowledgement"/);
  const rpcCallsAfterCrash = mock.rpc.mock.calls.filter(([name]) => name === "apply_ledger_batch");
  expect(rpcCallsAfterCrash).toHaveLength(1);
  await expect(synchronize(data, true, async () => {}, {}, { stateStore: state })).resolves.toMatchObject({ uploaded: 0 });
  expect(mock.rpc.mock.calls.filter(([name]) => name === "apply_ledger_batch")).toHaveLength(1);
});

it("reuses the same mutation identity after an ambiguous network response", async () => {
  const state = store();
  const data = { ...createEmptyAppData(), workspaceId: "outbox-replay", stocks: [{ ...seedData.stocks[0], id: "stock-1" }] };
  let firstSubmission = true;
  mock.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === "get_ledger_bootstrap_page") return { data: { contractVersion: "stockledger-personal-sync-v1", cursor: 0, nextOffset: 0, complete: true, records: [] }, error: null };
    if (name === "get_ledger_changes") return { data: { contractVersion: "stockledger-personal-sync-v1", highWaterCursor: 0, nextCursor: args.p_after_cursor, hasMore: false, changes: [] }, error: null };
    if (name === "apply_ledger_batch" && firstSubmission) { firstSubmission = false; return { data: null, error: { message: "network lost after server commit" } }; }
    if (name === "apply_ledger_batch") return { data: [{ collection: "stocks", recordId: "stock-1", revision: 1, cursor: 1 }], error: null };
    throw new Error(`Unexpected RPC ${name}`);
  });
  const { synchronize } = await import("../src/features/sync/synchronize");
  await expect(synchronize(data, true, async () => {}, {}, { stateStore: state })).rejects.toThrow(/network lost/);
  const firstMutation = mock.rpc.mock.calls.find(([name]) => name === "apply_ledger_batch")?.[1]?.p_mutation_id;
  await expect(synchronize(data, true, async () => {}, {}, { stateStore: state })).resolves.toMatchObject({ uploaded: 0 });
  const mutationCalls = mock.rpc.mock.calls.filter(([name]) => name === "apply_ledger_batch");
  expect(mutationCalls).toHaveLength(2);
  expect(mutationCalls[1][1].p_mutation_id).toBe(firstMutation);
});
