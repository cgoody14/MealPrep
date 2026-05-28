import { useState } from 'react'

export default function OnboardingModal({ household, onJoin, onDone }) {
  const pendingCode = localStorage.getItem('pending_invite') || ''
  const [code, setCode] = useState(pendingCode)
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState('')

  const finish = () => {
    localStorage.removeItem('new_account')
    localStorage.removeItem('pending_invite')
    onDone()
  }

  const handleJoin = async () => {
    if (!code.trim() || code.length < 6) return
    setJoining(true)
    setError('')
    try {
      localStorage.removeItem('pending_invite')
      await onJoin(code.trim())
      setJoined(true)
      setTimeout(finish, 1400)
    } catch (err) {
      setError(err.message || 'Invalid code — check and try again.')
      setJoining(false)
    }
  }

  // Success state
  if (joined) {
    return (
      <div className="modal-overlay onboarding-overlay">
        <div className="onboarding-card slide-up">
          <div className="onboarding-joined">
            <span className="onboarding-joined-icon">✓</span>
            <p className="onboarding-joined-text">Household joined!</p>
            <p className="onboarding-joined-sub">You now share a meal library.</p>
          </div>
        </div>
      </div>
    )
  }

  const hasCode = code.length > 0

  return (
    <div className="modal-overlay onboarding-overlay">
      <div className="onboarding-card slide-up">
        <div className="onboarding-brand">🍽️</div>
        <h2 className="onboarding-title">Welcome to Rouxlo</h2>
        <p className="onboarding-desc">
          {hasCode
            ? "We found a household code from your sign-up. Tap Join to share a meal library with your household."
            : "Plan meals, build a recipe archive, and share a shopping list. Got a code from a partner? Enter it below."}
        </p>

        {household && (
          <div className="onboarding-join-section">
            {!hasCode && (
              <p className="onboarding-join-label">Household invite code <span className="auth-optional-badge">optional</span></p>
            )}
            <div className="onboarding-join-row">
              <input
                className="form-input hh-join-input"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                placeholder="ABC123"
                maxLength={6}
                spellCheck={false}
                autoFocus={!hasCode}
              />
              <button
                className="btn btn-primary"
                onClick={handleJoin}
                disabled={joining || code.length < 6}
              >
                {joining ? 'Joining…' : 'Join'}
              </button>
            </div>
            {error && <div className="form-error onboarding-error">{error}</div>}
          </div>
        )}

        <button className="btn btn-ghost onboarding-skip" onClick={finish}>
          {hasCode ? 'Skip for now' : 'Get Started →'}
        </button>
      </div>
    </div>
  )
}
