import { supabase } from '../supabase'

export const TIERS = { FREE: 'free', PRO: 'pro', UNLIMITED: 'unlimited' }

export const FREE_RECIPE_LIMIT = 10
export const PRO_RECIPE_LIMIT = 20

export const TIER_INFO = {
  pro: {
    name: 'Pro',
    price: '$2.99/mo',
    stripePriceId: import.meta.env.VITE_STRIPE_PRICE_PRO,
    features: [`Up to ${PRO_RECIPE_LIMIT} recipes`, 'AI URL & photo import'],
  },
  unlimited: {
    name: 'Unlimited',
    price: '$5.99/mo',
    stripePriceId: import.meta.env.VITE_STRIPE_PRICE_UNLIMITED,
    features: ['Unlimited recipes', 'Household sharing', 'AI URL & photo import', 'Priority support'],
  },
}

export async function getTier(householdId) {
  if (!householdId) return TIERS.FREE
  const { data, error } = await supabase
    .from('households')
    .select('tier')
    .eq('id', householdId)
    .single()
  if (error) return TIERS.FREE
  return data?.tier || TIERS.FREE
}

export function canAddRecipe(currentCount, tier) {
  if (tier === TIERS.UNLIMITED) return true
  if (tier === TIERS.PRO)       return currentCount < PRO_RECIPE_LIMIT
  return currentCount < FREE_RECIPE_LIMIT
}

export function canJoinHousehold(tier) {
  // Household sharing is an Unlimited-only feature.
  return tier === TIERS.UNLIMITED
}

export class TierGateError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
    this.name = 'TierGateError'
  }
}
