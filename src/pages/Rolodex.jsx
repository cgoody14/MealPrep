import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import MealCard from '../components/MealCard'
import MealDetail from '../components/MealDetail'
import MealForm from '../components/MealForm'
import UrlImportBar from '../components/UrlImportBar'
import SkeletonCard from '../components/SkeletonCard'

const ALL_TAGS = [
  'protein','chicken','beef','pork','steak','shrimp','salmon','lamb','turkey',
  'seafood','pasta',
  'vegetarian','vegan','healthy','gluten-free','low-carb',
  'sides','soup','salad',
  'easy','quick','weeknight','weekend','brunch',
  'crowd-pleaser','meal-prep','grill',
  'italian','japanese','greek','mexican','thai','indian','korean','mediterranean',
]

const SORT_OPTIONS = [
  { value: 'rating', label: 'Highest Rated' },
  { value: 'recent', label: 'Recently Made' },
  { value: 'oldest', label: 'Made Longest Ago' },
  { value: 'added', label: 'Recently Added' },
  { value: 'az', label: 'A–Z' },
]

export default function Rolodex({ meals, loading, addMeal, updateMeal, deleteMeal, markMadeToday, weekMeals, addToWeek, removeFromWeek }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('rating')
  const [activeTag, setActiveTag] = useState('All')
  const [detailMeal, setDetailMeal] = useState(null)
  const [editMeal, setEditMeal] = useState(null)
  const [weekLoading, setWeekLoading] = useState(false)
  const [importError, setImportError] = useState('')
  const [reimportUrl, setReimportUrl] = useState('')

  const weekMealIds = new Set((weekMeals || []).map(wm => wm.meal_id))

  // Only show tags that exist on at least one meal
  const availableTags = useMemo(() => {
    const used = new Set()
    meals.forEach(m => (m.tags || []).forEach(t => used.add(t)))
    return ALL_TAGS.filter(t => used.has(t))
  }, [meals])

  // Meals passed to the randomizer — respects tag filter but not text search
  const tagFilteredMeals = useMemo(() =>
    activeTag === 'All' ? meals : meals.filter(m => (m.tags || []).includes(activeTag))
  , [meals, activeTag])

  const filtered = useMemo(() => {
    const sortFn = (a, b) => {
      switch (sort) {
        case 'rating': return (b.rating || 0) - (a.rating || 0)
        case 'recent': {
          if (!a.last_made && !b.last_made) return 0
          if (!a.last_made) return 1
          if (!b.last_made) return -1
          return new Date(b.last_made) - new Date(a.last_made)
        }
        case 'oldest': {
          if (!a.last_made && !b.last_made) return 0
          if (!a.last_made) return -1
          if (!b.last_made) return 1
          return new Date(a.last_made) - new Date(b.last_made)
        }
        case 'added': return new Date(b.created_at) - new Date(a.created_at)
        case 'az': return a.name.localeCompare(b.name)
        default: return 0
      }
    }

    let list = [...meals]

    if (search.trim()) {
      const q = search.toLowerCase()

      // Score: exact name > name prefix > name contains > exact tag > tag contains > ingredient
      const score = m => {
        const name = m.name.toLowerCase()
        if (name === q) return 5
        if (name.startsWith(q)) return 4
        if (name.includes(q)) return 3
        if ((m.tags || []).some(t => t.toLowerCase() === q)) return 2
        if ((m.tags || []).some(t => t.toLowerCase().includes(q))) return 2
        if ((m.ingredients || []).some(i => i.toLowerCase().includes(q))) return 1
        return 0
      }

      list = list
        .filter(m => score(m) > 0)
        // Primary: relevance; tiebreaker: user's chosen sort
        .sort((a, b) => (score(b) - score(a)) || sortFn(a, b))
    } else {
      list.sort(sortFn)
    }

    if (activeTag !== 'All') {
      list = list.filter(m => (m.tags || []).includes(activeTag))
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

  const handleAddToWeekFromDetail = async (mealId) => {
    await addToWeek(mealId)
    setDetailMeal(null)
  }

  const handleSaveEdit = async (data) => {
    if (editMeal?.id) {
      await updateMeal(editMeal.id, data)
    }
  }

  const handleUrlImport = async (data) => {
    setImportError('')
    await addMeal(data)
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title-row">
          <h1 className="page-title">Recipes</h1>
          <span className="meal-count-pill">{meals.length} recipe{meals.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <p className="page-subtitle">Your personal recipe archive. Add meals manually or import from any recipe URL. Search, filter by tag, and track how often you cook each dish.</p>

      <UrlImportBar onImport={handleUrlImport} reimportUrl={reimportUrl} onReimportConsumed={() => setReimportUrl('')} />

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
        <button className="btn btn-secondary" onClick={() => navigate('/randomizer')}>
          🎲 Randomize
        </button>
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

      {loading ? (
        <div className="meal-grid">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} delay={i * 60} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🍽️</div>
          <div className="empty-text">
            {meals.length === 0 ? 'No meals yet. Add your first meal!' : 'No meals match your search.'}
          </div>
        </div>
      ) : (
        <div className="meal-grid">
          {filtered.map((meal, i) => (
            <MealCard
              key={meal.id}
              meal={meal}
              onOpen={setDetailMeal}
              onToggleWeek={handleToggleWeek}
              inWeek={weekMealIds.has(meal.id)}
              weekLoading={weekLoading}
              onAdjustCount={(id, _n, update) => updateMeal(id, update)}
              animDelay={i * 40}
            />
          ))}
        </div>
      )}

      {detailMeal && (
        <MealDetail
          meal={detailMeal}
          onClose={() => setDetailMeal(null)}
          inWeek={weekMealIds.has(detailMeal.id)}
          onAddToWeek={handleAddToWeekFromDetail}
          onDelete={async (id) => { await deleteMeal(id); setDetailMeal(null) }}
          onEdit={(meal) => { setDetailMeal(null); setEditMeal(meal) }}
          onReimport={(url) => { setDetailMeal(null); setReimportUrl(url) }}
        />
      )}

      {editMeal && (
        <MealForm
          initial={editMeal}
          onSave={handleSaveEdit}
          onClose={() => setEditMeal(null)}
          existingMeals={meals}
        />
      )}

    </div>
  )
}
