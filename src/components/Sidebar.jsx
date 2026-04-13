import { NavLink } from 'react-router-dom'

const ShuffleIcon = () => (
  <svg
    width="22" height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'block' }}
  >
    <polyline points="16 3 21 3 21 8"/>
    <line x1="4" y1="20" x2="21" y2="3"/>
    <polyline points="21 16 21 21 16 21"/>
    <line x1="15" y1="15" x2="21" y2="21"/>
    <line x1="4" y1="4" x2="9" y2="9"/>
  </svg>
)

const NAV = [
  { path: '/', icon: '⊞', label: 'Rolodex', countKey: null },
  { path: '/week', icon: '📅', label: 'This Week', countKey: 'week' },
  { path: '/randomizer', icon: <ShuffleIcon />, label: 'Meal Randomizer', countKey: null },
  { path: '/shopping', icon: '🛒', label: 'Shopping List', countKey: null },
]

export default function Sidebar({ mealCount, weekCount, onOpenSettings }) {
  const counts = { meals: mealCount, week: weekCount }

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-brand-icon">🍽️</span>
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
            <span className="tab-label">{item.label}</span>
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
