import type { Period } from '../api/types'
import { usePeriod } from '../context/PeriodContext'
import './shell.css'

/** One compact control for the time window: ‹ month › with a dropdown that
 * switches to "Last 90 days" or "All time". */
export function PeriodPicker() {
  const { period, setPeriod, monthLabel, prevMonth, nextMonth } = usePeriod()
  const monthly = period === 'monthly'

  return (
    <div className="period-picker">
      <button onClick={prevMonth} disabled={!monthly} aria-label="Previous month">
        ‹
      </button>
      <select
        aria-label="Period"
        value={period}
        onChange={(e) => setPeriod(e.target.value as Period)}
      >
        <option value="monthly">{monthLabel}</option>
        <option value="range">Last 90 days</option>
        <option value="all">All time</option>
      </select>
      <button onClick={nextMonth} disabled={!monthly} aria-label="Next month">
        ›
      </button>
    </div>
  )
}
