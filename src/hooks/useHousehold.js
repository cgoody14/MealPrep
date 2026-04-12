import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'

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
        .select('user_id, joined_at')

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

    const { data: target, error: e1 } = await supabase
      .from('households')
      .select('id')
      .eq('invite_code', cleanCode)
      .single()

    if (e1 || !target) throw new Error('Invite code not found — check the code and try again.')

    const { error: e2 } = await supabase
      .from('user_households')
      .update({ household_id: target.id, joined_at: new Date().toISOString() })
      .eq('user_id', user.id)

    if (e2) throw e2
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

  return { household, members, currentUserId, loading, error, fetchHousehold, joinHousehold, leaveHousehold }
}
