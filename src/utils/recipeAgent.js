import { callGroq, callScrape } from './groqClient'

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

Servings rules: return an integer (e.g. "serves 4" → 4, "makes 6 servings" → 6). Return 0 if unknown.
Nutrition rules: estimate realistic per-serving values as integers (calories, protein_g, carbs_g, fat_g). Return 0 if unknown.

Ingredient rules — transcribe ONLY ingredients explicitly listed in the recipe. DO NOT add, infer, or supplement based on cooking knowledge or common variations:
- Copy quantities and measurements exactly as written: "2 cups chicken broth" → "2 cups chicken broth"
- Copy preparation notes exactly: "3 cloves garlic, minced" → "3 cloves garlic, minced"
- If an ingredient is not explicitly stated in the recipe, do NOT include it
- Never guess what "probably" belongs — omit rather than invent

Tag rules — only use from this exact list that genuinely apply:
protein, chicken, beef, pork, steak, shrimp, salmon, lamb, turkey,
seafood, pasta, vegetarian, vegan, healthy, gluten-free, low-carb,
sides, soup, salad, easy, quick, weeknight, weekend, brunch,
crowd-pleaser, meal-prep, grill,
italian, japanese, greek, mexican, thai, indian, korean, mediterranean

Instructions rules:
- Write ALL steps as a single string separated by ' | ' (space pipe space) — NOT newlines or \\n
- A typical recipe should produce 8–20 steps; NEVER compress multiple actions into one step
- Keep prep steps separate from cook steps (making a sauce is its own step, not merged into another)
- Each step must include specific temperatures (e.g. 375°F, medium-high heat), specific times (e.g. 15–20 minutes), exact techniques, and quantities where relevant
- Mark optional steps clearly (e.g. If desired, broil for 3 minutes for light char)
- Include plating and serving instructions as the final step
- Do NOT summarize steps — write each step exactly as a recipe author would write it
- Aim for 15–30 words per step
- Bad: '1. Make tartar sauce' — Good: '1. Combine 1/2 cup mayonnaise, finely chopped pickles, pickle brine, shallot, dill, capers, and soy sauce in a bowl; season with salt and refrigerate'
- Bad: '2. Fry the fish' — Good: '2. Heat 1 cup vegetable oil in a large skillet over medium-high heat until shimmering, then fry breaded fillets 3–4 minutes per side until deep golden brown'

