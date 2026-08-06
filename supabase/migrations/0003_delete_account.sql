-- Deleting your own account.
--
-- Everything the app stores hangs off auth.users by `on delete cascade`, so the
-- one row that has to go is the auth user itself — and that table is not
-- reachable from a client, at any privilege the browser holds. This is the
-- narrowest possible way to expose it: a function that takes no arguments and
-- can only ever delete the caller.
--
-- security definer is required (the caller has no rights on auth.users) and is
-- therefore written defensively: an empty search_path so nothing resolves
-- through a schema the caller controls, a null check so it can never run
-- unauthenticated, and execute revoked from everyone but a signed-in user.

create function delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  delete from auth.users where id = v_user_id;
end;
$$;

revoke execute on function delete_account() from public, anon;
grant execute on function delete_account() to authenticated;
