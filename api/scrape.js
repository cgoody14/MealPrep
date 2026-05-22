import { createClient } from '@supabase/supabase-js'

// Same schema as recipeAgent.js — defines the JSON shape Groq must return
const RECIPE_JSON_SCHEMA = `Exactly this shape:
{
  "name": "recipe name",
  "ingredients": ["ingredient with quantity e.g. 2 cups chicken broth"],
  "notes": "2-3 sentence cooking tips or description max 300 chars",
  "tags": [],
  "cookTime": "e.g. 30 mins",
  "servings": 4,
  "calories": 450,
  "protein_g": 32,
  "carbs_g": 28,
  "fat_g": 18,
  "instructions": "1. First step | 2. Second step | 3. Third step"
}

Servings rules: return an integer (e.g. "serves 4" → 4). Return 0 if unknown.
Nutrition rules: estimate realistic per-serving values as integers. Return 0 if unknown.

Ingredient rules: transcribe ONLY ingredients explicitly listed in the recipe. Copy quantities and preparation notes exactly as written. Never infer or add ingredients not stated.

Tag rules — only use from this exact list that genuinely apply:
protein, chicken, beef, pork, steak, shrimp, salmon, lamb, turkey,
seafood, pasta, vegetarian, vegan, healthy, gluten-free, low-carb,
sides, soup, salad, easy, quick, weeknight, weekend, brunch,
crowd-pleaser, meal-prep, grill,
italian, japanese, greek, mexican, thai, indian, korean, mediterranean

Instructions rules:
- Write ALL steps as a single string separated by ' | ' (space pipe space) — NOT newlines or \\n
- Transcribe every step from the source in FULL — do NOT summarize, skip, or merge steps
- A typical recipe should produce 8–20 steps; never compress multiple actions into one step
- Each step must include: specific temperatures (e.g. 375°F, medium-high heat), specific times (e.g. 15–20 minutes), exact techniques, and quantities where relevant
- Keep prep steps separate from cook steps (e.g. mixing sauce is its own step, not merged into the main cook step)
- Mark optional steps clearly: "If desired, broil for 3 minutes for a light char"
- Include plating and serving instructions as the final step
- Aim for 15–30 words per step
- Bad: "1. Make tartar sauce" — Good: "1. Combine 1/2 cup mayonnaise, 1/4 cup finely chopped bread-and-butter pickles, 1 tbsp pickle brine, 1 small shallot, 2 tbsp fresh dill, 2 tbsp capers, and 1 tsp soy sauce in a bowl; season with salt and refrigerate until ready to use"
- Bad: "2. Fry the fish" — Good: "2. Heat 1 cup vegetable oil in a large skillet over medium-high heat until shimmering; fry breaded fillets 3–4 minutes per side until deep golden brown and cooked through"

Never return null. Return empty arrays for ingredients and tags if unknown. Return empty string for other fields if unknown.`

// Pre-format JSON-LD structured data to highlight instruction steps clearly for Groq.
// When a site provides recipeInstructions as a HowToStep array, we pull them out
// and label them explicitly so the AI can't miss or compress them.
function formatStructuredRecipe(structured) {
  const rawInstructions = structured.recipeInstructions
  const steps = []
  if (Array.isArray(rawInstructions)) {
    rawInstructions.forEach((step, i) => {
      const text = typeof step === 'string' ? step : (step.text || step.name || '')
      if (text.trim()) steps.push(`${i + 1}. ${text.trim()}`)
    })
  } else if (typeof rawInstructions === 'string' && rawInstructions.trim()) {
    steps.push(rawInstructions.trim())
  }

  if (steps.length > 0) {
    const { recipeInstructions: _omit, ...rest } = structured
    return (
      JSON.stringify(rest) +
      '\n\nRECIPE INSTRUCTIONS — transcribe EVERY step below in full detail, do not summarize:\n' +
      steps.join('\n')
    )
  }
  return JSON.stringify(structured)
}

// Recursively find a Recipe node in a JSON-LD value
function findRecipe(node) {
  if (!node || typeof node !== 'object') return null
  if (node['@type'] === 'Recipe') return node
  if (Array.isArray(node)) {
    for (const item of node) {
      const r = findRecipe(item)
      if (r) return r
    }
  }
  if (node['@graph']) return findRecipe(node['@graph'])
  return null
}

