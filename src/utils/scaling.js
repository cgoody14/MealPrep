const UNSCALABLE = /\bto taste\b|\bas needed\b|\bas desired\b|\bas required\b|\bto garnish\b|\ba pinch\b/i
const SPELLED_START = /^(a |an |one |two |three |four |five |six |seven |eight |nine |ten )/i

function formatNum(n) {
  if (n === Math.round(n)) return String(Math.round(n))
  const fracs = [[1/8,'1/8'],[1/4,'1/4'],[1/3,'1/3'],[3/8,'3/8'],[1/2,'1/2'],[2/3,'2/3'],[3/4,'3/4']]
  for (const [fval, label] of fracs) {
    if (Math.abs(n - fval) < 0.04) return label
  }
  const whole = Math.floor(n)
  const rem = n - whole
  if (whole > 0) {
    for (const [fval, label] of fracs) {
      if (Math.abs(rem - fval) < 0.04) return `${whole} ${label}`
    }
  }
  return n.toFixed(1).replace(/\.0$/, '')
}

function parseLeadingNumber(str) {
  const mixed = str.match(/^(\d+)\s+(\d+)\/(\d+)(.*)/)
  if (mixed) {
    return { value: parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3]), rest: mixed[4] }
  }
  const frac = str.match(/^(\d+)\/(\d+)(.*)/)
  if (frac) {
    return { value: parseInt(frac[1]) / parseInt(frac[2]), rest: frac[3] }
  }
  const dec = str.match(/^(\d+\.?\d*)(.*)/)
  if (dec) {
    return { value: parseFloat(dec[1]), rest: dec[2] }
  }
  return null
}

export function scaleIngredient(ingredient, factor) {
  if (!factor || factor === 1) return ingredient
  if (UNSCALABLE.test(ingredient)) return ingredient
  const trimmed = ingredient.trim()
  if (SPELLED_START.test(trimmed)) return ingredient

  const rangeMatch = trimmed.match(/^(\d+\.?\d*)[–-](\d+\.?\d*)(.*)/)
  if (rangeMatch) {
    const a = parseFloat(rangeMatch[1]) * factor
    const b = parseFloat(rangeMatch[2]) * factor
    return `${formatNum(a)}-${formatNum(b)}${rangeMatch[3]}`
  }

  const parsed = parseLeadingNumber(trimmed)
  if (!parsed) return ingredient

  return `${formatNum(parsed.value * factor)}${parsed.rest}`
}

export function scaleIngredients(ingredients, originalServings, targetServings) {
  if (!originalServings || !targetServings || originalServings === 0) return ingredients
  const factor = Math.max(0.25, targetServings / originalServings)
  return ingredients.map(ing => scaleIngredient(ing, factor))
}

export function scaleIngredientsByFactor(ingredients, factor) {
  if (!factor || factor === 1) return ingredients
  return (ingredients || []).map(ing => scaleIngredient(ing, factor))
}

export function getScaleFactor(originalServings, targetServings) {
  if (!originalServings || originalServings === 0) return null
  return Math.max(0.25, targetServings / originalServings)
}

export function formatScaleBadge(factor) {
  if (!factor || Math.abs(factor - 1) < 0.05) return null
  const BADGE_FRACS = [
    [4,'×4'],[3,'×3'],[2,'×2'],
    [0.75,'×¾'],[0.667,'×⅔'],[0.5,'×½'],[0.333,'×⅓'],[0.25,'×¼']
  ]
  for (const [val, label] of BADGE_FRACS) {
    if (Math.abs(factor - val) < 0.04) return label
  }
  return `×${Math.round(factor * 100) / 100}`
}
