-- ============================================================
-- Server-side paywall enforcement
-- Run this once in the Supabase SQL Editor.
--
-- The client (canAddRecipe / canJoinHousehold) already gates these,
-- but the anon key is public, so a determined user could call the
-- Supabase API directly and bypass the client. These DB-level checks
-- are the backstop that holds regardless of client.
-- ============================================================

-- 1. Recipe cap by household tier, enforced on every meal INSERT.
--    Count is per household (all members' meals), matching the client's
--    household-scoped meals.length. Limits: free 10, pro 50, unlimited ∞.
CREATE OR REPLACE FUNCTION public.enforce_recipe_limit()
RETURNS trigger AS $$
DECLARE
  hid       UUID;
  h_tier    TEXT;
  meal_cnt  INT;
  lim       INT;
BEGIN
  -- Household of the inserting user
  SELECT household_id INTO hid
  FROM public.user_households
  WHERE user_id = NEW.user_id;

  -- No household yet (shouldn't happen post-signup) — allow.
  IF hid IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(tier, 'free') INTO h_tier
  FROM public.households
  WHERE id = hid;

  lim := CASE h_tier
           WHEN 'unlimited' THEN NULL   -- no cap
           WHEN 'pro'       THEN 50
           ELSE                  10     -- free (and any unknown tier)
         END;

  IF lim IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count existing meals across the whole household
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

DROP TRIGGER IF EXISTS enforce_recipe_limit_trigger ON public.meals;
CREATE TRIGGER enforce_recipe_limit_trigger
  BEFORE INSERT ON public.meals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_recipe_limit();


-- 2. Harden the household-join RPC: the TARGET household must be on a
--    paid tier for new members to join (household-based billing — the
--    inviter pays). Mirrors the client gate in useHousehold.joinHousehold.
--    Body is unchanged from 20260412_household_dedup.sql apart from the
--    added tier check at the top.
CREATE OR REPLACE FUNCTION public.join_household_and_deduplicate(target_household_id UUID)
RETURNS VOID AS $$
DECLARE
  existing_members UUID[];
  target_tier      TEXT;
BEGIN
  -- Tier gate — only paid households accept new members.
  SELECT COALESCE(tier, 'free') INTO target_tier
  FROM public.households
  WHERE id = target_household_id;

  IF target_tier NOT IN ('pro', 'unlimited') THEN
    RAISE EXCEPTION 'HOUSEHOLD_JOIN_BLOCKED: target household is on the free plan'
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
