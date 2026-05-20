export function weightedRandom(meals, count, cooldownDays) {
  const now = new Date();
  const eligible = meals.filter(m => {
    const days = m.last_made ? Math.floor((now - new Date(m.last_made)) / 86400000) : 999;
    return days >= cooldownDays;
  });
  const weighted = eligible.map(m => {
    const days = m.last_made ? Math.floor((now - new Date(m.last_made)) / 86400000) : 999;
    const recency = days >= 30 ? 1.0 : days >= 14 ? 0.6 : 0.3;
    // +2 instead of +1 so never-made meals (times_made=0) get log(2)≈0.69, not 0
    const weight = Math.max(0.5, Math.pow(m.rating || 3, 2) * Math.log((m.times_made || 0) + 2) * recency);
    return { ...m, weight };
  });
  const selected = [];
  const pool = [...weighted];
  for (let i = 0; i < Math.min(count, pool.length); i++) {
    const total = pool.reduce((s, m) => s + m.weight, 0);
    let rand = Math.random() * total;
    for (let j = 0; j < pool.length; j++) {
      rand -= pool[j].weight;
      if (rand <= 0) { selected.push(pool[j]); pool.splice(j, 1); break; }
    }
  }
  return selected;
}

export function plannerScore(meal, ingKeywords) {
  const matchCount = ingKeywords.filter(kw =>
    meal.ingredients.some(i => i.toLowerCase().includes(kw))
  ).length;
  return (meal.rating * 10) + (matchCount * 25) + (Math.random() * 5);
}
