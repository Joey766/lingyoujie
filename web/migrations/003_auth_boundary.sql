-- Keep internal authentication tables outside the privileges of browser API roles.
do $$
declare api_role text;
begin
  foreach api_role in array array['anon','authenticated','service_role'] loop
    if exists(select 1 from pg_roles where rolname=api_role) then
      execute format('revoke all on public."user", public.session, public.account, public.verification, public."rateLimit" from %I',api_role);
    end if;
  end loop;
end $$;

create table public.auth_attempt (
  key text primary key, hits integer not null, expires_at timestamptz not null
);
revoke all on public.auth_attempt from public;
do $$
declare api_role text;
begin
  foreach api_role in array array['anon','authenticated','service_role'] loop
    if exists(select 1 from pg_roles where rolname=api_role) then
      execute format('revoke all on public.auth_attempt from %I',api_role);
    end if;
  end loop;
end $$;

create function community.my_thread_identity(target uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,community as $$
  select case when p.author_id=community.viewer() then p.anonymous else i.anonymous end
  from community.posts p
  left join community.thread_identities i on p.id=i.post_id and i.author_id=community.viewer()
  where p.id=target and p.visibility='public'
$$;
revoke all on function community.my_thread_identity(uuid) from public;
grant execute on function community.my_thread_identity(uuid) to lyj_runtime;
