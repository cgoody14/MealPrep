-- ============================================================
-- Nutrition Tracking
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

ALTER TABLE public.meals
  ADD COLUMN IF NOT EXISTS servings  INT,
  ADD COLUMN IF NOT EXISTS calories  INT,
  ADD COLUMN IF NOT EXISTS protein_g INT,
  ADD COLUMN IF NOT EXISTS carbs_g   INT,
  ADD COLUMN IF NOT EXISTS fat_g     INT;
