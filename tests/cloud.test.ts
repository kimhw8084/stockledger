import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
const db = new PGlite();
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const drill = "33333333-3333-4333-8333-333333333333";
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid$$;
    grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
    insert into auth.users values ('${owner}'),('${other}'),('${drill}');`);
  for (const file of readdirSync("supabase/migrations").filter(file => file.endsWith(".sql")).sort()) await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
}, 30000);
afterAll(() => db.close());
const asUser = async (user: string) => { await db.exec("reset role; set role authenticated;"); await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]); };
const change = (revision: number, payload = { id: "stock-1", symbol: "ABC" }, recordId = "stock-1") => [{ collection: "stocks", recordId, expectedRevision: revision, deleted: false, payload }];
const apply = (mutation: string, changes: unknown) => db.query("select public.apply_ledger_batch($1::uuid,$2::jsonb) as result", [mutation, JSON.stringify(changes)]);
it("enforces ownership and denies direct client mutations", async () => {
  await asUser(owner);
  await apply("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", change(0));
  expect((await db.query("select * from public.ledger_records")).rows).toHaveLength(1);
  await asUser(other);
  expect((await db.query("select * from public.ledger_records")).rows).toHaveLength(0);
  await expect(db.query("update public.ledger_records set deleted=true")).rejects.toThrow(/permission denied/);
  await db.exec("reset role; set role anon");
  await expect(db.query("select * from public.ledger_records")).rejects.toThrow(/permission denied/);
});
it("replays a mutation once and rejects changed reuse or stale revisions", async () => {
  await asUser(owner);
  const mutation = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const first = await apply(mutation, change(1));
  expect((await apply(mutation, change(1))).rows).toEqual(first.rows);
  await expect(apply(mutation, change(2))).rejects.toThrow(/different content/);
  await expect(apply("cccccccc-cccc-4ccc-8ccc-cccccccccccc", change(1))).rejects.toThrow(/Revision conflict/);
  expect((await db.query<{ revision: number }>("select revision from public.ledger_records")).rows[0].revision).toBe(2);
});
it("rolls back a whole batch when one record conflicts", async () => {
  await asUser(owner);
  await expect(apply("dddddddd-dddd-4ddd-8ddd-dddddddddddd", [
    { ...change(0)[0], recordId: "stock-new" }, ...change(0),
  ])).rejects.toThrow(/Revision conflict/);
  expect((await db.query("select * from public.ledger_records where record_id='stock-new'")).rows).toHaveLength(0);
});
it("keeps owner-scoped revisions and tombstones after an application-owned recovery rollback", async () => {
  await asUser(other);
  const recordId = "recovery-rollback-stock";
  await apply("44444444-4444-4444-8444-444444444441", change(0, { id: recordId, symbol: "REC" }, recordId));
  const beforeRollback = (await db.query<{ revision: number; deleted: boolean }>(`select revision,deleted from public.ledger_records where record_id='${recordId}'`)).rows[0];
  await expect(apply("44444444-4444-4444-8444-444444444442", [
    { ...change(0)[0] },
    { ...change(0, { id: recordId, symbol: "REC-CONFLICT" }, recordId)[0], expectedRevision: 0 },
  ])).rejects.toThrow(/Revision conflict/);
  const afterRollback = (await db.query<{ revision: number; deleted: boolean }>(`select revision,deleted from public.ledger_records where record_id='${recordId}'`)).rows[0];
  expect(afterRollback).toEqual(beforeRollback);
  await apply("44444444-4444-4444-8444-444444444443", [{ ...change(1, { id: recordId, symbol: "REC" }, recordId)[0], deleted: true }]);
  const tombstone = (await db.query<{ deleted: boolean; revision: number }>(`select deleted,revision from public.ledger_records where record_id='${recordId}'`)).rows[0];
  expect(tombstone).toEqual({ deleted: true, revision: 2 });
  await asUser(owner);
  expect((await db.query(`select * from public.ledger_records where record_id='${recordId}'`)).rows).toHaveLength(0);
});
it("rejects writes after account removal even with an old subject claim", async () => {
  await db.exec(`reset role; delete from auth.users where id='${other}'`);
  await asUser(other);
  await expect(apply("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", change(0))).rejects.toThrow(/Authentication required/);
});
it("preserves published recipe definitions while allowing retirement metadata", async () => {
  await asUser(owner);
  const recipe = { collection: "recipes", recordId: "recipe-1", expectedRevision: 0, payload: { id: "recipe-1", name: "Original", conditions: [] }, deleted: false };
  await apply("ffffffff-ffff-4fff-8fff-ffffffffffff", [recipe]);
  await expect(apply("12345678-abcd-4abc-8abc-123456789abc", [{ ...recipe, expectedRevision: 1, payload: { ...recipe.payload, name: "Overwritten" } }])).rejects.toThrow(/immutable/);
  await expect(apply("22345678-abcd-4abc-8abc-123456789abc", [{ ...recipe, expectedRevision: 1, payload: { ...recipe.payload, retiredAt: "2026-09-15T22:00:00Z" } }])).resolves.toBeDefined();
});
it("rejects raw provider collections and exposes bounded ordered cursor pages with tombstones", async () => {
  await asUser(drill);
  await expect(apply("33333333-3333-4333-8333-333333333331", [{ collection: "snapshots", recordId: "raw", expectedRevision: 0, payload: { id: "raw" }, deleted: false }])).rejects.toThrow(/Invalid record/);
  await apply("33333333-3333-4333-8333-333333333332", change(0, { id: "drill-1", symbol: "ONE" }, "drill-1"));
  await apply("33333333-3333-4333-8333-333333333333", [{ collection: "stocks", recordId: "drill-2", expectedRevision: 0, payload: { id: "drill-2", symbol: "TWO" }, deleted: false }]);
  const highWater = (await db.query<{ result: { contractVersion: string; cursor: number } }>("select public.get_ledger_high_water_cursor() as result")).rows[0].result;
  expect(highWater.contractVersion).toBe("stockledger-personal-sync-v1");
  expect(highWater.cursor).toBeGreaterThan(0);
  const firstPage = (await db.query<{ result: { records: unknown[]; complete: boolean; nextOffset: number } }>("select public.get_ledger_bootstrap_page(0,1) as result")).rows[0].result;
  expect(firstPage.records).toHaveLength(1);
  expect(firstPage.complete).toBe(false);
  const changes = (await db.query<{ result: { changes: Array<{ cursor: number; deleted: boolean }>; hasMore: boolean } }>("select public.get_ledger_changes(0,500) as result")).rows[0].result;
  expect(changes.changes.length).toBeGreaterThanOrEqual(2);
  expect(changes.changes[0].cursor).toBeLessThan(changes.changes[1].cursor);
  await apply("33333333-3333-4333-8333-333333333334", [{ collection: "stocks", recordId: "drill-1", expectedRevision: 1, payload: { id: "drill-1", symbol: "ONE" }, deleted: true }]);
  const afterDelete = (await db.query<{ result: { changes: Array<{ deleted: boolean }> } }>(`select public.get_ledger_changes(${changes.changes.at(-1)!.cursor},500) as result`)).rows[0].result;
  expect(afterDelete.changes.at(-1)?.deleted).toBe(true);
});
it("rejects expired cursors explicitly instead of skipping compacted history", async () => {
  await db.exec(`reset role; update ledger_private.sync_state set history_floor = 10 where user_id='${drill}'`);
  await asUser(drill);
  await expect(db.query("select public.get_ledger_changes(0,500) as result")).rejects.toThrow(/CURSOR_EXPIRED|cursor expired/i);
  await db.exec(`reset role; update ledger_private.sync_state set history_floor = 0 where user_id='${drill}'`);
});
it("invalidates cloud state on deletion request without touching local-only data", async () => {
  await asUser(drill);
  const status = (await db.query<{ result: { status: string; authUserDeletion: string } }>("select public.request_account_deletion() as result")).rows[0].result;
  expect(status).toMatchObject({ status: "requested", authUserDeletion: "unproven" });
  expect((await db.query("select * from public.ledger_records")).rows).toHaveLength(0);
  await expect(apply("33333333-3333-4333-8333-333333333335", change(0))).rejects.toThrow(/disabled/);
  const restoredStatus = (await db.query<{ result: { status: string } }>("select public.get_account_deletion_status() as result")).rows[0].result;
  expect(restoredStatus.status).toBe("requested");
  await db.exec("reset role;");
  const requestId = (await db.query<{ request_id: string }>(`select request_id from ledger_private.account_deletion_requests where user_id='${drill}' order by requested_at desc limit 1`)).rows[0].request_id;
  await db.query("select ledger_private.advance_deletion($1::uuid,'in_progress')", [requestId]);
  await asUser(drill);
  expect((await db.query<{ result: { status: string } }>("select public.get_account_deletion_status() as result")).rows[0].result.status).toBe("in_progress");
  await db.exec("reset role;");
  await db.query("select ledger_private.advance_deletion($1::uuid,'failed','auth-deletion-unproven')", [requestId]);
  await asUser(drill);
  expect((await db.query<{ result: { status: string; failureCode: string } }>("select public.get_account_deletion_status() as result")).rows[0].result).toMatchObject({ status: "failed", failureCode: "auth-deletion-unproven" });
  await db.exec("reset role;");
  await expect(db.query("select ledger_private.advance_deletion($1::uuid,'completed')", [requestId])).rejects.toThrow(/proof/);
});
