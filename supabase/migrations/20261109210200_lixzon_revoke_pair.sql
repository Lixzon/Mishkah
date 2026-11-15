create or replace function public.revoke_lixzon_sync_pair(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  revoked_pair_id uuid;
begin
  if p_code is null or p_code !~ '^[A-HJ-NP-Z2-9]{20}$' then
    raise exception 'Invalid pairing code';
  end if;

  delete from public.lixzon_sync_pairs
  where code_hash = encode(extensions.digest(convert_to(p_code, 'UTF8'), 'sha256'), 'hex')
  returning pair_id into revoked_pair_id;

  return revoked_pair_id is not null;
end;
$$;

revoke all on function public.revoke_lixzon_sync_pair(text) from public;
grant execute on function public.revoke_lixzon_sync_pair(text) to anon, authenticated;
