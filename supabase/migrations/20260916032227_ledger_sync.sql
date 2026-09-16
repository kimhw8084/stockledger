-- Personal, versioned records. Raw provider archives remain local until licensed
-- redistribution/storage rights are configured. Never grant client DML directly.
create schema if not exists ledger_private;
revoke all on schema ledger_private from public, anon, authenticated;

create table public.ledger_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  collection text not null check (collection in ('stocks','recipes','customMetrics','eyes','alerts','decisions','outcomes','snapshots','evaluations','reviewLogs','scannerSettings')),
  record_id text not null check (length(record_id) between 1 and 200),
  revision bigint not null default 1 check (revision > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 262144),
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, collection, record_id)
);
create table public.ledger_changes (
  cursor bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  collection text not null,
  record_id text not null,
  revision bigint not null,
  changed_at timestamptz not null default now()
);
create index ledger_changes_owner_cursor on public.ledger_changes (user_id, cursor);
create table ledger_private.sync_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  mutation_id uuid not null,
  request_hash text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, mutation_id)
);
create index sync_requests_owner_created on ledger_private.sync_requests (user_id, created_at);
alter table public.ledger_records enable row level security;
alter table public.ledger_changes enable row level security;
alter table ledger_private.sync_requests enable row level security;
revoke all on public.ledger_records, public.ledger_changes from anon, authenticated;
grant select on public.ledger_records, public.ledger_changes to authenticated;
create policy own_records_read on public.ledger_records for select to authenticated using ((select auth.uid()) = user_id);
create policy own_changes_read on public.ledger_changes for select to authenticated using ((select auth.uid()) = user_id);

-- A private definer is required to perform the atomic operation while clients
-- have SELECT-only grants. Caller identity is obtained from verified Auth claims,
-- never passed as a request field or taken from editable user metadata.
create function ledger_private.apply_batch(p_mutation_id uuid, p_changes jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  item jsonb;
  current_revision bigint;
  current_payload jsonb;
  next_revision bigint;
  saved ledger_private.sync_requests%rowtype;
  output jsonb := '[]'::jsonb;
  count_rows bigint;
begin
  if owner_id is null or not exists (select 1 from auth.users where id = owner_id) then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_mutation_id is null or p_changes is null or jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) > 500 or octet_length(p_changes::text) > 5242880 then
    raise exception 'Invalid or oversized sync batch' using errcode = '22023';
  end if;
  -- Serializing each owner's writes keeps cursors ordered by commit for that owner.
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
      or jsonb_typeof(item->'payload') <> 'object' or jsonb_typeof(item->'deleted') <> 'boolean'
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
    insert into public.ledger_changes(user_id, collection, record_id, revision) values(owner_id, item->>'collection', item->>'recordId', next_revision);
    output := output || jsonb_build_array(jsonb_build_object('collection',item->>'collection','recordId',item->>'recordId','revision',next_revision));
  end loop;
  select count(*) into count_rows from public.ledger_records where user_id = owner_id;
  if count_rows > 5000 or (select coalesce(sum(octet_length(payload::text)),0) from public.ledger_records where user_id = owner_id) > 20971520 then
    raise exception 'Personal workspace quota exceeded' using errcode = '54000';
  end if;
  insert into ledger_private.sync_requests(user_id, mutation_id, request_hash, response) values(owner_id, p_mutation_id, encode(sha256(convert_to(p_changes::text, 'UTF8')), 'hex'), output);
  -- Retain request dedupe for 30 days. Revision preconditions still prevent old replays.
  delete from ledger_private.sync_requests where user_id = owner_id and created_at < now() - interval '30 days';
  delete from ledger_private.sync_requests where user_id = owner_id and mutation_id in
    (select mutation_id from ledger_private.sync_requests where user_id = owner_id order by created_at desc offset 200);
  -- The pilot client reads full records. Bound audit metadata until cursor sync is introduced.
  delete from public.ledger_changes where user_id = owner_id and cursor <
    (select cursor from public.ledger_changes where user_id = owner_id order by cursor desc offset 9999 limit 1);
  return output;
end $$;
revoke all on function ledger_private.apply_batch(uuid,jsonb) from public, anon, authenticated;
grant usage on schema ledger_private to authenticated;
grant execute on function ledger_private.apply_batch(uuid,jsonb) to authenticated;
create function public.apply_ledger_batch(p_mutation_id uuid, p_changes jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select ledger_private.apply_batch(p_mutation_id, p_changes);
$$;
revoke all on function public.apply_ledger_batch(uuid,jsonb) from public, anon;
grant execute on function public.apply_ledger_batch(uuid,jsonb) to authenticated;
