export async function scrapeRecipeWithAI(url) {
  try {
    // Step 1: Fetch HTML via our own serverless function
    const scrapeRes = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    })
    const { html, error } = await scrapeRes.json()
    if (error || !html) throw new Error(error ?? 'No HTML returned')

    console.log('[gemini] fetched html length:', html.length)

    // Step 2: Strip to readable text
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    doc.querySelectorAll(
      'script,style,nav,footer,header,aside,[class*="ad-"],[id*="ad-"]'
    ).forEach(el => el.remove())
    const rawText = (doc.body?.innerText ?? doc.body?.textContent ?? '').slice(0, 6000)

    console.log('[gemini] stripped text preview:', rawText.slice(0, 300))

    // Step 3: Send to Gemini
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a recipe parser. Extract structured recipe data from the text below and return ONLY a valid JSON object. No preamble, no markdown, no backticks — raw JSON only.

Return exactly this shape:
{
  "name": "recipe name",
  "ingredients": ["ingredient name only no quantities"],
  "notes": "description or cooking tips max 300 chars",
  "tags": [],
  "cookTime": "e.g. 30 mins",
  "servings": "e.g. 4 servings"
}

Ingredient rules:
- Strip ALL quantities and measurements
- "2 cups chicken broth" → "chicken broth"
- "1 tbsp olive oil" → "olive oil"

Tag rules — only use from this exact list:
protein, pasta, seafood, vegetarian, sides, easy, weeknight, weekend,
crowd-pleaser, healthy, brunch, italian, japanese, greek

Never return null. Empty arrays if nothing found.

Recipe text:
${rawText}

Source URL: ${url}`
          }]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1000 }
      })
    })

    const aiData = await response.json()
    console.log('[gemini] raw response:', JSON.stringify(aiData))

    const text = aiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
    const clean = text.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)
    console.log('[gemini] parsed result:', result)
    return result

  } catch (err) {
    console.error('[gemini] failed:', err.message)
    return buildFallback(url)
  }
}

function buildFallback(url) {
  try {
    const path = new URL(url).pathname
    const slug = path.split('/').filter(Boolean).pop() ?? ''
    const name = slug
      .replace(/[-_]/g, ' ')
      .replace(/\.(html|htm|php|aspx)$/i, '')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim() || 'Imported Recipe'
    return { name, ingredients: [], notes: '', tags: [], cookTime: '', servings: '', _fallback: true }
  } catch {
    return { name: 'Imported Recipe', ingredients: [], notes: '', tags: [], cookTime: '', servings: '', _fallback: true }
  }
}
