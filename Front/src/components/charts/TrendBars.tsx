import type { TrendPoint } from '../../api/types'
import { trendBars } from '../../lib/charts'
import './charts.css'

export function TrendBars({ trend }: { trend: TrendPoint[] }) {
  const bars = trendBars(trend)
  return (
    <div className="chart-card">
      <div className="chart-head">
        <div className="chart-title">
          Income vs expenses <span>· last 6 months</span>
        </div>
        <div className="trend-legend">
          <span style={{ color: 'var(--up)' }}>■ Income</span>
          <span style={{ color: 'var(--down)' }}>■ Expenses</span>
        </div>
      </div>
      <div className="trend-bars">
        {bars.map((m, i) => (
          <div className="trend-col" key={i}>
            <div className="trend-bar-pair">
              <div className="trend-bar-inc" style={{ height: m.incH }} />
              <div className="trend-bar-exp" style={{ height: m.expH }} />
            </div>
            <div className="trend-label">{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
