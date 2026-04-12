-- ============================================================
-- Household Join Fix
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- This fixes "new row violates row-level security policy" when joining.
-- ============================================================

-- PostgreSQL applies the SELECT policy as an implicit WITH CHECK on UPDATE,
-- which blocks changing household_id to a household the user can't yet see.
-- This SECURITY DEFINER function bypasses RLS for the update only.

CREATE OR REPLACE FUNCTION public.join_household_by_id(target_household_id UUID)
RETURNS VOID AS $$
  UPDATE public.user_households
  SET household_id = target_household_id, joined_at = now()
  WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;
