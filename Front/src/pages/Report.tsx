import { Link } from 'react-router-dom'
import { CategoryIcon } from '../components/CategoryIcon'
import { usePeriod } from '../context/PeriodContext'
import { useSettings } from '../hooks/useSettings'
import { useMonthlyReport } from '../hooks/useStats'
import { formatDayShort } from '../lib/dates'
import { formatMoney, formatSignedMoney } from '../lib/money'
import '../components/charts/charts.css'
import './pages.css'

/** "+12%" / "−8%" / "new" — with whether the change is good news. */
function Change({ pct, upIsGood }: { pct: number | null; upIsGood: boolean }) {
  if (pct === null) return <span className="report-change">—</span>
  if (pct === 0) return <span className="report-change">no change</span>
  const good = pct > 0 === upIsGood
  return (
    <span className={'report-change ' + (good ? 'good' : 'bad')}>
      {pct > 0 ? '+' : '−'}
      {Math.abs(pct)}% vs last month
    </span>
  )
}

/** Prints on white paper even from dark mode: switch to the light palette for
 * the print, then put the user's theme back. */
function printReport() {
  const root = document.documentElement
  const previous = root.getAttribute('data-theme')
  root.setAttribute('data-theme', 'light')
  const restore = () => {
    if (previous === null) root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', previous)
    window.removeEventListener('afterprint', restore)
  }
  window.addEventListener('afterprint', restore)
  window.print()
}

/** One month at a glance, compared with the month before. Printable (and so
 * savable as PDF from the browser's print dialog). */
export function Report() {
  const { year, month, prevMonth, nextMonth } = usePeriod()
  const { data: settings } = useSettings()
  const { data: report, isLoading } = useMonthlyReport(year, month + 1)

  const currency = settings?.currency_symbol ?? '$'
  const showCents = settings?.show_cents ?? true
  const money = (n: number) => formatMoney(n, currency, showCents)

  const title = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const prevTitle = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long' })
  const cur = report?.current
  const maxCat = Math.max(1, ...(report?.categories ?? []).map((c) => Math.max(c.amount, c.previous)))

  return (
    <div className="report">
      <div className="page-head report-head">
        <div>
          <Link to="/charts" className="report-back no-print">
            ← Charts
          </Link>
          <h1 className="page-title">Monthly report</h1>
        </div>
        <div className="page-head-actions no-print">
          <div className="report-month-nav">
            <button className="icon-btn" onClick={prevMonth} aria-label="Previous month">
              ‹
            </button>
            <span className="report-month">{title}</span>
            <button className="icon-btn" onClick={nextMonth} aria-label="Next month">
              ›
            </button>
          </div>
          <button className="pm-btn pm-btn-ghost pm-btn-sm" onClick={printReport}>
            Print / PDF
          </button>
        </div>
      </div>
      <div className="print-only report-print-title">Pocketman · {title}</div>

      {isLoading || !report || !cur ? (
        <div className="pm-empty">Loading…</div>
      ) : (
        <>
          <section className="report-cards">
            <div className="stat-card">
              <div className="stat-label">Income</div>
              <div className="stat-value" style={{ color: 'var(--up)' }}>{money(cur.income)}</div>
              <Change pct={report.income_change_pct} upIsGood />
            </div>
            <div className="stat-card">
              <div className="stat-label">Expenses</div>
              <div className="stat-value" style={{ color: 'var(--down)' }}>{money(cur.expense)}</div>
              <Change pct={report.expense_change_pct} upIsGood={false} />
            </div>
            <div className="stat-card">
              <div className="stat-label">Balance</div>
              <div className="stat-value">{formatSignedMoney(cur.balance, currency, showCents)}</div>
              <span className="report-change">
                {prevTitle}: {formatSignedMoney(report.previous.balance, currency, showCents)}
              </span>
            </div>
            <div className="stat-card">
              <div className="stat-label">Saved</div>
              <div className="stat-value">{cur.savings_rate}%</div>
              <span className="report-change">
                {report.transaction_count} transactions · {money(report.avg_daily_expense)}/day
              </span>
            </div>
          </section>

          <section className="report-section">
            <h2 className="pm-section-title">Spending by category</h2>
            <div className="report-legend">
              <span><i className="swatch swatch-cur" /> {title.split(' ')[0]}</span>
              <span><i className="swatch swatch-prev" /> {prevTitle}</span>
            </div>
            <div className="list-card">
              {report.categories.map((c) => (
                <div className="list-row report-cat" key={c.category_id}>
                  <span className="icon-badge">
                    <CategoryIcon iconKey={c.icon} size={17} />
                  </span>
                  <span className="list-main">
                    <span className="list-title">
                      {c.name}
                      {c.over_budget && c.budget != null && (
                        <span className="report-over"> · over budget by {money(c.amount - c.budget)}</span>
                      )}
                    </span>
                    <span className="report-bars">
                      <span className="report-bar cur" style={{ width: (c.amount / maxCat) * 100 + '%' }} />
                      <span className="report-bar prev" style={{ width: (c.previous / maxCat) * 100 + '%' }} />
                    </span>
                  </span>
                  <span className="list-value">
                    {money(c.amount)}
                    <span className="list-value-sub">
                      {' '}
                      {c.change_pct === null ? 'new' : `${c.change_pct > 0 ? '+' : c.change_pct < 0 ? '−' : ''}${Math.abs(c.change_pct)}%`}
                    </span>
                  </span>
                </div>
              ))}
              {report.categories.length === 0 && <div className="pm-empty">No spending this month or last.</div>}
            </div>
          </section>

          <div className="report-columns">
            <section className="report-section">
              <h2 className="pm-section-title">Largest expenses</h2>
              <div className="list-card">
                {report.top_expenses.map((e) => (
                  <div className="list-row" key={e.id}>
                    <span className="list-main">
                      <span className="list-title">{e.description}</span>
                      <span className="list-sub">
                        {e.category_name} · {formatDayShort(e.date)}
                      </span>
                    </span>
                    <span className="list-value" style={{ color: 'var(--down)' }}>{money(e.amount)}</span>
                  </div>
                ))}
                {report.top_expenses.length === 0 && <div className="pm-empty">No expenses.</div>}
              </div>
            </section>

            {report.tags.length > 0 && (
              <section className="report-section">
                <h2 className="pm-section-title">Spending by tag</h2>
                <div className="list-card">
                  {report.tags.map((t) => (
                    <div className="list-row" key={t.name}>
                      <span className="list-main">
                        <span className="list-title">#{t.name}</span>
                      </span>
                      <span className="list-value">{money(t.amount)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  )
}
