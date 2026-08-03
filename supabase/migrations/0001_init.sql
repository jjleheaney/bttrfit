-- BTTR Fit initial schema.
--
-- Every table is owned by exactly one user and RLS is enabled everywhere, so a
-- user can only ever read or write their own rows. Ownership of the lift tables
-- is derived through blocks rather than duplicating user_id, which keeps a lift
-- entry from ever disagreeing with the block it belongs to.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create type unit_preference as enum ('kg', 'lbs');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '',
  email text not null default '',
  unit_preference unit_preference not null default 'kg',
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles are readable by their owner"
  on profiles for select using ((select auth.uid()) = id);

create policy "profiles are insertable by their owner"
  on profiles for insert with check ((select auth.uid()) = id);

create policy "profiles are updatable by their owner"
  on profiles for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- A profile row must exist the moment a user signs up, otherwise the block
-- setup flow has nowhere to write the first name and unit preference.
create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, first_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'first_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- blocks
-- ---------------------------------------------------------------------------

create type block_status as enum ('active', 'completed', 'abandoned');

create table blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  block_number integer not null check (block_number > 0),
  start_date date not null,
  -- 8 weeks inclusive of the start date.
  end_date date not null generated always as (start_date + 55) stored,
  starting_weight numeric(6, 2) not null check (starting_weight > 0),
  protein_target_g integer not null check (protein_target_g > 0),
  weekly_drinks_target integer not null default 3 check (weekly_drinks_target >= 0),
  status block_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (user_id, block_number)
);

-- Only one block per user may be active.
create unique index blocks_one_active_per_user
  on blocks (user_id)
  where status = 'active';

create index blocks_user_id_idx on blocks (user_id);

alter table blocks enable row level security;

create policy "blocks are readable by their owner"
  on blocks for select using ((select auth.uid()) = user_id);

create policy "blocks are insertable by their owner"
  on blocks for insert with check ((select auth.uid()) = user_id);

create policy "blocks are updatable by their owner"
  on blocks for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "blocks are deletable by their owner"
  on blocks for delete using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- daily_entries
-- ---------------------------------------------------------------------------

-- Every metric is nullable on purpose: "not answered" must stay distinguishable
-- from "answered no", and a partially completed day is a normal state.
create table daily_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  block_id uuid not null references blocks (id) on delete cascade,
  entry_date date not null,
  weight numeric(6, 2) check (weight > 0),
  protein_hit boolean,
  workout_done boolean,
  sleep_hit boolean,
  steps_hit boolean,
  drinks integer check (drinks >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

create index daily_entries_block_date_idx on daily_entries (block_id, entry_date);

create function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger daily_entries_set_updated_at
  before update on daily_entries
  for each row execute function set_updated_at();

alter table daily_entries enable row level security;

create policy "daily entries are readable by their owner"
  on daily_entries for select using ((select auth.uid()) = user_id);

create policy "daily entries are insertable by their owner"
  on daily_entries for insert with check ((select auth.uid()) = user_id);

create policy "daily entries are updatable by their owner"
  on daily_entries for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "daily entries are deletable by their owner"
  on daily_entries for delete using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- sentinel_lifts
-- ---------------------------------------------------------------------------

create table sentinel_lifts (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references blocks (id) on delete cascade,
  slot smallint not null check (slot between 1 and 3),
  lift_key text not null,
  display_name text not null,
  unique (block_id, slot)
);

create index sentinel_lifts_block_id_idx on sentinel_lifts (block_id);

alter table sentinel_lifts enable row level security;

create policy "sentinel lifts are readable by their owner"
  on sentinel_lifts for select using (
    exists (
      select 1 from blocks
      where blocks.id = sentinel_lifts.block_id
        and blocks.user_id = (select auth.uid())
    )
  );

create policy "sentinel lifts are insertable by their owner"
  on sentinel_lifts for insert with check (
    exists (
      select 1 from blocks
      where blocks.id = sentinel_lifts.block_id
        and blocks.user_id = (select auth.uid())
    )
  );

create policy "sentinel lifts are updatable by their owner"
  on sentinel_lifts for update using (
    exists (
      select 1 from blocks
      where blocks.id = sentinel_lifts.block_id
        and blocks.user_id = (select auth.uid())
    )
  ) with check (
    exists (
      select 1 from blocks
      where blocks.id = sentinel_lifts.block_id
        and blocks.user_id = (select auth.uid())
    )
  );

create policy "sentinel lifts are deletable by their owner"
  on sentinel_lifts for delete using (
    exists (
      select 1 from blocks
      where blocks.id = sentinel_lifts.block_id
        and blocks.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- lift_entries
-- ---------------------------------------------------------------------------

create table lift_entries (
  id uuid primary key default gen_random_uuid(),
  sentinel_lift_id uuid not null references sentinel_lifts (id) on delete cascade,
  week_number smallint not null check (week_number between 1 and 8),
  reps integer not null check (reps > 0),
  weight numeric(6, 2) not null check (weight > 0),
  logged_at timestamptz not null default now(),
  unique (sentinel_lift_id, week_number)
);

create index lift_entries_sentinel_lift_id_idx on lift_entries (sentinel_lift_id);

alter table lift_entries enable row level security;

create policy "lift entries are readable by their owner"
  on lift_entries for select using (
    exists (
      select 1 from sentinel_lifts
      join blocks on blocks.id = sentinel_lifts.block_id
      where sentinel_lifts.id = lift_entries.sentinel_lift_id
        and blocks.user_id = (select auth.uid())
    )
  );

create policy "lift entries are insertable by their owner"
  on lift_entries for insert with check (
    exists (
      select 1 from sentinel_lifts
      join blocks on blocks.id = sentinel_lifts.block_id
      where sentinel_lifts.id = lift_entries.sentinel_lift_id
        and blocks.user_id = (select auth.uid())
    )
  );

create policy "lift entries are updatable by their owner"
  on lift_entries for update using (
    exists (
      select 1 from sentinel_lifts
      join blocks on blocks.id = sentinel_lifts.block_id
      where sentinel_lifts.id = lift_entries.sentinel_lift_id
        and blocks.user_id = (select auth.uid())
    )
  ) with check (
    exists (
      select 1 from sentinel_lifts
      join blocks on blocks.id = sentinel_lifts.block_id
      where sentinel_lifts.id = lift_entries.sentinel_lift_id
        and blocks.user_id = (select auth.uid())
    )
  );

create policy "lift entries are deletable by their owner"
  on lift_entries for delete using (
    exists (
      select 1 from sentinel_lifts
      join blocks on blocks.id = sentinel_lifts.block_id
      where sentinel_lifts.id = lift_entries.sentinel_lift_id
        and blocks.user_id = (select auth.uid())
    )
  );
