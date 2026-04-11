import { useState, useEffect, useRef, useMemo } from 'react'
import { buildShoppingList, enrichIngredientsWithQuantities } from '../utils/shopping'
import { getWeekRange, getWeekStart } from '../utils/format'

export default function Shopping({ weekMeals, loading }) {
  const weekStart = getWeekStart()
  const storageKey = `shop-checked-${weekStart}`

  const [checked, setChecked] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(storageKey) || '[]'))
    } catch { return new Set() }
  })
  const [copied, setCopied] = useState(false)
  const [quantities, setQuantities] = useState({}) // { [meal.id]: string[] | 'loading' }
  const fetchedRef = useRef(new Set())

  const mealObjects = useMemo(() => weekMeals.map(wm => wm.meals).filter(Boolean), [weekMeals])
  const categories = useMemo(() => buildShoppingList(mealObjects), [mealObjects])

  const totalItems = Object.values(categories).reduce((sum, items) => sum + items.length, 0)
  const totalCategories = Object.keys(categories).length

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify([...checked]))
  }, [checked, storageKey])

  // Fetch quantities for each meal once per session, cached by meal.id
  useEffect(() => {
    mealObjects.forEach(meal => {
      if (!meal.ingredients?.length) return
      if (fetchedRef.current.has(meal.id)) return
      fetchedRef.current.add(meal.id)
      setQuantities(prev => ({ ...prev, [meal.id]: 'loading' }))
      enrichIngredientsWithQuantities(meal.name, meal.ingredients).then(result => {
        setQuantities(prev => ({ ...prev, [meal.id]: result }))
      })
    })
  }, [mealObjects])

  const toggleChecked = (item) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(item)) next.delete(item)
      else next.add(item)
      return next
    })
  }

  const allItemsText = Object.entries(categories)
    .map(([cat, items]) => `${cat}:\n${items.map(i => `  - ${i}`).join('\n')}`)
    .join('\n\n')

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(allItemsText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="spinner-wrap"><div className="spinner" /></div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Shopping List</h1>
          <p className="page-subtitle">Auto-generated from this week's meals. Check off items as you shop — your progress saves automatically and resets each new week.</p>
          <div className="week-header-meta">
            {totalItems} item{totalItems !== 1 ? 's' : ''} across {totalCategories} categor{totalCategories !== 1 ? 'ies' : 'y'}
            {' · '}{getWeekRange()}
          </div>
        </div>
        <button className="btn btn-secondary" onClick={handleCopyAll} disabled={totalItems === 0}>
          {copied ? '✓ Copied' : 'Copy All'}
        </button>
      </div>

      {totalItems === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🛒</div>
          <div className="empty-text">Add meals to This Week to generate your shopping list.</div>
        </div>
      ) : (
        <>
          {/* By Recipe — always expanded at top */}
          <div className="shop-section">
            <div className="shop-section-title">By Recipe</div>
            <div className="by-recipe-grid">
              {mealObjects.map(meal => {
                const qData = quantities[meal.id]
                const isLoading = qData === 'loading'
                const enriched = Array.isArray(qData) ? qData : (meal.ingredients || [])

                return (
                  <div key={meal.id} className="by-recipe-card card">
                    <div className="by-recipe-card-header">
                      <span className="by-recipe-card-name">{meal.name}</span>
                      {isLoading && <span className="qty-loading">Adding quantities…</span>}
                    </div>
                    <ul className="shop-item-list">
                      {enriched.map(ing => (
                        <li
                          key={ing}
                          className={`shop-item ${checked.has(ing) ? 'checked' : ''}`}
                          onClick={() => toggleChecked(ing)}
                        >
                          <span className="shop-checkbox">{checked.has(ing) ? '✓' : ''}</span>
                          <span className="shop-item-label">{ing}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>

          {/* All Items by Category */}
          <div className="shop-section">
            <div className="shop-section-title">All Items by Category</div>
            <div className="shop-grid">
              {Object.entries(categories).map(([cat, items]) => (
                <div key={cat} className="shop-card card">
                  <div className="shop-card-title">{cat}</div>
                  <ul className="shop-item-list">
                    {items.map(item => (
                      <li
                        key={item}
                        className={`shop-item ${checked.has(item) ? 'checked' : ''}`}
                        onClick={() => toggleChecked(item)}
                      >
                        <span className="shop-checkbox">{checked.has(item) ? '✓' : ''}</span>
                        <span className="shop-item-label">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
