-- Reusable authenticated credential change. No current credentials belong in source.
create or replace function public.budget_change_login(
 session_token text, current_password text, new_username text, new_password text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller_hash text;
begin
 caller_hash=encode(extensions.digest(session_token,'sha256'),'hex');
 if not exists(select 1 from budget_private.sessions where token_hash=caller_hash and expires_at>now()) then
  return '{"unauthorized":true}'::jsonb;
 end if;
 if not exists(select 1 from budget_private.account where id=1 and password_hash=extensions.crypt(current_password,password_hash)) then
  return '{"error":"Current password is incorrect."}'::jsonb;
 end if;
 if new_username !~ '^[a-zA-Z0-9_-]{3,40}$' or octet_length(new_password)<8 or octet_length(new_password)>72 then
  return '{"error":"Use a username of 3–40 letters, numbers, underscores or hyphens and a password of 8–72 bytes."}'::jsonb;
 end if;
 update budget_private.account set username=new_username,password_hash=extensions.crypt(new_password,extensions.gen_salt('bf',12)) where id=1;
 delete from budget_private.sessions where token_hash<>caller_hash;
 return '{"ok":true}'::jsonb;
end; $$;
revoke all on function public.budget_change_login(text,text,text,text) from public,authenticated;
grant execute on function public.budget_change_login(text,text,text,text) to anon;
