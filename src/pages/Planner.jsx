import { useState, useMemo } from 'react'
import Stars from '../components/Stars'
import { buildShoppingList } from '../utils/shopping'
import { daysSince } from '../utils/format'

export default function Planner({ meals, addToWeek, weekMeals }) {
  const [countInput, setCountInput] = useState('5')
  const [cooldown, setCooldown] = useState(1)
  const [ingInput, setIngInput] = useState('')
  const [results, setResults] = useState([])
  const [generated, setGenerated] = useState(false)
  const [addedIds, setAddedIds] = useState(new Set())
  const [copied, setCopied] = useState(false)
  const [countError, setCountError] = useState('')

  const weekMealIds = new Set((weekMeals || []).map(wm => wm.meal_id))

  const handleGenerate = () => {
    const count = parseInt(countInput, 10) || 0
    if (count === 0) {
      setCountError('Enter a number of meals to generate')
      return
    }
    setCountError('')

    const keywords = ingInput
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)

    const cooldownDays = cooldown * 7
    const now = new Date()

    const eligible = meals.filter(m => {
      const days = m.last_made ? Math.floor((now - new Date(m.last_made)) / 86400000) : 999
      return days >= cooldownDays
    })

    // Weighted random selection — higher-rated and less-recently-made meals are
    // more likely to appear, but all eligible meals have a real chance each time.
    const weighted = eligible.map(m => {
      const days = m.last_made ? Math.floor((now - new Date(m.last_made)) / 86400000) : 999
      const recency = days >= 30 ? 1.0 : days >= 14 ? 0.6 : 0.3
      const keywordBoost = keywords.filter(kw =>
        (m.ingredients || []).some(i => i.toLowerCase().includes(kw))
      ).length * 2
      const weight = Math.max(0.5, ((m.rating || 3) + keywordBoost) * Math.log((m.times_made || 0) + 2) * recency)
      const _matchedKeywords = keywords.filter(kw =>
        (m.ingredients || []).some(i => i.toLowerCase().includes(kw))
      )
      return { ...m, weight, _matchedKeywords }
    })

    const selected = []
    const pool = [...weighted]
    for (let i = 0; i < Math.min(count, pool.length); i++) {
      const total = pool.reduce((s, m) => s + m.weight, 0)
      let rand = Math.random() * total
      for (let j = 0; j < pool.length; j++) {
        rand -= pool[j].weight
        if (rand <= 0) { selected.push(pool[j]); pool.splice(j, 1); break }
      }
    }

    setResults(selected)
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
              type="text"
              inputMode="numeric"
              value={countInput}
              onChange={e => {
                const raw = e.target.value.replace(/[^0-9]/g, '')
                setCountInput(raw)
              }}
              onBlur={e => {
                if (e.target.value === '' || e.target.value === '0') setCountInput('0')
              }}
              placeholder="0"
            />
            {countError && <div className="form-error" style={{ marginTop: 6 }}>{countError}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">
              {cooldown === 0
                ? 'No cooldown — all meals eligible'
                : `Skip meals made within the last ${cooldown} week${cooldown === 1 ? '' : 's'}`}
            </label>
            <input
              className="range-input"
              type="range"
              min="0"
              max="13"
              value={cooldown}
              onChange={e => setCooldown(Number(e.target.value))}
            />
            <div className="range-labels">
              <span>0 weeks</span>
              <span>13 weeks</span>
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
