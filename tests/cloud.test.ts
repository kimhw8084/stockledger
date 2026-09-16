import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
const db = new PGlite();
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid$$;
    grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
    insert into auth.users values ('${owner}'),('${other}');`);
  for (const file of readdirSync("supabase/migrations").filter(file => file.endsWith(".sql")).sort()) await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
}, 30000);
afterAll(() => db.close());
const asUser = async (user: string) => { await db.exec("reset role; set role authenticated;"); await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]); };
const change = (revision: number, payload = { id: "stock-1", symbol: "ABC" }) => [{ collection: "stocks", recordId: "stock-1", expectedRevision: revision, deleted: false, payload }];
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
