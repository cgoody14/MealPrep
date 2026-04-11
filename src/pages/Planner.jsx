import { useState, useMemo } from 'react'
import Stars from '../components/Stars'
import { plannerScore } from '../utils/scoring'
import { buildShoppingList } from '../utils/shopping'
import { daysSince } from '../utils/format'

export default function Planner({ meals, addToWeek, weekMeals }) {
  const [count, setCount] = useState(5)
  const [cooldown, setCooldown] = useState(7)
  const [ingInput, setIngInput] = useState('')
  const [results, setResults] = useState([])
  const [generated, setGenerated] = useState(false)
  const [addedIds, setAddedIds] = useState(new Set())
  const [copied, setCopied] = useState(false)

  const weekMealIds = new Set((weekMeals || []).map(wm => wm.meal_id))

  const handleGenerate = () => {
    const keywords = ingInput
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)

    const now = new Date()
    const eligible = meals.filter(m => {
      const days = m.last_made ? Math.floor((now - new Date(m.last_made)) / 86400000) : 999
      return days >= cooldown
    })

    const scored = eligible.map(m => ({
      ...m,
      _score: plannerScore(m, keywords),
      _matchedKeywords: keywords.filter(kw =>
        (m.ingredients || []).some(i => i.toLowerCase().includes(kw))
      )
    }))

    scored.sort((a, b) => b._score - a._score)
    setResults(scored.slice(0, count))
    setGenerated(true)
    setAddedIds(new Set())
  }

  const handleAddToWeek = async (meal) => {
    await addToWeek(meal.id)
    setAddedIds(prev => new Set([...prev, meal.id]))
  }

  const shoppingList = useMemo(() => {
    if (results.length === 0) return {}
    return buildShoppingList(results)
  }, [results])

  const shoppingText = Object.entries(shoppingList)
    .map(([cat, items]) => `${cat}: ${items.join(', ')}`)
    .join('\n')

  const handleCopyShop = async () => {
    try {
      await navigator.clipboard.writeText(shoppingText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Meal Randomizer</h1>
      </div>
      <p className="page-subtitle">Generate a randomized meal plan based on your cook history, ratings, and ingredient preferences. Add results directly to This Week.</p>

      <div className="planner-controls card">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Number of meals</label>
            <input
              className="form-input"
              type="number"
              min="1"
              max={meals.length || 10}
              inputMode="numeric"
              value={count}
              onChange={e => {
                const val = parseInt(e.target.value, 10)
                if (!isNaN(val) && val >= 1 && val <= (meals.length || 10)) setCount(val)
              }}
              style={{ MozAppearance: 'textfield' }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              Skip meals made within <strong>{cooldown} days</strong>
            </label>
            <input
              className="range-input"
              type="range"
              min="0"
              max="90"
              value={cooldown}
              onChange={e => setCooldown(Number(e.target.value))}
            />
            <div className="range-labels">
              <span>0 days</span>
              <span>90 days</span>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Preferred ingredients (comma-separated)</label>
          <input
            className="form-input"
            value={ingInput}
            onChange={e => setIngInput(e.target.value)}
            placeholder="e.g. chicken, lemon, garlic"
          />
        </div>

        <button className="btn btn-primary" onClick={handleGenerate} disabled={meals.length === 0}>
          Generate Plan
        </button>
      </div>

      {generated && results.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">◈</div>
          <div className="empty-text">No eligible meals. Try reducing the cooldown window.</div>
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="planner-results">
            {results.map((meal, i) => {
              const days = daysSince(meal.last_made)
              const daysText = meal.last_made ? (days === 0 ? 'Today' : `${days}d ago`) : 'Never made'
              const alreadyInWeek = weekMealIds.has(meal.id)
              const justAdded = addedIds.has(meal.id)

              return (
                <div key={meal.id} className="planner-card fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="planner-rank">{i + 1}</div>
                  <div className="planner-card-body">
                    <div className="planner-card-header">
                      <h3 className="meal-name">{meal.name}</h3>
                      <Stars rating={meal.rating} size="sm" />
                    </div>
                    <div className="meal-meta">
                      {daysText} · <strong>{meal.times_made}×</strong> cooked
                    </div>
                    {meal._matchedKeywords?.length > 0 && (
                      <div className="chip-row">
                        {meal._matchedKeywords.map(kw => (
                          <span key={kw} className="chip chip-match">✓ {kw}</span>
                        ))}
                      </div>
                    )}
                    {meal.tags?.length > 0 && (
                      <div className="tag-row">
                        {meal.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}
                      </div>
                    )}
                    <div className="planner-card-footer">
                      {meal.source && (
                        <a href={meal.source} target="_blank" rel="noopener noreferrer" className="source-link">↗ recipe</a>
                      )}
                      <button
                        className={`btn btn-sm ${alreadyInWeek || justAdded ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={() => handleAddToWeek(meal)}
                        disabled={alreadyInWeek || justAdded}
                      >
                        {alreadyInWeek || justAdded ? '✓ In This Week' : 'Add to This Week'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="planner-shopping card">
            <div className="card-header-row">
              <h2 className="section-title">Shopping List</h2>
              <button className="btn btn-ghost btn-sm" onClick={handleCopyShop}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            {Object.entries(shoppingList).map(([cat, items]) => (
              <div key={cat} className="shop-category">
                <div className="shop-category-label">{cat}</div>
                <div className="chip-row">
                  {items.map(item => <span key={item} className="chip">{item}</span>)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
