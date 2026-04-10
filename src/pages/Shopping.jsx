import { useState, useEffect, useMemo } from 'react'
import { buildShoppingList } from '../utils/shopping'
import { getWeekRange, getWeekStart } from '../utils/format'

export default function Shopping({ weekMeals, loading }) {
  const weekStart = getWeekStart()
  const storageKey = `shop-checked-${weekStart}`

  const [checked, setChecked] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(storageKey) || '[]'))
    } catch { return new Set() }
  })
  const [byRecipeOpen, setByRecipeOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const mealObjects = useMemo(() => weekMeals.map(wm => wm.meals).filter(Boolean), [weekMeals])
  const categories = useMemo(() => buildShoppingList(mealObjects), [mealObjects])

  const totalItems = Object.values(categories).reduce((sum, items) => sum + items.length, 0)
  const totalCategories = Object.keys(categories).length

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify([...checked]))
  }, [checked, storageKey])

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
          <div className="page-subtitle">
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
                      <span className="shop-checkbox">
                        {checked.has(item) ? '✓' : ''}
                      </span>
                      <span className="shop-item-label">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="by-recipe-section">
            <button
              className="by-recipe-toggle"
              onClick={() => setByRecipeOpen(o => !o)}
            >
              {byRecipeOpen ? '▼' : '▶'} By Recipe
            </button>
            {byRecipeOpen && (
              <div className="by-recipe-content">
                {mealObjects.map(meal => (
                  <div key={meal.id} className="by-recipe-meal">
                    <div className="by-recipe-meal-name">{meal.name}</div>
                    <div className="chip-row">
                      {(meal.ingredients || []).map(ing => (
                        <span key={ing} className="chip">{ing}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
