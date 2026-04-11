const apiKey = import.meta.env.VITE_GEMINI_API_KEY
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

export async function callGemini(rawText, url) {
  const prompt = `You are a recipe parser. Extract structured recipe data from the text below and return ONLY a valid JSON object. No preamble, no markdown, no backticks — raw JSON only.

Return exactly this shape:
{
  name: recipe name as a string,
  ingredients: array of ingredient name strings with all quantities and measurements stripped. '2 cups chicken broth' becomes 'chicken broth'. '1 tbsp olive oil' becomes 'olive oil',
  notes: recipe description or key cooking tips as a string max 300 chars,
  tags: array of tags only chosen from this exact list based on what genuinely applies: protein, pasta, seafood, vegetarian, sides, easy, weeknight, weekend, crowd-pleaser, healthy, brunch, italian, japanese, greek,
  cookTime: cook time as a readable string e.g. 30 mins,
  servings: servings as a readable string e.g. 4 servings
}

Never return null for any field. Return empty arrays for ingredients and tags if none found. Return empty string for other fields if not found.

Recipe text:
${rawText}

Source URL: ${url}`

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1000 }
    })
  })

  if (!resp.ok) throw new Error(`Gemini API error: ${resp.status}`)
  const data = await resp.json()
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('No response from Gemini')

  // Strip potential markdown code fences Gemini sometimes adds despite instructions
  text = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
  return JSON.parse(text)
}
