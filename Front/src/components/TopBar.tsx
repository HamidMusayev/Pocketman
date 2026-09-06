import { useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
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
  const tabsRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()

  // On narrow screens the tabs are a horizontally scrolling strip, so the
  // current one can sit off-screen after a route change (or a reload deep in
  // the app). Pull it back into view.
  useEffect(() => {
    const active = tabsRef.current?.querySelector('.topbar-tab.active')
    active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [pathname])

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-brand">
          <div className="topbar-brand-mark">
            <LogoMark size={23} />
          </div>
          <div className="topbar-brand-name">
            pocket<span>man</span>
          </div>
        </div>

        <nav className="topbar-tabs" ref={tabsRef} aria-label="Sections">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) => 'topbar-tab' + (isActive ? ' active' : '')}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>

        <div className="topbar-right">
          <NavLink to="/settings" className="settings-link" title="Settings" aria-label="Settings">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.1a2 2 0 1 1-4 0V21a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4.1V4a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 16.9 5.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
            </svg>
          </NavLink>
          <button className="logout-link" onClick={logout}>
            Lock
          </button>
        </div>
      </div>
    </header>
  )
}
