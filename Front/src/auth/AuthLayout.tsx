import type { ReactNode } from 'react'
import { AuthCardHeader } from './AuthCardHeader'
import { IntroVideo } from './IntroVideo'
import './auth.css'

const ShieldIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)
const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
)
const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 3l18 18" />
    <path d="M10.6 5.1A9.7 9.7 0 0 1 12 5c5 0 8.5 4.5 9.5 7a12 12 0 0 1-2.6 3.7M6.4 6.4A12.4 12.4 0 0 0 2.5 12c1 2.5 4.5 7 9.5 7 1.6 0 3-.4 4.3-1.1" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
)

const POINTS = [
  {
    icon: <LockIcon />,
    title: 'Passwords never stored in plain text',
    text: 'Each password is hashed with bcrypt. Not even the server can read it.',
  },
  {
    icon: <ShieldIcon />,
    title: 'Guarded sign-in',
    text: 'Repeated wrong passwords are throttled, and you can sign out every other device at any time.',
  },
  {
    icon: <EyeOffIcon />,
    title: 'Private by design',
    text: 'No email, no phone number, no bank connection, no ads. Your numbers stay in your account.',
  },
]

/** Login / register shell: a security-first welcome panel next to the form on
 * wide screens; on phones the panel shrinks to a headline above the form. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-screen">
      <div className="auth-bg" aria-hidden="true">
        <span className="auth-glow auth-glow-1" />
        <span className="auth-glow auth-glow-2" />
        <span className="auth-grid" />
      </div>

      <div className="auth-wrap">
        <section className="auth-hero">
          <AuthCardHeader />
          <div className="auth-badge">
            <ShieldIcon /> Private &amp; secure
          </div>
          <h2 className="auth-hero-title">
            Your money, <span>under lock.</span>
          </h2>
          <p className="auth-hero-sub">
            Pocketman is a personal finance tracker: log income and expenses, set budgets, keep
            recurring bills and savings goals on track, and see it all in charts, in a space that
            only you can open.
          </p>
          <IntroVideo />
          <ul className="auth-points">
            {POINTS.map((p) => (
              <li key={p.title}>
                <span className="auth-point-icon">{p.icon}</span>
                <span>
                  <strong>{p.title}</strong>
                  <span>{p.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="auth-card">{children}</div>
      </div>
    </div>
  )
}
