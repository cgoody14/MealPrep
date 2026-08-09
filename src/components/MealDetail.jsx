import { useState, useRef } from 'react'
import Stars from './Stars'
import { daysSince, formatDate } from '../utils/format'
import { isImageUrl } from '../utils/storage'
import { scaleIngredients } from '../utils/scaleIngredients'
import { adjustRecipeWithAI } from '../utils/recipeAgent'
import { ALLOWED_TAGS } from '../lib/tags'
import CookMode from './CookMode'

const ADJUST_CHIPS = ['Halve servings', 'Double it', 'Make it vegetarian', 'Make it healthier']

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

export default function MealDetail({ meal, onClose, inWeek, onAddToWeek, onDelete, onEdit, onReimport, onRemoveFromWeek, onUpdate, contextServings }) {
  const [adding, setAdding] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [scaledServings, setScaledServings] = useState(contextServings ?? meal.servings ?? null)
  const [cookMode, setCookMode] = useState(false)
  const [photoIndex, setPhotoIndex] = useState(0)
  const touchStartX = useRef(0)

  // Adjust-with-AI on a saved recipe
  const [showAdjust, setShowAdjust] = useState(false)
  const [adjustInput, setAdjustInput] = useState('')
  const [adjusting, setAdjusting] = useState(false)
  const [adjustError, setAdjustError] = useState('')

  const handleAdjust = async (instructionArg) => {
    const instruction = (instructionArg ?? adjustInput).trim()
    if (!instruction || adjusting || !onUpdate) return
    setAdjusting(true)
    setAdjustError('')
    try {
      const result = await adjustRecipeWithAI(
        {
          name: meal.name,
          ingredients: meal.ingredients || [],
          notes: meal.notes || '',
          tags: meal.tags || [],
          cookTime: meal.cook_time || '',
          servings: meal.servings || 0,
          calories: meal.calories || 0,
          protein_g: meal.protein_g || 0,
          carbs_g: meal.carbs_g || 0,
          fat_g: meal.fat_g || 0,
          instructions: meal.instructions || '',
        },
        instruction
      )
      const updates = {
        name: result.name || meal.name,
        ingredients: Array.isArray(result.ingredients) ? result.ingredients : meal.ingredients,
        notes: result.notes ?? meal.notes,
        tags: Array.isArray(result.tags) ? result.tags.filter(t => ALLOWED_TAGS.includes(t)) : meal.tags,
        cook_time: result.cookTime || meal.cook_time,
        servings: parseInt(result.servings) || meal.servings,
        calories: parseInt(result.calories) || meal.calories,
        protein_g: parseInt(result.protein_g) || meal.protein_g,
        carbs_g: parseInt(result.carbs_g) || meal.carbs_g,
        fat_g: parseInt(result.fat_g) || meal.fat_g,
        instructions: (result.instructions || '').split(' | ').map(s => s.trim()).filter(Boolean).join('\n') || meal.instructions,
      }
      await onUpdate(meal.id, updates)
      setScaledServings(updates.servings || null)
      setAdjustInput('')
      setShowAdjust(false)
    } catch (err) {
      setAdjustError(err.message || 'Could not adjust the recipe. Try rephrasing.')
    } finally {
      setAdjusting(false)
    }
  }

  const originalServings = meal.servings || null
  const displayIngredients = scaledServings && originalServings
    ? scaleIngredients(meal.ingredients || [], originalServings, scaledServings)
    : (meal.ingredients || [])

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
    <>
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-detail slide-up" onClick={e => e.stopPropagation()}>

        {/* Sticky top bar */}
        <div className="detail-sticky-bar">
          <button className="btn btn-ghost detail-exit-btn" onClick={onClose}>Exit</button>
          <div className="detail-sticky-actions">
            <button className="btn btn-cook" onClick={() => setCookMode(true)}>👨‍🍳 Cook</button>
            <button className="btn btn-edit" onClick={() => onEdit(meal)}>✏️ Edit</button>
            {onRemoveFromWeek ? (
              <button className="btn btn-ghost" onClick={onRemoveFromWeek}>Remove from Week</button>
            ) : (
              <button
                className={`btn ${inWeek ? 'btn-in-week' : 'btn-primary'}`}
                onClick={inWeek ? undefined : handleAddToWeek}
                disabled={inWeek || adding}
              >
                {adding ? 'Adding…' : inWeek ? '✓ In This Week' : 'Add to This Week'}
              </button>
            )}
          </div>
        </div>

        {/* Scrollable content body */}
        <div className="detail-body">
          <div className="detail-header">
            <h2 className="detail-title">{meal.name}</h2>
            <Stars rating={meal.rating} size="lg" />
          </div>

          {onUpdate && (
            <div className="detail-adjust">
              {!showAdjust ? (
                <button className="btn btn-secondary btn-sm" onClick={() => setShowAdjust(true)}>
                  ✨ Adjust with AI
                </button>
              ) : (
                <div className="ai-adjust">
                  <div className="ai-adjust-row">
                    <input
                      className="form-input"
                      value={adjustInput}
                      onChange={e => setAdjustInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdjust() } }}
                      placeholder="Tell AI how to change it… e.g. make it vegetarian, convert to metric"
                      disabled={adjusting}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleAdjust()}
                      disabled={adjusting || !adjustInput.trim()}
                    >
                      {adjusting ? 'Adjusting…' : 'Apply'}
                    </button>
                  </div>
                  <div className="ai-adjust-chips">
                    {ADJUST_CHIPS.map(chip => (
                      <button
                        key={chip}
                        type="button"
                        className="chip chip-suggest"
                        onClick={() => handleAdjust(chip)}
                        disabled={adjusting}
                      >
                        {chip}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="chip chip-suggest"
                      onClick={() => { setShowAdjust(false); setAdjustInput(''); setAdjustError('') }}
                      disabled={adjusting}
                    >
                      Cancel
                    </button>
                  </div>
                  {adjusting && <div className="import-status-line" style={{ marginTop: 8 }}>Rewriting the recipe…</div>}
                  {adjustError && <div className="form-error" style={{ marginTop: 6 }}>{adjustError}</div>}
                </div>
              )}
            </div>
          )}

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

          {(() => {
            const allPhotos = meal.photo_urls?.length > 0
              ? meal.photo_urls
              : (meal.photo_url ? [meal.photo_url] : [])
            if (allPhotos.length === 0) return null
            const idx = Math.min(photoIndex, allPhotos.length - 1)
            const currentUrl = allPhotos[idx]

            if (allPhotos.length === 1) {
              return (
                <div className="recipe-attachment">
                  {isImageUrl(currentUrl) ? (
                    <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="recipe-photo-link">
                      <img src={currentUrl} alt="Recipe photo" className="recipe-photo-thumb" />
                      <span className="recipe-photo-label">View recipe photo</span>
                    </a>
                  ) : (
                    <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="recipe-attachment-link">
                      📎 View recipe attachment
                    </a>
                  )}
                </div>
              )
            }

            return (
              <div className="recipe-attachment">
                <div
                  className="photo-carousel"
                  onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
                  onTouchEnd={e => {
                    const dx = e.changedTouches[0].clientX - touchStartX.current
                    if (dx > 50) setPhotoIndex(i => (i - 1 + allPhotos.length) % allPhotos.length)
                    else if (dx < -50) setPhotoIndex(i => (i + 1) % allPhotos.length)
                  }}
                >
                  <button
                    className="carousel-btn"
                    onClick={() => setPhotoIndex(i => (i - 1 + allPhotos.length) % allPhotos.length)}
                    aria-label="Previous photo"
                  >◀</button>
                  <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="carousel-img-wrap">
                    {isImageUrl(currentUrl) ? (
                      <img src={currentUrl} alt={`Photo ${idx + 1} of ${allPhotos.length}`} className="carousel-photo-img" />
                    ) : (
                      <span className="recipe-attachment-link">📎 Attachment {idx + 1}</span>
                    )}
                  </a>
                  <button
                    className="carousel-btn"
                    onClick={() => setPhotoIndex(i => (i + 1) % allPhotos.length)}
                    aria-label="Next photo"
                  >▶</button>
                </div>
                <div className="carousel-counter">Photo {idx + 1} of {allPhotos.length}</div>
              </div>
            )
          })()}

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
              <div className="detail-section-label-row">
                <span className="detail-section-label">Ingredients</span>
                {originalServings && (
                  <div className="serving-scaler">
                    <button
                      className="scaler-btn"
                      onClick={() => setScaledServings(s => Math.max(1, (s || originalServings) - 1))}
                      disabled={(scaledServings || originalServings) <= 1}
                    >−</button>
                    <span className="scaler-value">
                      {scaledServings || originalServings} srv
                      {scaledServings && scaledServings !== originalServings
                        ? <span className="scaler-original"> (orig: {originalServings})</span>
                        : null}
                    </span>
                    <button
                      className="scaler-btn"
                      onClick={() => setScaledServings(s => (s || originalServings) + 1)}
                    >+</button>
                  </div>
                )}
              </div>
              <div className="chip-row">
                {displayIngredients.map((ing, i) => (
                  <span key={i} className="chip">{ing}</span>
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

    {cookMode && (
      <CookMode
        meal={meal}
        scaledIngredients={displayIngredients}
        scaledServings={scaledServings}
        originalServings={originalServings}
        onClose={() => setCookMode(false)}
      />
    )}
  </>
  )
}
