import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../supabase'
import { getWeekStart } from '../utils/format'

// Syncs shopping list checked state and manual items to Supabase for cross-device
// household sync. Falls back to localStorage if household_id is unavailable.
export function useShoppingItems() {
  const weekStart = getWeekStart()
  const storageKey = `shop-checked-${weekStart}`
  const manualKey = `shop-manual-${weekStart}`

  const [householdId, setHouseholdId] = useState(null)
  const [recipeChecked, setRecipeChecked] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(storageKey) || '[]')) }
    catch { return new Set() }
  })
  const [manualItems, setManualItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(manualKey) || '[]') }
    catch { return [] }
  })
  const loadedRef = useRef(false)
  const householdIdRef = useRef(null)

  // Load household_id then fetch items from Supabase
  const loadItems = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: membership } = await supabase
        .from('user_households')
        .select('household_id')
        .eq('user_id', user.id)
        .single()

      if (!membership?.household_id) return

      const hid = membership.household_id
      setHouseholdId(hid)
      householdIdRef.current = hid

      const { data: rows } = await supabase
        .from('shopping_items')
        .select('*')
        .eq('household_id', hid)
        .eq('week_start', weekStart)

      if (!rows) return

      const checked = new Set()
      const manual = []

      rows.forEach(row => {
        if (row.is_manual) {
          const name = row.item_key.replace(/^manual\|\|\|/, '')
          manual.push({ name, category: row.category || 'Other' })
          if (row.is_checked) checked.add(`manual|||${name}`)
        } else if (row.is_checked) {
          checked.add(row.item_key)
        }
      })

      setRecipeChecked(checked)
      setManualItems(manual)
      // Mirror to localStorage as offline cache
      localStorage.setItem(storageKey, JSON.stringify([...checked]))
      localStorage.setItem(manualKey, JSON.stringify(manual))
      loadedRef.current = true
    } catch (err) {
      console.warn('[useShoppingItems] load failed, using localStorage:', err.message)
    }
  }, [weekStart, storageKey, manualKey])

  useEffect(() => { loadItems() }, [loadItems])

  // Real-time subscription — refresh on any change to this household's shopping items
  useEffect(() => {
    if (!householdId) return
    const channel = supabase
      .channel(`shopping-${householdId}-${weekStart}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'shopping_items',
        filter: `household_id=eq.${householdId}`
      }, () => {
        loadItems()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [householdId, weekStart, loadItems])

  // Persist checked key to Supabase (upsert) and local state simultaneously
  const upsertKey = useCallback(async (key, checked) => {
    const hid = householdIdRef.current
    if (hid) {
      supabase.from('shopping_items').upsert(
        { household_id: hid, week_start: weekStart, item_key: key, is_checked: checked, is_manual: false },
        { onConflict: 'household_id,week_start,item_key' }
      ).then(({ error }) => { if (error) console.warn('[useShoppingItems] upsert error:', error.message) })
    }
  }, [weekStart])

  const toggleRecipeIng = useCallback((mealId, origIng) => {
    const key = `${mealId}|||${origIng}`
    setRecipeChecked(prev => {
      const next = new Set(prev)
      const nowChecked = !next.has(key)
      if (nowChecked) next.add(key); else next.delete(key)
      localStorage.setItem(storageKey, JSON.stringify([...next]))
      upsertKey(key, nowChecked)
      return next
    })
  }, [storageKey, upsertKey])

  const toggleCategoryIng = useCallback((ing, mealObjects) => {
    const norm = (s) => s.toLowerCase().trim()
    const meals = mealObjects.filter(m =>
      (m.ingredients || []).some(i => norm(i) === norm(ing))
    )
    setRecipeChecked(prev => {
      const allChecked = meals.every(m => {
        const orig = (m.ingredients || []).find(i => norm(i) === norm(ing))
        return orig && prev.has(`${m.id}|||${orig}`)
      })
      const next = new Set(prev)
      meals.forEach(m => {
        const orig = (m.ingredients || []).find(i => norm(i) === norm(ing))
        if (!orig) return
        const key = `${m.id}|||${orig}`
        if (allChecked) { next.delete(key); upsertKey(key, false) }
        else { next.add(key); upsertKey(key, true) }
      })
      localStorage.setItem(storageKey, JSON.stringify([...next]))
      return next
    })
  }, [storageKey, upsertKey])

  const toggleManual = useCallback((name) => {
    const key = `manual|||${name}`
    setRecipeChecked(prev => {
      const next = new Set(prev)
      const nowChecked = !next.has(key)
      if (nowChecked) next.add(key); else next.delete(key)
      localStorage.setItem(storageKey, JSON.stringify([...next]))
      const hid = householdIdRef.current
      if (hid) {
        supabase.from('shopping_items').upsert(
          { household_id: hid, week_start: weekStart, item_key: key, is_checked: nowChecked, is_manual: true },
          { onConflict: 'household_id,week_start,item_key' }
        ).then(({ error }) => { if (error) console.warn('[useShoppingItems] manual toggle error:', error.message) })
      }
      return next
    })
  }, [storageKey, weekStart])

  const addManualItem = useCallback(async (name, category) => {
    const item = { name, category }
    setManualItems(prev => {
      const next = [...prev, item]
      localStorage.setItem(manualKey, JSON.stringify(next))
      return next
    })
    const hid = householdIdRef.current
    if (hid) {
      const key = `manual|||${name}`
      const { error } = await supabase.from('shopping_items').upsert(
        { household_id: hid, week_start: weekStart, item_key: key, is_checked: false, is_manual: true, category },
        { onConflict: 'household_id,week_start,item_key' }
      )
      if (error) console.warn('[useShoppingItems] addManualItem error:', error.message)
    }
  }, [manualKey, weekStart])

  const removeManualItem = useCallback(async (name) => {
    setManualItems(prev => {
      const next = prev.filter(m => m.name !== name)
      localStorage.setItem(manualKey, JSON.stringify(next))
      return next
    })
    setRecipeChecked(prev => {
      const next = new Set(prev)
      next.delete(`manual|||${name}`)
      localStorage.setItem(storageKey, JSON.stringify([...next]))
      return next
    })
    const hid = householdIdRef.current
    if (hid) {
      const { error } = await supabase.from('shopping_items')
        .delete()
        .eq('household_id', hid)
        .eq('week_start', weekStart)
        .eq('item_key', `manual|||${name}`)
      if (error) console.warn('[useShoppingItems] removeManualItem error:', error.message)
    }
  }, [manualKey, storageKey, weekStart])

  const clearAllItems = useCallback(async () => {
    setRecipeChecked(new Set())
    setManualItems([])
    localStorage.removeItem(storageKey)
    localStorage.removeItem(manualKey)
    const hid = householdIdRef.current
    if (hid) {
      const { error } = await supabase.from('shopping_items')
        .delete()
        .eq('household_id', hid)
        .eq('week_start', weekStart)
      if (error) console.warn('[useShoppingItems] clearAll error:', error.message)
    }
  }, [storageKey, manualKey, weekStart])

  return {
    recipeChecked,
    manualItems,
    toggleRecipeIng,
    toggleCategoryIng,
    toggleManual,
    addManualItem,
    removeManualItem,
    clearAllItems,
  }
}
