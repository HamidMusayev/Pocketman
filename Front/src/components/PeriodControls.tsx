import { usePeriod } from '../context/PeriodContext'
import type { Period } from '../api/types'
import './shell.css'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'all', label: 'All time' },
  { key: 'range', label: 'Date range' },
]

export function PeriodControls() {
  const { period, setPeriod, monthLabel, prevMonth, nextMonth } = usePeriod()

  return (
    <div className="period-band">
      <div className="period-row">
        <div className="seg seg-period" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              className={'seg-btn' + (period === p.key ? ' active' : '')}
              aria-pressed={period === p.key}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="period-right">
          {period === 'monthly' && (
            <div className="month-nav">
              <button onClick={prevMonth} aria-label="Previous month">
                ‹
              </button>
              <div className="month-nav-label">{monthLabel}</div>
              <button onClick={nextMonth} aria-label="Next month">
                ›
              </button>
            </div>
          )}
          <div className="db-chip">
            <span className="db-chip-dot" />
            <span>pocketman.db</span>
          </div>
        </div>
      </div>
    </div>
  )
}
