import type { CategoryBreakdownItem } from '../../api/types'
import { donutSegments } from '../../lib/charts'
import { rampColor } from '../../lib/colorRamp'
import { formatMoney } from '../../lib/money'
import './charts.css'

interface Props {
  breakdown: CategoryBreakdownItem[]
  currency: string
  showCents: boolean
}

export function CategoryDonut({ breakdown, currency, showCents }: Props) {
  const segments = donutSegments(breakdown, 66)
  const total = breakdown.reduce((sum, it) => sum + it.amount, 0)

  return (
    <div className="chart-card">
      <div className="chart-title" style={{ marginBottom: 14 }}>
        Expenses by category
      </div>
      <div className="donut-body">
        <div className="donut-wrap">
          <svg width="136" height="136" viewBox="0 0 180 180">
            <circle cx="90" cy="90" r="66" fill="none" stroke="var(--elev)" strokeWidth="26" />
            {segments.map((s, i) => (
              <circle
                key={i}
                cx="90"
                cy="90"
                r="66"
                fill="none"
                stroke={s.color}
                strokeWidth="26"
                strokeDasharray={s.dash}
                strokeDashoffset={s.offset}
                transform="rotate(-90 90 90)"
              />
            ))}
          </svg>
          <div className="donut-center">
            <div className="donut-center-label">Total</div>
            <div className="donut-center-value">{formatMoney(total, currency, showCents)}</div>
          </div>
        </div>
        <div className="donut-legend">
          {breakdown.map((it, i) => (
            <div className="donut-legend-row" key={it.category_id}>
              <span className="donut-swatch" style={{ background: rampColor(i) }} />
              <span className="donut-legend-name">{it.name}</span>
              <span className="donut-legend-amount">{formatMoney(it.amount, currency, showCents)}</span>
              <span className="donut-legend-pct">{it.pct}%</span>
            </div>
          ))}
          {breakdown.length === 0 && (
            <div style={{ font: '400 13px var(--sans)', color: 'var(--muted)' }}>No expenses this period.</div>
          )}
        </div>
      </div>
    </div>
  )
}
