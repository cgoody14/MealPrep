-- Add servings_override to week_meals so users can adjust per-week serving count.
-- NULL means use the recipe's default servings.
alter table week_meals
  add column if not exists servings_override integer;
