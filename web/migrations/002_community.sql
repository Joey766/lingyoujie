do $$
begin
  if not exists(select 1 from pg_roles where rolname='lyj_runtime') then
    create role lyj_runtime nologin noinherit;
  end if;
end $$;
grant lyj_runtime to current_user;
revoke all on public."user", public.session, public.account, public.verification, public."rateLimit" from lyj_runtime;

create schema community;
revoke all on schema community from public;
grant usage on schema community to lyj_runtime;
alter default privileges in schema community revoke execute on functions from public;

create table community.topics (slug text primary key, name text not null, mark text not null, position int not null unique);
insert into community.topics values
  ('study','学习、教育与 AI','学',1),('work','工作与能力','职',2),('venture','做事与复盘','做',3),
  ('relations','关系与期待','情',4),('choices','选择与代价','路',5),('daily','日常与吐槽','日',6),('merit','标准讨论','问',7);
create type community.visibility as enum ('public','hidden','deleted');
create type community.kind as enum ('story','question','thought','review','daily');
create type community.report_reason as enum ('privacy','harassment','spam','other');
create table community.posts (
  id uuid primary key default gen_random_uuid(), author_id text not null references public."user"(id) on delete cascade,
  topic text not null references community.topics(slug), kind community.kind not null,
  title text not null check (char_length(btrim(title)) between 1 and 68),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  anonymous boolean not null default false, featured boolean not null default false,
  visibility community.visibility not null default 'public', created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index on community.posts (created_at desc,id) where visibility='public';
create index on community.posts (topic,created_at desc) where visibility='public';
create index on community.posts (author_id,created_at desc);
create table community.thread_identities (
  post_id uuid references community.posts(id) on delete cascade, author_id text references public."user"(id) on delete cascade,
  anonymous boolean not null, number int,
  primary key(post_id,author_id), unique(post_id,number), check(anonymous=(number is not null))
);
create table community.comments (
  id uuid primary key default gen_random_uuid(), post_id uuid not null references community.posts(id) on delete cascade,
  author_id text not null references public."user"(id) on delete cascade,
  root_id uuid, reply_to uuid, body text not null check(char_length(btrim(body)) between 1 and 800),
  visibility community.visibility not null default 'public', created_at timestamptz not null default now(), edited_at timestamptz,
  unique(post_id,id),
  foreign key(post_id,root_id) references community.comments(post_id,id) on delete cascade,
  foreign key(post_id,reply_to) references community.comments(post_id,id) on delete cascade,
  check ((root_id is null)=(reply_to is null))
);
create index on community.comments (post_id,created_at) where visibility='public';
create index on community.comments (author_id,created_at desc);
create table community.bookmarks (
  user_id text references public."user"(id) on delete cascade, post_id uuid references community.posts(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(user_id,post_id)
);
create table community.reactions (
  user_id text references public."user"(id) on delete cascade, post_id uuid references community.posts(id) on delete cascade,
  primary key(user_id,post_id)
);
create table community.notices (
  id uuid primary key default gen_random_uuid(), recipient text not null references public."user"(id) on delete cascade,
  post_id uuid not null references community.posts(id) on delete cascade,
  comment_id uuid not null references community.comments(id) on delete cascade,
  kind text not null check(kind in ('comment','reply')), created_at timestamptz not null default now(), read_at timestamptz,
  unique(recipient,comment_id)
);
create index on community.notices(recipient,created_at desc);
create table community.reports (
  id uuid primary key default gen_random_uuid(), reporter text not null references public."user"(id) on delete cascade,
  post_id uuid not null references community.posts(id) on delete cascade, comment_id uuid,
  reason community.report_reason not null, state text not null default 'open' check(state in ('open','dismissed','hidden')),
  created_at timestamptz not null default now(), reviewed_at timestamptz,
  foreign key(post_id,comment_id) references community.comments(post_id,id) on delete cascade,
  unique nulls not distinct(reporter,post_id,comment_id)
);
create table community.admins (user_id text primary key references public."user"(id) on delete cascade);
create table community.moderation_log (
  id bigint generated always as identity primary key, admin_id text references public."user"(id) on delete set null,
  report_id uuid not null references community.reports(id) on delete cascade,
  decision text not null check(decision in ('dismissed','hidden')), created_at timestamptz not null default now()
);
create table community.write_limits (
  user_id text references public."user"(id) on delete cascade, category text not null,
  bucket timestamptz not null, hits int not null, primary key(user_id,category)
);

create function community.viewer() returns text language sql stable set search_path=pg_catalog
as $$ select nullif(current_setting('lyj.user_id',true),'') $$;
create function community.actor() returns text language plpgsql stable security definer set search_path=pg_catalog,community
as $$
declare uid text:=community.viewer();
begin
  if uid is null or not exists(select 1 from public."user" where id=uid and "emailVerified") then
    raise exception 'authentication_required' using errcode='42501';
  end if;
  return uid;
end $$;
create function community.is_admin() returns boolean language sql stable security definer set search_path=pg_catalog,community
as $$ select exists(select 1 from community.admins a join public."user" u on u.id=a.user_id where a.user_id=community.viewer() and u."emailVerified") $$;

alter table community.posts enable row level security;
alter table community.comments enable row level security;
alter table community.thread_identities enable row level security;
alter table community.bookmarks enable row level security;
alter table community.reactions enable row level security;
alter table community.notices enable row level security;
alter table community.reports enable row level security;
alter table community.admins enable row level security;
alter table community.moderation_log enable row level security;
alter table community.write_limits enable row level security;
create policy reads_own_bookmarks on community.bookmarks for select to lyj_runtime using (user_id=community.viewer());
create policy reads_own_notices on community.notices for select to lyj_runtime using (recipient=community.viewer());

-- Projections intentionally have no author/account IDs, emails, or profile URLs.
create view community.post_feed with (security_barrier=true) as
select p.id,p.topic,p.kind,p.title,p.body,p.anonymous,p.featured,p.created_at,p.edited_at,
  case when p.anonymous then '匿名楼主' else u.name end as author,
  coalesce(c.total,0)::int as comment_count, coalesce(c.last_comment,p.created_at) as activity,
  coalesce(p.author_id=community.viewer(),false) as owned,
  exists(select 1 from community.bookmarks b where b.post_id=p.id and b.user_id=community.viewer()) as saved,
  exists(select 1 from community.reactions r where r.post_id=p.id and r.user_id=community.viewer()) as resonated
from community.posts p join public."user" u on u.id=p.author_id
left join lateral (
  select count(*) total,max(created_at) last_comment from community.comments where post_id=p.id and visibility='public'
) c on true where p.visibility='public';

create view community.comment_feed with (security_barrier=true) as
select c.id,c.post_id,c.root_id,c.reply_to,c.created_at,c.edited_at,
  case when c.visibility='public' then c.body else null end as body,
  case when c.visibility<>'public' then '已移除'
       when c.author_id=p.author_id and p.anonymous then '匿名楼主'
       when i.anonymous then '匿名用户 '||i.number::text
       else u.name end as author,
  c.visibility='public' and coalesce(c.author_id=community.viewer(),false) as owned,
  c.visibility='public' and c.author_id=p.author_id as is_op
from community.comments c join community.posts p on p.id=c.post_id
join public."user" u on u.id=c.author_id
left join community.thread_identities i on i.post_id=c.post_id and i.author_id=c.author_id
where p.visibility='public' and (c.visibility='public' or
  (c.root_id is null and exists(select 1 from community.comments child where child.root_id=c.id and child.visibility='public')));

create view community.my_posts with (security_barrier=true) as
select id,title,topic,visibility,anonymous,created_at from community.posts
where author_id=community.viewer() and visibility<>'deleted';
create view community.my_notices with (security_barrier=true) as
select n.id,n.post_id,n.comment_id,n.kind,n.created_at,n.read_at,
  case when p.visibility='public' then p.title end as title,
  p.visibility='public' and c.visibility='public' as available
from community.notices n join community.posts p on p.id=n.post_id join community.comments c on c.id=n.comment_id
where n.recipient=community.viewer();

create function community.throttle(uid text, action text, ceiling int) returns void
language plpgsql security definer set search_path=pg_catalog,community as $$
declare current_bucket timestamptz:=date_trunc('minute',clock_timestamp()); total int;
begin
  insert into community.write_limits(user_id,category,bucket,hits) values(uid,action,current_bucket,1)
  on conflict(user_id,category) do update set hits=case when write_limits.bucket=current_bucket then write_limits.hits+1 else 1 end,
  bucket=current_bucket returning hits into total;
  if total>ceiling then raise exception 'rate_limited' using errcode='P0001'; end if;
end $$;

create function community.publish_post(subject text, content text, target_topic text, style community.kind, hidden_name boolean)
returns uuid language plpgsql security definer set search_path=pg_catalog,community as $$
declare uid text:=community.actor(); result uuid;
begin
  perform community.throttle(uid,'post',4);
  insert into community.posts(author_id,topic,kind,title,body,anonymous)
  values(uid,target_topic,style,btrim(subject),btrim(content),hidden_name) returning id into result;
  return result;
end $$;

create function community.edit_post(target uuid, subject text, content text, target_topic text, style community.kind)
returns void language plpgsql security definer set search_path=pg_catalog,community as $$
declare uid text:=community.actor();
begin
  perform community.throttle(uid,'edit',12);
  update community.posts set title=btrim(subject),body=btrim(content),topic=target_topic,kind=style,edited_at=now()
  where id=target and author_id=uid and visibility='public';
  if not found then raise exception 'not_allowed' using errcode='42501'; end if;
end $$;

create function community.delete_post(target uuid) returns void language plpgsql security definer set search_path=pg_catalog,community as $$
declare uid text:=community.actor();
begin
  update community.posts set visibility='deleted' where id=target and author_id=uid and visibility<>'deleted';
  if not found then raise exception 'not_allowed' using errcode='42501'; end if;
end $$;

create function community.add_comment(target uuid, parent uuid, content text, hidden_name boolean)
returns uuid language plpgsql security definer set search_path=pg_catalog,community as $$
declare uid text:=community.actor(); post_owner text; op_anon boolean; root uuid; reply_owner text; result uuid;
begin
  perform community.throttle(uid,'comment',10);
  perform pg_advisory_xact_lock(hashtextextended(target::text,0));
  select author_id,anonymous into post_owner,op_anon from community.posts where id=target and visibility='public' for share;
  if not found then raise exception 'not_allowed' using errcode='42501'; end if;
  if parent is not null then
    select coalesce(root_id,id),author_id into root,reply_owner from community.comments
    where post_id=target and id=parent and visibility='public' for share;
    if not found then raise exception 'not_allowed' using errcode='42501'; end if;
  end if;
  if uid=post_owner then hidden_name:=op_anon; end if;
  insert into community.thread_identities(post_id,author_id,anonymous,number)
  select target,uid,hidden_name,case when hidden_name then coalesce(max(number),0)+1 end
  from community.thread_identities where post_id=target
  on conflict(post_id,author_id) do nothing;
  insert into community.comments(post_id,author_id,root_id,reply_to,body)
  values(target,uid,root,parent,btrim(content)) returning id into result;
  if reply_owner is not null and reply_owner<>uid then
    insert into community.notices(recipient,post_id,comment_id,kind) values(reply_owner,target,result,'reply');
  end if;
  if post_owner<>uid and post_owner is distinct from reply_owner then
    insert into community.notices(recipient,post_id,comment_id,kind) values(post_owner,target,result,'comment');
  end if;
  return result;
end $$;

create function community.edit_comment(target uuid, content text) returns void
language plpgsql security definer set search_path=pg_catalog,community as $$
declare uid text:=community.actor();
begin
  perform community.throttle(uid,'edit',12);
  update community.comments c set body=btrim(content),edited_at=now() where c.id=target and c.author_id=uid
  and c.visibility='public' and exists(select 1 from community.posts p where p.id=c.post_id and p.visibility='public');
  if not found then raise exception 'not_allowed' using errcode='42501'; end if;
end $$;

create function community.delete_comment(target uuid) returns void
language plpgsql security definer set search_path=pg_catalog,community as $$
declare uid text:=community.actor();
begin
  update community.comments set visibility='deleted' where id=target and author_id=uid and visibility<>'deleted';
  if not found then raise exception 'not_allowed' using errcode='42501'; end if;
end $$;

create function community.set_bookmark(target uuid, enabled boolean) returns void
language plpgsql security definer set search_path=pg_catalog,community as $$
declare uid text:=community.actor();
begin
  perform community.throttle(uid,'interaction',30);
  if not enabled then delete from community.bookmarks where user_id=uid and post_id=target; return; end if;
  if not exists(select 1 from community.posts where id=target and visibility='public') then
    raise exception 'not_allowed' using errcode='42501';
  end if;
  insert into community.bookmarks(user_id,post_id) values(uid,target) on conflict do nothing;
end $$;

create function community.set_reaction(target uuid, enabled boolean) returns void
language plpgsql security definer set search_path=pg_catalog,community as $$
declare uid text:=community.actor();
begin
  perform community.throttle(uid,'interaction',30);
  if not enabled then delete from community.reactions where user_id=uid and post_id=target; return; end if;
  if not exists(select 1 from community.posts where id=target and visibility='public') then
    raise exception 'not_allowed' using errcode='42501';
  end if;
  insert into community.reactions(user_id,post_id) values(uid,target) on conflict do nothing;
end $$;

create function community.mark_notice(target uuid) returns void language plpgsql security definer set search_path=pg_catalog,community as $$
declare uid text:=community.actor();
begin
  update community.notices set read_at=now() where recipient=uid and read_at is null and (target is null or id=target);
end $$;

create function community.report(target uuid, comment uuid, cause community.report_reason) returns void
language plpgsql security definer set search_path=pg_catalog,community as $$
declare uid text:=community.actor();
begin
  perform community.throttle(uid,'report',5);
  if not exists(select 1 from community.posts where id=target and visibility='public') or
     (comment is not null and not exists(select 1 from community.comments where id=comment and post_id=target and visibility='public')) then
    raise exception 'not_allowed' using errcode='42501';
  end if;
  insert into community.reports(reporter,post_id,comment_id,reason) values(uid,target,comment,cause) on conflict do nothing;
end $$;

create function community.review_queue() returns table (
  id uuid,post_id uuid,comment_id uuid,title text,body text,reason community.report_reason,state text,created_at timestamptz
) language plpgsql security definer set search_path=pg_catalog,community as $$
begin
  if not community.is_admin() then raise exception 'not_allowed' using errcode='42501'; end if;
  return query select r.id,r.post_id,r.comment_id,p.title,
    case when r.comment_id is null then p.body else c.body end,r.reason,r.state,r.created_at
  from community.reports r join community.posts p on p.id=r.post_id
  left join community.comments c on c.id=r.comment_id order by (r.state='open') desc,r.created_at desc limit 100;
end $$;

create function community.review(target uuid, decision text) returns void
language plpgsql security definer set search_path=pg_catalog,community as $$
declare uid text:=community.actor(); item community.reports%rowtype;
begin
  if not community.is_admin() or decision is null or decision not in ('dismissed','hidden') then
    raise exception 'not_allowed' using errcode='42501';
  end if;
  select * into item from community.reports where id=target and state='open' for update;
  if not found then raise exception 'not_allowed' using errcode='42501'; end if;
  if decision='hidden' then
    if item.comment_id is null then update community.posts set visibility='hidden' where id=item.post_id and visibility='public';
    else update community.comments set visibility='hidden' where id=item.comment_id and visibility='public'; end if;
  end if;
  update community.reports set state=decision,reviewed_at=now() where id=target;
  insert into community.moderation_log(admin_id,report_id,decision) values(uid,target,decision);
end $$;

revoke all on all tables in schema community from public, lyj_runtime;
revoke all on all functions in schema community from public, lyj_runtime;
grant select on community.topics,community.post_feed,community.comment_feed,
  community.my_posts,community.my_notices,community.bookmarks to lyj_runtime;
grant execute on function community.viewer(),community.is_admin(),
  community.publish_post(text,text,text,community.kind,boolean),community.edit_post(uuid,text,text,text,community.kind),
  community.delete_post(uuid),community.add_comment(uuid,uuid,text,boolean),community.edit_comment(uuid,text),
  community.delete_comment(uuid),community.set_bookmark(uuid,boolean),community.set_reaction(uuid,boolean),
  community.mark_notice(uuid),community.report(uuid,uuid,community.report_reason),community.review_queue(),
  community.review(uuid,text) to lyj_runtime;
