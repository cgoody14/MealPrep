import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { getWeekStart } from '../utils/format'

export function useWeekMeals() {
  const [weekMeals, setWeekMeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const weekStart = getWeekStart()

  const fetchWeekMeals = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error: fetchError } = await supabase
        .from('week_meals')
        .select('*, meals(*)')
        .eq('week_start', weekStart)
        .eq('user_id', user.id)
        .order('added_at', { ascending: true })

      if (fetchError) throw fetchError
      setWeekMeals(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [weekStart])

  useEffect(() => { fetchWeekMeals() }, [fetchWeekMeals])

  const addToWeek = async (meal_id) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error: addError } = await supabase
      .from('week_meals')
      .insert({ meal_id, week_start: weekStart, user_id: user.id })
      .select('*, meals(*)')
      .single()
    if (addError) throw addError
    setWeekMeals(prev => [...prev, data])
    return data
  }

  const updateDayOfWeek = async (id, day) => {
    const { error } = await supabase
      .from('week_meals')
      .update({ day_of_week: day })
      .eq('id', id)
    if (error) throw error
    setWeekMeals(prev => prev.map(wm => wm.id === id ? { ...wm, day_of_week: day } : wm))
  }

  const updateServingsOverride = async (id, servings) => {
    const { error } = await supabase
      .from('week_meals')
      .update({ servings_override: servings })
      .eq('id', id)
    if (error) throw error
    setWeekMeals(prev => prev.map(wm => wm.id === id ? { ...wm, servings_override: servings } : wm))
  }

  const removeFromWeek = async (id) => {
    const { error: removeError } = await supabase
      .from('week_meals')
      .delete()
      .eq('id', id)
    if (removeError) throw removeError
    setWeekMeals(prev => prev.filter(wm => wm.id !== id))
  }

  const clearWeek = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { error: clearError } = await supabase
      .from('week_meals')
      .delete()
      .eq('week_start', weekStart)
      .eq('user_id', user.id)
    if (clearError) throw clearError
    setWeekMeals([])
  }

  return { weekMeals, loading, error, weekStart, fetchWeekMeals, addToWeek, removeFromWeek, clearWeek, updateDayOfWeek, updateServingsOverride }
}
