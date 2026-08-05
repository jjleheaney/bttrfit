-- Starting a block is one transaction.
--
-- PostgREST gives each request its own transaction, so creating the block, its
-- three sentinel lifts and the week 1 baseline sets as separate inserts could
-- half-succeed. That failure mode is worse than most: the partial block holds
-- the one-active-block index, so the user is left unable to retry setup and
-- unable to check in. A single plpgsql function runs in one transaction, so
-- either the whole block exists or none of it does.
--
-- security invoker (the default) is deliberate: the function runs as the caller,
-- so every RLS policy still applies and a forged user_id is still rejected. It
-- takes no user id at all — ownership comes from auth.uid().

create function create_block(
  p_first_name text,
  p_unit_preference unit_preference,
  p_start_date date,
  p_starting_weight numeric,
  p_protein_target_g integer,
  p_weekly_drinks_target integer,
  p_lifts jsonb
)
returns blocks
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_block public.blocks;
  v_lift jsonb;
  v_lift_id uuid;
begin
  if v_user_id is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  if jsonb_typeof(p_lifts) is distinct from 'array' or jsonb_array_length(p_lifts) <> 3 then
    raise exception 'a block needs exactly three sentinel lifts' using errcode = '22023';
  end if;

  insert into public.profiles (id, first_name, unit_preference)
  values (v_user_id, p_first_name, p_unit_preference)
  on conflict (id) do update
    set first_name = excluded.first_name,
        unit_preference = excluded.unit_preference;

  insert into public.blocks (
    user_id,
    block_number,
    start_date,
    starting_weight,
    protein_target_g,
    weekly_drinks_target
  )
  values (
    v_user_id,
    -- Numbered per user, and the unique (user_id, block_number) constraint
    -- rejects the race if two setups are submitted at once.
    coalesce((select max(block_number) from public.blocks where user_id = v_user_id), 0) + 1,
    p_start_date,
    p_starting_weight,
    p_protein_target_g,
    p_weekly_drinks_target
  )
  returning * into v_block;

  for v_lift in select * from jsonb_array_elements(p_lifts)
  loop
    insert into public.sentinel_lifts (block_id, slot, lift_key, display_name)
    values (
      v_block.id,
      (v_lift ->> 'slot')::integer,
      v_lift ->> 'lift_key',
      v_lift ->> 'display_name'
    )
    returning id into v_lift_id;

    -- Week 1 is the baseline the rest of the block is measured against, so it is
    -- written here rather than left for the user's first lift log.
    insert into public.lift_entries (sentinel_lift_id, week_number, reps, weight)
    values (
      v_lift_id,
      1,
      (v_lift ->> 'reps')::integer,
      (v_lift ->> 'weight')::numeric
    );
  end loop;

  return v_block;
end;
$$;

revoke all on function create_block(
  text, unit_preference, date, numeric, integer, integer, jsonb
) from public;

grant execute on function create_block(
  text, unit_preference, date, numeric, integer, integer, jsonb
) to authenticated;
