-- Household-shared serving size — one row per household
-- Lets all members see and sync the "Cooking for X" value in real time.
CREATE TABLE IF NOT EXISTS public.household_serving_size (
  household_id UUID PRIMARY KEY REFERENCES public.households(id) ON DELETE CASCADE,
  serving_size INT NOT NULL DEFAULT 4 CHECK (serving_size BETWEEN 1 AND 20),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.household_serving_size ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hss_select" ON public.household_serving_size
  FOR SELECT USING (household_id = public.get_my_household_id());

CREATE POLICY "hss_insert" ON public.household_serving_size
  FOR INSERT WITH CHECK (household_id = public.get_my_household_id());

CREATE POLICY "hss_update" ON public.household_serving_size
  FOR UPDATE USING (household_id = public.get_my_household_id());
