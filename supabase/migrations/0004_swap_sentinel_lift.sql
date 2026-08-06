-- Swapping a sentinel lift is one transaction.
--
-- Pointing the slot at a new lift and writing its week 1 baseline are two
-- writes, and the half-done state is the dangerous one: a slot named "Deadlift"
-- carrying the bench press top set it replaced. Every strength comparison for
-- the rest of the block would then be measured against the wrong number, quietly
-- and with the app reporting the swap as failed.
--
-- security invoker (the default), like create_block: the function runs as the
-- caller, so RLS decides whether the slot is theirs, and it takes no user id.

create function swap_sentinel_lift(
  p_sentinel_lift_id uuid,
  p_lift_key text,
  p_display_name text,
  p_reps integer,
  p_weight numeric
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_updated uuid;
begin
  update public.sentinel_lifts
     set lift_key = p_lift_key,
         display_name = p_display_name
   where id = p_sentinel_lift_id
  returning id into v_updated;

  -- RLS turns someone else's slot into zero rows rather than an error, so the
  -- caller has to be told the difference.
  if v_updated is null then
    raise exception 'no such sentinel lift' using errcode = 'P0002';
  end if;

  -- Replaced, never inherited: the new lift's baseline is the set that was
  -- typed for it.
  insert into public.lift_entries (sentinel_lift_id, week_number, reps, weight)
  values (p_sentinel_lift_id, 1, p_reps, p_weight)
  on conflict (sentinel_lift_id, week_number) do update
    set reps = excluded.reps,
        weight = excluded.weight;

  -- Weeks 2 onward belong to the lift that has just been replaced. The swap is
  -- only offered while there are none, so this is the belt to that braces.
  delete from public.lift_entries
   where sentinel_lift_id = p_sentinel_lift_id
     and week_number > 1;
end;
$$;

revoke execute on function swap_sentinel_lift(uuid, text, text, integer, numeric) from public, anon;
grant execute on function swap_sentinel_lift(uuid, text, text, integer, numeric) to authenticated;
