import { useState, useCallback } from 'react'

const LS_KEY = 'household-size'

export function useServingSize() {
  const [globalServings, setGlobalState] = useState(
    () => Math.min(12, Math.max(1, parseInt(localStorage.getItem(LS_KEY) || '4', 10) || 4))
  )
  const [perRecipeOverrides, setOverrides] = useState({})

  const setGlobalServings = useCallback((n) => {
    const clamped = Math.min(12, Math.max(1, n))
    localStorage.setItem(LS_KEY, String(clamped))
    setGlobalState(clamped)
    setOverrides({})
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
