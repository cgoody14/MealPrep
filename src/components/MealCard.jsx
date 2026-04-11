import Stars from './Stars'
import { daysSince } from '../utils/format'

function CooldownBar({ lastMade }) {
  const days = daysSince(lastMade)
  let color = 'var(--green)'
  if (days < 7) color = '#E05252'
  else if (days < 20) color = 'var(--yellow)'

  return (
    <div className="cooldown-bar-track">
      <div
        className="cooldown-bar-fill"
        style={{ backgroundColor: color }}
      />
    </div>
  )
}

export default function MealCard({ meal, onOpen, onToggleWeek, inWeek, weekLoading, animDelay = 0 }) {
  const days = daysSince(meal.last_made)
  const daysText = meal.last_made ? (days === 0 ? 'Today' : `${days}d ago`) : 'Never made'
  const visibleIngredients = (meal.ingredients || []).slice(0, 4)
  const extraIngredients = (meal.ingredients || []).length - 4
  const visibleTags = (meal.tags || []).slice(0, 3)

  const handleWeekToggle = (e) => {
    e.stopPropagation()
    onToggleWeek(meal)
  }

  return (
    <div className="meal-card fade-up" style={{ animationDelay: `${animDelay}ms` }} onClick={() => onOpen(meal)}>
      {meal.source && <span className="url-ribbon">URL</span>}
      <div className="meal-card-body">
        <div className="meal-card-header">
          <h3 className="meal-name">{meal.name}</h3>
          <Stars rating={meal.rating} size="sm" />
        </div>
        {meal.cook_time && (
          <div className="meal-cook-time">⏱ {meal.cook_time}</div>
        )}
        <div className="meal-meta">
          {daysText} · <strong>{meal.times_made}×</strong> cooked
        </div>
        {visibleIngredients.length > 0 && (
          <div className="chip-row">
            {visibleIngredients.map(ing => (
              <span key={ing} className="chip">{ing}</span>
            ))}
            {extraIngredients > 0 && (
              <span className="chip chip-more">+{extraIngredients} more</span>
            )}
          </div>
        )}
        {visibleTags.length > 0 && (
          <div className="tag-row">
            {visibleTags.map(tag => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        )}
      </div>
      <div className="meal-card-footer">
        <button
          className={`btn-week ${inWeek ? 'btn-week-active' : ''}`}
          onClick={handleWeekToggle}
          disabled={weekLoading}
        >
          {inWeek ? '✓ This Week' : '+ This Week'}
        </button>
      </div>
      <CooldownBar lastMade={meal.last_made} />
    </div>
  )
}
