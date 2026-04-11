import { useState } from 'react'
import Stars from './Stars'
import { daysSince, formatDate } from '../utils/format'

export default function MealDetail({ meal, onClose, inWeek, onAddToWeek }) {
  const [adding, setAdding] = useState(false)

  const days = daysSince(meal.last_made)

  const handleAddToWeek = async () => {
    setAdding(true)
    try {
      await onAddToWeek(meal.id)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-detail slide-up" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="detail-header">
          <h2 className="detail-title">{meal.name}</h2>
          <Stars rating={meal.rating} size="lg" />
        </div>

        <div className="detail-stats">
          <div className="stat-box">
            <div className="stat-value">{meal.times_made}×</div>
            <div className="stat-label">Times Made</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{meal.last_made ? `${days}d` : '—'}</div>
            <div className="stat-label">Days Since</div>
          </div>
          <div className="stat-box">
            <div className="stat-value" style={{ fontSize: 14 }}>{formatDate(meal.last_made)}</div>
            <div className="stat-label">Last Made</div>
          </div>
          {meal.cook_time && (
            <div className="stat-box">
              <div className="stat-value" style={{ fontSize: 14 }}>{meal.cook_time}</div>
              <div className="stat-label">Cook Time</div>
            </div>
          )}
        </div>

        {meal.source && (
          <a href={meal.source} target="_blank" rel="noopener noreferrer" className="source-link">
            ↗ View original recipe
          </a>
        )}

        {meal.ingredients?.length > 0 && (
          <div className="detail-section">
            <div className="detail-section-label">Ingredients</div>
            <div className="chip-row">
              {meal.ingredients.map(ing => (
                <span key={ing} className="chip">{ing}</span>
              ))}
            </div>
          </div>
        )}

        <div className="detail-section">
          <div className="detail-section-label">Instructions</div>
          {meal.instructions ? (
            <ol className="instruction-list">
              {meal.instructions
                .split(/ \| |\n/)
                .map(s => s.replace(/^\d+\.\s*/, '').trim())
                .filter(Boolean)
                .map((step, i) => (
                  <li key={i} className="instruction-step">
                    <span className="instruction-num">{i + 1}</span>
                    <span className="instruction-step-text">{step}</span>
                  </li>
                ))}
            </ol>
          ) : (
            <p className="instruction-empty">No instructions saved yet.</p>
          )}
        </div>

        {meal.notes && (
          <div className="detail-section">
            <div className="detail-section-label">Notes</div>
            <blockquote className="notes-quote">{meal.notes}</blockquote>
          </div>
        )}

        {meal.tags?.length > 0 && (
          <div className="detail-section">
            <div className="detail-section-label">Tags</div>
            <div className="tag-row">
              {meal.tags.map(tag => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
          </div>
        )}

        <div className="detail-footer">
          <button className="btn btn-ghost" onClick={onClose}>Exit</button>
          <button
            className={`btn ${inWeek ? 'btn-week-active-full' : 'btn-primary'}`}
            onClick={inWeek ? undefined : handleAddToWeek}
            disabled={inWeek || adding}
          >
            {adding ? 'Adding…' : inWeek ? '✓ In This Week' : 'Add to This Week'}
          </button>
        </div>
      </div>
    </div>
  )
}