// Extract the first Recipe JSON-LD block from an HTML page
function extractJsonLd(html) {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match
  while ((match = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1])
      const recipe = findRecipe(parsed)
      if (recipe) return recipe
    } catch { /* malformed JSON-LD — skip */ }
  }
  return null
}

// Strip HTML to clean readable text for Groq
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 14000) // keep well within Groq's context window
}

function parseAIResponse(text) {
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const match = clean.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON in response')
  return JSON.parse(match[0])
}

function buildFallback(url, blocked = false) {
  try {
    const slug = new URL(url).pathname.split('/').filter(Boolean).pop() ?? ''
    const name = slug
      .replace(/[-_]/g, ' ').replace(/\.(html|htm|php|aspx)$/i, '')
      .replace(/\b\w/g, c => c.toUpperCase()).trim() || 'Imported Recipe'
    return { name, ingredients: [], notes: '', tags: [], cookTime: '', servings: 0, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, instructions: '', _fallback: true, _blocked: blocked }
  } catch {
    return { name: 'Imported Recipe', ingredients: [], notes: '', tags: [], cookTime: '', servings: 0, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, instructions: '', _fallback: true, _blocked: blocked }
  }
}

function isBlockedPage(status, html) {
  if (status === 403 || status === 503) return true
  if (!html) return false
  const lower = html.slice(0, 4000).toLowerCase()
  return (
    lower.includes('cf-browser-verification') ||
    lower.includes('challenge-platform') ||
    lower.includes('enable javascript and cookies') ||
    (lower.includes('just a moment') && lower.includes('cloudflare')) ||
    lower.includes('access denied') ||
    lower.includes('403 forbidden')
  )
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Auth check
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  const { data: { user }, error: authErr } = await supabase.auth.getUser(auth.slice(7))
  if (authErr || !user) {
    return res.status(401).json({ error: 'Invalid session' })
  }

  const { url } = req.body ?? {}
  if (!url) return res.status(400).json({ error: 'url is required' })

  // Validate URL — must be http(s) only
  let parsedUrl
  try {
    parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error()
  } catch {
    return res.status(400).json({ error: 'Invalid URL' })
  }

  // ── Step 1: Fetch the actual page ───────────────────────────────────────────
  let pageHtml
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 9000)
    const pageRes = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })
    clearTimeout(timeout)
    const html = await pageRes.text()
    if (!pageRes.ok || isBlockedPage(pageRes.status, html)) {
      return res.status(200).json(buildFallback(url, true))
    }
    pageHtml = html
  } catch {
    // Can't reach the page — degrade gracefully with a fallback
    return res.status(200).json(buildFallback(url, false))
  }

  // ── Step 2: Extract content — JSON-LD first, then raw text ─────────────────
  // JSON-LD (schema.org/Recipe) is present on most modern recipe sites and is
  // machine-readable, giving Groq the cleanest possible signal.
  const structured = extractJsonLd(pageHtml)
  const recipeContext = structured ? formatStructuredRecipe(structured) : htmlToText(pageHtml)
  const contextLabel = structured ? 'JSON-LD structured recipe data' : 'recipe page text'

  // ── Step 3: Normalize into our schema via Groq ─────────────────────────────
  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        max_tokens: 4000,
        messages: [
          {
            role: 'system',
            content: `You are a recipe extractor. Extract the recipe from the provided ${contextLabel} and return ONLY a valid JSON object with no preamble, no markdown, no backticks — raw JSON only.\n\n${RECIPE_JSON_SCHEMA}`,
          },
          {
            role: 'user',
            content: `Source URL: ${url}\n\n${contextLabel[0].toUpperCase() + contextLabel.slice(1)}:\n${recipeContext}`,
          },
        ],
      }),
    })
    const groqData = await groqRes.json()
    if (groqData.error) throw new Error(groqData.error.message)
    const result = parseAIResponse(groqData.choices?.[0]?.message?.content ?? '')
    return res.status(200).json(result)
  } catch {
    return res.status(200).json(buildFallback(url))
  }
}
