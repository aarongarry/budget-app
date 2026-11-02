-- Run once in the Supabase SQL editor. All data is behind server-validated sessions.
begin;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists budget_private;
revoke all on schema budget_private from public, anon, authenticated;
create table if not exists budget_private.account (
 id integer primary key check(id=1), username text not null, password_hash text not null
);
create table if not exists budget_private.sessions (
 token_hash text primary key, expires_at timestamptz not null
);
create table if not exists budget_private.login_attempts (
 id bigint generated always as identity primary key, attempted_at timestamptz not null default now()
);
create table if not exists budget_private.document (
 id integer primary key check(id=1), revision integer not null default 0,
 state jsonb not null default '{"months":{},"entries":{}}'::jsonb
);
alter table budget_private.account enable row level security;
alter table budget_private.sessions enable row level security;
alter table budget_private.login_attempts enable row level security;
alter table budget_private.document enable row level security;
insert into budget_private.account values(1,'admin',extensions.crypt('admin',extensions.gen_salt('bf',12))) on conflict do nothing;
insert into budget_private.document(id) values(1) on conflict do nothing;

create or replace function public.budget_login(login_name text,login_password text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare new_token text;
begin
 perform pg_advisory_xact_lock(724838);
 delete from budget_private.login_attempts where attempted_at<now()-interval '15 minutes';
 if (select count(*) from budget_private.login_attempts)>=15 then
  return jsonb_build_object('error','Too many attempts. Try again in 15 minutes.');
 end if;
 insert into budget_private.login_attempts default values;
 if length(login_name)>100 or length(login_password)>200 or not exists(
  select 1 from budget_private.account where username=login_name and password_hash=extensions.crypt(login_password,password_hash)
 ) then return jsonb_build_object('error','Incorrect username or password.'); end if;
 delete from budget_private.login_attempts where id > 0;
 delete from budget_private.sessions where expires_at<now();
 new_token=encode(extensions.gen_random_bytes(32),'hex');
 insert into budget_private.sessions values(encode(extensions.digest(new_token,'sha256'),'hex'),now()+interval '365 days');
 return jsonb_build_object('token',new_token);
end; $$;
create or replace function public.budget_read(session_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from budget_private.sessions where token_hash=encode(extensions.digest(session_token,'sha256'),'hex') and expires_at>now()) then return '{"unauthorized":true}'::jsonb; end if;
 return (select jsonb_build_object('revision',revision,'state',state) from budget_private.document where id=1);
end; $$;
create or replace function public.budget_write(session_token text,expected_revision integer,next_state jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare doc budget_private.document%rowtype;
begin
 if not exists(select 1 from budget_private.sessions where token_hash=encode(extensions.digest(session_token,'sha256'),'hex') and expires_at>now()) then return '{"unauthorized":true}'::jsonb; end if;
 if jsonb_typeof(next_state)<>'object' or jsonb_typeof(next_state->'months') is distinct from 'object' or jsonb_typeof(next_state->'entries') is distinct from 'object' or octet_length(next_state::text)>10000000 then raise exception 'Invalid budget data'; end if;
 select * into doc from budget_private.document where id=1 for update;
 if doc.revision<>expected_revision then return jsonb_build_object('conflict',true,'revision',doc.revision,'state',doc.state); end if;
 update budget_private.document set state=next_state,revision=revision+1 where id=1;
 return jsonb_build_object('revision',doc.revision+1);
end; $$;
create or replace function public.budget_logout(session_token text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 delete from budget_private.sessions where token_hash=encode(extensions.digest(session_token,'sha256'),'hex'); return true;
end; $$;
revoke all on function public.budget_login(text,text) from public, authenticated;
revoke all on function public.budget_read(text) from public, authenticated;
revoke all on function public.budget_write(text,integer,jsonb) from public, authenticated;
revoke all on function public.budget_logout(text) from public, authenticated;
grant execute on function public.budget_login(text,text) to anon;
grant execute on function public.budget_read(text) to anon;
grant execute on function public.budget_write(text,integer,jsonb) to anon;
grant execute on function public.budget_logout(text) to anon;
commit;
