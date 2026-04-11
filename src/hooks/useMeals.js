import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'

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
      name: "Lemon Herb Chicken Thighs",
      rating: 5,
      last_made: daysAgo(3),
      times_made: 6,
      ingredients: ["chicken thighs","lemon","garlic","rosemary","olive oil","butter"],
      notes: "Pat dry before searing. Finish in oven at 425°F for 20 min. Squeeze lemon at the very end.",
      tags: ["protein","easy","weeknight"],
      source: ""
    },
    {
      user_id: userId,
      name: "Orzo with Brown Butter & Parmesan",
      rating: 4,
      last_made: daysAgo(10),
      times_made: 4,
      ingredients: ["orzo","butter","parmesan","shallots","chicken stock","parsley","black pepper"],
      notes: "Toast orzo in dry pan first for extra nuttiness. Cook like risotto — add stock gradually.",
      tags: ["pasta","sides","vegetarian"],
      source: ""
    },
    {
      user_id: userId,
      name: "Pan-Seared Ribeye with Herb Butter",
      rating: 5,
      last_made: daysAgo(14),
      times_made: 8,
      ingredients: ["ribeye steak","butter","garlic","thyme","rosemary","flaky salt"],
      notes: "Room temp 30 min before cooking. Cast iron screaming hot. Baste continuously. Rest 10 min.",
      tags: ["protein","weekend"],
      source: ""
    },
    {
      user_id: userId,
      name: "Crispy Smashed Potatoes",
      rating: 4,
      last_made: daysAgo(7),
      times_made: 5,
      ingredients: ["baby potatoes","olive oil","garlic powder","rosemary","flaky salt","parmesan"],
      notes: "Boil until fork tender, smash thin, roast 450°F until very crispy. Don't rush the roast.",
      tags: ["sides","vegetarian","crowd-pleaser"],
      source: ""
    },
    {
      user_id: userId,
      name: "Panko-Crusted Cod with Aioli",
      rating: 4,
      last_made: daysAgo(21),
      times_made: 3,
      ingredients: ["cod fillets","panko breadcrumbs","dijon mustard","lemon","parsley","mayo","garlic"],
      notes: "Mustard acts as the glue for breadcrumbs. Broil last 2 min for color.",
      tags: ["seafood","easy","weeknight"],
      source: ""
    },
    {
      user_id: userId,
      name: "Shakshuka with Feta",
      rating: 5,
      last_made: daysAgo(5),
      times_made: 9,
      ingredients: ["eggs","crushed tomatoes","bell peppers","onion","cumin","paprika","feta","harissa"],
      notes: "Low and slow on the sauce. Nestle eggs carefully. Cover to steam — yolks should still jiggle.",
      tags: ["vegetarian","brunch","easy"],
      source: ""
    },
    {
      user_id: userId,
      name: "Slow-Roasted Salmon with Fennel",
      rating: 4,
      last_made: daysAgo(30),
      times_made: 2,
      ingredients: ["salmon fillet","fennel","olive oil","lemon","capers","dill","shallots"],
      notes: "275°F for 25–30 min depending on thickness. Should be just barely opaque in center.",
      tags: ["seafood","healthy","weekend"],
      source: ""
    },
    {
      user_id: userId,
      name: "Weeknight Bolognese",
      rating: 5,
      last_made: daysAgo(18),
      times_made: 11,
      ingredients: ["ground beef","ground pork","rigatoni","whole milk","white wine","onion","carrot","celery","tomato paste","parmesan"],
      notes: "Milk is non-negotiable. Cook meat until very dry before adding wine. Minimum 1hr simmer.",
      tags: ["pasta","crowd-pleaser","weekend"],
      source: ""
    },
    {
      user_id: userId,
      name: "Miso Glazed Eggplant",
      rating: 3,
      last_made: daysAgo(45),
      times_made: 2,
      ingredients: ["eggplant","white miso","mirin","sake","sesame oil","scallions","sesame seeds"],
      notes: "Score the flesh deeply. Salt and press 20 min. Broil high — you want char.",
      tags: ["vegetarian","japanese","sides"],
      source: ""
    },
    {
      user_id: userId,
      name: "Greek Lamb Meatballs with Tzatziki",
      rating: 5,
      last_made: daysAgo(60),
      times_made: 3,
      ingredients: ["ground lamb","garlic","oregano","cumin","egg","breadcrumbs","feta","greek yogurt","cucumber","dill","lemon"],
      notes: "Don't overwork the mix. Refrigerate 30 min before rolling. Sear first then finish in oven.",
      tags: ["protein","greek","weekend","crowd-pleaser"],
      source: ""
    },
    {
      user_id: userId,
      name: "Mushroom Chicken Piccata",
      rating: 4,
      last_made: daysAgo(2),
      times_made: 1,
      ingredients: ["chicken breasts","cremini mushrooms","all-purpose flour","butter","olive oil","lemon juice","capers","chicken broth","white wine","garlic","parsley","salt","black pepper"],
      notes: "Pound chicken thin for even cooking. Don't skip deglazing — the fond is everything. Finish with cold butter off heat for silky sauce.",
      tags: ["protein","italian","weeknight","easy"],
      source: "https://www.allrecipes.com/recipe/15134/mushroom-chicken-piccata/"
    }
  ]
}

export function useMeals() {
  const [meals, setMeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchMeals = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error: fetchError } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      if (data.length === 0) {
        const seeds = SEED_MEALS(user.id)
        const { data: inserted, error: insertError } = await supabase
          .from('meals')
          .insert(seeds)
          .select()
        if (insertError) throw insertError
        setMeals(inserted || [])
      } else {
        setMeals(data)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMeals() }, [fetchMeals])

  const addMeal = async (meal) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')
    const payload = {
      user_id: session.user.id,
      name: meal.name,
      rating: meal.rating ?? 3,
      last_made: meal.last_made ?? null,
      times_made: meal.times_made ?? 0,
      ingredients: meal.ingredients ?? [],
      notes: meal.notes ?? '',
      tags: meal.tags ?? [],
      source: meal.source ?? ''
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
    setMeals(prev => prev.map(m => m.id === id ? data : m))
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
