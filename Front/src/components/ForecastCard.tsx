import { useForecast } from '../hooks/usePlanned'
import { formatDayShort } from '../lib/dates'
import { formatMoney, formatSignedMoney } from '../lib/money'

/** Balance expected at the end of this month: today's balance plus every
 * planned income, minus every planned expense (recurring ones included). */
export function ForecastCard({ currency, showCents }: { currency: string; showCents: boolean }) {
  const { data: f } = useForecast()
  if (!f || f.item_count === 0) return null
  return (
    <section className="side-card forecast-card" aria-label="End of month forecast">
      <div className="side-card-title">Expected on {formatDayShort(f.end_date)}</div>
      <div className="forecast-value">{formatSignedMoney(f.expected_balance, currency, showCents)}</div>
      <div className="forecast-rows">
        <div>
          <span>Balance now</span>
          <span>{formatSignedMoney(f.balance, currency, showCents)}</span>
        </div>
        {f.planned_income > 0 && (
          <div>
            <span>Planned income</span>
            <span style={{ color: 'var(--up)' }}>+{formatMoney(f.planned_income, currency, showCents)}</span>
          </div>
        )}
        {f.planned_expense > 0 && (
          <div>
            <span>Planned expenses</span>
            <span style={{ color: 'var(--down)' }}>−{formatMoney(f.planned_expense, currency, showCents)}</span>
          </div>
        )}
      </div>
    </section>
  )
}
