import { NavLink } from 'react-router-dom'

const NAV = [
  { path: '/', icon: '⊞', label: 'Recipes', countKey: null },
  { path: '/week', icon: '📅', label: 'This Week', countKey: 'week' },
  { path: '/randomizer', icon: '🔀', label: 'Meal Randomizer', mobileLabel: 'Randomizer', countKey: null },
  { path: '/shopping', icon: '🛒', label: 'Shopping List', countKey: null },
  { path: '/faqs', icon: '?', label: 'FAQs', countKey: null },
]

export default function Sidebar({ mealCount, weekCount, isAdmin }) {
  const counts = { meals: mealCount, week: weekCount }
  // Owner-only Dashboard link (server-side endpoint still enforces access).
  const navItems = isAdmin
    ? [...NAV, { path: '/admin', icon: '📊', label: 'Dashboard', countKey: null }]
    : NAV

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="sidebar">
        <div className="sidebar-brand">
          <img
            src="/logo.png"
            alt="Rouxlo"
            className="sidebar-brand-logo"
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
          <span className="sidebar-brand-text">Rouxlo</span>
        </div>
        <ul className="sidebar-nav">
          {navItems.map(item => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              >
                <span className="sidebar-icon">{item.icon}</span>
                <span className="sidebar-label">{item.label}</span>
                {item.countKey && counts[item.countKey] > 0 && (
                  <span className="sidebar-badge">{counts[item.countKey]}</span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Mobile bottom tab bar */}
      <nav className="bottom-tabs">
        {NAV.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}
          >
            <span className="tab-icon">{item.icon}</span>
            <span className="tab-label">{item.mobileLabel || item.label}</span>
            {item.countKey && counts[item.countKey] > 0 && (
              <span className="tab-badge">{counts[item.countKey]}</span>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
