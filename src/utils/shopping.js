import { callGroq } from './groqClient'
import { AI_TEXT_MODEL } from '../lib/aiModels'

export function buildShoppingList(meals) {
  const cats = {
    "Proteins & Meat": [],
    "Seafood": [],
    "Produce": [],
    "Dairy & Eggs": [],
    "Pantry & Dry Goods": [],
    "Herbs & Spices": [],
    "Other": []
  };
  const kw = {
    "Seafood": ["salmon","cod","tuna","shrimp","fish","seafood","halibut","tilapia","scallop"],
    "Proteins & Meat": ["chicken","steak","beef","pork","lamb","turkey","duck","ribeye","ground","veal","bacon","sausage"],
    "Dairy & Eggs": ["egg","butter","milk","cream","cheese","parmesan","feta","yogurt","mozzarella","ricotta","cheddar","brie"],
    "Produce": ["onion","garlic","tomato","lemon","lime","pepper","fennel","eggplant","cucumber","carrot","celery","potato","scallion","shallot","mushroom","spinach","zucchini","squash","broccoli","asparagus","apple","avocado"],
    "Herbs & Spices": ["rosemary","thyme","parsley","dill","oregano","basil","cumin","paprika","miso","sesame","harissa","salt","caper","chili","turmeric","coriander","bay","mint","sage","cayenne"],
    "Pantry & Dry Goods": ["orzo","pasta","rice","breadcrumb","panko","stock","broth","wine","oil","tomato paste","mustard","mayo","mirin","sake","flour","sugar","vinegar","soy sauce","honey","bean","chickpea","canned"],
  };
  const seen = new Set();
  meals.forEach(m => (m.ingredients || []).forEach(ing => {
    const key = ing.toLowerCase().trim();
    if (seen.has(key)) return;
    seen.add(key);
    let placed = false;
    for (const [cat, words] of Object.entries(kw)) {
      if (words.some(w => key.includes(w))) { cats[cat].push(ing); placed = true; break; }
    }
    if (!placed) cats["Other"].push(ing);
  }));
  return Object.fromEntries(Object.entries(cats).filter(([, v]) => v.length > 0));
}

export async function enrichIngredientsWithQuantities(mealName, ingredients) {
  try {
    // callGroq imported at top of file
    const data = await callGroq({
      model: AI_TEXT_MODEL,
      temperature: 0.1,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: `You are a recipe assistant. Given a recipe name and a list of ingredients, return ONLY a valid JSON array with no preamble, no markdown, no backticks.

Rules:
- If an ingredient already has a quantity or measurement (e.g. "4 chicken breasts", "2 cups flour", "1 lemon"), return it exactly as-is — do NOT change the unit or convert to weight
- If an ingredient has no quantity, prepend a realistic one for a standard home recipe serving 4
- NEVER convert count-based quantities to weight (e.g. keep "4 chicken breasts" as "4 chicken breasts", not "1.5 lbs chicken breast")
- Return the same number of items as the input array in the same order
- Never return null

Example: ["4 chicken breasts","butter","garlic"] → ["4 chicken breasts","3 tbsp butter","4 cloves garlic"]`,
        },
        {
          role: 'user',
          content: `Recipe: "${mealName}"\nIngredients: ${JSON.stringify(ingredients)}\n\nReturn a JSON array of the same ingredients with realistic quantities added.`,
        },
      ],
    })
    const text = data.choices?.[0]?.message?.content ?? '[]'
    const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const jsonMatch = clean.match(/\[[\s\S]*\]/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : ingredients
  } catch {
    return ingredients
  }
}

export async function consolidateQuantities(categoryItems, mealNames) {
  try {
    // callGroq imported at top of file
    const data = await callGroq({
      model: AI_TEXT_MODEL,
      temperature: 0.1,
      max_tokens: 800,
      messages: [
        {
          role: 'system',
          content: `You are a grocery list consolidator. Given a list of ingredients that may appear across multiple recipes, return ONLY a valid JSON array with no preamble, no markdown, no backticks.

Each item in the array should be a string combining the ingredient name with a realistic total quantity needed across all the recipes provided.

Rules:
- If an ingredient already has a quantity, keep the same unit type — NEVER convert counts to weight (e.g. "4 chicken breasts" stays as count, not lbs)
- If the same ingredient appears multiple times, sum the quantities using the same unit
- Only convert units when combining same-unit quantities at large amounts (e.g. 16 tbsp → 1 cup)
- Keep count-based items as counts: "4 chicken breasts", "3 eggs", "2 lemons"

Example: "butter" in 3 recipes needing 2 tbsp, 3 tbsp, 1 tbsp → "6 tbsp butter"`,
        },
        {
          role: 'user',
          content: `Recipes this week: ${mealNames.join(', ')}\n\nIngredients to consolidate: ${JSON.stringify(categoryItems)}\n\nReturn a JSON array of strings with total quantities.`,
        },
      ],
    })
    const text = data.choices?.[0]?.message?.content ?? '[]'
    const clean = text.replace(/```json|```/g, '').trim()
    const match = clean.match(/\[[\s\S]*\]/)
    return match ? JSON.parse(match[0]) : categoryItems
  } catch {
    return categoryItems
  }
}

export async function categorizeIngredient(ingredient) {
  try {
    // callGroq imported at top of file
    const data = await callGroq({
      model: AI_TEXT_MODEL,
      temperature: 0.1,
      max_tokens: 50,
      messages: [
        {
          role: 'system',
          content: `You are a grocery categorizer. Given an ingredient name return ONLY a JSON object with one key "category" whose value is exactly one of these categories:
"Proteins & Meat", "Seafood", "Produce", "Dairy & Eggs", "Pantry & Dry Goods", "Herbs & Spices", "Other"

No preamble, no markdown, no backticks. Raw JSON only.
Example: {"category": "Produce"}`,
        },
        { role: 'user', content: ingredient },
      ],
    })
    const text = data.choices?.[0]?.message?.content ?? '{}'
    const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const jsonMatch = clean.match(/\{[\s\S]*\}/)
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    return parsed.category ?? 'Other'
  } catch {
    return 'Other'
  }
}
