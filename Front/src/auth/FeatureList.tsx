import { useEffect, useRef, useState } from 'react'

const ListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2" />
  </svg>
)

/** Everything Pocketman does, in the order a new user meets it. */
const FEATURES: { title: string; text: string }[] = [
  { title: 'Your own private account', text: 'Sign up with a username and password; each user sees only their own data.' },
  { title: 'Overview', text: 'Current balance, this period’s income and expenses, and the latest transactions at a glance.' },
  { title: 'Transactions', text: 'Log income, expenses and transfers between accounts, with notes and tags. Search and filter any time.' },
  { title: 'Accounts', text: 'Cash, cards, savings: add, edit or delete them, set a starting balance and see your net worth.' },
  { title: 'Categories', text: 'Group spending and income into your own categories, each with its own icon.' },
  { title: 'Budgets', text: 'Set a monthly limit per category and get a warning at 80% and when you go over 100%.' },
  { title: 'Recurring transactions', text: 'Rent, salary, subscriptions: repeat them on a schedule and let them add themselves.' },
  { title: 'Planned income & expenses', text: 'Plan a future payment; on the day, answer “Did it happen?” to confirm, postpone or delete it, and see the balance expected at month end.' },
  { title: 'Savings goals', text: 'Set a target amount (and a date if you like) and track how close you are.' },
  { title: 'Charts & spending calendar', text: 'Category breakdowns, trends over time and a day-by-day calendar of spending.' },
  { title: 'Monthly report', text: 'A clean summary of the month that you can print or save as PDF.' },
  { title: 'Import & export', text: 'Bring in a Money Manager (.mmbak) backup or a CSV file, and export your transactions to CSV.' },
  { title: 'Install as an app', text: 'Add Pocketman to your home screen or desktop and open it like a native app.' },
  { title: 'Light & dark theme', text: 'Pick the look you like, or follow your device.' },
]

/** "All features" button for the login/register screen: opens a short,
 * numbered list of what the app can do. */
export function FeatureList() {
  const [open, setOpen] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button type="button" className="auth-features-btn" onClick={() => setOpen(true)}>
        <ListIcon /> All features
      </button>

      {open && (
        <div className="auth-video-overlay" onClick={() => setOpen(false)}>
          <div
            className="auth-features-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-features-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="auth-features-head">
              <h3 id="auth-features-title">What Pocketman can do</h3>
              <button
                ref={closeRef}
                type="button"
                className="auth-features-close"
                onClick={() => setOpen(false)}
                aria-label="Close features"
              >
                ×
              </button>
            </div>
            <ol className="auth-features-list">
              {FEATURES.map((f) => (
                <li key={f.title}>
                  <strong>{f.title}</strong>
                  <span>{f.text}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </>
  )
}
