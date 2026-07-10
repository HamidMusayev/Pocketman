import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { LogoMark } from './Logo'
import './shell.css'

const TABS: { to: string; label: string }[] = [
  { to: '/overview', label: 'Overview' },
  { to: '/recurring', label: 'Recurring' },
  { to: '/charts', label: 'Charts' },
  { to: '/categories', label: 'Categories' },
  { to: '/accounts', label: 'Accounts' },
]

export function TopBar() {
  const { logout } = useAuth()

  return (
    <div className="topbar">
      <div className="topbar-inner">
        <div className="topbar-brand">
          <div className="topbar-brand-mark">
            <LogoMark />
          </div>
          <div>
            <div className="topbar-brand-name">
              pocket<span>man</span>
            </div>
            <div className="topbar-status">
              <span className="topbar-status-dot" />
              <span className="topbar-status-text">Connected · pocketman.db</span>
            </div>
          </div>
        </div>

        <div className="topbar-tabs">
          <div className="topbar-tabs-inner">
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) => 'topbar-tab' + (isActive ? ' active' : '')}
              >
                {tab.label}
              </NavLink>
            ))}
          </div>
        </div>

        <div className="topbar-right">
          <NavLink to="/settings" className="settings-link" title="Settings">
            ⚙
          </NavLink>
          <button className="logout-link" onClick={logout}>
            Lock
          </button>
        </div>
      </div>
    </div>
  )
}
