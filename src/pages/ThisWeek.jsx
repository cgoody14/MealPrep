import { useState } from 'react'
import Stars from '../components/Stars'
import MealDetail from '../components/MealDetail'
import { getWeekRange, daysSince } from '../utils/format'

function parseSteps(instructions) {
  return (instructions || '')
    .split(/ \| |\n/)
    .map(s => s.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean)
}

function renderStepText(text) {
  const parts = text.split(/(If desired[,.]?|[Oo]ptional[,:]?)/g)
  return parts.map((part, i) =>
    /^(If desired[,.]?|[Oo]ptional[,:]?)$/.test(part)
      ? <em key={i} className="step-optional">{part}</em>
      : part
  )
}

function CooldownBar({ lastMade }) {
  const days = daysSince(lastMade)
  let color = 'var(--green)'
  if (days < 7) color = '#E05252'
  else if (days < 20) color = 'var(--yellow)'
  return (
    <div className="cooldown-bar-track">
      <div className="cooldown-bar-fill" style={{ backgroundColor: color }} />
    </div>
  )
}

export default function ThisWeek({ meals, weekMeals, loading, addToWeek, removeFromWeek, clearWeek, markMadeToday, onRefresh }) {
  const [clearing, setClearing] = useState(false)
  const [markingId, setMarkingId] = useState(null)
  const [openPanel, setOpenPanel] = useState({})
  const [detailMeal, setDetailMeal] = useState(null)

  const togglePanel = (id, panel) => setOpenPanel(prev => ({
    ...prev,
    [id]: prev[id] === panel ? undefined : panel
  }))

  const handleClearWeek = async () => {
    setClearing(true)
    try { await clearWeek() } finally { setClearing(false) }
  }

  const handleMarkMade = async (mealId) => {
    setMarkingId(mealId)
    try { await markMadeToday(mealId) } finally { setMarkingId(null) }
  }

  const weekMealIds = new Set((weekMeals || []).map(wm => wm.meal_id))

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">This Week</h1>
          <p className="page-subtitle">Your meals for the week. Add from the Rolodex or use the Randomizer. Tap a card to view details.</p>
          <div className="week-header-meta">{getWeekRange()} · {weekMeals.length} meal{weekMeals.length !== 1 ? 's' : ''}</div>
        </div>
        {onRefresh && <button className="btn btn-ghost refresh-btn" onClick={onRefresh} title="Refresh">↻</button>}
      </div>

      <div className="week-actions">
        <button className="btn btn-ghost" onClick={handleClearWeek} disabled={clearing || weekMeals.length === 0}>
          {clearing ? 'Clearing…' : 'Clear Week'}
        </button>
      </div>

      {loading ? (
        <div className="spinner-wrap"><div className="spinner" /></div>
      ) : weekMeals.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <div className="empty-text">No meals this week. Add from the Rolodex or use the Randomizer.</div>
        </div>
      ) : (
        <div className="meal-grid">
          {weekMeals.map((wm, i) => {
            const m = wm.meals
            if (!m) return null
            const days = daysSince(m.last_made)
            const daysText = m.last_made ? (days === 0 ? 'Today' : `${days}d ago`) : 'Never made'
            const panel = openPanel[wm.id]
            const steps = parseSteps(m.instructions)

            return (
              <div
                key={wm.id}
                className="meal-card fade-up"
                style={{ animationDelay: `${i * 40}ms` }}
                onClick={() => setDetailMeal(m)}
              >
                {m.source && <span className="url-ribbon">URL</span>}
                <div className="meal-card-body">
                  <div className="meal-card-header">
                    <h3 className="meal-name">{m.name}</h3>
                    <button
                      className="btn-icon remove-btn"
                      onClick={e => { e.stopPropagation(); removeFromWeek(wm.id) }}
                      title="Remove from week"
                    >✕</button>
                  </div>
                  <Stars rating={m.rating} size="sm" />
                  {m.cook_time && <div className="meal-cook-time">⏱ {m.cook_time}</div>}
                  <div className="meal-meta">
                    {daysText} · <strong>{m.times_made}×</strong> cooked
                  </div>

                  {m.ingredients?.length > 0 && (
                    <div className="chip-row">
                      {m.ingredients.slice(0, 4).map(ing => (
                        <span key={ing} className="chip">{ing}</span>
                      ))}
                      {m.ingredients.length > 4 && (
                        <span className="chip chip-more">+{m.ingredients.length - 4} more</span>
                      )}
                    </div>
                  )}

                  {m.tags?.length > 0 && (
                    <div className="tag-row">
                      {m.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>
                  )}

                  {(m.ingredients?.length > 0 || steps.length > 0) && (
                    <div className="week-card-expand-btns" onClick={e => e.stopPropagation()}>
                      {m.ingredients?.length > 0 && (
                        <button
                          className={`week-card-expand-btn ${panel === 'ing' ? 'active' : ''}`}
                          onClick={() => togglePanel(wm.id, 'ing')}
                        >🧂 Ingredients</button>
                      )}
                      {steps.length > 0 && (
                        <button
                          className={`week-card-expand-btn ${panel === 'instr' ? 'active' : ''}`}
                          onClick={() => togglePanel(wm.id, 'instr')}
                        >📋 Instructions</button>
                      )}
                    </div>
                  )}

                  {panel === 'ing' && m.ingredients?.length > 0 && (
                    <div className="week-card-expandable" onClick={e => e.stopPropagation()}>
                      <div className="chip-row">
                        {m.ingredients.map(ing => <span key={ing} className="chip">{ing}</span>)}
                      </div>
                    </div>
                  )}

                  {panel === 'instr' && steps.length > 0 && (
                    <div className="week-card-expandable" onClick={e => e.stopPropagation()}>
                      <ol className="week-instr-list">
                        {steps.map((step, idx) => (
                          <li key={idx} className="week-instr-step">
                            <span className="instruction-num">{idx + 1}</span>
                            <span className="instruction-step-text">{renderStepText(step)}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>

                <div className="meal-card-footer" onClick={e => e.stopPropagation()}>
                  {m.source && (
                    <a href={m.source} target="_blank" rel="noopener noreferrer" className="source-link">↗ recipe</a>
                  )}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleMarkMade(m.id)}
                    disabled={markingId === m.id}
                  >
                    {markingId === m.id ? 'Saving…' : '✓ Mark Made'}
                  </button>
                </div>
                <CooldownBar lastMade={m.last_made} />
              </div>
            )
          })}
        </div>
      )}

      {detailMeal && (
        <MealDetail
          meal={detailMeal}
          onClose={() => setDetailMeal(null)}
          inWeek={weekMealIds.has(detailMeal.id)}
          onAddToWeek={addToWeek}
          onEdit={() => {}}
          onDelete={() => {}}
        />
      )}
    </div>
  )
}
