import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { getTier, canJoinHousehold, TierGateError } from '../lib/subscriptions'

export function useHousehold() {
  const [household, setHousehold] = useState(null)   // households row
  const [members, setMembers] = useState([])          // user_households rows
  const [currentUserId, setCurrentUserId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchHousehold = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setCurrentUserId(user.id)

      // Get this user's household membership
      const { data: membership, error: e1 } = await supabase
        .from('user_households')
        .select('household_id')
        .eq('user_id', user.id)
        .single()

      if (e1 || !membership) {
        // Migration not yet run — household feature not available
        setLoading(false)
        return
      }

      // Get household details (invite_code lives here)
      const { data: hh } = await supabase
        .from('households')
        .select('*')
        .eq('id', membership.household_id)
        .single()

      setHousehold(hh || null)

      // Get all members in the household (RLS filters to same household)
      const { data: memberRows } = await supabase
        .from('user_households')
        .select('user_id, joined_at, display_name')

      setMembers(memberRows || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchHousehold() }, [fetchHousehold])

  // Join an existing household via its 6-character invite code
  const joinHousehold = async (code) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const cleanCode = code.trim().toUpperCase()

    // Use RPC so SECURITY DEFINER bypasses the household RLS policy —
    // without it, the SELECT is blocked because the user isn't a member yet.
    const { data: householdId, error: e1 } = await supabase
      .rpc('find_household_by_invite', { code: cleanCode })

    if (e1 || !householdId) throw new Error('Invite code not found — check the code and try again.')

    // Tier gate — the TARGET household must be on Pro/Unlimited for
    // new members to join. (Household-based billing: the inviter pays.)
    const targetTier = await getTier(householdId)
    if (!canJoinHousehold(targetTier)) {
      throw new TierGateError('HOUSEHOLD_JOIN_BLOCKED', 'This household is on the Free plan')
    }

    // Use RPC so SECURITY DEFINER bypasses the SELECT policy which PostgreSQL
    // applies as an implicit WITH CHECK on UPDATE — it would block setting
    // household_id to a value the user can't yet "see" via the SELECT policy.
    // Also deduplicates meals by name to avoid showing the same meal twice.
    const { error: e2 } = await supabase
      .rpc('join_household_and_deduplicate', { target_household_id: householdId })

    if (e2) throw e2
    await fetchHousehold()
  }

  // Update the current user's display name via direct update (uh_update policy allows own-row changes)
  const updateDisplayName = async (name) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const { error } = await supabase
      .from('user_households')
      .update({ display_name: name.trim() || null })
      .eq('user_id', user.id)
    if (error) throw error
    await fetchHousehold()
  }

  // Remove another member from the household.
  // A DB trigger automatically creates a new solo household for them.
  const removeMember = async (memberUserId) => {
    const { error } = await supabase
      .from('user_households')
      .delete()
      .eq('user_id', memberUserId)
    if (error) throw error
    await fetchHousehold()
  }

  // Leave current household and create a new solo household
  const leaveHousehold = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: newHH, error: e1 } = await supabase
      .from('households')
      .insert({ created_by: user.id })
      .select()
      .single()

    if (e1 || !newHH) throw new Error('Failed to create new household')

    const { error: e2 } = await supabase
      .from('user_households')
      .update({ household_id: newHH.id, joined_at: new Date().toISOString() })
      .eq('user_id', user.id)

    if (e2) throw e2
    await fetchHousehold()
  }

  return { household, members, currentUserId, loading, error, fetchHousehold, joinHousehold, leaveHousehold, updateDisplayName, removeMember }
}
