import type { CumulativePoint } from '../../api/types'
import { cumulativeLine } from '../../lib/charts'
import { formatMoney, formatSignedMoney } from '../../lib/money'
import './charts.css'

interface Props {
  series: CumulativePoint[]
  currency: string
  showCents: boolean
}

export function CumulativeLineChart({ series, currency, showCents }: Props) {
  const geo = cumulativeLine(series)

  return (
    <div className="chart-card">
      <div className="chart-head" style={{ marginBottom: 18 }}>
        <div className="chart-title">
          Cumulative balance <span>· all time</span>
        </div>
        <div style={{ font: '600 15px var(--mono)', color: 'var(--yellow)' }}>
          {geo.endValue != null ? formatSignedMoney(geo.endValue, currency, showCents) : formatMoney(0, currency, showCents)}
        </div>
      </div>

      {series.length === 0 ? (
        <div style={{ font: '400 13px var(--sans)', color: 'var(--muted)', padding: '32px 0' }}>
          No transactions yet.
        </div>
      ) : (
        <>
          <div className="line-body">
            <div className="line-yaxis">
              {geo.yAxis.map((ya, i) => (
                <span key={i} style={{ top: ya.topPct }}>
                  {formatMoney(ya.value, currency, showCents)}
                </span>
              ))}
            </div>
            <div className="line-plot">
              <svg width="100%" height="100%" viewBox="0 0 900 220" preserveAspectRatio="none" style={{ display: 'block' }}>
                {geo.gridLines.map((g, i) => (
                  <line key={i} x1="0" y1={g.y} x2="900" y2={g.y} stroke="var(--line)" strokeWidth="1" />
                ))}
                <path
                  d={geo.linePath}
                  fill="none"
                  stroke="var(--yellow)"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              {geo.lineEnd && <div className="line-end-dot" style={{ left: geo.lineEnd.xPct, top: geo.lineEnd.yPct }} />}
            </div>
          </div>
          <div className="line-xlabels">
            <div style={{ width: 56, flex: 'none' }} />
            <div className="line-xlabels-inner">
              {geo.lineLabels.map((x, i) => (
                <span key={i}>{x}</span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
