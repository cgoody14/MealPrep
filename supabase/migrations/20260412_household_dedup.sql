-- ============================================================
-- Household Join + Deduplication Fix
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- Replaces the join function with one that removes duplicate meal
-- names from the joining user before merging the household.
-- ============================================================

CREATE OR REPLACE FUNCTION public.join_household_and_deduplicate(target_household_id UUID)
RETURNS VOID AS $$
DECLARE
  existing_members UUID[];
BEGIN
  -- Get all current members of the target household (excluding self)
  SELECT ARRAY_AGG(user_id) INTO existing_members
  FROM public.user_households
  WHERE household_id = target_household_id
    AND user_id != auth.uid();

  -- Delete the joining user's meals whose names duplicate existing household meals
  IF existing_members IS NOT NULL AND array_length(existing_members, 1) > 0 THEN
    DELETE FROM public.meals
    WHERE user_id = auth.uid()
      AND lower(name) IN (
        SELECT lower(name) FROM public.meals
        WHERE user_id = ANY(existing_members)
      );
  END IF;

  -- Join the household
  UPDATE public.user_households
  SET household_id = target_household_id, joined_at = now()
  WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
