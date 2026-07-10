import { usePeriod, usePeriodParams } from '../context/PeriodContext'
import { useSettings } from '../hooks/useSettings'
import { useSummary } from '../hooks/useStats'
import { formatSignedMoney } from '../lib/money'
import './shell.css'

export function SummaryCards() {
  const params = usePeriodParams()
  const { periodName } = usePeriod()
  const { data: settings } = useSettings()
  const { data: summary } = useSummary(params)

  const currency = settings?.currency_symbol ?? '$'
  const showCents = settings?.show_cents ?? true

  const income = summary?.income ?? 0
  const expense = summary?.expense ?? 0
  const balance = summary?.balance ?? 0
  const savingsRate = summary?.savings_rate ?? 0

  return (
    <div className="summary-hero">
      <div>
        <div className="summary-hero-balance-label">Net balance · {periodName}</div>
        <div className="summary-hero-balance-value">{formatSignedMoney(balance, currency, showCents)}</div>
      </div>
      <div className="summary-hero-divider" />
      <div className="summary-hero-stats">
        <div>
          <div className="summary-hero-stat-label">Income</div>
          <div className="summary-hero-stat-value" style={{ color: 'var(--up)' }}>
            {formatSignedMoney(income, currency, showCents)}
          </div>
        </div>
        <div>
          <div className="summary-hero-stat-label">Expenses</div>
          <div className="summary-hero-stat-value" style={{ color: 'var(--down)' }}>
            {formatSignedMoney(expense, currency, showCents)}
          </div>
        </div>
        <div>
          <div className="summary-hero-stat-label">Savings rate</div>
          <div className="summary-hero-stat-value" style={{ color: savingsRate >= 0 ? 'var(--up)' : 'var(--down)' }}>
            {savingsRate}%
          </div>
        </div>
      </div>
    </div>
  )
}
