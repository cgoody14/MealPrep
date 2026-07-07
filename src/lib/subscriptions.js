import { supabase } from '../supabase'

export const TIERS = { FREE: 'free', PRO: 'pro', UNLIMITED: 'unlimited' }

export const FREE_RECIPE_LIMIT = 10
export const PRO_RECIPE_LIMIT = 50

export const TIER_INFO = {
  pro: {
    name: 'Pro',
    price: '$4.99/mo',
    features: [`Up to ${PRO_RECIPE_LIMIT} recipes`, 'Household sharing', 'AI URL & photo import'],
  },
  unlimited: {
    name: 'Unlimited',
    price: '$8.99/mo',
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
  return tier === TIERS.PRO || tier === TIERS.UNLIMITED
}

export class TierGateError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
    this.name = 'TierGateError'
  }
}
