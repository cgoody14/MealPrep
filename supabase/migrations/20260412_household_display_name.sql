-- ============================================================
-- Household Display Names + Member Removal
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Add display_name column to user_households
ALTER TABLE public.user_households
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- 2. Function: remove a member from the household and move them to a new solo household
CREATE OR REPLACE FUNCTION public.remove_household_member(member_user_id UUID)
RETURNS VOID AS $$
DECLARE
  caller_household UUID;
  new_household_id UUID;
BEGIN
  -- Get the caller's household
  SELECT household_id INTO caller_household
  FROM public.user_households
  WHERE user_id = auth.uid();

  -- Verify the target member is in the same household (and not the caller themselves)
  IF NOT EXISTS (
    SELECT 1 FROM public.user_households
    WHERE user_id = member_user_id
      AND household_id = caller_household
      AND user_id != auth.uid()
  ) THEN
    RAISE EXCEPTION 'Member not found in your household';
  END IF;

  -- Create a new solo household for the removed member
  INSERT INTO public.households (created_by)
  VALUES (member_user_id)
  RETURNING id INTO new_household_id;

  -- Move the removed member to their new solo household
  UPDATE public.user_households
  SET household_id = new_household_id, joined_at = now()
  WHERE user_id = member_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
