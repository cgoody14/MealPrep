-- ============================================================
-- Retune Pro tier: 20-recipe cap, household sharing is Unlimited-only.
-- Run this once in the Supabase SQL Editor.
--
-- Replaces the two enforcement functions from 20260709 so the server
-- matches the new client rules:
--   free  = 10 recipes, no sharing
--   pro   = 20 recipes, no sharing
--   unlimited = ∞ recipes, household sharing
-- ============================================================

-- 1. Recipe cap: pro drops from 50 to 20.
CREATE OR REPLACE FUNCTION public.enforce_recipe_limit()
RETURNS trigger AS $$
DECLARE
  hid       UUID;
  h_tier    TEXT;
  meal_cnt  INT;
  lim       INT;
BEGIN
  SELECT household_id INTO hid
  FROM public.user_households
  WHERE user_id = NEW.user_id;

  IF hid IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(tier, 'free') INTO h_tier
  FROM public.households
  WHERE id = hid;

  lim := CASE h_tier
           WHEN 'unlimited' THEN NULL   -- no cap
           WHEN 'pro'       THEN 20
           ELSE                  10     -- free (and any unknown tier)
         END;

  IF lim IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO meal_cnt
  FROM public.meals m
  JOIN public.user_households uh ON uh.user_id = m.user_id
  WHERE uh.household_id = hid;

  IF meal_cnt >= lim THEN
    RAISE EXCEPTION 'RECIPE_LIMIT_REACHED: % tier is capped at % recipes', h_tier, lim
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Household join: now Unlimited-only (was pro OR unlimited).
CREATE OR REPLACE FUNCTION public.join_household_and_deduplicate(target_household_id UUID)
RETURNS VOID AS $$
DECLARE
  existing_members UUID[];
  target_tier      TEXT;
BEGIN
  -- Tier gate — household sharing is an Unlimited-only feature.
  SELECT COALESCE(tier, 'free') INTO target_tier
  FROM public.households
  WHERE id = target_household_id;

  IF target_tier <> 'unlimited' THEN
    RAISE EXCEPTION 'HOUSEHOLD_JOIN_BLOCKED: household sharing requires the Unlimited plan'
      USING ERRCODE = 'check_violation';
  END IF;

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
