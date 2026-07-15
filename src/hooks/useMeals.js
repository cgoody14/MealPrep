import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../supabase'
import { getTier, canAddRecipe, TierGateError } from '../lib/subscriptions'

const SEED_MEALS = (userId) => {
  const today = new Date()
  const daysAgo = (n) => {
    const d = new Date(today)
    d.setDate(d.getDate() - n)
    return d.toISOString().split('T')[0]
  }
  return [
    {
      user_id: userId,
      name: "Chicken Piccata",
      rating: 5,
      last_made: daysAgo(4),
      times_made: 7,
      ingredients: ["chicken breasts","all-purpose flour","butter","olive oil","garlic","dry white wine","chicken stock","lemon","capers","parsley"],
      notes: "Pound the breasts thin so they cook fast and stay tender. Dredge in flour, sear in butter + oil, then build the pan sauce with wine, stock, lemon and capers. Finish with a knob of cold butter for gloss.",
      tags: ["protein","weeknight","easy"],
      source: "https://cooking.nytimes.com/recipes/1019883-chicken-piccata",
      cook_time: "30 min",
      instructions: "Pound chicken to even thickness and season; dredge lightly in flour.\nSear in butter and olive oil, ~3 min per side, until golden; set aside.\nAdd garlic, then deglaze with white wine and chicken stock; simmer to reduce.\nStir in lemon juice and capers; return chicken to warm through.\nSwirl in cold butter, scatter parsley, and serve over pasta or greens."
    },
    {
      user_id: userId,
      name: "Ground Beef Tacos with Napa Cabbage & Guacamole",
      rating: 5,
      last_made: daysAgo(6),
      times_made: 9,
      ingredients: ["ground beef","chili powder","cumin","paprika","garlic","onion","napa cabbage","avocado","lime","cilantro","tortillas"],
      notes: "Napa cabbage instead of lettuce keeps the crunch without going soggy. Brown the beef hard for the crispy bits, then season. Smash the guac chunky with plenty of lime.",
      tags: ["protein","weeknight","crowd-pleaser"],
      source: "https://feelgoodfoodie.net/recipe/ground-beef-tacos-napa-cabbage-guacamole/",
      cook_time: "25 min",
      instructions: "Brown ground beef with onion until well seared; drain excess fat.\nStir in chili powder, cumin, paprika and garlic with a splash of water; simmer to coat.\nMash avocado with lime, cilantro and salt for a chunky guacamole.\nShred napa cabbage for a crisp topping.\nWarm tortillas and build: beef, cabbage, guacamole, extra lime."
    },
    {
      user_id: userId,
      name: "One-Pot Ratatouille Pasta",
      rating: 5,
      last_made: daysAgo(12),
      times_made: 5,
      ingredients: ["eggplant","zucchini","bell pepper","onion","garlic","crushed tomatoes","short pasta","olive oil","basil","parmesan"],
      notes: "Everything simmers in one pot — the pasta cooks right in the tomatoey vegetables and soaks up all the flavor. Don't rush the eggplant; let it soften fully before the liquids go in.",
      tags: ["vegetarian","pasta","easy"],
      source: "https://cooking.nytimes.com/recipes/1025450-one-pot-ratatouille-pasta",
      cook_time: "35 min",
      instructions: "Sauté onion, bell pepper and eggplant in olive oil until softened.\nAdd zucchini and garlic; cook a few minutes more.\nStir in crushed tomatoes and enough water to cook the pasta.\nAdd the dry pasta, bring to a simmer, and cook until al dente, stirring so it doesn't stick.\nFold in torn basil and finish with grated parmesan."
    },
  ]
}

export function useMeals() {
  const [meals, setMeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userId, setUserId] = useState(null)
  // Guards the one-time seed insert. fetchMeals fires from several concurrent
  // triggers (mount, addMeal's refetch, the Realtime meals/user_households
  // subscriptions); without this lock two of them could both observe an empty
  // list before the localStorage flag is written and each insert SEED_MEALS,
  // duplicating the starter recipes. Set synchronously (no await between the
  // check and the set) so exactly one caller ever seeds per session.
  const seedingRef = useRef(false)

  const fetchMeals = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data, error: fetchError } = await supabase
        .from('meals')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      // Only seed once per user — if the flag is already set, an empty list
      // means they deliberately deleted everything, so respect that.
      const seededKey = `meals-seeded-${user.id}`
      if (data.length === 0 && !localStorage.getItem(seededKey) && !seedingRef.current) {
        // Claim the seed synchronously before any await so a concurrent
        // fetchMeals can't also enter this branch and double-insert.
        seedingRef.current = true
        const seeds = SEED_MEALS(user.id)
        const { data: inserted, error: insertError } = await supabase
          .from('meals')
          .insert(seeds)
          .select()
        if (insertError) throw insertError
        localStorage.setItem(seededKey, '1')
        setMeals(inserted || [])
      } else {
        if (data.length > 0) localStorage.setItem(seededKey, '1')
        setMeals(data)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMeals() }, [fetchMeals])

  // Real-time sync — refetch whenever any household member's meal changes.
  // Supabase Realtime enforces the meals_select RLS policy server-side, so
  // only events for rows this user can already see are delivered.
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`meals-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meals' }, () => {
        fetchMeals()
      })
      // Also watch household membership — when someone joins/leaves, the visible
      // set of meals changes even though no meal rows were touched.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_households' }, () => {
        fetchMeals()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, fetchMeals])

  const addMeal = async (meal) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    // Tier gate — block free-tier users past FREE_RECIPE_LIMIT
    const { data: hm } = await supabase
      .from('user_households')
      .select('household_id')
      .eq('user_id', session.user.id)
      .single()
    const tier = await getTier(hm?.household_id)
    if (!canAddRecipe(meals.length, tier)) {
      throw new TierGateError('RECIPE_LIMIT_REACHED', 'Recipe limit reached for current tier')
    }

    const payload = {
      user_id: session.user.id,
      name: meal.name,
      rating: meal.rating ?? 3,
      last_made: meal.last_made ?? null,
      times_made: meal.times_made ?? 0,
      ingredients: meal.ingredients ?? [],
      notes: meal.notes ?? '',
      tags: meal.tags ?? [],
      source: meal.source ?? '',
      cook_time: meal.cook_time ?? '',
      instructions: meal.instructions ?? '',
      photo_url: meal.photo_url ?? null,
      photo_urls: meal.photo_urls ?? null,
    }
    console.log('[addMeal] inserting payload:', payload)
    const { data, error: addError } = await supabase
      .from('meals')
      .insert([payload])
      .select()
    console.log('[addMeal] response — data:', data, '  error:', addError)
    if (addError) throw addError
    await fetchMeals()
    return data[0]
  }

  const updateMeal = async (id, updates) => {
    const { data, error: updateError } = await supabase
      .from('meals')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (updateError) throw updateError
    await fetchMeals()
    return data
  }

  const deleteMeal = async (id) => {
    const { error: deleteError } = await supabase
      .from('meals')
      .delete()
      .eq('id', id)
    if (deleteError) throw deleteError
    setMeals(prev => prev.filter(m => m.id !== id))
  }

  const markMadeToday = async (id) => {
    const meal = meals.find(m => m.id === id)
    if (!meal) return
    return updateMeal(id, {
      times_made: meal.times_made + 1,
      last_made: new Date().toISOString().split('T')[0]
    })
  }

  return { meals, loading, error, fetchMeals, addMeal, updateMeal, deleteMeal, markMadeToday }
}
