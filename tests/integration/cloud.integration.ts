import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const status = JSON.parse(execFileSync(resolve("node_modules/.bin/supabase"), ["status", "-o", "json"], { encoding: "utf8", timeout: 30_000 }));
  const url: string = status.API_URL; const key: string = status.ANON_KEY;
  assert(["127.0.0.1", "localhost"].includes(new URL(url).hostname), "Integration test is restricted to local Supabase.");
  assert(key, "Local anonymous key is missing.");
  const makeClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const first = makeClient(), second = makeClient(), anonymous = makeClient();
  try {
    for (const client of [first, second]) {
      const { data, error } = await client.auth.signUp({ email: `stockledger-${randomUUID()}@example.invalid`, password: `${randomUUID()}-Aa1!` });
      assert.equal(error, null); assert(data.session, "Local email confirmations must be disabled for this fixture.");
      assert((await client.auth.getUser()).data.user, "Auth session could not be verified.");
    }
    const mutation = randomUUID();
    const changes = [{ collection: "stocks", recordId: "cloud-test-stock", expectedRevision: 0, payload: { id: "cloud-test-stock", symbol: "ABC", name: "Fixture", thesis: "Test", createdAt: new Date().toISOString() }, deleted: false }];
    const result = await first.rpc("apply_ledger_batch", { p_mutation_id: mutation, p_changes: changes });
    assert.equal(result.error, null); assert.equal(result.data[0].revision, 1);
    const replay = await first.rpc("apply_ledger_batch", { p_mutation_id: mutation, p_changes: changes });
    assert.equal(replay.error, null); assert.deepEqual(replay.data, result.data);
    assert.equal((await first.from("ledger_records").select("record_id")).data?.length, 1);
    assert.deepEqual((await second.from("ledger_records").select("record_id")).data, []);
    assert((await anonymous.from("ledger_records").select("record_id")).error);
    assert((await first.from("ledger_records").update({ deleted: true }).eq("record_id", "cloud-test-stock")).error);
    const conflict = await first.rpc("apply_ledger_batch", { p_mutation_id: randomUUID(), p_changes: changes });
    assert.equal(conflict.error?.code, "40001");
    console.log("Local Auth, PostgREST, ownership, atomic RPC, retry, and revision checks passed.");
  } finally { await first.auth.signOut(); await second.auth.signOut(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Cloud integration failed"); process.exitCode = 1; });
