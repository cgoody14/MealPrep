import { useState } from 'react'

export default function HouseholdModal({
  household, members, currentUserId,
  onJoin, onLeave, onUpdateDisplayName, onRemoveMember, onClose, onSignOut
}) {
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [removingId, setRemovingId] = useState(null)

  // Display name editing
  const myMember = members.find(m => m.user_id === currentUserId)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(myMember?.display_name || '')
  const [savingName, setSavingName] = useState(false)

  const isSolo = members.length <= 1

  const handleCopyCode = async () => {
    if (!household?.invite_code) return
    try {
      await navigator.clipboard.writeText(household.invite_code)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    } catch { /* ignore */ }
  }

  const handleShare = async () => {
    if (!household?.invite_code) return
    const text = `Join me on Mise en Place — our shared meal planner!\n\nhttps://meal-prep-lac.vercel.app/\n\nCreate an account, then go to Settings → Join a Household and enter code: ${household.invite_code}`
    if (navigator.share) {
      try { await navigator.share({ title: 'Mise en Place Invite', text }) }
      catch { /* user cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(text)
        setCodeCopied(true)
        setTimeout(() => setCodeCopied(false), 2000)
      } catch { /* ignore */ }
    }
  }

  const handleJoin = async () => {
    if (!joinCode.trim()) return
    setJoining(true)
    setJoinError('')
    try {
      await onJoin(joinCode)
      setJoinCode('')
    } catch (err) {
      setJoinError(err.message)
    } finally {
      setJoining(false)
    }
  }

  const handleLeave = async () => {
    setLeaving(true)
    try {
      await onLeave()
      setShowLeaveConfirm(false)
    } catch {
      /* ignore */
    } finally {
      setLeaving(false)
    }
  }

  const handleSaveName = async () => {
    setSavingName(true)
    try {
      await onUpdateDisplayName(nameValue)
      setEditingName(false)
    } catch { /* ignore */ } finally {
      setSavingName(false)
    }
  }

  const handleRemove = async (memberId) => {
    setRemovingId(memberId)
    try {
      await onRemoveMember(memberId)
    } catch { /* ignore */ } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-settings slide-up" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title">Settings</h2>

        {/* ── Display name ── */}
        {household && (
          <div className="settings-section">
            <h3 className="settings-section-title">Your Name</h3>
            {editingName ? (
              <div className="hh-name-edit-row">
                <input
                  className="form-input"
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false) }}
                  placeholder="Enter your name"
                  maxLength={40}
                  autoFocus
                />
                <button className="btn btn-primary btn-sm" onClick={handleSaveName} disabled={savingName}>
                  {savingName ? 'Saving…' : 'Save'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditingName(false); setNameValue(myMember?.display_name || '') }}>
                  Cancel
                </button>
              </div>
            ) : (
              <div className="hh-name-row">
                <span className="hh-name-display">{myMember?.display_name || <em className="hh-name-empty">Not set</em>}</span>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditingName(true)}>
                  Edit
                </button>
              </div>
            )}
            <span className="hh-code-hint">This name is visible to other members of your household.</span>
          </div>
        )}

        {/* ── Household section ── */}
        {household ? (
          <>
            <div className="settings-section">
              <h3 className="settings-section-title">Household</h3>
              <p className="settings-desc">
                {isSolo
                  ? 'Share your invite code with a partner or family member so you can plan meals together.'
                  : `You're sharing this account with ${members.length - 1} other ${members.length - 1 === 1 ? 'person' : 'people'}.`}
              </p>

              <div className="hh-code-block">
                <span className="hh-code-label">Your invite code</span>
                <div className="hh-code-row">
                  <span className="hh-code">{household.invite_code}</span>
                  <button className="btn btn-secondary btn-sm" onClick={handleCopyCode}>
                    {codeCopied ? '✓ Copied' : 'Copy'}
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={handleShare}>
                    Share
                  </button>
                </div>
                <span className="hh-code-hint">Share this 6-character code with anyone you want to share your meal library with.</span>
              </div>
            </div>

            {/* ── Members list ── */}
            {!isSolo && (
              <div className="settings-section">
                <h3 className="settings-section-title">Members</h3>
                <ul className="hh-members">
                  {members.map(m => (
                    <li key={m.user_id} className="hh-member">
                      <span className="hh-member-avatar">👤</span>
                      <span className="hh-member-info">
                        <span className="hh-member-name">
                          {m.display_name || (m.user_id === currentUserId ? 'You' : 'Member')}
                          {m.user_id === currentUserId && ' (you)'}
                        </span>
                        <span className="hh-member-since">
                          Joined {new Date(m.joined_at).toLocaleDateString()}
                        </span>
                      </span>
                      {m.user_id === currentUserId ? (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setShowLeaveConfirm(true)}
                        >
                          Leave
                        </button>
                      ) : (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleRemove(m.user_id)}
                          disabled={removingId === m.user_id}
                        >
                          {removingId === m.user_id ? 'Removing…' : 'Remove'}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>

                {showLeaveConfirm && (
                  <div className="hh-leave-confirm">
                    <p>Leave this household? Your meals will stay, but you'll no longer share with other members.</p>
                    <div className="hh-leave-btns">
                      <button className="btn btn-primary btn-sm" onClick={handleLeave} disabled={leaving}>
                        {leaving ? 'Leaving…' : 'Yes, Leave'}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowLeaveConfirm(false)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Join a household ── */}
            <div className="settings-section">
              <h3 className="settings-section-title">Join a Household</h3>
              <p className="settings-desc">
                Enter someone else's invite code to merge your accounts and share their meal library.
              </p>
              <div className="hh-join-row">
                <input
                  className="form-input hh-join-input"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  placeholder="ABC123"
                  maxLength={6}
                  spellCheck={false}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleJoin}
                  disabled={joining || joinCode.length < 6}
                >
                  {joining ? 'Joining…' : 'Join'}
                </button>
              </div>
              {joinError && <div className="form-error" style={{ marginTop: 8 }}>{joinError}</div>}
            </div>
          </>
        ) : (
          <div className="settings-section">
            <p className="settings-desc">
              Household sharing requires a one-time database migration. Run the SQL in
              <code> supabase/migrations/20260412_household_sharing.sql</code> in your Supabase SQL Editor to enable this feature.
            </p>
          </div>
        )}

        {/* ── Sign out ── */}
        <div className="settings-section settings-signout">
          <button className="btn btn-ghost" onClick={onSignOut}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
