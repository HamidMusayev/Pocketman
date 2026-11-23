import { useMemo } from 'react'
import { usePeriod } from '../../context/PeriodContext'
import { useTransactions } from '../../hooks/useTransactions'
import { buildMonthGrid, groupByDay } from '../../lib/calendar'
import { todayIso } from '../../lib/dates'
import { formatCompactMoney, formatMoney } from '../../lib/money'
import './charts.css'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Props {
  currency: string
  showCents: boolean
}

/** A month calendar heat-grid: each day shows its income (green) and expense
 * (red), with a faint net tint so the month reads at a glance. Follows the
 * shared period month (set by the page's period picker). */
export function MonthCalendar({ currency, showCents }: Props) {
  const { year, month, monthLabel } = usePeriod()

  // Always this specific month's transactions, independent of the page period.
  const { data: txns } = useTransactions({ period: 'monthly', year, month: month + 1 })

  const weeks = useMemo(() => buildMonthGrid(year, month, groupByDay(txns ?? [])), [year, month, txns])

  const maxNet = useMemo(() => {
    let m = 0
    for (const week of weeks) {
      for (const cell of week) {
        if (cell) m = Math.max(m, Math.abs(cell.income - cell.expense))
      }
    }
    return m || 1
  }, [weeks])

  const today = todayIso()

  function tint(income: number, expense: number): string | undefined {
    if (income === 0 && expense === 0) return undefined
    const net = income - expense
    const alpha = Math.min(0.2, (Math.abs(net) / maxNet) * 0.16 + 0.05)
    const rgb = net >= 0 ? '14,203,129' : '246,70,93'
    return `rgba(${rgb},${alpha})`
  }

  return (
    <div className="chart-card">
      <div className="chart-head" style={{ marginBottom: 16 }}>
        <div className="chart-title">
          Daily activity <span>· income &amp; expenses per day</span>
        </div>
        <span className="chart-title">
          <span>{monthLabel}</span>
        </span>
      </div>

      <div className="cal-scroll">
        <div className="cal-grid">
          {WEEKDAYS.map((d) => (
            <div key={d} className="cal-weekday">
              {d}
            </div>
          ))}
          {weeks.map((week, wi) =>
            week.map((cell, ci) => {
              if (!cell) return <div key={`${wi}-${ci}`} className="cal-cell cal-empty" />
              const isToday = cell.dateIso === today
              return (
                <div
                  key={cell.dateIso}
                  className={'cal-cell' + (isToday ? ' cal-today' : '')}
                  style={{ background: tint(cell.income, cell.expense) }}
                >
                  <div className="cal-day">{cell.day}</div>
                  {cell.income > 0 && (
                    <div className="cal-amt cal-inc" title={formatMoney(cell.income, currency, showCents)}>
                      +{formatCompactMoney(cell.income, currency)}
                    </div>
                  )}
                  {cell.expense > 0 && (
                    <div className="cal-amt cal-exp" title={formatMoney(cell.expense, currency, showCents)}>
                      −{formatCompactMoney(cell.expense, currency)}
                    </div>
                  )}
                </div>
              )
            }),
          )}
        </div>
      </div>
    </div>
  )
}
