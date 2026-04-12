-- ============================================================
-- Household Invite Lookup Fix
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- This fixes "Invite code not found" when joining a household.
-- ============================================================

-- The original hh_select policy only lets users see their own household,
-- which blocks looking up someone else's household by invite code.
-- This SECURITY DEFINER function bypasses RLS for the lookup only.

CREATE OR REPLACE FUNCTION public.find_household_by_invite(code text)
RETURNS UUID AS $$
  SELECT id FROM public.households WHERE invite_code = upper(trim(code)) LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
