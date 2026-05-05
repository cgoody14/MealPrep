// Parses a leading numeric value from an ingredient string.
// Handles: integers (2), decimals (0.5), fractions (1/2), mixed numbers (1 1/2).
// Returns { value: number, rest: string } or null if no number found.
function parseLeadingNumber(str) {
  // Mixed number: "1 1/2"
  const mixed = str.match(/^(\d+)\s+(\d+)\/(\d+)(.*)/)
  if (mixed) {
    const whole = parseInt(mixed[1])
    const num = parseInt(mixed[2])
    const den = parseInt(mixed[3])
    return { value: whole + num / den, rest: mixed[4] }
  }
  // Fraction: "1/2"
  const frac = str.match(/^(\d+)\/(\d+)(.*)/)
  if (frac) {
    return { value: parseInt(frac[1]) / parseInt(frac[2]), rest: frac[3] }
  }
  // Decimal or integer: "2" or "0.5"
  const dec = str.match(/^(\d+\.?\d*)(.*)/)
  if (dec) {
    return { value: parseFloat(dec[1]), rest: dec[2] }
  }
  return null
}

// Range: "1-2 cloves" — scale both numbers
function scaleRange(str, factor) {
  return str.replace(/(\d+\.?\d*)–(\d+\.?\d*)|(\d+\.?\d*)-(\d+\.?\d*)/, (_, a1, b1, a2, b2) => {
    const a = parseFloat(a1 ?? a2)
    const b = parseFloat(b1 ?? b2)
    return `${formatNum(a * factor)}-${formatNum(b * factor)}`
  })
}

// Format a scaled number cleanly: prefer fractions for common values, integers when whole.
function formatNum(n) {
  if (n === Math.round(n)) return String(Math.round(n))
  // Common fractions
  const fracs = [[1/8,'1/8'],[1/4,'1/4'],[1/3,'1/3'],[3/8,'3/8'],[1/2,'1/2'],[2/3,'2/3'],[3/4,'3/4']]
  for (const [fval, label] of fracs) {
    if (Math.abs(n - fval) < 0.04) return label
  }
  // Mixed numbers
  const whole = Math.floor(n)
  const rem = n - whole
  if (whole > 0) {
    for (const [fval, label] of fracs) {
      if (Math.abs(rem - fval) < 0.04) return `${whole} ${label}`
    }
  }
  // Fallback to 1 decimal
  return n.toFixed(1).replace(/\.0$/, '')
}

// Scale a single ingredient string by (newServings / originalServings).
// Returns the scaled string, or the original if no number is found.
export function scaleIngredient(ingredient, factor) {
  if (!factor || factor === 1) return ingredient
  const trimmed = ingredient.trim()

  // Handle range at the start: "1-2 cloves garlic"
  const rangeMatch = trimmed.match(/^(\d+\.?\d*)[–-](\d+\.?\d*)(.*)/)
  if (rangeMatch) {
    const a = parseFloat(rangeMatch[1]) * factor
    const b = parseFloat(rangeMatch[2]) * factor
    return `${formatNum(a)}-${formatNum(b)}${rangeMatch[3]}`
  }

  const parsed = parseLeadingNumber(trimmed)
  if (!parsed) return ingredient // no number — "salt to taste", "fresh herbs"

  const scaled = parsed.value * factor
  return `${formatNum(scaled)}${parsed.rest}`
}

// Scale an array of ingredient strings.
export function scaleIngredients(ingredients, originalServings, newServings) {
  if (!originalServings || originalServings === newServings) return ingredients
  const factor = newServings / originalServings
  return ingredients.map(ing => scaleIngredient(ing, factor))
}
