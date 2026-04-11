export async function scrapeRecipeWithAI(url) {
  try {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

    console.log('[gemini] looking up recipe from URL:', url)

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `A user wants to save this recipe to their meal planner: ${url}

Based on the URL and your knowledge of this recipe, return ONLY a valid JSON object with no preamble, no markdown, no backticks — raw JSON only.

Exactly this shape:
{
  "name": "recipe name",
  "ingredients": ["ingredient name only, no quantities or measurements"],
  "notes": "2-3 sentence cooking tips or description, max 300 chars",
  "tags": [],
  "cookTime": "e.g. 30 mins",
  "servings": "e.g. 4 servings"
}

Ingredient rules — strip ALL quantities and measurements:
- "2 cups chicken broth" → "chicken broth"
- "1 tbsp olive oil" → "olive oil"
- "3 cloves garlic, minced" → "garlic"
- Keep only the core ingredient name

Tag rules — only use tags from this exact list that genuinely apply:
protein, pasta, seafood, vegetarian, sides, easy, weeknight, weekend,
crowd-pleaser, healthy, brunch, italian, japanese, greek

If you do not recognize the recipe from the URL, make your best guess from the URL slug words. Never return null. Return empty arrays for ingredients and tags if truly unknown. Return empty string for other fields if unknown.`
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1000
        }
      })
    })

    const aiData = await response.json()
    console.log('[gemini] raw response:', JSON.stringify(aiData))

    if (aiData.error) throw new Error(aiData.error.message)

    const text = aiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
    console.log('[gemini] extracted text:', text)

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
