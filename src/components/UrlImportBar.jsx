import { useState } from 'react'
import Stars from './Stars'

const ALLOWED_TAGS = [
  'protein','pasta','seafood','vegetarian','sides','easy','weeknight',
  'weekend','crowd-pleaser','healthy','brunch','italian','japanese','greek'
]

// Parse ISO 8601 duration (PT30M, PT1H30M, etc.) → total minutes
function parseMinutes(iso) {
  if (!iso) return null
  const h = iso.match(/(\d+)H/)
  const m = iso.match(/(\d+)M/)
  const total = (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0)
  return total > 0 ? total : null
}

function generateTags(name, ingredients, description, cookTimeRaw, servingsRaw) {
  const ingStr = ingredients.join(' ').toLowerCase()
  const descStr = (description + ' ' + name).toLowerCase()
  const minutes = parseMinutes(cookTimeRaw)
  const servings = parseInt(servingsRaw) || 0
  const tags = []

  if (/chicken|beef|pork|lamb|steak|turkey/.test(ingStr)) tags.push('protein')
  if (/salmon|cod|shrimp|fish|tuna|seafood|scallop/.test(ingStr)) tags.push('seafood')
  if (/pasta|orzo|rigatoni|spaghetti|penne|noodle/.test(ingStr)) tags.push('pasta')
  if (!tags.includes('protein') && !tags.includes('seafood')) tags.push('vegetarian')
  if ((minutes && minutes < 30) || /easy|quick/.test(descStr)) tags.push('easy')
  if (minutes && minutes < 45 && !tags.includes('easy')) tags.push('weeknight')
  if ((minutes && minutes > 60) || /slow|braise/.test(descStr)) tags.push('weekend')
  if (/italian|pasta|risotto|parmesan/.test(descStr)) tags.push('italian')
  if (/miso|mirin|sake|soy sauce|sesame/.test(ingStr)) tags.push('japanese')
  if (/feta|tzatziki|oregano/.test(ingStr) || /lamb/.test(ingStr)) tags.push('greek')
  if (/healthy|light|fresh|low.cal/.test(descStr)) tags.push('healthy')
  if (/brunch|breakfast|frittata/.test(descStr) || /\begg\b/.test(ingStr)) tags.push('brunch')
  if (servings >= 6) tags.push('crowd-pleaser')

  return [...new Set(tags)].filter(t => ALLOWED_TAGS.includes(t))
}

