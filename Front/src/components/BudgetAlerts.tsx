import { Link } from 'react-router-dom'
import { usePeriodParams } from '../context/PeriodContext'
import { useBudgetSummary } from '../hooks/useCategories'
import { budgetAlerts } from '../lib/budgetAlerts'
import { formatMoney } from '../lib/money'
import { CategoryIcon } from './CategoryIcon'

/** Categories at 80% or more of their monthly budget. Budgets are monthly, so
 * this only shows while a single month is selected. Hidden when all is fine. */
export function BudgetAlerts({ currency, showCents }: { currency: string; showCents: boolean }) {
  const params = usePeriodParams()
  const monthly = params.period === 'monthly'
  const { data: summary } = useBudgetSummary(params)
  if (!monthly) return null
  const alerts = budgetAlerts(summary?.categories ?? [])
  if (alerts.length === 0) return null

  return (
    <section className="budget-alerts" aria-label="Budget alerts">
      {alerts.map((a) => (
        <Link
          to="/budget"
          key={a.category_id}
          className={'budget-alert ' + (a.level === 'over' ? 'budget-alert-over' : 'budget-alert-near')}
        >
          <CategoryIcon iconKey={a.icon} size={16} />
          <span className="budget-alert-text">
            <strong>{a.name}</strong>{' '}
            {a.level === 'over'
              ? `is ${formatMoney(a.spent - (a.budget ?? 0), currency, showCents)} over budget`
              : `has used ${a.pct_used}% of its budget`}
          </span>
          <span className="budget-alert-pct">{a.pct_used}%</span>
        </Link>
      ))}
    </section>
  )
}
