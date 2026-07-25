-- ============================================================
-- Move starter-recipe seeding server-side
-- Run this once in the Supabase SQL Editor.
--
-- Seeding used to run client-side (useMeals.fetchMeals), which raced
-- against the async household-creation trigger and concurrent refetches,
-- occasionally duplicating the 3 starters on a new account's first import.
-- Seeding here, inside the signup trigger, is atomic and runs exactly
-- once — duplication becomes impossible. The client no longer seeds.
--
-- Only new signups are affected; existing users already have their meals.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_household()
RETURNS trigger AS $$
DECLARE
  hid UUID;
BEGIN
  -- Create the user's solo household + membership (unchanged behavior)
  INSERT INTO public.households (created_by) VALUES (NEW.id) RETURNING id INTO hid;
  INSERT INTO public.user_households (user_id, household_id) VALUES (NEW.id, hid);

  -- Seed the 3 starter recipes for this user (same content as the old
  -- client-side SEED_MEALS). last_made uses CURRENT_DATE - N for a
  -- "lived-in" feel; times_made is a plausible count.
  INSERT INTO public.meals
    (user_id, name, rating, last_made, times_made, ingredients, notes, tags, source, cook_time, instructions)
  VALUES
    (
      NEW.id,
      'Chicken Piccata',
      5,
      CURRENT_DATE - 4,
      7,
      ARRAY['chicken breasts','all-purpose flour','butter','olive oil','garlic','dry white wine','chicken stock','lemon','capers','parsley'],
      'Pound the breasts thin so they cook fast and stay tender. Dredge in flour, sear in butter + oil, then build the pan sauce with wine, stock, lemon and capers. Finish with a knob of cold butter for gloss.',
      ARRAY['protein','weeknight','easy'],
      'https://cooking.nytimes.com/recipes/1019883-chicken-piccata',
      '30 min',
      E'Pound chicken to even thickness and season; dredge lightly in flour.\nSear in butter and olive oil, ~3 min per side, until golden; set aside.\nAdd garlic, then deglaze with white wine and chicken stock; simmer to reduce.\nStir in lemon juice and capers; return chicken to warm through.\nSwirl in cold butter, scatter parsley, and serve over pasta or greens.'
    ),
    (
      NEW.id,
      'Ground Beef Tacos with Napa Cabbage & Guacamole',
      5,
      CURRENT_DATE - 6,
      9,
      ARRAY['ground beef','chili powder','cumin','paprika','garlic','onion','napa cabbage','avocado','lime','cilantro','tortillas'],
      'Napa cabbage instead of lettuce keeps the crunch without going soggy. Brown the beef hard for the crispy bits, then season. Smash the guac chunky with plenty of lime.',
      ARRAY['protein','weeknight','crowd-pleaser'],
      'https://feelgoodfoodie.net/recipe/ground-beef-tacos-napa-cabbage-guacamole/',
      '25 min',
      E'Brown ground beef with onion until well seared; drain excess fat.\nStir in chili powder, cumin, paprika and garlic with a splash of water; simmer to coat.\nMash avocado with lime, cilantro and salt for a chunky guacamole.\nShred napa cabbage for a crisp topping.\nWarm tortillas and build: beef, cabbage, guacamole, extra lime.'
    ),
    (
      NEW.id,
      'One-Pot Ratatouille Pasta',
      5,
      CURRENT_DATE - 12,
      5,
      ARRAY['eggplant','zucchini','bell pepper','onion','garlic','crushed tomatoes','short pasta','olive oil','basil','parmesan'],
      'Everything simmers in one pot — the pasta cooks right in the tomatoey vegetables and soaks up all the flavor. Don''t rush the eggplant; let it soften fully before the liquids go in.',
      ARRAY['vegetarian','pasta','easy'],
      'https://cooking.nytimes.com/recipes/1025450-one-pot-ratatouille-pasta',
      '35 min',
      E'Sauté onion, bell pepper and eggplant in olive oil until softened.\nAdd zucchini and garlic; cook a few minutes more.\nStir in crushed tomatoes and enough water to cook the pasta.\nAdd the dry pasta, bring to a simmer, and cook until al dente, stirring so it doesn''t stick.\nFold in torn basil and finish with grated parmesan.'
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger already exists (on_auth_user_created_household, AFTER INSERT ON
-- auth.users) from 20260412_household_sharing.sql, so replacing the function
-- above is sufficient. Recreated here defensively in case it was dropped.
DROP TRIGGER IF EXISTS on_auth_user_created_household ON auth.users;
CREATE TRIGGER on_auth_user_created_household
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_household();
