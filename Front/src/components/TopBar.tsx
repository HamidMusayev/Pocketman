import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getThemeMode, resolveTheme, setThemeMode } from '../lib/themeMode'
import { LogoMark } from './Logo'
import './shell.css'

type IconProps = { size?: number }

function Svg({ size = 20, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const HomeIcon = () => (
  <Svg>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20h14V9.5" />
  </Svg>
)
const ChartIcon = () => (
  <Svg>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Svg>
)
const BudgetIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3v9l6.4 6.4" />
  </Svg>
)
const WalletIcon = () => (
  <Svg>
    <rect x="3" y="6" width="18" height="14" rx="2.5" />
    <path d="M3 10h18M16 15h2" />
  </Svg>
)
const SunIcon = () => (
  <Svg size={17}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Svg>
)
const MoonIcon = () => (
  <Svg size={17}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
  </Svg>
)
const GearIcon = () => (
  <Svg size={17}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.1a2 2 0 1 1-4 0V21a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4.1V4a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 16.9 5.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </Svg>
)
const LockIcon = () => (
  <Svg size={17}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Svg>
)

const TABS = [
  { to: '/overview', label: 'Overview', icon: <HomeIcon /> },
  { to: '/charts', label: 'Charts', icon: <ChartIcon /> },
  { to: '/budget', label: 'Budget', icon: <BudgetIcon /> },
  { to: '/accounts', label: 'Accounts', icon: <WalletIcon /> },
]

function ThemeToggle() {
  const [theme, setTheme] = useState(() => resolveTheme(getThemeMode()))
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      className="icon-btn"
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
      onClick={() => {
        setThemeMode(next)
        setTheme(next)
      }}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

export function TopBar() {
  const { logout } = useAuth()

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/overview" className="topbar-brand">
            <div className="topbar-brand-mark">
              <LogoMark size={20} />
            </div>
            <div className="topbar-brand-name">
              pocket<span>man</span>
            </div>
          </NavLink>

          <nav className="topbar-tabs" aria-label="Sections">
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
            <ThemeToggle />
            <NavLink to="/settings" className="icon-btn" title="Settings" aria-label="Settings">
              <GearIcon />
            </NavLink>
            <button className="icon-btn" onClick={logout} title="Lock" aria-label="Lock">
              <LockIcon />
            </button>
          </div>
        </div>
      </header>

      {/* phones: the sections live in a thumb-reachable bar at the bottom */}
      <nav className="bottom-nav" aria-label="Sections">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) => 'bottom-nav-item' + (isActive ? ' active' : '')}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  )
}
