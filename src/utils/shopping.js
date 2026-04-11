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
    const apiKey = import.meta.env.VITE_GROQ_API_KEY
    const endpoint = 'https://api.groq.com/openai/v1/chat/completions'

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        max_tokens: 500,
        messages: [
          {
            role: 'system',
            content: `You are a recipe assistant. Given a recipe name and a list of ingredients without quantities, return ONLY a valid JSON array with no preamble, no markdown, no backticks. Each item in the array should be a string with a realistic quantity prepended.

Example input: recipe "Garlic Shrimp Scampi", ingredients ["shrimp","butter","garlic","lemon"]
Example output: ["1 lb shrimp","3 tbsp butter","4 cloves garlic","1 lemon"]

Keep quantities realistic for a standard home recipe serving 4.
Return the same number of items as the input array in the same order.
Never return null.`
          },
          {
            role: 'user',
            content: `Recipe: "${mealName}"
Ingredients: ${JSON.stringify(ingredients)}

Return a JSON array of the same ingredients with realistic quantities added.`
          }
        ]
      })
    })

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content ?? '[]'
    const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const jsonMatch = clean.match(/\[[\s\S]*\]/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : ingredients
  } catch {
    return ingredients
  }
}