function cleanIngredient(raw) {
  let s = raw.trim()
  s = s.replace(/^[\d¼½¾⅓⅔⅛⅜⅝⅞]+[\s/\d-]*\s*/u, '')
  s = s.replace(/^(cup|cups|tablespoon|tablespoons|tbsp|teaspoon|teaspoons|tsp|oz|ounce|ounces|pound|pounds|lb|lbs|gram|grams|g|kg|ml|liter|liters|pinch|handful|dash|can|cans|clove|cloves|slice|slices|bunch|bunches|package|packages|stick|sticks|head|heads|medium|large|small|fresh|dried|chopped|minced|diced|sliced|whole|ground)\s+/i, '')
  s = s.replace(/\s*\(.*?\)\s*/g, '')
  s = s.replace(/[,;.]+$/, '').trim()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

async function scrapeRecipe(url) {
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
  const resp = await fetch(proxyUrl)
  if (!resp.ok) throw new Error('Proxy request failed')
  const json = await resp.json()
  const html = json.contents

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Try JSON-LD first
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]')
  for (const script of scripts) {
    try {
      let data = JSON.parse(script.textContent)
      if (data['@graph']) {
        data = data['@graph'].find(n =>
          n['@type'] === 'Recipe' ||
          (Array.isArray(n['@type']) && n['@type'].includes('Recipe'))
        )
      }
      if (!data) continue
      const isRecipe = data['@type'] === 'Recipe' ||
        (Array.isArray(data['@type']) && data['@type'].includes('Recipe'))
      if (!isRecipe) continue

      const ingredients = (data.recipeIngredient || []).map(cleanIngredient).filter(Boolean)
      const name = data.name || ''
      const rawDesc = data.description || ''
      const notes = rawDesc.slice(0, 500)
      const cookTime = data.totalTime || data.cookTime || ''
      const servingsRaw = data.recipeYield
        ? (Array.isArray(data.recipeYield) ? data.recipeYield[0] : data.recipeYield)
        : ''
      const keywords = data.keywords
        ? (typeof data.keywords === 'string'
            ? data.keywords.split(',').map(k => k.trim().toLowerCase())
            : [])
        : []
      const autoTags = generateTags(name, ingredients, rawDesc, cookTime, String(servingsRaw))
      const allTags = [...new Set([...autoTags, ...keywords.filter(k => ALLOWED_TAGS.includes(k))])]

      return { name, notes, ingredients, cookTime, servings: String(servingsRaw), tags: allTags, source: url }
    } catch { /* skip */ }
  }

  // Fallback: OpenGraph + itemprop/CSS selectors
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || ''
  const metaDesc = (
    doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
    doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
    ''
  ).slice(0, 500)

  const ingSelectors = [
    '[itemprop="recipeIngredient"]',
    '.recipe-ingredients li',
    '.ingredients li',
    '.ingredients-list li',
    '.wprm-recipe-ingredient',
    '.recipe-ingredient',
    '.ingredient',
  ]
  let ingredients = []
  for (const sel of ingSelectors) {
    const els = doc.querySelectorAll(sel)
    if (els.length > 0) {
      ingredients = Array.from(els).map(el => cleanIngredient(el.textContent)).filter(Boolean)
      break
    }
  }

  let name = ogTitle
  if (!name) {
    try {
      const path = new URL(url).pathname
      name = path.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'Imported Recipe'
      name = name.charAt(0).toUpperCase() + name.slice(1)
    } catch { name = 'Imported Recipe' }
  }

  return {
    name,
    notes: metaDesc,
    ingredients,
    cookTime: '',
    servings: '',
    tags: generateTags(name, ingredients, metaDesc, '', ''),
    source: url,
  }
}

export default function UrlImportBar({ onImport }) {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState('idle')
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [ingInput, setIngInput] = useState('')

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

  const handleImport = async () => {
    if (!url.trim()) return
    setStatus('loading')
    setSaveError('')
    try {
      const result = await scrapeRecipe(url.trim())
      setPreview({ ...result, rating: 3 })
      setStatus('preview')
    } catch {
      try {
        const path = new URL(url.trim()).pathname
        let name = path.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'Imported Recipe'
        name = name.charAt(0).toUpperCase() + name.slice(1)
        setPreview({ name, notes: '', ingredients: [], cookTime: '', servings: '', tags: [], source: url.trim(), rating: 3 })
      } catch {
        setPreview({ name: '', notes: '', ingredients: [], cookTime: '', servings: '', tags: [], source: url.trim(), rating: 3 })
      }
      setStatus('preview')
    }
  }

  const handleSave = async () => {
    if (!preview) return
    setSaving(true)
    setSaveError('')
    try {
      await onImport({
        name: preview.name.trim() || 'Imported Recipe',
        rating: preview.rating ?? 3,
        last_made: null,
        times_made: 0,
        ingredients: preview.ingredients,
        notes: preview.notes,
        tags: preview.tags,
        source: preview.source,
      })
      setUrl('')
      setPreview(null)
      setStatus('idle')
      setIngInput('')
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
  }

  return (
    <div className="url-import-section">
      <div className="url-import-bar">
        <span className="url-import-label">Import Recipe</span>
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
            {status === 'loading' ? 'Importing…' : 'Import'}
          </button>
        </div>
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
          <div className="import-preview-meta">
            {preview.cookTime && <span>⏱ {preview.cookTime}</span>}
            {preview.servings && <span>👥 {preview.servings} servings</span>}
            <a href={preview.source} target="_blank" rel="noopener noreferrer" className="source-link">↗ Original</a>
          </div>

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
