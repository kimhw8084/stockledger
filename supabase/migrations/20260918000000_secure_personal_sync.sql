-- StockLedger personal sync contract v1. Raw provider/scanner archives and
-- derived snapshots remain local; only the collections named below are valid.
-- Cursor values are server-issued identity values, never client timestamps.
alter table public.ledger_changes add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.ledger_changes add column if not exists deleted boolean not null default false;
alter table public.ledger_changes drop constraint if exists ledger_changes_payload_object;
alter table public.ledger_changes add constraint ledger_changes_payload_object check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 262144);

drop policy if exists own_records_read on public.ledger_records;
drop policy if exists own_changes_read on public.ledger_changes;
create policy own_records_read on public.ledger_records for select to authenticated
  using ((select auth.uid()) = user_id and collection in ('stocks','recipes','customMetrics','eyes','alerts','decisions','outcomes','evaluations','reviewLogs'));
create policy own_changes_read on public.ledger_changes for select to authenticated
  using ((select auth.uid()) = user_id and collection in ('stocks','recipes','customMetrics','eyes','alerts','decisions','outcomes','evaluations','reviewLogs'));

update public.ledger_changes changes
set payload = records.payload, deleted = records.deleted
from public.ledger_records records
where records.user_id = changes.user_id
  and records.collection = changes.collection
  and records.record_id = changes.record_id;

create table if not exists ledger_private.sync_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  contract_version text not null default 'stockledger-personal-sync-v1',
  high_water_cursor bigint not null default 0 check (high_water_cursor >= 0),
  history_floor bigint not null default 0 check (history_floor >= 0),
  invalidated_at timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists ledger_private.account_deletion_requests (
  request_id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  status text not null check (status in ('requested','in_progress','completed','failed')),
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  auth_user_deletion_proven boolean not null default false
);
create unique index if not exists account_deletion_one_active on ledger_private.account_deletion_requests(user_id) where user_id is not null and status in ('requested','in_progress');
alter table ledger_private.sync_state enable row level security;
alter table ledger_private.account_deletion_requests enable row level security;
revoke all on ledger_private.sync_state, ledger_private.account_deletion_requests from public, anon, authenticated;

