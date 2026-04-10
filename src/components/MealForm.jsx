import { useState } from 'react'
import Stars from './Stars'

const ALL_TAGS = [
  'protein','pasta','seafood','vegetarian','sides','easy','weeknight',
  'weekend','crowd-pleaser','healthy','brunch','italian','japanese','greek'
]

const emptyMeal = {
  name: '',
  rating: 0,
  last_made: new Date().toISOString().split('T')[0],
  ingredients: [],
  notes: '',
  tags: [],
  source: '',
  times_made: 1,
}

export default function MealForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState({ ...emptyMeal, ...initial })
  const [ingInput, setIngInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const addIngredient = () => {
    const val = ingInput.trim()
    if (!val) return
    if (!form.ingredients.includes(val)) {
      set('ingredients', [...form.ingredients, val])
    }
    setIngInput('')
  }

  const removeIngredient = (ing) => {
    set('ingredients', form.ingredients.filter(i => i !== ing))
  }

  const toggleTag = (tag) => {
    set('tags', form.tags.includes(tag)
      ? form.tags.filter(t => t !== tag)
      : [...form.tags, tag]
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({
        name: form.name.trim(),
        rating: form.rating || null,
        last_made: form.last_made || null,
        times_made: Number(form.times_made) || 1,
        ingredients: form.ingredients,
        notes: form.notes.trim(),
        tags: form.tags,
        source: form.source.trim(),
      })
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-form slide-up" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title">{initial?.id ? 'Edit Meal' : 'Add Meal'}</h2>

        <form onSubmit={handleSubmit} className="meal-form">
          <div className="form-group">
            <label className="form-label">Name <span className="required">*</span></label>
            <input
              className="form-input"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Lemon Herb Chicken"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Rating</label>
            <Stars rating={form.rating} onRate={r => set('rating', r)} size="lg" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Last Made</label>
              <input
                className="form-input"
                type="date"
                value={form.last_made}
                onChange={e => set('last_made', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Times Made</label>
              <input
                className="form-input"
                type="number"
                min="1"
                value={form.times_made}
                onChange={e => set('times_made', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Ingredients</label>
            <div className="ing-input-row">
              <input
                className="form-input"
                value={ingInput}
                onChange={e => setIngInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addIngredient() } }}
                placeholder="Type ingredient + Enter"
              />
              <button type="button" className="btn btn-secondary btn-sm" onClick={addIngredient}>Add</button>
            </div>
            {form.ingredients.length > 0 && (
              <div className="chip-row" style={{ marginTop: 8 }}>
                {form.ingredients.map(ing => (
                  <span key={ing} className="chip chip-removable">
                    {ing}
                    <button
                      type="button"
                      className="chip-remove"
                      onClick={() => removeIngredient(ing)}
                    >✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              className="form-textarea"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Cooking tips, modifications…"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Tags</label>
            <div className="tag-toggle-row">
              {ALL_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  className={`tag-toggle ${form.tags.includes(tag) ? 'active' : ''}`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Source URL (optional)</label>
            <input
              className="form-input"
              type="url"
              value={form.source}
              onChange={e => set('source', e.target.value)}
              placeholder="https://…"
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="form-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : initial?.id ? 'Save Changes' : 'Add to Rolodex'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
