import { useState, useRef } from 'react'
import Stars from './Stars'
import { uploadRecipeAttachment, isImageUrl } from '../utils/storage'
import { estimateNutrition } from '../utils/recipeAgent'

const ALL_TAGS = [
  'protein','pasta','seafood','vegetarian','sides','easy','weeknight',
  'weekend','crowd-pleaser','healthy','brunch','italian','japanese','greek'
]

const emptyMeal = {
  name: '',
  rating: 3,
  last_made: new Date().toISOString().split('T')[0],
  ingredients: [],
  notes: '',
  instructions: '',
  tags: [],
  source: '',
  times_made: 1,
  cook_time: '',
  servings: '',
  calories: '',
  protein_g: '',
  carbs_g: '',
  fat_g: '',
  photo_url: '',
}

export default function MealForm({ initial, onSave, onClose, existingMeals = [] }) {
  const [form, setForm] = useState({ ...emptyMeal, ...initial })
  const [ingInput, setIngInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState('')
  const [dupWarning, setDupWarning] = useState('')
  const [error, setError] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoObjectUrl, setPhotoObjectUrl] = useState(null)
  const [nutritionLoading, setNutritionLoading] = useState(false)
  const [nutritionError, setNutritionError] = useState('')
  const photoInputRef = useRef(null)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const checkDuplicate = (name) => {
    const trimmed = name.trim().toLowerCase()
    if (!trimmed) { setDupWarning(''); return }
    const dup = existingMeals.find(m =>
      m.name.toLowerCase() === trimmed && m.id !== initial?.id
    )
    setDupWarning(dup ? `A recipe named "${dup.name}" already exists in your Rolodex.` : '')
  }

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

  const handleAutoFillNutrition = async () => {
    if (!form.name.trim() && form.ingredients.length === 0) return
    setNutritionLoading(true)
    setNutritionError('')
    try {
      const result = await estimateNutrition(form.name || 'Recipe', form.ingredients)
      setForm(f => ({
        ...f,
        calories: result.calories ?? f.calories,
        protein_g: result.protein_g ?? f.protein_g,
        carbs_g: result.carbs_g ?? f.carbs_g,
        fat_g: result.fat_g ?? f.fat_g,
      }))
    } catch (err) {
      setNutritionError('Could not estimate nutrition. Try again.')
    } finally {
      setNutritionLoading(false)
    }
  }

  const toggleTag = (tag) => {
    set('tags', form.tags.includes(tag)
      ? form.tags.filter(t => t !== tag)
      : [...form.tags, tag]
    )
  }

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (photoObjectUrl) URL.revokeObjectURL(photoObjectUrl)
    setPhotoFile(file)
    setPhotoObjectUrl(URL.createObjectURL(file))
  }

  const clearPhoto = () => {
    setPhotoFile(null)
    if (photoObjectUrl) { URL.revokeObjectURL(photoObjectUrl); setPhotoObjectUrl(null) }
    set('photo_url', '')
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setNameError('Name is required.')
      return
    }
    setNameError('')
    setSaving(true)
    setError('')
    try {
      let photo_url = form.photo_url || null
      if (photoFile) {
        try {
          photo_url = await uploadRecipeAttachment(photoFile)
        } catch (uploadErr) {
          console.warn('Photo upload failed:', uploadErr.message)
        }
      }
      await onSave({
        name: form.name.trim(),
        rating: form.rating ?? 3,
        last_made: form.last_made || null,
        times_made: Number(form.times_made) || 1,
        ingredients: form.ingredients,
        notes: form.notes.trim(),
        instructions: form.instructions.trim(),
        tags: form.tags,
        source: form.source.trim(),
        cook_time: form.cook_time.trim(),
        servings: form.servings ? Number(form.servings) : null,
        calories: form.calories ? Number(form.calories) : null,
        protein_g: form.protein_g ? Number(form.protein_g) : null,
        carbs_g: form.carbs_g ? Number(form.carbs_g) : null,
        fat_g: form.fat_g ? Number(form.fat_g) : null,
        photo_url,
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
              className={`form-input ${nameError ? 'input-error' : ''}`}
              value={form.name}
              onChange={e => {
                set('name', e.target.value)
                if (nameError) setNameError('')
                checkDuplicate(e.target.value)
              }}
              onBlur={e => checkDuplicate(e.target.value)}
              placeholder="e.g. Lemon Herb Chicken"
              autoFocus
            />
            {nameError && <div className="field-error">{nameError}</div>}
            {dupWarning && !nameError && (
              <div className="dup-warning">⚠️ {dupWarning}</div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Rating</label>
            <Stars rating={form.rating} onRate={r => set('rating', r)} size="lg" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Cook Time</label>
              <input
                className="form-input"
                value={form.cook_time}
                onChange={e => set('cook_time', e.target.value)}
                placeholder="e.g. 45 mins"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Servings</label>
              <input
                className="form-input"
                type="number"
                min="1"
                value={form.servings}
                onChange={e => set('servings', e.target.value)}
                placeholder="e.g. 4"
              />
              <div className="form-hint">Used for scaling in This Week &amp; Shopping</div>
            </div>
          </div>

          <div className="form-group">
            <div className="nutrition-label-row">
              <label className="form-label">
                Nutrition <span className="auth-optional-badge">optional · per serving</span>
              </label>
              <button
                type="button"
                className="btn btn-ghost btn-sm nutrition-autofill-btn"
                onClick={handleAutoFillNutrition}
                disabled={nutritionLoading}
              >
                {nutritionLoading ? '⏳ Estimating…' : '✨ Auto-fill'}
              </button>
            </div>
            <div className="form-row">
              <input className="form-input" type="number" min="0" placeholder="Calories"
                value={form.calories} onChange={e => set('calories', e.target.value)} />
              <input className="form-input" type="number" min="0" placeholder="Protein (g)"
                value={form.protein_g} onChange={e => set('protein_g', e.target.value)} />
              <input className="form-input" type="number" min="0" placeholder="Carbs (g)"
                value={form.carbs_g} onChange={e => set('carbs_g', e.target.value)} />
              <input className="form-input" type="number" min="0" placeholder="Fat (g)"
                value={form.fat_g} onChange={e => set('fat_g', e.target.value)} />
            </div>
            {nutritionError && <div className="form-error" style={{ marginTop: 6 }}>{nutritionError}</div>}
            <div className="form-hint">AI estimates — verify with a nutrition calculator for accuracy.</div>
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
            <label className="form-label">Instructions</label>
            <textarea
              className="form-textarea"
              value={form.instructions}
              onChange={e => set('instructions', e.target.value)}
              placeholder={"1. Preheat oven to 425°F.\n2. Season and sear the protein.\n3. Finish in oven…"}
              rows={6}
            />
            <div className="form-hint">Tip: each step on its own line.</div>
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

          <div className="form-group">
            <label className="form-label">Recipe Photo (optional)</label>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              id="meal-form-photo"
              className="photo-file-input"
              onChange={handlePhotoSelect}
            />
            {(photoFile || form.photo_url) ? (
              <div className="photo-selected-row">
                {(photoObjectUrl || (form.photo_url && isImageUrl(form.photo_url))) ? (
                  <img
                    src={photoObjectUrl || form.photo_url}
                    alt="recipe"
                    className="photo-thumb"
                  />
                ) : (
                  <span className="photo-thumb-placeholder">📎</span>
                )}
                <span className="photo-filename">
                  {photoFile ? photoFile.name : 'Current photo'}
                </span>
                <label htmlFor="meal-form-photo" className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                  Replace
                </label>
                <button type="button" className="btn btn-ghost btn-sm" onClick={clearPhoto}>✕</button>
              </div>
            ) : (
              <label htmlFor="meal-form-photo" className="photo-upload-btn">
                📷 Add Recipe Photo
              </label>
            )}
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="form-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : initial?.id ? 'Save Changes' : 'Add Meal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
