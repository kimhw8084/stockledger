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
  const first = makeClient(), second = makeClient(), sameAccountDevice = makeClient(), deletionAccount = makeClient(), anonymous = makeClient();
  const firstEmail = `stockledger-${randomUUID()}@example.invalid`;
  const firstPassword = `${randomUUID()}-Aa1!`;
  const deletionEmail = `stockledger-${randomUUID()}@example.invalid`;
  const deletionPassword = `${randomUUID()}-Aa1!`;
  try {
    for (const [client, email, password] of [[first, firstEmail, firstPassword], [second, `stockledger-${randomUUID()}@example.invalid`, `${randomUUID()}-Aa1!`], [deletionAccount, deletionEmail, deletionPassword]] as const) {
      const { data, error } = await client.auth.signUp({ email, password });
      assert.equal(error, null); assert(data.session, "Local email confirmations must be disabled for this fixture.");
      assert((await client.auth.getUser()).data.user, "Auth session could not be verified.");
    }
    const restored = await sameAccountDevice.auth.signInWithPassword({ email: firstEmail, password: firstPassword });
    assert.equal(restored.error, null); assert(restored.data.session, "Second device could not restore the account session.");
    const recovery = await first.auth.resetPasswordForEmail(firstEmail);
    assert.equal(recovery.error, null, "Password recovery entry point was rejected by local Auth.");
    const localSignOut = await first.auth.signOut({ scope: "local" });
    assert.equal(localSignOut.error, null); assert.equal((await first.auth.getUser()).data.user, null, "Local sign-out did not clear this device session.");
    const restoredSession = await first.auth.signInWithPassword({ email: firstEmail, password: firstPassword });
    assert.equal(restoredSession.error, null); assert(restoredSession.data.session, "Session restoration after local sign-out failed.");
    const mutation = randomUUID();
    const changes = [{ collection: "stocks", recordId: "cloud-test-stock", expectedRevision: 0, payload: { id: "cloud-test-stock", symbol: "ABC", name: "Fixture", thesis: "Test", createdAt: new Date().toISOString() }, deleted: false }];
    const result = await first.rpc("apply_ledger_batch", { p_mutation_id: mutation, p_changes: changes });
    assert.equal(result.error, null); assert.equal(result.data[0].revision, 1);
    const replay = await first.rpc("apply_ledger_batch", { p_mutation_id: mutation, p_changes: changes });
    assert.equal(replay.error, null); assert.deepEqual(replay.data, result.data);
    assert.equal((await first.from("ledger_records").select("record_id")).data?.length, 1);
    assert.deepEqual((await second.from("ledger_records").select("record_id")).data, []);
    assert.deepEqual((await sameAccountDevice.from("ledger_records").select("record_id")).data, [{ record_id: "cloud-test-stock" }]);
    assert((await anonymous.from("ledger_records").select("record_id")).error);
    assert((await first.from("ledger_records").update({ deleted: true }).eq("record_id", "cloud-test-stock")).error);
    const conflict = await first.rpc("apply_ledger_batch", { p_mutation_id: randomUUID(), p_changes: changes });
    assert.equal(conflict.error?.code, "40001");
    const cursor = await first.rpc("get_ledger_high_water_cursor");
    assert.equal(cursor.error, null); assert.equal(cursor.data.contractVersion, "stockledger-personal-sync-v1");
    const bootstrap = await first.rpc("get_ledger_bootstrap_page", { p_offset: 0, p_limit: 1 });
    assert.equal(bootstrap.error, null); assert.equal(bootstrap.data.records.length, 1);
    assert.equal(bootstrap.data.records[0].collection, "stocks");
    const changesPage = await first.rpc("get_ledger_changes", { p_after_cursor: 0, p_limit: 1 });
    assert.equal(changesPage.error, null); assert.equal(changesPage.data.changes.length, 1); assert(changesPage.data.changes[0].cursor > 0);
    const deleted = await first.rpc("apply_ledger_batch", { p_mutation_id: randomUUID(), p_changes: [{ ...changes[0], expectedRevision: 1, deleted: true }] });
    assert.equal(deleted.error, null);
    const tombstone = await first.rpc("get_ledger_changes", { p_after_cursor: changesPage.data.changes[0].cursor, p_limit: 10 });
    assert.equal(tombstone.error, null); assert.equal(tombstone.data.changes.at(-1).deleted, true);
    const rollback = await first.rpc("apply_ledger_batch", {
      p_mutation_id: randomUUID(),
      p_changes: [
        { collection: "stocks", recordId: "cloud-recovery-new", expectedRevision: 0, payload: { id: "cloud-recovery-new", symbol: "REC" }, deleted: false },
        { collection: "stocks", recordId: "cloud-test-stock", expectedRevision: 0, payload: { id: "cloud-test-stock", symbol: "ABC" }, deleted: false },
      ],
    });
    assert.equal(rollback.error?.code, "40001");
    assert.deepEqual((await first.from("ledger_records").select("record_id").eq("record_id", "cloud-recovery-new")).data, []);
    const deletion = await deletionAccount.rpc("request_account_deletion");
    assert.equal(deletion.error, null); assert.equal(deletion.data.status, "requested"); assert.equal(deletion.data.authUserDeletion, "unproven");
    assert.deepEqual((await deletionAccount.from("ledger_records").select("record_id")).data, []);
    console.log("Local Auth, two-account ownership, same-account devices, cursor feed, tombstones, deletion invalidation, atomic RPC, retry, and revision checks passed.");
  } finally { await first.auth.signOut(); await second.auth.signOut(); await sameAccountDevice.auth.signOut(); await deletionAccount.auth.signOut(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Cloud integration failed"); process.exitCode = 1; });