Never return null. Return empty arrays for ingredients and tags if unknown.
Return empty string for other fields if unknown.`

function parseAIResponse(text) {
  let clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const jsonMatch = clean.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON object found in response')
  clean = jsonMatch[0]
  try {
    return JSON.parse(clean)
  } catch {
    // Strip control characters that can invalidate JSON
    const sanitized = clean.replace(/[-]/g, ' ')
    return JSON.parse(sanitized)
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
    return { name, ingredients: [], notes: '', tags: [], cookTime: '', servings: 0, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, instructions: '', _fallback: true }
  } catch {
    return { name: 'Imported Recipe', ingredients: [], notes: '', tags: [], cookTime: '', servings: 0, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, instructions: '', _fallback: true }
  }
}

export async function scrapeRecipeWithAI(url) {
  // ── 1. Production: server fetches the real page, extracts content, runs Groq ──
  // callScrape returns null in dev (no server), falls back to AI-memory below.
  let serverResult = null
  try {
    serverResult = await callScrape(url)
    if (serverResult && !serverResult._fallback && !serverResult.error) {
      return serverResult
    }
  } catch { /* network error — fall through */ }

  // ── 2. Dev only: ask Groq to recall the exact recipe from the URL ───────────
  // (In prod, callScrape already ran Groq server-side on the real page.)
  if (import.meta.env.VITE_GROQ_API_KEY) {
    try {
      const aiData = await callGroq({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        max_tokens: 4000,
        messages: [
          {
            role: 'system',
            content: `You are a strict recipe transcriber. When given a recipe URL, recall the recipe from your training data and transcribe ONLY what is explicitly written in that recipe. Return ONLY a valid JSON object with no preamble, no markdown, no backticks — raw JSON only.\n\n${RECIPE_JSON_SCHEMA}`,
          },
          {
            role: 'user',
            content: `Transcribe the recipe at this URL exactly as written: ${url}\n\nFor the instructions field, write each step in full detail — include temperatures, times, quantities, and techniques. Do not summarize or shorten any step.`,
          },
        ],
      })
      const recalled = parseAIResponse(aiData.choices?.[0]?.message?.content ?? '')
      if (Array.isArray(recalled.ingredients) && recalled.ingredients.length > 0) {
        return recalled
      }
    } catch { /* fall through to approximation */ }
  }

  // ── 3. Page couldn't be read (blocked/unreachable) — generate a close AI
  //       approximation from the dish name so the user gets a usable draft
  //       instead of an empty form. Clearly flagged for the UI.
  const guessName = buildFallback(url).name
  if (guessName && guessName.toLowerCase() !== 'imported recipe') {
    try {
      const approx = await generateRecipeFromPrompt(guessName)
      if (Array.isArray(approx.ingredients) && approx.ingredients.length > 0) {
        return { ...approx, source: url, _approximated: true }
      }
    } catch (err) {
      console.error('[recipeAgent] approximation failed:', err.message)
    }
  }

  // ── 4. Nothing worked — empty fallback form (preserve the blocked flag) ──────
  return { ...buildFallback(url), _blocked: !!serverResult?._blocked }
}

// Convert any image file to a base64 JPEG, resizing large images down
async function fileToBase64Jpeg(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      const MAX_DIM = 1568
      let w = img.naturalWidth
      let h = img.naturalHeight
      if (w > MAX_DIM || h > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / w, MAX_DIM / h)
        w = Math.round(w * ratio)
        h = Math.round(h * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(objectUrl)
      resolve(canvas.toDataURL('image/jpeg', 0.9).split(',')[1])
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not read image. Try saving it as a JPEG and uploading again.'))
    }

    img.src = objectUrl
  })
}

export async function scrapeRecipeFromImage(files) {
  const fileArray = Array.isArray(files) ? files : [files]
  const base64Array = await Promise.all(fileArray.map(fileToBase64Jpeg))

  const imageContent = base64Array.map(b64 => ({
    type: 'image_url',
    image_url: { url: `data:image/jpeg;base64,${b64}` },
  }))

  const multi = fileArray.length > 1
  const aiData = await callGroq({
    model: 'qwen/qwen3.6-27b',
    temperature: 0.1,
    max_tokens: 2500,
    messages: [
      {
        role: 'user',
        content: [
          ...imageContent,
          {
            type: 'text',
            text: `${multi ? `These are ${fileArray.length} photos of a recipe — treat them as consecutive pages of the same recipe.` : 'This is a photo of a recipe page.'} Read every word carefully across all images and return ONLY a valid JSON object with no preamble, no markdown, no backticks — raw JSON only.\n\n${RECIPE_JSON_SCHEMA}\n\nTranscribe every ingredient and instruction step exactly as written in the photo${multi ? 's' : ''}. Do not summarize or skip any step.`,
          },
        ],
      },
    ],
  })

  if (aiData.error) throw new Error(aiData.error.message)
  const result = parseAIResponse(aiData.choices?.[0]?.message?.content ?? '')
  return result
}

export async function estimateNutrition(name, ingredients) {
  const data = await callGroq({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.1,
    max_tokens: 200,
    messages: [
      {
        role: 'system',
        content: `You are a nutrition estimator. Given a recipe name and ingredients, return ONLY a valid JSON object with no preamble, no markdown, no backticks. Estimate realistic per-serving nutrition values for a standard home recipe serving 4. Return exactly these keys as integers:
{"calories": 450, "protein_g": 32, "carbs_g": 28, "fat_g": 18}`,
      },
      {
        role: 'user',
        content: `Recipe: "${name}"\nIngredients: ${ingredients.join(', ')}\n\nReturn JSON with estimated per-serving nutrition.`,
      },
    ],
  })
  const text = data.choices?.[0]?.message?.content ?? '{}'
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const jsonMatch = clean.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in response')
  const parsed = JSON.parse(jsonMatch[0])
  return {
    calories: parseInt(parsed.calories) || null,
    protein_g: parseInt(parsed.protein_g) || null,
    carbs_g: parseInt(parsed.carbs_g) || null,
    fat_g: parseInt(parsed.fat_g) || null,
  }
}

// Generation prompt — same output shape as RECIPE_JSON_SCHEMA, but the model
// INVENTS a full recipe for the described dish (rather than transcribing).
const GENERATE_SCHEMA = `Return ONLY a valid JSON object, raw JSON only — no preamble, no markdown, no backticks. Exactly this shape:
{
  "name": "recipe name",
  "ingredients": ["ingredient with quantity e.g. 2 cups chicken broth"],
  "notes": "2-3 sentence description or cooking tips, max 300 chars",
  "tags": [],
  "cookTime": "e.g. 30 mins",
  "servings": 4,
  "calories": 450,
  "protein_g": 32,
  "carbs_g": 28,
  "fat_g": 18,
  "instructions": "1. First step | 2. Second step | 3. Third step"
}

