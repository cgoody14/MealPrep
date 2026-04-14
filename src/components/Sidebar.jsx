import { NavLink } from 'react-router-dom'

const NAV = [
  { path: '/', icon: '⊞', label: 'Rolodex', countKey: null },
  { path: '/week', icon: '📅', label: 'This Week', countKey: 'week' },
  { path: '/randomizer', icon: '🔀', label: 'Meal Randomizer', mobileLabel: 'Randomizer', countKey: null },
  { path: '/shopping', icon: '🛒', label: 'Shopping List', countKey: null },
]

export default function Sidebar({ mealCount, weekCount, onOpenSettings }) {
  const counts = { meals: mealCount, week: weekCount }

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="sidebar">
        <div className="sidebar-brand">
          <img
            src="/logo.png"
            alt="Mise en Place"
            className="sidebar-brand-logo"
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
          <span className="sidebar-brand-text">Mise en Place</span>
        </div>
        <ul className="sidebar-nav">
          {NAV.map(item => (
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
        <div className="sidebar-spacer" />
        <div className="sidebar-bottom">
          <button className="sidebar-settings-btn" onClick={onOpenSettings}>
            <span className="sidebar-icon">⚙</span>
            <span className="sidebar-label">Settings</span>
          </button>
        </div>
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
        <button className="tab-item tab-btn" onClick={onOpenSettings}>
          <span className="tab-icon">⚙</span>
          <span className="tab-label">Settings</span>
        </button>
      </nav>
    </>
  )
}
