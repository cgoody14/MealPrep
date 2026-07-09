import { useState } from 'react'
import { supabase } from '../supabase'
import { TIER_INFO, FREE_RECIPE_LIMIT } from '../lib/subscriptions'

const REASON_HEADLINE = {
  recipe_limit: `You've reached the ${FREE_RECIPE_LIMIT}-recipe limit`,
  household_join: "That household hasn't upgraded yet",
  manual_upgrade: 'Upgrade your plan',
}

const REASON_BODY = {
  recipe_limit: 'Upgrade to keep saving new recipes.',
  household_join: 'Ask the person who shared this code to upgrade their household to Pro so you can join.',
  manual_upgrade: 'Pick a plan below to unlock more recipes and household sharing.',
}

export default function UpgradePrompt({ reason, onClose }) {
  const [pendingTier, setPendingTier] = useState(null)
  const [error, setError] = useState('')

  const handleUpgrade = async (tier) => {
    setPendingTier(tier)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tier }),
      })
      const data = await res.json()
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || 'Payment setup failed')
      }
      window.location.href = data.url
    } catch (err) {
      setError(err.message || 'Payment setup failed — try again.')
      setPendingTier(null)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-upgrade slide-up" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="upgrade-header">
          <h2 className="modal-title">{REASON_HEADLINE[reason] || 'Unlock more'}</h2>
          <p className="upgrade-sub">{REASON_BODY[reason] || 'Upgrade to unlock this feature.'}</p>
        </div>

        <div className="upgrade-tiers">
          {['pro', 'unlimited'].map(key => {
            const t = TIER_INFO[key]
            const featured = key === 'pro'
            const isPending = pendingTier === key
            return (
              <div key={key} className={`upgrade-tier${featured ? ' featured' : ''}`}>
                {featured && <span className="upgrade-tier-badge">Recommended</span>}
                <h3 className="upgrade-tier-name">{t.name}</h3>
                <div className="upgrade-tier-price">{t.price}</div>
                <ul className="upgrade-tier-features">
                  {t.features.map(f => <li key={f}>✓ {f}</li>)}
                </ul>
                <button
                  className="btn btn-primary btn-full"
                  onClick={() => handleUpgrade(key)}
                  disabled={!!pendingTier}
                >
                  {isPending ? 'Redirecting…' : 'Upgrade'}
                </button>
              </div>
            )
          })}
        </div>

        {error && <div className="form-error upgrade-error">{error}</div>}

        <button className="btn btn-ghost btn-full" onClick={onClose} disabled={!!pendingTier}>
          Not now
        </button>
      </div>
    </div>
  )
}
