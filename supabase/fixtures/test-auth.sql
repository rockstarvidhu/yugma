-- Bootstrap for a newly created, disposable PostgreSQL database only.
-- Supabase supplies these roles and auth helpers on deployed projects.
-- CI also creates an upgrade database in the same disposable cluster.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
  if exists (
    select 1 from pg_roles where rolname in ('anon', 'authenticated', 'service_role')
      and (rolcanlogin or rolsuper or rolbypassrls <> (rolname = 'service_role'))
  ) then raise exception 'Unsafe fixture role configuration'; end if;
end $$;

create schema auth;
create table auth.users (id uuid primary key);

create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb;
$$;

create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    auth.jwt() ->> 'sub'
  )::uuid;
$$;

grant usage on schema auth to anon, authenticated, service_role;
