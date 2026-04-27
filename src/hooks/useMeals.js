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
      name: "Weeknight Bolognese",
      rating: 5,
      last_made: daysAgo(18),
      times_made: 11,
      ingredients: ["ground beef","ground pork","rigatoni","whole milk","white wine","onion","carrot","celery","tomato paste","parmesan"],
      notes: "Milk is non-negotiable. Cook meat until very dry before adding wine. Minimum 1hr simmer.",
      tags: ["pasta","crowd-pleaser","weekend"],
      source: ""
    },
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
      source: meal.source ?? '',
      cook_time: meal.cook_time ?? '',
      instructions: meal.instructions ?? '',
      photo_url: meal.photo_url ?? null,
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
