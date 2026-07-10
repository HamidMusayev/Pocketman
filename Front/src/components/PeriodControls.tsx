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
    <div className="period-row">
      <div className="period-pills">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            className={'period-pill' + (period === p.key ? ' active' : '')}
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>
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
    </div>
  )
}
