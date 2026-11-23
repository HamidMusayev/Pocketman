import { useMemo, useState } from 'react'
import { usePeriod } from '../../context/PeriodContext'
import { useTransactions } from '../../hooks/useTransactions'
import { buildMonthGrid, groupByDay } from '../../lib/calendar'
import { formatDateLabel, todayIso } from '../../lib/dates'
import { formatMoney, formatTransactionAmount } from '../../lib/money'
import './charts.css'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

interface Props {
  currency: string
  showCents: boolean
}

/** A compact spending calendar: each day is a small square tinted by how much
 * was spent (darker = more), with a green dot on days money came in. Tap a
 * day to see its totals and transactions underneath. Follows the shared
 * period month (set by the page's period picker). */
export function MonthCalendar({ currency, showCents }: Props) {
  const { year, month, monthLabel } = usePeriod()

  // Always this specific month's transactions, independent of the page period.
  const { data: txns } = useTransactions({ period: 'monthly', year, month: month + 1 })

  const weeks = useMemo(() => buildMonthGrid(year, month, groupByDay(txns ?? [])), [year, month, txns])

  const maxExpense = useMemo(() => {
    let m = 0
    for (const week of weeks) for (const cell of week) if (cell) m = Math.max(m, cell.expense)
    return m || 1
  }, [weeks])

  const today = todayIso()
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}-`

  // Picked day; falls back to today (in this month) or the last day with activity.
  const [picked, setPicked] = useState<string | null>(null)
  const selected = useMemo(() => {
    if (picked?.startsWith(monthPrefix)) return picked
    if (today.startsWith(monthPrefix)) return today
    const active = weeks.flat().filter((c) => c && (c.income > 0 || c.expense > 0))
    return active.length ? active[active.length - 1]!.dateIso : null
  }, [picked, monthPrefix, today, weeks])

  const selectedCell = weeks.flat().find((c) => c?.dateIso === selected) ?? null
  const dayTxns = (txns ?? []).filter((t) => t.date === selected)

  function heat(expense: number): string | undefined {
    if (expense <= 0) return undefined
    const level = Math.min(1, expense / maxExpense)
    return `rgba(246,70,93,${(0.12 + level * 0.5).toFixed(2)})`
  }

  return (
    <div className="chart-card cal-card">
      <div className="chart-head cal-head">
        <div className="chart-title">
          Spending calendar <span>· {monthLabel}</span>
        </div>
        <div className="cal-legend" aria-hidden="true">
          <span>Less</span>
          <i style={{ background: 'rgba(246,70,93,0.12)' }} />
          <i style={{ background: 'rgba(246,70,93,0.37)' }} />
          <i style={{ background: 'rgba(246,70,93,0.62)' }} />
          <span>More</span>
        </div>
      </div>

      <div className="cal-grid">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="cal-weekday">
            {d}
          </div>
        ))}
        {weeks.map((week, wi) =>
          week.map((cell, ci) => {
            if (!cell) return <div key={`${wi}-${ci}`} />
            const cls =
              'cal-cell' +
              (cell.dateIso === today ? ' cal-today' : '') +
              (cell.dateIso === selected ? ' cal-selected' : '') +
              (cell.expense > 0 || cell.income > 0 ? ' cal-active' : '')
            return (
              <button
                type="button"
                key={cell.dateIso}
                className={cls}
                style={{ background: heat(cell.expense) }}
                onClick={() => setPicked(cell.dateIso)}
                aria-pressed={cell.dateIso === selected}
                aria-label={`${formatDateLabel(cell.dateIso)}: spent ${formatMoney(cell.expense, currency, showCents)}${
                  cell.income > 0 ? `, received ${formatMoney(cell.income, currency, showCents)}` : ''
                }`}
              >
                <span className="cal-day">{cell.day}</span>
                {cell.income > 0 && <span className="cal-inc-dot" />}
              </button>
            )
          }),
        )}
      </div>

      {selectedCell && (
        <div className="cal-detail">
          <div className="cal-detail-head">
            <span className="cal-detail-date">{formatDateLabel(selectedCell.dateIso)}</span>
            <span className="cal-detail-totals">
              {selectedCell.income > 0 && (
                <span style={{ color: 'var(--up)' }}>+{formatMoney(selectedCell.income, currency, showCents)}</span>
              )}
              {selectedCell.expense > 0 && (
                <span style={{ color: 'var(--down)' }}>−{formatMoney(selectedCell.expense, currency, showCents)}</span>
              )}
            </span>
          </div>
          {dayTxns.length === 0 ? (
            <div className="cal-detail-empty">Nothing on this day.</div>
          ) : (
            <ul className="cal-detail-list">
              {dayTxns.slice(0, 5).map((t) => (
                <li key={t.id}>
                  <span className="cal-detail-desc">{t.description}</span>
                  <span
                    className="cal-detail-amt"
                    style={{ color: t.type === 'income' ? 'var(--up)' : t.type === 'expense' ? 'var(--down)' : 'var(--muted2)' }}
                  >
                    {t.type === 'transfer'
                      ? `⇄ ${formatMoney(t.amount, currency, showCents)}`
                      : formatTransactionAmount(t.type, t.amount, currency, showCents)}
                  </span>
                </li>
              ))}
              {dayTxns.length > 5 && <li className="cal-detail-more">+{dayTxns.length - 5} more</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