-- The private function is the only write path. Its owner is derived from the
-- verified Auth claim and every mutable operation is serialized per owner.
create or replace function ledger_private.apply_batch(p_mutation_id uuid, p_changes jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  item jsonb;
  current_revision bigint;
  current_payload jsonb;
  next_revision bigint;
  changed_cursor bigint;
  saved ledger_private.sync_requests%rowtype;
  output jsonb := '[]'::jsonb;
  count_rows bigint;
  boundary_cursor bigint;
  high_water bigint;
begin
  if owner_id is null or not exists (select 1 from auth.users where id = owner_id) then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if exists (select 1 from ledger_private.sync_state where user_id = owner_id and invalidated_at is not null)
     or exists (select 1 from ledger_private.account_deletion_requests where user_id = owner_id and status in ('requested','in_progress','completed')) then
    raise exception 'Account cloud sync is disabled' using errcode = '28000';
  end if;
  if p_mutation_id is null or p_changes is null or jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) > 500 or octet_length(p_changes::text) > 5242880 then
    raise exception 'Invalid or oversized sync batch' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 8084));
  select * into saved from ledger_private.sync_requests where user_id = owner_id and mutation_id = p_mutation_id;
  if found then
    if saved.request_hash <> encode(sha256(convert_to(p_changes::text, 'UTF8')), 'hex') then raise exception 'Mutation ID reused with different content' using errcode = '22023'; end if;
    return saved.response;
  end if;
  if (select count(*) from ledger_private.sync_requests where user_id = owner_id and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Sync rate limit reached; retry in an hour' using errcode = '54000';
  end if;
  for item in select value from jsonb_array_elements(p_changes) loop
    if jsonb_typeof(item) <> 'object' or not (item ?& array['collection','recordId','expectedRevision','payload','deleted'])
      or (item->>'collection') not in ('stocks','recipes','customMetrics','eyes','alerts','decisions','outcomes','evaluations','reviewLogs')
      or length(item->>'recordId') not between 1 and 200
      or jsonb_typeof(item->'payload') <> 'object' or octet_length((item->'payload')::text) > 262144
      or jsonb_typeof(item->'deleted') <> 'boolean'
      or jsonb_typeof(item->'expectedRevision') <> 'number'
      or (item->>'expectedRevision')::numeric < 0
      or trunc((item->>'expectedRevision')::numeric) <> (item->>'expectedRevision')::numeric then
      raise exception 'Invalid record' using errcode = '22023';
    end if;
    select revision, payload into current_revision, current_payload from public.ledger_records
      where user_id = owner_id and collection = item->>'collection' and record_id = item->>'recordId' for update;
    if coalesce(current_revision, 0) <> (item->>'expectedRevision')::bigint then
      raise exception 'Revision conflict for %/%', item->>'collection', item->>'recordId' using errcode = '40001';
    end if;
    if current_revision is not null and (
      (item->>'collection' = 'recipes' and current_payload - 'retiredAt' <> (item->'payload') - 'retiredAt')
      or (item->>'collection' = 'evaluations' and current_payload <> item->'payload')
    ) then
      raise exception 'Published history is immutable; create a new revision' using errcode = '22023';
    end if;
    next_revision := coalesce(current_revision, 0) + 1;
    insert into public.ledger_records(user_id, collection, record_id, revision, payload, deleted)
      values(owner_id, item->>'collection', item->>'recordId', next_revision, item->'payload', (item->>'deleted')::boolean)
      on conflict (user_id, collection, record_id) do update set revision = excluded.revision, payload = excluded.payload, deleted = excluded.deleted, updated_at = now();
    insert into public.ledger_changes(user_id, collection, record_id, revision, payload, deleted)
      values(owner_id, item->>'collection', item->>'recordId', next_revision, item->'payload', (item->>'deleted')::boolean)
      returning cursor into changed_cursor;
    output := output || jsonb_build_array(jsonb_build_object('collection',item->>'collection','recordId',item->>'recordId','revision',next_revision,'cursor',changed_cursor));
  end loop;
  select count(*) into count_rows from public.ledger_records where user_id = owner_id;
  if count_rows > 5000 or (select coalesce(sum(octet_length(payload::text)),0) from public.ledger_records where user_id = owner_id) > 20971520 then
    raise exception 'Personal workspace quota exceeded' using errcode = '54000';
  end if;
  select coalesce(max(cursor),0) into high_water from public.ledger_changes where user_id = owner_id and collection in ('stocks','recipes','customMetrics','eyes','alerts','decisions','outcomes','evaluations','reviewLogs');
  insert into ledger_private.sync_state(user_id, contract_version, high_water_cursor, updated_at)
    values(owner_id, 'stockledger-personal-sync-v1', high_water, now())
    on conflict (user_id) do update set high_water_cursor = greatest(ledger_private.sync_state.high_water_cursor, excluded.high_water_cursor), updated_at = now();
  select cursor into boundary_cursor from public.ledger_changes where user_id = owner_id and collection in ('stocks','recipes','customMetrics','eyes','alerts','decisions','outcomes','evaluations','reviewLogs') order by cursor desc offset 9999 limit 1;
  if boundary_cursor is not null then
    delete from public.ledger_changes where user_id = owner_id and cursor < boundary_cursor;
    update ledger_private.sync_state set history_floor = greatest(history_floor, boundary_cursor - 1), updated_at = now() where user_id = owner_id;
  end if;
  insert into ledger_private.sync_requests(user_id, mutation_id, request_hash, response)
    values(owner_id, p_mutation_id, encode(sha256(convert_to(p_changes::text, 'UTF8')), 'hex'), output);
  delete from ledger_private.sync_requests where user_id = owner_id and created_at < now() - interval '30 days';
  delete from ledger_private.sync_requests where user_id = owner_id and mutation_id in
    (select mutation_id from ledger_private.sync_requests where user_id = owner_id order by created_at desc offset 200);
  return output;
end $$;
revoke all on function ledger_private.apply_batch(uuid,jsonb) from public, anon, authenticated;
grant usage on schema ledger_private to authenticated;
grant execute on function ledger_private.apply_batch(uuid,jsonb) to authenticated;

create or replace function ledger_private.get_high_water_cursor()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid(); high_water bigint;
begin
  if owner_id is null or not exists (select 1 from auth.users where id = owner_id) then raise exception 'Authentication required' using errcode = '28000'; end if;
  if exists (select 1 from ledger_private.sync_state where user_id = owner_id and invalidated_at is not null) then raise exception 'Account cloud sync is disabled' using errcode = '28000'; end if;
  select coalesce(max(cursor),0) into high_water from public.ledger_changes where user_id = owner_id and collection in ('stocks','recipes','customMetrics','eyes','alerts','decisions','outcomes','evaluations','reviewLogs');
  return jsonb_build_object('contractVersion','stockledger-personal-sync-v1','cursor',high_water);
end $$;

create or replace function ledger_private.get_bootstrap_page(p_offset integer, p_limit integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  row_item record;
  item jsonb;
  records jsonb := '[]'::jsonb;
  high_water bigint;
  count_rows integer := 0;
  has_more boolean;
begin
  if owner_id is null or not exists (select 1 from auth.users where id = owner_id) then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_offset is null or p_offset < 0 or p_offset > 5000 or p_limit is null or p_limit < 1 or p_limit > 500 then raise exception 'Invalid bootstrap page bound' using errcode = '22023'; end if;
  if exists (select 1 from ledger_private.sync_state where user_id = owner_id and invalidated_at is not null) then raise exception 'Account cloud sync is disabled' using errcode = '28000'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 8084));
  select coalesce(max(cursor),0) into high_water from public.ledger_changes where user_id = owner_id and collection in ('stocks','recipes','customMetrics','eyes','alerts','decisions','outcomes','evaluations','reviewLogs');
  for row_item in
    select collection, record_id, revision, payload, deleted from public.ledger_records
    where user_id = owner_id and collection in ('stocks','recipes','customMetrics','eyes','alerts','decisions','outcomes','evaluations','reviewLogs')
    order by collection, record_id offset p_offset limit p_limit
  loop
    item := jsonb_build_object('collection', row_item.collection, 'record_id', row_item.record_id, 'revision', row_item.revision, 'payload', row_item.payload, 'deleted', row_item.deleted, 'cursor', high_water);
    if octet_length((records || jsonb_build_array(item))::text) > 5242880 then
      if count_rows = 0 then raise exception 'Bootstrap page exceeds byte bound' using errcode = '54000'; end if;
      exit;
    end if;
    records := records || jsonb_build_array(item);
    count_rows := count_rows + 1;
  end loop;
  select exists(select 1 from public.ledger_records where user_id = owner_id and collection in ('stocks','recipes','customMetrics','eyes','alerts','decisions','outcomes','evaluations','reviewLogs') order by collection, record_id offset p_offset + count_rows limit 1) into has_more;
  return jsonb_build_object('contractVersion','stockledger-personal-sync-v1','cursor',high_water,'nextOffset',p_offset + count_rows,'complete',not has_more,'records',records);
