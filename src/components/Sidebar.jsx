import { NavLink } from 'react-router-dom'

const NAV = [
  { path: '/', icon: '⊞', label: 'Rolodex', countKey: 'meals' },
  { path: '/week', icon: '📅', label: 'This Week', countKey: 'week' },
  { path: '/randomizer', icon: '◈', label: 'Meal Randomizer', countKey: null },
  { path: '/shopping', icon: '🛒', label: 'Shopping List', countKey: null },
]

export default function Sidebar({ mealCount, weekCount }) {
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
      </nav>
    </>
  )
}
