-- Adds tier column to households table for paywall gating.
-- Run once in the Supabase SQL Editor.

ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free';

ALTER TABLE public.households
  DROP CONSTRAINT IF EXISTS households_tier_check;

ALTER TABLE public.households
  ADD CONSTRAINT households_tier_check
  CHECK (tier IN ('free', 'pro', 'unlimited'));