end $$;

create or replace function ledger_private.get_changes(p_after_cursor bigint, p_limit integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  row_item record;
  item jsonb;
  changes jsonb := '[]'::jsonb;
  state_floor bigint := 0;
  high_water bigint := 0;
  last_cursor bigint := p_after_cursor;
  count_rows integer := 0;
  has_more boolean;
begin
  if owner_id is null or not exists (select 1 from auth.users where id = owner_id) then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_after_cursor is null or p_after_cursor < 0 or p_limit is null or p_limit < 1 or p_limit > 500 then raise exception 'Invalid change page bound' using errcode = '22023'; end if;
  if exists (select 1 from ledger_private.sync_state where user_id = owner_id and invalidated_at is not null) then raise exception 'Account cloud sync is disabled' using errcode = '28000'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 8084));
  select coalesce(history_floor,0), coalesce(high_water_cursor,0) into state_floor, high_water from ledger_private.sync_state where user_id = owner_id;
  select greatest(high_water, coalesce(max(cursor),0)) into high_water from public.ledger_changes where user_id = owner_id and collection in ('stocks','recipes','customMetrics','eyes','alerts','decisions','outcomes','evaluations','reviewLogs');
  if p_after_cursor < state_floor then raise exception 'CURSOR_EXPIRED: re-bootstrap is required' using errcode = 'P0001'; end if;
  if p_after_cursor > high_water then raise exception 'Cursor is ahead of the owner high-water cursor' using errcode = '22023'; end if;
  for row_item in
    select cursor, collection, record_id, revision, payload, deleted from public.ledger_changes
    where user_id = owner_id and collection in ('stocks','recipes','customMetrics','eyes','alerts','decisions','outcomes','evaluations','reviewLogs') and cursor > p_after_cursor and cursor <= high_water order by cursor limit p_limit
  loop
    item := jsonb_build_object('cursor', row_item.cursor, 'collection', row_item.collection, 'record_id', row_item.record_id, 'revision', row_item.revision, 'payload', row_item.payload, 'deleted', row_item.deleted);
    if octet_length((changes || jsonb_build_array(item))::text) > 5242880 then
      if count_rows = 0 then raise exception 'Change page exceeds byte bound' using errcode = '54000'; end if;
      exit;
    end if;
    changes := changes || jsonb_build_array(item);
    last_cursor := row_item.cursor;
    count_rows := count_rows + 1;
  end loop;
  select exists(select 1 from public.ledger_changes where user_id = owner_id and collection in ('stocks','recipes','customMetrics','eyes','alerts','decisions','outcomes','evaluations','reviewLogs') and cursor > last_cursor and cursor <= high_water) into has_more;
  return jsonb_build_object('contractVersion','stockledger-personal-sync-v1','highWaterCursor',high_water,'nextCursor',last_cursor,'hasMore',has_more,'changes',changes);
