-- Shopping items: cross-device sync for checked items and manual additions
-- Each row represents one item (checked or manual) per household per week.

create table if not exists shopping_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  week_start   date not null,
  item_key     text not null,        -- "mealId|||ingredient" or "manual|||name"
  is_checked   boolean not null default false,
  is_manual    boolean not null default false,
  category     text,                 -- only set for manual items
  created_at   timestamptz not null default now(),
  unique (household_id, week_start, item_key)
);

-- Index for fast per-household-per-week lookups
create index if not exists shopping_items_hh_week
  on shopping_items (household_id, week_start);

-- RLS: members of the same household can read and write each other's items
alter table shopping_items enable row level security;

create policy "shopping_items_select"
  on shopping_items for select
  using (household_id = get_my_household_id());

create policy "shopping_items_insert"
  on shopping_items for insert
  with check (household_id = get_my_household_id());

create policy "shopping_items_update"
  on shopping_items for update
  using (household_id = get_my_household_id());

create policy "shopping_items_delete"
  on shopping_items for delete
  using (household_id = get_my_household_id());