Ingredient rules — produce a COMPLETE ingredient list with real quantities and measurements for a home cook (e.g. "2 cups all-purpose flour", "1 lb boneless chicken thighs, cut into 1-inch cubes"). Include everything genuinely needed to cook the dish; don't leave out staples.
Servings rules: return a realistic integer (default 4).
Nutrition rules: estimate realistic per-serving values as integers (calories, protein_g, carbs_g, fat_g).
Tag rules — only use tags from this exact list that genuinely apply:
protein, chicken, beef, pork, steak, shrimp, salmon, lamb, turkey, seafood, pasta, vegetarian, vegan, healthy, gluten-free, low-carb, sides, soup, salad, easy, quick, weeknight, weekend, brunch, crowd-pleaser, meal-prep, grill, italian, japanese, greek, mexican, thai, indian, korean, mediterranean
Instructions rules:
- Write ALL steps as a single string separated by ' | ' (space pipe space) — NOT newlines
- Produce 8-20 detailed steps; never compress multiple actions into one step
- EVERY step must restate the exact quantities/measurements of the ingredients it uses (pull them straight from the ingredient list) — never write a step that just names an ingredient without its amount
- Include specific temperatures (e.g. medium-high heat, 400°F), specific times (e.g. 6-8 minutes), pan/tool, and visual doneness cues in each relevant step
- Keep prep steps separate from cook steps; end with a plating/serving step
- Aim for 20-35 words per step; be descriptive, like a cookbook author
- Bad (too vague): '3. Add chicken and cook until browned'
- Good (descriptive with measurements): '3. Add the 1 lb cubed chicken thighs in a single layer and cook over medium-high heat, undisturbed, 3-4 minutes per side until golden brown and cooked through'
- Bad: '7. Combine peanut butter, soy sauce, and coconut milk'
- Good: '7. In a bowl, whisk 1/3 cup peanut butter, 3 tbsp soy sauce, 1/2 cup coconut milk, 1 tbsp honey, and 1 tsp rice vinegar until smooth'`

// Invent a full recipe from a freeform description, e.g. "spicy Thai peanut noodles".
export async function generateRecipeFromPrompt(prompt) {
  const aiData = await callGroq({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.6,
    max_tokens: 4000,
    messages: [
      {
        role: 'system',
        content: `You are a professional recipe developer. Given a short description of a dish, invent a complete, realistic, cookable recipe for it.\n\n${GENERATE_SCHEMA}`,
      },
      {
        role: 'user',
        content: `Create a recipe for: ${prompt.trim()}`,
      },
    ],
  })
  if (aiData.error) throw new Error(aiData.error.message)
  const result = parseAIResponse(aiData.choices?.[0]?.message?.content ?? '')
  result.source = ''
  return result
}

// Apply a plain-language change to an existing recipe, e.g. "make it vegetarian"
// or "halve the servings". Returns the full updated recipe in the same shape.
export async function adjustRecipeWithAI(recipe, instruction) {
  const current = JSON.stringify({
    name: recipe.name || '',
    ingredients: recipe.ingredients || [],
    notes: recipe.notes || '',
    tags: recipe.tags || [],
    cookTime: recipe.cookTime || '',
    servings: recipe.servings || 0,
    calories: recipe.calories || 0,
    protein_g: recipe.protein_g || 0,
    carbs_g: recipe.carbs_g || 0,
    fat_g: recipe.fat_g || 0,
    // Send instructions in the ' | ' format the model expects.
    instructions: (recipe.instructions || '').split('\n').map(s => s.trim()).filter(Boolean).join(' | '),
  })

  const aiData = await callGroq({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.4,
    max_tokens: 4000,
    messages: [
      {
        role: 'system',
        content: `You are a recipe editor. You are given a recipe as JSON and a change to apply. Apply ONLY the requested change and return the FULL updated recipe in the same JSON shape. Recalculate anything the change affects — e.g. scaling servings scales ingredient quantities and per-serving nutrition; making it vegetarian/vegan swaps the proteins and adjusts the affected steps; converting units rewrites quantities. Keep unrelated fields intact.\n\n${GENERATE_SCHEMA}`,
      },
      {
        role: 'user',
        content: `Current recipe:\n${current}\n\nChange to apply: ${instruction.trim()}`,
      },
    ],
  })
  if (aiData.error) throw new Error(aiData.error.message)
  return parseAIResponse(aiData.choices?.[0]?.message?.content ?? '')
}