end $$;

revoke all on function ledger_private.get_high_water_cursor() from public, anon, authenticated;
revoke all on function ledger_private.get_bootstrap_page(integer,integer) from public, anon, authenticated;
revoke all on function ledger_private.get_changes(bigint,integer) from public, anon, authenticated;
grant execute on function ledger_private.get_high_water_cursor() to authenticated;
grant execute on function ledger_private.get_bootstrap_page(integer,integer) to authenticated;
grant execute on function ledger_private.get_changes(bigint,integer) to authenticated;

create or replace function public.get_ledger_high_water_cursor()
returns jsonb language sql security invoker set search_path = '' as $$ select ledger_private.get_high_water_cursor(); $$;
create or replace function public.get_ledger_bootstrap_page(p_offset integer, p_limit integer)
returns jsonb language sql security invoker set search_path = '' as $$ select ledger_private.get_bootstrap_page(p_offset, p_limit); $$;
create or replace function public.get_ledger_changes(p_after_cursor bigint, p_limit integer)
returns jsonb language sql security invoker set search_path = '' as $$ select ledger_private.get_changes(p_after_cursor, p_limit); $$;
revoke all on function public.get_ledger_high_water_cursor() from public, anon;
revoke all on function public.get_ledger_bootstrap_page(integer,integer) from public, anon;
revoke all on function public.get_ledger_changes(bigint,integer) from public, anon;
grant execute on function public.get_ledger_high_water_cursor() to authenticated;
grant execute on function public.get_ledger_bootstrap_page(integer,integer) to authenticated;
grant execute on function public.get_ledger_changes(bigint,integer) to authenticated;

