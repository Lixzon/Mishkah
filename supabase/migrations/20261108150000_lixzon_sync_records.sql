create table if not exists public.lixzon_sync_records (
  user_id uuid not null references auth.users (id) on delete cascade,
  record_key text not null check (
    record_key ~ '^(furqan[.]progression|mishkah[.]engagement|furqan[.]memorized:[0-9]{1,3}:[0-9]{1,3}|quran[.]daily-highlight:[0-9]{4}-[0-9]{2}-[0-9]{2})$'
  ),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and octet_length(payload::text) <= 32768
  ),
  updated_at timestamptz not null default now(),
  primary key (user_id, record_key)
);

alter table public.lixzon_sync_records enable row level security;
revoke all on table public.lixzon_sync_records from anon;
grant select, insert, update, delete on table public.lixzon_sync_records to authenticated;

drop policy if exists "Users read their own LIXZON records" on public.lixzon_sync_records;
create policy "Users read their own LIXZON records"
  on public.lixzon_sync_records for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users insert their own LIXZON records" on public.lixzon_sync_records;
create policy "Users insert their own LIXZON records"
  on public.lixzon_sync_records for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users update their own LIXZON records" on public.lixzon_sync_records;
create policy "Users update their own LIXZON records"
  on public.lixzon_sync_records for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete their own LIXZON records" on public.lixzon_sync_records;
create policy "Users delete their own LIXZON records"
  on public.lixzon_sync_records for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.touch_lixzon_sync_record()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists touch_lixzon_sync_record on public.lixzon_sync_records;
create trigger touch_lixzon_sync_record
  before update on public.lixzon_sync_records
  for each row execute function public.touch_lixzon_sync_record();

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'lixzon_sync_records'
  ) then
    alter publication supabase_realtime add table public.lixzon_sync_records;
  end if;
end;
$$;
