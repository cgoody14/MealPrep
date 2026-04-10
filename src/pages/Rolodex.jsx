import { useState, useMemo } from 'react'
import MealCard from '../components/MealCard'
import MealDetail from '../components/MealDetail'
import MealForm from '../components/MealForm'
import UrlImportBar from '../components/UrlImportBar'
import { daysSince } from '../utils/format'

const ALL_TAGS = [
  'protein','pasta','seafood','vegetarian','sides','easy','weeknight',
  'weekend','crowd-pleaser','healthy','brunch','italian','japanese','greek'
]

const SORT_OPTIONS = [
  { value: 'rating', label: 'Highest Rated' },
  { value: 'recent', label: 'Recently Made' },
  { value: 'oldest', label: 'Made Longest Ago' },
  { value: 'az', label: 'A–Z' },
]

export default function Rolodex({ meals, addMeal, updateMeal, deleteMeal, markMadeToday, weekMeals, addToWeek, removeFromWeek }) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('rating')
  const [activeTag, setActiveTag] = useState('All')
  const [detailMeal, setDetailMeal] = useState(null)
  const [editMeal, setEditMeal] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [weekLoading, setWeekLoading] = useState(false)

  const weekMealIds = new Set((weekMeals || []).map(wm => wm.meal_id))

  // Only show tags that exist on at least one meal
  const availableTags = useMemo(() => {
    const used = new Set()
    meals.forEach(m => (m.tags || []).forEach(t => used.add(t)))
    return ALL_TAGS.filter(t => used.has(t))
  }, [meals])

  const filtered = useMemo(() => {
    let list = [...meals]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(m =>
        m.name.toLowerCase().includes(q) ||
        (m.ingredients || []).some(i => i.toLowerCase().includes(q)) ||
        (m.tags || []).some(t => t.toLowerCase().includes(q))
      )
    }
    if (activeTag !== 'All') {
      list = list.filter(m => (m.tags || []).includes(activeTag))
    }
    switch (sort) {
      case 'rating': list.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break
      case 'recent': list.sort((a, b) => {
        if (!a.last_made && !b.last_made) return 0
        if (!a.last_made) return 1
        if (!b.last_made) return -1
        return new Date(b.last_made) - new Date(a.last_made)
      }); break
      case 'oldest': list.sort((a, b) => {
        if (!a.last_made && !b.last_made) return 0
        if (!a.last_made) return -1
        if (!b.last_made) return 1
        return new Date(a.last_made) - new Date(b.last_made)
      }); break
      case 'az': list.sort((a, b) => a.name.localeCompare(b.name)); break
    }
    return list
  }, [meals, search, activeTag, sort])

  const handleToggleWeek = async (meal) => {
    setWeekLoading(true)
    try {
      if (weekMealIds.has(meal.id)) {
        const wm = (weekMeals || []).find(w => w.meal_id === meal.id)
        if (wm) await removeFromWeek(wm.id)
      } else {
        await addToWeek(meal.id)
      }
    } finally {
      setWeekLoading(false)
    }
  }

  const handleDelete = async (id) => {
    await deleteMeal(id)
    setDetailMeal(null)
  }

  const handleMarkMade = async (id) => {
    const updated = await markMadeToday(id)
    if (detailMeal?.id === id && updated) setDetailMeal(updated)
  }

  const handleSaveEdit = async (data) => {
    if (editMeal?.id) {
      await updateMeal(editMeal.id, data)
    } else {
      await addMeal(data)
    }
  }

  const handleUrlImport = async (data) => {
    await addMeal(data)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Rolodex</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Meal</button>
      </div>

      <UrlImportBar onImport={handleUrlImport} />

      <div className="controls-bar">
        <input
          className="form-input search-input"
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search meals, ingredients, tags…"
        />
        <select
          className="form-select"
          value={sort}
          onChange={e => setSort(e.target.value)}
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {availableTags.length > 0 && (
        <div className="tag-filter-row">
          <button
            className={`filter-pill ${activeTag === 'All' ? 'active' : ''}`}
            onClick={() => setActiveTag('All')}
          >
            All
          </button>
          {availableTags.map(tag => (
            <button
              key={tag}
              className={`filter-pill ${activeTag === tag ? 'active' : ''}`}
              onClick={() => setActiveTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🍽️</div>
          <div className="empty-text">
            {meals.length === 0 ? 'No meals yet. Add your first meal!' : 'No meals match your search.'}
          </div>
        </div>
      ) : (
        <div className="meal-grid">
          {filtered.map((meal, i) => (
            <div key={meal.id} style={{ animationDelay: `${i * 40}ms` }}>
              <MealCard
                meal={meal}
                onOpen={setDetailMeal}
                onToggleWeek={handleToggleWeek}
                inWeek={weekMealIds.has(meal.id)}
                weekLoading={weekLoading}
              />
            </div>
          ))}
        </div>
      )}

      {detailMeal && (
        <MealDetail
          meal={detailMeal}
          onClose={() => setDetailMeal(null)}
          onEdit={(meal) => { setEditMeal(meal); setDetailMeal(null) }}
          onDelete={handleDelete}
          onMarkMade={handleMarkMade}
        />
      )}

      {(editMeal || showAdd) && (
        <MealForm
          initial={editMeal || {}}
          onSave={handleSaveEdit}
          onClose={() => { setEditMeal(null); setShowAdd(false) }}
        />
      )}
    </div>
  )
}