create or replace function ledger_private.request_deletion()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  saved ledger_private.account_deletion_requests%rowtype;
begin
  if owner_id is null or not exists (select 1 from auth.users where id = owner_id) then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into saved from ledger_private.account_deletion_requests where user_id = owner_id order by requested_at desc limit 1 for update;
  if found and saved.status <> 'failed' then
    return jsonb_build_object('status',saved.status,'requestedAt',saved.requested_at,'startedAt',saved.started_at,'completedAt',saved.completed_at,'failedAt',saved.failed_at,'failureCode',saved.failure_code,'authUserDeletion',case when saved.auth_user_deletion_proven then 'completed' else 'unproven' end);
  end if;
  insert into ledger_private.account_deletion_requests(user_id,status) values(owner_id,'requested') returning * into saved;
  insert into ledger_private.sync_state(user_id, contract_version, invalidated_at, updated_at)
    values(owner_id, 'stockledger-personal-sync-v1', now(), now())
    on conflict (user_id) do update set invalidated_at = coalesce(ledger_private.sync_state.invalidated_at, now()), updated_at = now();
  -- These are the only cloud-side delivery artifacts currently deployed.
  delete from ledger_private.sync_requests where user_id = owner_id;
  delete from public.ledger_changes where user_id = owner_id;
  delete from public.ledger_records where user_id = owner_id;
  return jsonb_build_object('status',saved.status,'requestedAt',saved.requested_at,'startedAt',saved.started_at,'completedAt',saved.completed_at,'failedAt',saved.failed_at,'failureCode',saved.failure_code,'authUserDeletion','unproven');
end $$;

create or replace function ledger_private.deletion_status()
returns jsonb language sql security definer set search_path = '' as $$
  select case when request_id is null then null else jsonb_build_object('status',status,'requestedAt',requested_at,'startedAt',started_at,'completedAt',completed_at,'failedAt',failed_at,'failureCode',failure_code,'authUserDeletion',case when auth_user_deletion_proven then 'completed' else 'unproven' end) end
  from (select * from ledger_private.account_deletion_requests where user_id = auth.uid() order by requested_at desc limit 1) request;
$$;

-- A future server-controlled operator/worker can advance this request only
-- after using the supported Auth admin API. No client grant is issued.
create or replace function ledger_private.advance_deletion(p_request_id uuid, p_status text, p_failure_code text default null, p_auth_user_deletion_proven boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved ledger_private.account_deletion_requests%rowtype;
begin
  if current_user not in ('postgres','service_role') then raise exception 'Operator authorization required' using errcode = '42501'; end if;
  if p_status not in ('in_progress','completed','failed') then raise exception 'Invalid deletion state' using errcode = '22023'; end if;
  if p_status = 'completed' and not p_auth_user_deletion_proven then raise exception 'Auth deletion proof is required' using errcode = '22023'; end if;
  update ledger_private.account_deletion_requests set status = p_status,
    started_at = case when p_status = 'in_progress' and started_at is null then now() else started_at end,
    completed_at = case when p_status = 'completed' then now() else completed_at end,
    failed_at = case when p_status = 'failed' then now() else failed_at end,
    failure_code = case when p_status = 'failed' then p_failure_code else null end,
    auth_user_deletion_proven = auth_user_deletion_proven or p_auth_user_deletion_proven
    where request_id = p_request_id returning * into saved;
  if not found then raise exception 'Deletion request not found' using errcode = '22023'; end if;
  return jsonb_build_object('status',saved.status,'requestedAt',saved.requested_at,'startedAt',saved.started_at,'completedAt',saved.completed_at,'failedAt',saved.failed_at,'failureCode',saved.failure_code,'authUserDeletion',case when saved.auth_user_deletion_proven then 'completed' else 'unproven' end);
end $$;
revoke all on function ledger_private.request_deletion() from public, anon, authenticated;
revoke all on function ledger_private.deletion_status() from public, anon, authenticated;
revoke all on function ledger_private.advance_deletion(uuid,text,text,boolean) from public, anon, authenticated;
grant execute on function ledger_private.request_deletion() to authenticated;
grant execute on function ledger_private.deletion_status() to authenticated;
create or replace function public.request_account_deletion()
returns jsonb language sql security invoker set search_path = '' as $$ select ledger_private.request_deletion(); $$;
create or replace function public.get_account_deletion_status()
returns jsonb language sql security invoker set search_path = '' as $$ select ledger_private.deletion_status(); $$;
revoke all on function public.request_account_deletion() from public, anon;
revoke all on function public.get_account_deletion_status() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.get_account_deletion_status() to authenticated;
