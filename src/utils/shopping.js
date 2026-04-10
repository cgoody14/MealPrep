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
