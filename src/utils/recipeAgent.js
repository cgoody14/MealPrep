export async function scrapeRecipeWithAI(url) {
  try {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY
    const endpoint = 'https://api.groq.com/openai/v1/chat/completions'

    console.log('[groq] looking up recipe from URL:', url)

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        temperature: 0.1,
        max_tokens: 1000,
        messages: [
          {
            role: 'system',
            content: `You are a recipe parser. When given a recipe URL, use your training knowledge to return ONLY a valid JSON object with no preamble, no markdown, no backticks — raw JSON only.

Exactly this shape:
{
  "name": "recipe name",
  "ingredients": ["ingredient name only no quantities or measurements"],
  "notes": "2-3 sentence cooking tips or description max 300 chars",
  "tags": [],
  "cookTime": "e.g. 30 mins",
  "servings": "e.g. 4 servings"
}

Ingredient rules — strip ALL quantities and measurements:
- "2 cups chicken broth" → "chicken broth"
- "1 tbsp olive oil" → "olive oil"
- "3 cloves garlic minced" → "garlic"

Tag rules — only use from this exact list that genuinely apply:
protein, pasta, seafood, vegetarian, sides, easy, weeknight, weekend,
crowd-pleaser, healthy, brunch, italian, japanese, greek

Never return null. Return empty arrays for ingredients and tags if unknown.
Return empty string for other fields if unknown.`
          },
          {
            role: 'user',
            content: `Extract the recipe data for this URL: ${url}`
          }
        ]
      })
    })

    const aiData = await response.json()
    console.log('[groq] raw response:', JSON.stringify(aiData))

    if (aiData.error) throw new Error(aiData.error.message)

    const text = aiData.choices?.[0]?.message?.content ?? '{}'
    console.log('[groq] extracted text:', text)

    const clean = text.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)
    console.log('[groq] parsed result:', result)
    return result

  } catch (err) {
    console.error('[groq] failed:', err.message)
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
