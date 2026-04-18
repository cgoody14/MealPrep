import { useState } from 'react'
import Stars from './Stars'
import { daysSince, formatDate } from '../utils/format'

function renderStepText(text) {
  const parts = text.split(/(If desired[,.]?|[Oo]ptional[,:]?)/g)
  return parts.map((part, i) =>
    /^(If desired[,.]?|[Oo]ptional[,:]?)$/.test(part)
      ? <em key={i} className="step-optional">{part}</em>
      : part
  )
}

function parseSteps(instructions) {
  return (instructions || '')
    .split(/ \| |\n/)
    .map(s => s.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean)
}

export default function MealDetail({ meal, onClose, inWeek, onAddToWeek, onDelete, onEdit, onReimport }) {
  const [adding, setAdding] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const days = daysSince(meal.last_made)
  const steps = parseSteps(meal.instructions)
  const instructionsShort = meal.instructions && meal.instructions.length < 100

  const handleAddToWeek = async () => {
    setAdding(true)
    try {
      await onAddToWeek(meal.id)
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await onDelete(meal.id)
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-detail slide-up" onClick={e => e.stopPropagation()}>

        {/* Sticky top bar */}
        <div className="detail-sticky-bar">
          <button className="btn btn-ghost detail-exit-btn" onClick={onClose}>Exit</button>
          <div className="detail-sticky-actions">
            <button className="btn btn-edit" onClick={() => onEdit(meal)}>✏️ Edit</button>
            <button
              className={`btn ${inWeek ? 'btn-in-week' : 'btn-primary'}`}
              onClick={inWeek ? undefined : handleAddToWeek}
              disabled={inWeek || adding}
            >
              {adding ? 'Adding…' : inWeek ? '✓ In This Week' : 'Add to This Week'}
            </button>
          </div>
        </div>

        {/* Scrollable content body */}
        <div className="detail-body">
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

          {(meal.calories || meal.protein_g || meal.carbs_g || meal.fat_g) && (
            <div className="detail-section">
              <div className="detail-section-label">
                Nutrition{meal.servings ? ` · per serving (serves ${meal.servings})` : ' · per serving'}
              </div>
              <div className="nutrition-grid">
                {meal.calories != null && (
                  <div className="nutrition-box">
                    <div className="nutrition-value">{meal.calories}</div>
                    <div className="nutrition-label">Calories</div>
                  </div>
                )}
                {meal.protein_g != null && (
                  <div className="nutrition-box">
                    <div className="nutrition-value">{meal.protein_g}g</div>
                    <div className="nutrition-label">Protein</div>
                  </div>
                )}
                {meal.carbs_g != null && (
                  <div className="nutrition-box">
                    <div className="nutrition-value">{meal.carbs_g}g</div>
                    <div className="nutrition-label">Carbs</div>
                  </div>
                )}
                {meal.fat_g != null && (
                  <div className="nutrition-box">
                    <div className="nutrition-value">{meal.fat_g}g</div>
                    <div className="nutrition-label">Fat</div>
                  </div>
                )}
              </div>
            </div>
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
            {steps.length > 0 ? (
              <>
                <ol className="instruction-list">
                  {steps.map((step, i) => (
                    <li key={i} className="instruction-step">
                      <span className="instruction-num">{i + 1}</span>
                      <span className="instruction-step-text">{renderStepText(step)}</span>
                    </li>
                  ))}
                </ol>
                {instructionsShort && (
                  <div className="reimport-hint">
                    These instructions look brief — try re-importing the recipe for more detail.
                    {meal.source && onReimport && (
                      <button
                        className="reimport-btn"
                        onClick={() => { onClose(); onReimport(meal.source) }}
                      >
                        Re-import
                      </button>
                    )}
                  </div>
                )}
              </>
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

          {/* Delete zone */}
          <div className="delete-zone">
            {!confirmDelete ? (
              <button className="btn-delete-recipe" onClick={() => setConfirmDelete(true)}>
                Delete Recipe
              </button>
            ) : (
              <div className="delete-confirm-row">
                <span className="delete-confirm-text">Are you sure?</span>
                <button className="btn btn-primary" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Yes, Delete'}
                </button>
                <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
