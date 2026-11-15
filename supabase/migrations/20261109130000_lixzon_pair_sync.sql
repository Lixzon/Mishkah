create extension if not exists pgcrypto with schema extensions;

create table if not exists public.lixzon_sync_pairs (
  pair_id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

create table if not exists public.lixzon_paired_sync_records (
  pair_id uuid not null references public.lixzon_sync_pairs (pair_id) on delete cascade,
  record_key text not null check (
    record_key ~ '^(furqan[.]progression|mishkah[.]engagement|furqan[.]memorized:[0-9]{1,3}:[0-9]{1,3}|quran[.]daily-highlight:[0-9]{4}-[0-9]{2}-[0-9]{2})$'
  ),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and octet_length(payload::text) <= 32768
  ),
  updated_at timestamptz not null default now(),
  primary key (pair_id, record_key)
);

alter table public.lixzon_sync_pairs enable row level security;
alter table public.lixzon_paired_sync_records enable row level security;
revoke all on table public.lixzon_sync_pairs from anon, authenticated;
revoke all on table public.lixzon_paired_sync_records from anon, authenticated;

create or replace function public.create_lixzon_sync_pair(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_pair_id uuid;
begin
  if p_code !~ '^[A-HJ-NP-Z2-9]{20}$' then
    raise exception 'Invalid pairing code';
  end if;

  insert into public.lixzon_sync_pairs (code_hash)
  values (encode(extensions.digest(convert_to(p_code, 'UTF8'), 'sha256'), 'hex'))
  returning pair_id into new_pair_id;

  return new_pair_id;
end;
$$;

create or replace function public.join_lixzon_sync_pair(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_pair_id uuid;
begin
  if p_code !~ '^[A-HJ-NP-Z2-9]{20}$' then
    raise exception 'Invalid pairing code';
  end if;

  select pair_id into existing_pair_id
  from public.lixzon_sync_pairs
  where code_hash = encode(extensions.digest(convert_to(p_code, 'UTF8'), 'sha256'), 'hex');

  if existing_pair_id is null then
    raise exception 'Pairing code not found';
  end if;

  update public.lixzon_sync_pairs
  set last_used_at = pg_catalog.now()
  where pair_id = existing_pair_id;

  return existing_pair_id;
end;
$$;

create or replace function public.read_lixzon_paired_records(p_code text)
returns table(record_key text, payload jsonb, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_pair_id uuid;
begin
  if p_code !~ '^[A-HJ-NP-Z2-9]{20}$' then
    raise exception 'Invalid pairing code';
  end if;

  select pair_id into requested_pair_id
  from public.lixzon_sync_pairs
  where code_hash = encode(extensions.digest(convert_to(p_code, 'UTF8'), 'sha256'), 'hex');

  if requested_pair_id is null then
    raise exception 'Pairing code not found';
  end if;

  update public.lixzon_sync_pairs
  set last_used_at = pg_catalog.now()
  where pair_id = requested_pair_id;

  return query
  select records.record_key, records.payload, records.updated_at
  from public.lixzon_paired_sync_records as records
  where records.pair_id = requested_pair_id;
end;
$$;

create or replace function public.upsert_lixzon_paired_records(p_code text, p_records jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_pair_id uuid;
  item jsonb;
  item_key text;
  item_payload jsonb;
begin
  if p_code !~ '^[A-HJ-NP-Z2-9]{20}$' then
    raise exception 'Invalid pairing code';
  end if;

  select pair_id into requested_pair_id
  from public.lixzon_sync_pairs
  where code_hash = encode(extensions.digest(convert_to(p_code, 'UTF8'), 'sha256'), 'hex');

  if requested_pair_id is null then
    raise exception 'Pairing code not found';
  end if;
  if jsonb_typeof(p_records) <> 'array' or jsonb_array_length(p_records) > 100 then
    raise exception 'Invalid sync batch';
  end if;

  for item in select value from jsonb_array_elements(p_records)
  loop
    item_key := item ->> 'record_key';
    item_payload := item -> 'payload';
    if item_key !~ '^(furqan[.]progression|mishkah[.]engagement|furqan[.]memorized:[0-9]{1,3}:[0-9]{1,3}|quran[.]daily-highlight:[0-9]{4}-[0-9]{2}-[0-9]{2})$'
       or jsonb_typeof(item_payload) <> 'object'
       or octet_length(item_payload::text) > 32768 then
      raise exception 'Invalid sync record';
    end if;

    insert into public.lixzon_paired_sync_records (pair_id, record_key, payload, updated_at)
    values (requested_pair_id, item_key, item_payload, pg_catalog.now())
    on conflict (pair_id, record_key) do update
      set payload = excluded.payload,
          updated_at = excluded.updated_at;
  end loop;

  update public.lixzon_sync_pairs
  set last_used_at = pg_catalog.now()
  where pair_id = requested_pair_id;
end;
$$;

revoke all on function public.create_lixzon_sync_pair(text) from public;
revoke all on function public.join_lixzon_sync_pair(text) from public;
revoke all on function public.read_lixzon_paired_records(text) from public;
revoke all on function public.upsert_lixzon_paired_records(text, jsonb) from public;
grant execute on function public.create_lixzon_sync_pair(text) to anon, authenticated;
grant execute on function public.join_lixzon_sync_pair(text) to anon, authenticated;
grant execute on function public.read_lixzon_paired_records(text) to anon, authenticated;
grant execute on function public.upsert_lixzon_paired_records(text, jsonb) to anon, authenticated;
