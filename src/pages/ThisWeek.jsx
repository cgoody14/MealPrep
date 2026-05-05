import { useState } from 'react'
import Stars from '../components/Stars'
import MealDetail from '../components/MealDetail'
import MealForm from '../components/MealForm'
import { getWeekRange, daysSince, getWeekStart } from '../utils/format'
import { scaleIngredients, getScaleFactor, formatScaleBadge } from '../utils/scaling'
import { useServingSize } from '../hooks/useServingSize'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_FULL_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

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

function WeekMealCard({ wm, onRemove, onMarkMade, markingId, onOpenDetail, onDayChange,
                        effectiveServings, hasOverride, onOverrideChange, onOverrideReset }) {
  const m = wm.meals
  if (!m) return null
  const [openPanel, setOpenPanel] = useState(undefined)
  const days = daysSince(m.last_made)
  const daysText = m.last_made ? (days === 0 ? 'Today' : `${days}d ago`) : 'Never made'
  const steps = parseSteps(m.instructions)

  const scaleFactor = m.servings ? getScaleFactor(m.servings, effectiveServings) : null
  const badge = formatScaleBadge(scaleFactor)
  const displayIngredients = scaleFactor
    ? scaleIngredients(m.ingredients || [], m.servings, effectiveServings)
    : (m.ingredients || [])

  const togglePanel = (panel) =>
    setOpenPanel(prev => prev === panel ? undefined : panel)

  return (
    <div className="meal-card fade-up" onClick={() => onOpenDetail(m, wm.id)}>
      {m.source && <span className="url-ribbon">URL</span>}
      <div className="meal-card-body">
        <div className="meal-card-header">
          <div className="meal-name-row">
            <h3 className="meal-name">{m.name}</h3>
            {badge && <span className="scale-badge">{badge}</span>}
          </div>
          <button
            className="btn-icon remove-btn"
            onClick={e => { e.stopPropagation(); onRemove(wm.id) }}
            title="Remove from week"
          >✕</button>
        </div>
        <Stars rating={m.rating} size="sm" />
        {m.cook_time && <div className="meal-cook-time">⏱ {m.cook_time}</div>}
        <div className="meal-meta">
          {daysText} · <strong>{m.times_made}×</strong> cooked
        </div>

        {/* Day selector */}
        <div className="day-selector-row" onClick={e => e.stopPropagation()}>
          <select
            className="day-selector"
            value={wm.day_of_week ?? ''}
            onChange={e => onDayChange(wm.id, e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="">Unassigned</option>
            {DAY_NAMES.map((name, i) => (
              <option key={i} value={i}>{name}</option>
            ))}
          </select>
        </div>

        {/* Display-only servings stepper */}
        {m.servings && (
          <div className="recipe-override-row" onClick={e => e.stopPropagation()}>
            <span className="recipe-override-label">Servings</span>
            <div className="recipe-override-stepper">
              <button
                className="recipe-override-btn"
                onClick={() => onOverrideChange(Math.max(1, effectiveServings - 1))}
              >−</button>
              <span className="recipe-override-val">{effectiveServings}</span>
              <button
                className="recipe-override-btn"
                onClick={() => onOverrideChange(effectiveServings + 1)}
              >+</button>
            </div>
            {hasOverride && (
              <button className="recipe-reset-btn" onClick={onOverrideReset} title="Reset to global">↺</button>
            )}
          </div>
        )}

        {m.ingredients?.length > 0 && (
          <div className="chip-row">
            {displayIngredients.slice(0, 4).map((ing, i) => (
              <span key={i} className="chip">{ing}</span>
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
                className={`week-card-expand-btn ${openPanel === 'ing' ? 'active' : ''}`}
                onClick={() => togglePanel('ing')}
              >🧂 Ingredients</button>
            )}
            {steps.length > 0 && (
              <button
                className={`week-card-expand-btn ${openPanel === 'instr' ? 'active' : ''}`}
                onClick={() => togglePanel('instr')}
              >📋 Instructions</button>
            )}
          </div>
        )}

        {openPanel === 'ing' && m.ingredients?.length > 0 && (
          <div className="week-card-expandable" onClick={e => e.stopPropagation()}>
            {!m.servings && (
              <p className="scale-unavailable">Set a servings count on this recipe to enable scaling</p>
            )}
            <div className="chip-row">
              {displayIngredients.map((ing, i) => <span key={i} className="chip">{ing}</span>)}
            </div>
          </div>
        )}

        {openPanel === 'instr' && steps.length > 0 && (
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
          onClick={() => onMarkMade(m.id)}
          disabled={markingId === m.id}
        >
          {markingId === m.id ? 'Saving…' : '✓ Mark Made'}
        </button>
      </div>
      <CooldownBar lastMade={m.last_made} />
    </div>
  )
}

export default function ThisWeek({ meals, weekMeals, loading, addToWeek, removeFromWeek, clearWeek, markMadeToday, updateDayOfWeek, updateMeal, onRefresh }) {
  const [clearing, setClearing] = useState(false)
  const [markingId, setMarkingId] = useState(null)
  const [detailEntry, setDetailEntry] = useState(null) // { meal, weekMealId }
  const [editingMeal, setEditingMeal] = useState(null)

  const { globalServings, setGlobalServings, perRecipeOverrides, setRecipeOverride, resetRecipeOverride, getEffectiveServings } = useServingSize()

  const weekStart = getWeekStart()

  const handleClearWeek = async () => {
    setClearing(true)
    try { await clearWeek() } finally { setClearing(false) }
  }

  const handleMarkMade = async (mealId) => {
    setMarkingId(mealId)
    try { await markMadeToday(mealId) } finally { setMarkingId(null) }
  }

  const handleDayChange = async (weekMealId, day) => {
    try { await updateDayOfWeek(weekMealId, day) } catch { /* ignore */ }
  }

  const handleEditSave = async (data) => {
    await updateMeal(editingMeal.id, data)
    setEditingMeal(null)
  }

  const weekMealIds = new Set((weekMeals || []).map(wm => wm.meal_id))

  // Split meals into assigned (by day) and unassigned
  const mealsByDay = Array.from({ length: 7 }, () => [])
  const unassigned = []
  weekMeals.forEach(wm => {
    if (wm.day_of_week != null) mealsByDay[wm.day_of_week].push(wm)
    else unassigned.push(wm)
  })

  const cardProps = (wm) => ({
    wm,
    onRemove: removeFromWeek,
    onMarkMade: handleMarkMade,
    markingId,
    onOpenDetail: (m, weekMealId) => setDetailEntry({ meal: m, weekMealId }),
    onDayChange: handleDayChange,
    effectiveServings: getEffectiveServings(wm.meals),
    hasOverride: perRecipeOverrides[wm.meals?.id] != null,
    onOverrideChange: (s) => setRecipeOverride(wm.meals?.id, s),
    onOverrideReset: () => resetRecipeOverride(wm.meals?.id),
  })

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">This Week</h1>
          <p className="page-subtitle">Assign meals to days, or leave them unassigned. Tap any card to view details.</p>
          <div className="week-header-meta">{getWeekRange()} · {weekMeals.length} meal{weekMeals.length !== 1 ? 's' : ''}</div>
        </div>
        {onRefresh && <button className="btn btn-ghost refresh-btn" onClick={onRefresh} title="Refresh">↻</button>}
      </div>

      {/* Cooking for pill */}
      <div className="cooking-for-bar">
        <div className="cooking-for-pill">
          <span className="cooking-for-label">Cooking for</span>
          <button
            className="cooking-for-btn"
            onClick={() => setGlobalServings(globalServings - 1)}
            disabled={globalServings <= 1}
          >−</button>
          <span className="cooking-for-count">{globalServings}</span>
          <button
            className="cooking-for-btn"
            onClick={() => setGlobalServings(globalServings + 1)}
            disabled={globalServings >= 12}
          >+</button>
          <span className="cooking-for-label">{globalServings === 1 ? 'person' : 'people'}</span>
        </div>
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
        <>
          {/* Unassigned at top */}
          {unassigned.length > 0 && (
            <div className="week-unassigned">
              <div className="week-unassigned-label">Unassigned</div>
              <div className="week-list">
                {unassigned.map(wm => (
                  <WeekMealCard key={wm.id} {...cardProps(wm)} />
                ))}
              </div>
            </div>
          )}

          {/* Day sections */}
          {DAY_FULL_NAMES.map((fullName, i) => mealsByDay[i].length > 0 && (
            <div key={i} className="week-day-section">
              <div className="week-day-section-header">{fullName}</div>
              <div className="week-list">
                {mealsByDay[i].map(wm => (
                  <WeekMealCard key={wm.id} {...cardProps(wm)} />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {detailEntry && (
        <MealDetail
          meal={detailEntry.meal}
          contextServings={getEffectiveServings(detailEntry.meal)}
          onClose={() => setDetailEntry(null)}
          inWeek={weekMealIds.has(detailEntry.meal.id)}
          onAddToWeek={addToWeek}
          onRemoveFromWeek={() => { removeFromWeek(detailEntry.weekMealId); setDetailEntry(null) }}
          onEdit={(m) => { setDetailEntry(null); setEditingMeal(m) }}
          onDelete={() => {}}
        />
      )}

      {editingMeal && (
        <MealForm
          initial={editingMeal}
          existingMeals={meals}
          onSave={handleEditSave}
          onClose={() => setEditingMeal(null)}
        />
      )}
    </div>
  )
}
