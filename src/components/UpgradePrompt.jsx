import { TIER_INFO, FREE_RECIPE_LIMIT } from '../lib/subscriptions'

const REASON_HEADLINE = {
  recipe_limit: `You've reached the ${FREE_RECIPE_LIMIT}-recipe limit`,
  household_join: 'Household sharing requires an upgrade',
  manual_upgrade: 'Upgrade your plan',
}

const REASON_BODY = {
  recipe_limit: 'Upgrade to keep saving new recipes.',
  household_join: 'Upgrade to share your recipe library with a partner or family.',
  manual_upgrade: 'Pick a plan below to unlock more recipes and household sharing.',
}

export default function UpgradePrompt({ reason, onClose }) {
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
            return (
              <div key={key} className={`upgrade-tier${featured ? ' featured' : ''}`}>
                {featured && <span className="upgrade-tier-badge">Recommended</span>}
                <h3 className="upgrade-tier-name">{t.name}</h3>
                <div className="upgrade-tier-price">{t.price}</div>
                <ul className="upgrade-tier-features">
                  {t.features.map(f => <li key={f}>✓ {f}</li>)}
                </ul>
                <button className="btn btn-primary btn-full" disabled title="Coming soon">
                  Upgrade — coming soon
                </button>
              </div>
            )
          })}
        </div>

        <button className="btn btn-ghost btn-full" onClick={onClose}>Not now</button>
      </div>
    </div>
  )
}
