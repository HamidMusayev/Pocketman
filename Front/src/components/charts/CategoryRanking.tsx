import type { CategoryBreakdownItem } from '../../api/types'
import { categoryRanking } from '../../lib/charts'
import { formatMoney } from '../../lib/money'
import './charts.css'

interface Props {
  breakdown: CategoryBreakdownItem[]
  currency: string
  showCents: boolean
}

export function CategoryRanking({ breakdown, currency, showCents }: Props) {
  const rows = categoryRanking(breakdown, 7)

  return (
    <div className="chart-card">
      <div className="chart-title" style={{ marginBottom: 18 }}>
        Top spending categories
      </div>
      <div className="ranking-list">
        {rows.map((r, i) => (
          <div className="ranking-row" key={i}>
            <span className="ranking-name">{r.name}</span>
            <div className="ranking-track">
              <div className="ranking-fill" style={{ width: r.w, background: r.color }} />
            </div>
            <span className="ranking-amount">{formatMoney(r.amount, currency, showCents)}</span>
            <span className="ranking-pct">{r.pct}%</span>
          </div>
        ))}
        {rows.length === 0 && (
          <div style={{ font: '400 13px var(--sans)', color: 'var(--muted)' }}>No expenses this period.</div>
        )}
      </div>
    </div>
  )
}
