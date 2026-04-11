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
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        max_tokens: 1500,
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
  "servings": "e.g. 4 servings",
  "instructions": "1. First step | 2. Second step | 3. Third step"
}

Ingredient rules — strip ALL quantities and measurements:
- "2 cups chicken broth" → "chicken broth"
- "1 tbsp olive oil" → "olive oil"
- "3 cloves garlic minced" → "garlic"

Tag rules — only use from this exact list that genuinely apply:
protein, pasta, seafood, vegetarian, sides, easy, weeknight, weekend,
crowd-pleaser, healthy, brunch, italian, japanese, greek

Instructions rules:
- Write all steps as a single string
- Separate steps with ' | ' (space pipe space) — NOT newlines or \\n
- Example: "1. Preheat oven to 425F | 2. Season chicken | 3. Sear 4 min per side"
- Include all key cooking actions: prep, cook, plate

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

    const text = aiData.choices?.[0]?.message?.content ?? ''
    console.log('[groq] extracted text:', text)

    // Strip markdown code fences if present
    let clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

    // Extract just the JSON object in case there is any preamble
    const jsonMatch = clean.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON object found in response')
    clean = jsonMatch[0]

    let result
    try {
      result = JSON.parse(clean)
    } catch {
      // Last resort: sanitize control characters and retry
      const sanitized = clean
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .replace(/\s+/g, ' ')
      result = JSON.parse(sanitized)
    }

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
    return { name, ingredients: [], notes: '', tags: [], cookTime: '', servings: '', instructions: '', _fallback: true }
  } catch {
    return { name: 'Imported Recipe', ingredients: [], notes: '', tags: [], cookTime: '', servings: '', instructions: '', _fallback: true }
  }
}
