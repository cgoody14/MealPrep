-- Add day_of_week to week_meals for day-of-week meal assignment.
-- 0 = Sunday, 1 = Monday, ..., 6 = Saturday. NULL means unassigned.
alter table week_meals
  add column if not exists day_of_week integer check (day_of_week >= 0 and day_of_week <= 6);
