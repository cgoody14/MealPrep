import { useState } from 'react'
import Stars from '../components/Stars'
import RandomizeModal from '../components/RandomizeModal'
import SendModal from '../components/SendModal'
import { getWeekRange, daysSince } from '../utils/format'

export default function ThisWeek({ meals, weekMeals, loading, addToWeek, removeFromWeek, clearWeek, markMadeToday }) {
  const [showRandomize, setShowRandomize] = useState(false)
  const [showSend, setShowSend] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [markingId, setMarkingId] = useState(null)

  const handleClearWeek = async () => {
    setClearing(true)
    try { await clearWeek() } finally { setClearing(false) }
  }

  const handleMarkMade = async (mealId) => {
    setMarkingId(mealId)
    try { await markMadeToday(mealId) } finally { setMarkingId(null) }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">This Week</h1>
          <p className="page-subtitle">Queue up meals for the week. Use Randomize to let your ratings and cook history decide — or hand-pick from your Rolodex.</p>
          <div className="week-header-meta">{getWeekRange()} · {weekMeals.length} meal{weekMeals.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <div className="week-actions">
        <button className="btn btn-primary" onClick={() => setShowRandomize(true)}>
          🎲 Randomize For Me
        </button>
        <button className="btn btn-secondary" onClick={() => setShowSend(true)} disabled={weekMeals.length === 0}>
          📤 Send / Share
        </button>
        <button className="btn btn-ghost" onClick={handleClearWeek} disabled={clearing || weekMeals.length === 0}>
          {clearing ? 'Clearing…' : 'Clear Week'}
        </button>
      </div>

      {loading ? (
        <div className="spinner-wrap"><div className="spinner" /></div>
      ) : weekMeals.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <div className="empty-text">No meals this week. Use Randomize or add from the Rolodex.</div>
        </div>
      ) : (
        <div className="week-list">
          {weekMeals.map((wm, i) => {
            const m = wm.meals
            if (!m) return null
            const days = daysSince(m.last_made)
            const daysText = m.last_made ? (days === 0 ? 'Today' : `${days}d ago`) : 'Never made'

            return (
              <div key={wm.id} className="week-card fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="week-card-main">
                  <div className="week-card-header">
                    <h3 className="meal-name">{m.name}</h3>
                    <button
                      className="btn-icon remove-btn"
                      onClick={() => removeFromWeek(wm.id)}
                      title="Remove from week"
                    >✕</button>
                  </div>
                  <div className="meal-meta">
                    <Stars rating={m.rating} size="sm" />
                    <span>{daysText} · <strong>{m.times_made}×</strong> cooked</span>
                  </div>
                  {m.ingredients?.length > 0 && (
                    <div className="chip-row">
                      {(m.ingredients || []).slice(0, 4).map(ing => (
                        <span key={ing} className="chip">{ing}</span>
                      ))}
                      {m.ingredients.length > 4 && (
                        <span className="chip chip-more">+{m.ingredients.length - 4} more</span>
                      )}
                    </div>
                  )}
                  <div className="week-card-footer">
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
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showRandomize && (
        <RandomizeModal
          meals={meals}
          onAdd={addToWeek}
          onClose={() => setShowRandomize(false)}
        />
      )}

      {showSend && (
        <SendModal
          weekMeals={weekMeals}
          onClose={() => setShowSend(false)}
        />
      )}
    </div>
  )
}
