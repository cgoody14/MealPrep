import { useState } from 'react'

const ALLOWED_TAGS = [
  'protein','pasta','seafood','vegetarian','sides','easy','weeknight',
  'weekend','crowd-pleaser','healthy','brunch','italian','japanese','greek'
]

function guessTagsFromIngredients(ingredients) {
  const joined = ingredients.join(' ').toLowerCase()
  const tags = []
  if (/chicken|beef|pork|lamb|steak|turkey|duck/.test(joined)) tags.push('protein')
  if (/pasta|orzo|rigatoni|spaghetti|penne/.test(joined)) tags.push('pasta')
  if (/salmon|cod|shrimp|fish|tuna|seafood|scallop/.test(joined)) tags.push('seafood')
  if (!tags.includes('protein') && !tags.includes('seafood') &&
      /egg|tofu|mushroom|eggplant|chickpea|lentil/.test(joined)) tags.push('vegetarian')
  return tags.filter(t => ALLOWED_TAGS.includes(t))
}

function cleanIngredient(raw) {
  let s = raw.trim()
  // Strip leading quantities: "2 cups", "1/2 tsp", "3-4", etc.
  s = s.replace(/^[\d¼½¾⅓⅔⅛⅜⅝⅞]+[\s/\d-]*\s*/u, '')
  // Strip measurement words
  s = s.replace(/^(cup|cups|tablespoon|tablespoons|tbsp|teaspoon|teaspoons|tsp|oz|ounce|ounces|pound|pounds|lb|lbs|gram|grams|g|kg|ml|liter|liters|pinch|handful|dash|can|cans|clove|cloves|slice|slices|bunch|bunches|package|packages|stick|sticks|head|heads|medium|large|small|fresh|dried|chopped|minced|diced|sliced|whole|ground)\s+/i, '')
  // Remove parenthetical notes
  s = s.replace(/\s*\(.*?\)\s*/g, '')
  // Remove trailing comma/punctuation
  s = s.replace(/[,;.]+$/, '').trim()
  // Capitalize first letter
  return s.charAt(0).toUpperCase() + s.slice(1)
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
      // Handle @graph arrays
      if (data['@graph']) data = data['@graph'].find(n => n['@type'] === 'Recipe' || (Array.isArray(n['@type']) && n['@type'].includes('Recipe')))
      if (!data) continue
      if (data['@type'] === 'Recipe' || (Array.isArray(data['@type']) && data['@type'].includes('Recipe'))) {
        const ingredients = (data.recipeIngredient || []).map(cleanIngredient).filter(Boolean)
        const name = data.name || ''
        const description = data.description || ''
        const cookTime = data.totalTime || data.cookTime || ''
        const servings = data.recipeYield ? (Array.isArray(data.recipeYield) ? data.recipeYield[0] : data.recipeYield) : ''
        const keywords = data.keywords ? data.keywords.split(',').map(k => k.trim().toLowerCase()) : []
        const autoTags = guessTagsFromIngredients(ingredients)
        const allTags = [...new Set([...autoTags, ...keywords.filter(k => ALLOWED_TAGS.includes(k))])]
        return { name, description, ingredients, cookTime, servings, tags: allTags, source: url }
      }
    } catch { /* skip invalid JSON */ }
  }

  // Fallback: OpenGraph + CSS selectors
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.content || ''
  const ogDesc = doc.querySelector('meta[property="og:description"]')?.content || ''

  const ingSelectors = [
    '.recipe-ingredients li', '.ingredients-list li', '.wprm-recipe-ingredient',
    '[itemprop="recipeIngredient"]', '.ingredient', '.recipe-ingredient'
  ]
  let ingredients = []
  for (const sel of ingSelectors) {
    const els = doc.querySelectorAll(sel)
    if (els.length > 0) {
      ingredients = Array.from(els).map(el => cleanIngredient(el.textContent)).filter(Boolean)
      break
    }
  }

  // Guess name from URL if no og:title
  let name = ogTitle
  if (!name) {
    const path = new URL(url).pathname
    name = path.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'Imported Recipe'
    name = name.charAt(0).toUpperCase() + name.slice(1)
  }

  return {
    name,
    description: ogDesc,
    ingredients,
    cookTime: '',
    servings: '',
    tags: guessTagsFromIngredients(ingredients),
    source: url
  }
}

export default function UrlImportBar({ onImport }) {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | preview | error
  const [preview, setPreview] = useState(null)

  const handleImport = async () => {
    if (!url.trim()) return
    setStatus('loading')
    try {
      const result = await scrapeRecipe(url.trim())
      setPreview(result)
      setStatus('preview')
    } catch {
      // Graceful fallback: pre-fill form with URL-guessed name
      try {
        const path = new URL(url.trim()).pathname
        let name = path.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'Imported Recipe'
        name = name.charAt(0).toUpperCase() + name.slice(1)
        setPreview({ name, description: '', ingredients: [], cookTime: '', servings: '', tags: [], source: url.trim() })
        setStatus('preview')
      } catch {
        setPreview({ name: '', description: '', ingredients: [], cookTime: '', servings: '', tags: [], source: url.trim() })
        setStatus('preview')
      }
    }
  }

  const handleSave = () => {
    if (!preview) return
    onImport({
      name: preview.name,
      rating: null,
      last_made: null,
      times_made: 1,
      ingredients: preview.ingredients,
      notes: preview.description || '',
      tags: preview.tags,
      source: preview.source,
    })
    setUrl('')
    setPreview(null)
    setStatus('idle')
  }

  const handleDiscard = () => {
    setUrl('')
    setPreview(null)
    setStatus('idle')
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
          <div className="import-preview-header">
            <h3 className="import-preview-name">{preview.name || 'Untitled Recipe'}</h3>
            <div className="import-preview-meta">
              {preview.cookTime && <span>⏱ {preview.cookTime}</span>}
              {preview.servings && <span>👥 {preview.servings} servings</span>}
              <a href={preview.source} target="_blank" rel="noopener noreferrer" className="source-link">↗ Original</a>
            </div>
          </div>
          {preview.ingredients.length > 0 && (
            <div className="chip-row" style={{ marginBottom: 8 }}>
              {preview.ingredients.map(ing => <span key={ing} className="chip">{ing}</span>)}
            </div>
          )}
          {preview.description && (
            <p className="import-description">{preview.description}</p>
          )}
          {preview.tags.length > 0 && (
            <div className="tag-row" style={{ marginBottom: 12 }}>
              {preview.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}
            </div>
          )}
          <div className="import-preview-actions">
            <button className="btn btn-primary" onClick={handleSave}>Save to Rolodex</button>
            <button className="btn btn-ghost" onClick={handleDiscard}>Discard</button>
          </div>
        </div>
      )}
    </div>
  )
}
