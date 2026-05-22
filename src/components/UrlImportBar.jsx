import { useState, useRef, useEffect } from 'react'
import Stars from './Stars'
import { scrapeRecipeWithAI, scrapeRecipeFromImage } from '../utils/recipeAgent'
import { uploadRecipeAttachment } from '../utils/storage'

const ALLOWED_TAGS = [
  'protein','chicken','beef','pork','steak','shrimp','salmon','lamb','turkey',
  'seafood','pasta',
  'vegetarian','vegan','healthy','gluten-free','low-carb',
  'sides','soup','salad',
  'easy','quick','weeknight','weekend','brunch',
  'crowd-pleaser','meal-prep','grill',
  'italian','japanese','greek','mexican','thai','indian','korean','mediterranean',
]

const STATUS_MESSAGES = [
  'Looking up recipe…',
  'Asking Groq…',
  'Extracting ingredients…',
  'Building preview…',
]


const PHOTO_STATUS_MESSAGES = [
  'Reading photo…',
  'Scanning ingredients…',
  'Extracting steps…',
  'Building preview…',
]

export default function UrlImportBar({ onImport, reimportUrl, onReimportConsumed }) {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'preview'
  const [statusMsg, setStatusMsg] = useState('')
  const [preview, setPreview] = useState(null)
  const [fallbackMsg, setFallbackMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [ingInput, setIngInput] = useState('')
  const [photoFiles, setPhotoFiles] = useState([])
  const [photoObjectUrls, setPhotoObjectUrls] = useState([])
  const [photoError, setPhotoError] = useState('')

  const intervalRef = useRef(null)
  const successTimerRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (successTimerRef.current) clearTimeout(successTimerRef.current)
      photoObjectUrls.forEach(u => URL.revokeObjectURL(u))
    }
  }, [])

  // Pre-fill URL when triggered by Re-import button in MealDetail
  useEffect(() => {
    if (reimportUrl) {
      setUrl(reimportUrl)
      setPreview(null)
      setStatus('idle')
      setFallbackMsg('')
      setSuccessMsg('')
      onReimportConsumed?.()
      // Scroll to the import bar
      document.querySelector('.url-import-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [reimportUrl])

  const setField = (key, val) => setPreview(p => ({ ...p, [key]: val }))

  const removeIngredient = (ing) =>
    setField('ingredients', preview.ingredients.filter(i => i !== ing))

  const addIngredient = () => {
    const val = ingInput.trim()
    if (!val) return
    if (!preview.ingredients.includes(val)) {
      setField('ingredients', [...preview.ingredients, val])
    }
    setIngInput('')
  }

  const toggleTag = (tag) =>
    setField('tags', preview.tags.includes(tag)
      ? preview.tags.filter(t => t !== tag)
      : [...preview.tags, tag]
    )

  const startStatusCycle = () => {
    setStatusMsg(STATUS_MESSAGES[0])
    let idx = 0
    intervalRef.current = setInterval(() => {
      idx = (idx + 1) % STATUS_MESSAGES.length
      setStatusMsg(STATUS_MESSAGES[idx])
    }, 1500)
  }

  const stopStatusCycle = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setStatusMsg('')
  }

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setPhotoError('')
    const newUrls = files.map(f => URL.createObjectURL(f))
    setPhotoFiles(prev => [...prev, ...files])
    setPhotoObjectUrls(prev => [...prev, ...newUrls])
    setPreview(null)
    setStatus('idle')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removePhoto = (idx) => {
    URL.revokeObjectURL(photoObjectUrls[idx])
    setPhotoFiles(prev => prev.filter((_, i) => i !== idx))
    setPhotoObjectUrls(prev => prev.filter((_, i) => i !== idx))
  }

  const handlePhotoImport = async () => {
    if (!photoFiles.length) return
    setStatus('loading')
    setPhotoError('')
    setFallbackMsg('')
    setSuccessMsg('')

    setStatusMsg(PHOTO_STATUS_MESSAGES[0])
    let idx = 0
    intervalRef.current = setInterval(() => {
      idx = (idx + 1) % PHOTO_STATUS_MESSAGES.length
      setStatusMsg(PHOTO_STATUS_MESSAGES[idx])
    }, 1800)

    try {
      const result = await scrapeRecipeFromImage(photoFiles)
      stopStatusCycle()
      setPreview({
        name: result.name || '',
        ingredients: Array.isArray(result.ingredients) ? result.ingredients : [],
        notes: result.notes || '',
        tags: Array.isArray(result.tags) ? result.tags.filter(t => ALLOWED_TAGS.includes(t)) : [],
        cookTime: result.cookTime || '',
        servings: parseInt(result.servings) || null,
        calories: parseInt(result.calories) || null,
        protein_g: parseInt(result.protein_g) || null,
        carbs_g: parseInt(result.carbs_g) || null,
        fat_g: parseInt(result.fat_g) || null,
        instructions: (result.instructions || '').split(' | ').map(s => s.trim()).filter(Boolean).join('\n'),
        source: '',
        rating: 3,
      })
      setStatus('preview')
    } catch (err) {
      stopStatusCycle()
      setPhotoError(err.message || 'Could not read this photo. Try a clearer image.')
      setStatus('idle')
    }
  }

  const handleImport = async () => {
    if (!url.trim()) return
    setStatus('loading')
    setSaveError('')
    setFallbackMsg('')
    setSuccessMsg('')
    startStatusCycle()

    // scrapeRecipeWithAI never throws — returns buildFallback on any error
    const result = await scrapeRecipeWithAI(url.trim())
    stopStatusCycle()

    if (result._fallback) {
      setFallbackMsg(
        result._blocked
          ? "That site blocks automated access (AllRecipes does this). Take a screenshot of the recipe and use photo import instead, or fill in the details below."
          : "Couldn't reach that recipe site — fill in the details below."
      )
    }

    setPreview({
      name: result.name || '',
      ingredients: Array.isArray(result.ingredients) ? result.ingredients : [],
      notes: result.notes || '',
      tags: Array.isArray(result.tags)
        ? result.tags.filter(t => ALLOWED_TAGS.includes(t))
        : [],
      cookTime: result.cookTime || '',
      servings: parseInt(result.servings) || null,
      calories: parseInt(result.calories) || null,
      protein_g: parseInt(result.protein_g) || null,
      carbs_g: parseInt(result.carbs_g) || null,
      fat_g: parseInt(result.fat_g) || null,
      instructions: (result.instructions || '').split(' | ').map(s => s.trim()).filter(Boolean).join('\n'),
      source: url.trim(),
      rating: 3,
    })
    setStatus('preview')
  }

  const handleSave = async () => {
    if (!preview) return
    setSaving(true)
    setSaveError('')
    try {
      // Upload all photos (non-fatal if any fail)
      let photo_urls = []
      if (photoFiles.length > 0) {
        const results = await Promise.allSettled(photoFiles.map(f => uploadRecipeAttachment(f)))
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') photo_urls.push(r.value)
          else console.warn(`Photo ${i + 1} upload failed:`, r.reason?.message)
        })
      }

      await onImport({
        name: preview.name.trim() || 'Imported Recipe',
        rating: preview.rating ?? 3,
        last_made: null,
        times_made: 0,
        ingredients: preview.ingredients,
        notes: preview.notes,
        instructions: preview.instructions || '',
        cook_time: preview.cookTime || '',
        servings: preview.servings || null,
        calories: preview.calories || null,
        protein_g: preview.protein_g || null,
        carbs_g: preview.carbs_g || null,
        fat_g: preview.fat_g || null,
        tags: preview.tags,
        source: preview.source,
        photo_url: photo_urls[0] ?? null,
        photo_urls: photo_urls.length > 0 ? photo_urls : null,
      })
      setUrl('')
      setPreview(null)
      setStatus('idle')
      setIngInput('')
      setFallbackMsg('')
      setSuccessMsg('Saved to Rolodex!')
      successTimerRef.current = setTimeout(() => setSuccessMsg(''), 2000)
    } catch (err) {
      setSaveError(err.message || 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    setUrl('')
    setPreview(null)
    setStatus('idle')
    setIngInput('')
    setSaveError('')
    setFallbackMsg('')
    photoObjectUrls.forEach(u => URL.revokeObjectURL(u))
    setPhotoFiles([])
    setPhotoObjectUrls([])
    setPhotoError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    stopStatusCycle()
  }

  return (
    <div className="url-import-section">
      <div className="url-import-bar">
        <span className="url-import-label">Import Recipe</span>

        {/* URL row */}
        <div className="url-import-row">
          <input
            className="form-input url-import-input"
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleImport()}
            placeholder="Paste a recipe URL…"
            disabled={status === 'loading'}
          />
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={status === 'loading' || !url.trim()}
          >
            {status === 'loading' && !photoFiles.length ? 'Importing…' : 'Import'}
          </button>
        </div>

        {/* Divider */}
        <div className="import-divider"><span>or</span></div>

        {/* Photo upload row */}
        <div className="photo-upload-row">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            id="recipe-photo-input"
            className="photo-file-input"
            onChange={handlePhotoSelect}
            disabled={status === 'loading'}
          />
          {photoFiles.length === 0 ? (
            <label htmlFor="recipe-photo-input" className="photo-upload-btn">
              📷 Upload Recipe Photo(s)
            </label>
          ) : (
            <div className="multi-photo-selected">
              <div className="multi-photo-grid">
                {photoObjectUrls.map((url, i) => (
                  <div key={i} className="multi-photo-item">
                    <img src={url} alt={`page ${i + 1}`} className="multi-photo-thumb" />
                    <button
                      className="multi-photo-remove"
                      onClick={() => removePhoto(i)}
                      disabled={status === 'loading'}
                      title="Remove"
                    >✕</button>
                    {photoFiles.length > 1 && (
                      <span className="multi-photo-badge">{i + 1}</span>
                    )}
                  </div>
                ))}
                <label
                  htmlFor="recipe-photo-input"
                  className={`multi-photo-add${status === 'loading' ? ' disabled' : ''}`}
                  title="Add more photos"
                >
                  +
                </label>
              </div>
              <div className="multi-photo-actions">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handlePhotoImport}
                  disabled={status === 'loading'}
                >
                  {status === 'loading' ? 'Scanning…' : `Extract Recipe${photoFiles.length > 1 ? ` (${photoFiles.length} photos)` : ''}`}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    photoObjectUrls.forEach(u => URL.revokeObjectURL(u))
                    setPhotoFiles([])
                    setPhotoObjectUrls([])
                    if (fileInputRef.current) fileInputRef.current.value = ''
                    setPhotoError('')
                  }}
                  disabled={status === 'loading'}
                >Clear</button>
              </div>
            </div>
          )}
        </div>

        {status === 'loading' && statusMsg && (
          <div className="import-status-line">{statusMsg}</div>
        )}
        {photoError && <div className="import-fallback-msg">{photoError}</div>}
        {status !== 'loading' && fallbackMsg && (
          <div className="import-fallback-msg">{fallbackMsg}</div>
        )}
        {successMsg && (
          <div className="import-success-msg">{successMsg}</div>
        )}
      </div>

      {status === 'preview' && preview && (
        <div className="import-preview fade-in">
          {/* Editable name */}
          <input
            className="import-name-input"
            value={preview.name}
            onChange={e => setField('name', e.target.value)}
            placeholder="Recipe name"
          />

          {/* Editable rating */}
          <div className="import-rating-row">
            <Stars rating={preview.rating} onRate={r => setField('rating', r)} size="md" />
          </div>

          {/* Meta row */}
          {(preview.cookTime || preview.servings || preview.calories || preview.source) && (
            <div className="import-preview-meta">
              {preview.cookTime && <span>⏱ {preview.cookTime}</span>}
              {preview.servings && <span>👥 Serves {preview.servings}</span>}
              {preview.calories && <span>🔥 {preview.calories} cal/serving</span>}
              {preview.source && (
                <a href={preview.source} target="_blank" rel="noopener noreferrer" className="source-link">
                  ↗ Original recipe
                </a>
              )}
            </div>
          )}

          {/* Editable ingredients */}
          <div className="import-section">
            <div className="import-section-label">Ingredients</div>
            <div className="ing-input-row" style={{ marginBottom: 8 }}>
              <input
                className="form-input"
                value={ingInput}
                onChange={e => setIngInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addIngredient() } }}
                placeholder="Add ingredient…"
              />
              <button type="button" className="btn btn-secondary btn-sm" onClick={addIngredient}>Add</button>
            </div>
            {preview.ingredients.length > 0 && (
              <div className="chip-row">
                {preview.ingredients.map(ing => (
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

          {/* Editable notes */}
          <div className="import-section">
            <div className="import-section-label">Notes</div>
            <textarea
              className="form-textarea"
              value={preview.notes}
              onChange={e => setField('notes', e.target.value)}
              placeholder="Description, tips, or notes…"
              rows={3}
            />
          </div>

          {/* Editable instructions */}
          <div className="import-section">
            <div className="import-section-label">Instructions</div>
            <textarea
              className="form-textarea"
              value={preview.instructions}
              onChange={e => setField('instructions', e.target.value)}
              placeholder={"1. First step.\n2. Second step.\n3. Third step…"}
              rows={5}
            />
          </div>

          {/* Editable tags */}
          <div className="import-section">
            <div className="import-section-label">Tags</div>
            <div className="tag-toggle-row">
              {ALLOWED_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  className={`tag-toggle ${preview.tags.includes(tag) ? 'active' : ''}`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {saveError && <div className="form-error" style={{ marginBottom: 8 }}>{saveError}</div>}
          <div className="import-preview-actions">
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save to Rolodex'}
            </button>
            <button className="btn btn-ghost" onClick={handleDiscard} disabled={saving}>Discard</button>
          </div>
        </div>
      )}
    </div>
  )
}
