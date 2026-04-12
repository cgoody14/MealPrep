-- ============================================================
-- Household Sharing Migration
-- Run this once in your Supabase SQL Editor:
--   Dashboard → SQL Editor → New query → paste → Run
-- ============================================================

-- 1. Households table: one row per shared household
CREATE TABLE IF NOT EXISTS public.households (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code TEXT UNIQUE NOT NULL
    DEFAULT upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  created_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. User→household mapping: one row per user
CREATE TABLE IF NOT EXISTS public.user_households (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable RLS on new tables
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_households ENABLE ROW LEVEL SECURITY;

-- 4. Helper: get current user's household_id (used in RLS policies)
CREATE OR REPLACE FUNCTION public.get_my_household_id()
RETURNS UUID AS $$
  SELECT household_id FROM public.user_households WHERE user_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- 5. RLS for households: visible to members, updatable by members
CREATE POLICY "hh_select" ON public.households
  FOR SELECT USING (id = public.get_my_household_id());

CREATE POLICY "hh_insert" ON public.households
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- 6. RLS for user_households: see all members, update own row
CREATE POLICY "uh_select" ON public.user_households
  FOR SELECT USING (household_id = public.get_my_household_id());

CREATE POLICY "uh_update" ON public.user_households
  FOR UPDATE USING (user_id = auth.uid());

-- 7. Backfill: create a household for every existing user
DO $$
DECLARE
  u   RECORD;
  hid UUID;
BEGIN
  FOR u IN SELECT id FROM auth.users LOOP
    IF NOT EXISTS (SELECT 1 FROM public.user_households WHERE user_id = u.id) THEN
      INSERT INTO public.households (created_by) VALUES (u.id) RETURNING id INTO hid;
      INSERT INTO public.user_households (user_id, household_id) VALUES (u.id, hid);
    END IF;
  END LOOP;
END $$;

-- 8. Trigger: auto-create household for every new sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user_household()
RETURNS trigger AS $$
DECLARE
  hid UUID;
BEGIN
  INSERT INTO public.households (created_by) VALUES (NEW.id) RETURNING id INTO hid;
  INSERT INTO public.user_households (user_id, household_id) VALUES (NEW.id, hid);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_household ON auth.users;
CREATE TRIGGER on_auth_user_created_household
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_household();

-- 9. Update meals RLS: drop existing policies, create household-scoped ones
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE tablename = 'meals' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.meals', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "meals_select" ON public.meals
  FOR SELECT USING (
    user_id IN (
      SELECT user_id FROM public.user_households
      WHERE household_id = public.get_my_household_id()
    )
  );
CREATE POLICY "meals_insert" ON public.meals
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "meals_update" ON public.meals
  FOR UPDATE USING (
    user_id IN (
      SELECT user_id FROM public.user_households
      WHERE household_id = public.get_my_household_id()
    )
  );
CREATE POLICY "meals_delete" ON public.meals
  FOR DELETE USING (
    user_id IN (
      SELECT user_id FROM public.user_households
      WHERE household_id = public.get_my_household_id()
    )
  );

-- 10. Update week_meals RLS: same pattern
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
           WHERE tablename = 'week_meals' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.week_meals', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "week_meals_select" ON public.week_meals
  FOR SELECT USING (
    user_id IN (
      SELECT user_id FROM public.user_households
      WHERE household_id = public.get_my_household_id()
    )
  );
CREATE POLICY "week_meals_insert" ON public.week_meals
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "week_meals_update" ON public.week_meals
  FOR UPDATE USING (
    user_id IN (
      SELECT user_id FROM public.user_households
      WHERE household_id = public.get_my_household_id()
    )
  );
CREATE POLICY "week_meals_delete" ON public.week_meals
  FOR DELETE USING (
    user_id IN (
      SELECT user_id FROM public.user_households
      WHERE household_id = public.get_my_household_id()
    )
  );
