-- Lock the database down.
--
-- Before: anon could SELECT everything, so the publishable key in the page
-- source was enough to read the whole site and walk past the password gate.
--
-- After: every table has RLS enabled and ZERO policies. With RLS on and no
-- permissive policy, Postgres denies by default — anon and authenticated get
-- nothing at all. Only the secret key (service_role, which has BYPASSRLS) can
-- read or write, and that key lives solely on the server.

do $$
declare t text;
begin
  foreach t in array array[
    'itineraries','variants','places','stays','stay_options',
    'legs','days','notes','settings'
  ]
  loop
    execute format('drop policy if exists %I on %I', t || '_read', t);
    execute format('drop policy if exists %I on %I', t || '_write', t);
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

drop policy if exists editors_read on editors;
alter table editors enable row level security;

-- is_editor() was used by the old policies. The allowlist now lives in the
-- `editors` table and is checked by the server before sending a login code,
-- so the function is no longer referenced by any policy. Kept for reference.

-- ---------------------------------------------------------------- sanity
-- Every table should report rls enabled and 0 policies after this runs.
do $$
declare
  bad text;
begin
  select string_agg(c.relname, ', ')
    into bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname in ('itineraries','variants','places','stays','stay_options',
                      'legs','days','notes','settings','editors')
    and (c.relrowsecurity = false
         or exists (select 1 from pg_policies p
                    where p.schemaname = 'public' and p.tablename = c.relname));
  if bad is not null then
    raise exception 'Lockdown incomplete on: %', bad;
  end if;
end $$;
