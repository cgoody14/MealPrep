-- ============================================================
-- Mise en Place — Supabase migrations
-- Run this entire file in:
--   Supabase Dashboard → SQL Editor → New query → Run
-- Project: dmwycrtpirxfchpzohqs
-- ============================================================

-- meals table
create table if not exists meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  rating integer check (rating between 1 and 5),
  last_made date,
  times_made integer default 1,
  ingredients text[],
  notes text,
  tags text[],
  source text default '',
  created_at timestamptz default now()
);

alter table meals enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'meals' and policyname = 'Users manage own meals'
  ) then
    create policy "Users manage own meals" on meals
      for all using (auth.uid() = user_id);
  end if;
end$$;

-- week_meals table
create table if not exists week_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  meal_id uuid references meals(id) on delete cascade,
  week_start date not null,
  added_at timestamptz default now()
);

alter table week_meals enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'week_meals' and policyname = 'Users manage own week_meals'
  ) then
    create policy "Users manage own week_meals" on week_meals
      for all using (auth.uid() = user_id);
  end if;
end$$;
