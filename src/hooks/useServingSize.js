import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../supabase'

const LS_KEY = 'household-size'

export function useServingSize() {
  const [globalServings, setGlobalState] = useState(
    () => Math.min(12, Math.max(1, parseInt(localStorage.getItem(LS_KEY) || '4', 10) || 4))
  )
  const [perRecipeOverrides, setOverrides] = useState({})
  const [householdId, setHouseholdId] = useState(null)
  const householdIdRef = useRef(null)

  const loadServingSize = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: membership } = await supabase
        .from('user_households')
        .select('household_id')
        .eq('user_id', user.id)
        .single()

      if (!membership?.household_id) return
      setHouseholdId(membership.household_id)
      householdIdRef.current = membership.household_id

      const { data } = await supabase
        .from('household_serving_size')
        .select('serving_size')
        .eq('household_id', membership.household_id)
        .single()

      if (data?.serving_size) {
        const clamped = Math.min(12, Math.max(1, data.serving_size))
        setGlobalState(clamped)
        localStorage.setItem(LS_KEY, String(clamped))
      }
    } catch (err) {
      console.warn('[useServingSize] load failed:', err.message)
    }
  }, [])

  useEffect(() => { loadServingSize() }, [loadServingSize])

  // Real-time subscription — sync when another household member changes the serving size
  useEffect(() => {
    if (!householdId) return
    const channel = supabase
      .channel(`serving-size-${householdId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'household_serving_size',
        filter: `household_id=eq.${householdId}`
      }, (payload) => {
        const newSize = payload.new?.serving_size
        if (newSize) {
          const clamped = Math.min(12, Math.max(1, newSize))
          setGlobalState(clamped)
          setOverrides({})
          localStorage.setItem(LS_KEY, String(clamped))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [householdId])

  const setGlobalServings = useCallback((n) => {
    const clamped = Math.min(12, Math.max(1, n))
    localStorage.setItem(LS_KEY, String(clamped))
    setGlobalState(clamped)
    setOverrides({})
    const hid = householdIdRef.current
    if (hid) {
      supabase.from('household_serving_size')
        .upsert(
          { household_id: hid, serving_size: clamped, updated_at: new Date().toISOString() },
          { onConflict: 'household_id' }
        )
        .then(({ error }) => {
          if (error) console.warn('[useServingSize] upsert error:', error.message)
        })
    }
  }, [])

  const setRecipeOverride = useCallback((mealId, servings) => {
    setOverrides(prev => ({ ...prev, [mealId]: Math.max(1, servings) }))
  }, [])

  const resetRecipeOverride = useCallback((mealId) => {
    setOverrides(prev => { const n = { ...prev }; delete n[mealId]; return n })
  }, [])

  const getEffectiveServings = useCallback((meal) => {
    return perRecipeOverrides[meal?.id] ?? globalServings
  }, [globalServings, perRecipeOverrides])

  return { globalServings, setGlobalServings, perRecipeOverrides, setRecipeOverride, resetRecipeOverride, getEffectiveServings }
}
