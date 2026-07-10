/** Pure chart math ported from `renderVals()` in `UI Design/Pocketman.dc.html`.
 * These functions return plain data (numbers / SVG path strings); money and
 * color formatting is applied by the chart components so this stays testable. */
import type { CategoryBreakdownItem, CumulativePoint, TrendPoint } from '../api/types'
import { rampColor } from './colorRamp'

/** Budget bar color rule: >=100% red, >=80% yellow, else green; unbudgeted grey.
 * `pctUsed` is the backend's rounded spent/budget percentage (null = no budget). */
export function budgetColor(pctUsed: number | null): string {
  if (pctUsed == null) return 'var(--elev)'
  if (pctUsed >= 100) return 'var(--down)'
  if (pctUsed >= 80) return 'var(--yellow)'
  return 'var(--up)'
}

/** Overall budget ring color — same thresholds, but a 0% ring is still green. */
export function ringColor(pct: number): string {
  if (pct >= 100) return 'var(--down)'
  if (pct >= 80) return 'var(--yellow)'
  return 'var(--up)'
}

/** `stroke-dasharray` for a ring: the filled arc length then the full circumference. */
export function ringDash(spent: number, total: number, radius = 30): string {
  const c = 2 * Math.PI * radius
  const frac = total > 0 ? Math.min(1, spent / total) : 0
  return `${(frac * c).toFixed(2)} ${c.toFixed(2)}`
}

export interface DonutSegment {
  color: string
  dash: string
  offset: string
}

/** Donut ring segments, one per expense category, sized by share of total. */
export function donutSegments(items: CategoryBreakdownItem[], radius = 66): DonutSegment[] {
  const total = items.reduce((sum, it) => sum + it.amount, 0)
  const c = 2 * Math.PI * radius
  let acc = 0
  return items.map((it, i) => {
    const frac = total > 0 ? it.amount / total : 0
    const dash = `${(frac * c).toFixed(2)} ${c.toFixed(2)}`
    const offset = (-acc * c).toFixed(2)
    acc += frac
    return { color: rampColor(i), dash, offset }
  })
}

export interface TrendBar {
  label: string
  incH: string
  expH: string
}

/** Bar heights (as CSS percentages) for the income-vs-expenses chart. */
export function trendBars(trend: TrendPoint[]): TrendBar[] {
  const maxT = Math.max(1, ...trend.map((t) => t.income), ...trend.map((t) => t.expense))
  return trend.map((t) => ({
    label: t.label,
    incH: Math.round((t.income / maxT) * 100) + '%',
    expH: Math.round((t.expense / maxT) * 100) + '%',
  }))
}

export interface RankingRow {
  name: string
  amount: number
  pct: number
  w: string
  color: string
}

/** Horizontal bar widths for the "top spending categories" ranking. */
export function categoryRanking(items: CategoryBreakdownItem[], limit = 7): RankingRow[] {
  const top = items.slice(0, limit)
  const max = top.length ? top[0].amount : 1
  return top.map((it, i) => ({
    name: it.name,
    amount: it.amount,
    pct: it.pct,
    w: Math.round((it.amount / max) * 100) + '%',
    color: rampColor(i),
  }))
}

export interface CumulativeLine {
  linePath: string
  lineArea: string
  lineLabels: string[]
  gridLines: { y: string }[]
  yAxis: { topPct: string; value: number }[]
  lineEnd: { xPct: string; yPct: string } | null
  endValue: number | null
}

const W = 900
const VBH = 220
const TOP = 12
const BOT = 208

function shortDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Cumulative-balance area/line chart geometry over the whole transaction series. */
export function cumulativeLine(series: CumulativePoint[]): CumulativeLine {
  const empty: CumulativeLine = {
    linePath: '',
    lineArea: '',
    lineLabels: [],
    gridLines: [],
    yAxis: [],
    lineEnd: null,
    endValue: null,
  }
  if (!series.length) return empty

  const vs = series.map((p) => p.balance)
  const mn = Math.min(0, ...vs)
  let mx = Math.max(...vs)
  if (mx === mn) mx = mn + 1
  const n = series.length
  const X = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W)
  const Y = (v: number) => TOP + (1 - (v - mn) / (mx - mn)) * (BOT - TOP)

  const pts = series.map((p, i) => `${X(i).toFixed(1)},${Y(p.balance).toFixed(1)}`)
  const linePath = 'M' + pts.join(' L')
  const lineArea = `M${X(0).toFixed(1)},${BOT} L` + pts.join(' L') + ` L${X(n - 1).toFixed(1)},${BOT} Z`

  const gridLines: { y: string }[] = []
  const yAxis: { topPct: string; value: number }[] = []
  for (let g = 0; g <= 4; g++) {
    const y = TOP + ((BOT - TOP) * g) / 4
    gridLines.push({ y: y.toFixed(1) })
    yAxis.push({ topPct: ((y / VBH) * 100).toFixed(2) + '%', value: mx - ((mx - mn) * g) / 4 })
  }

  const lineEnd = {
    xPct: ((X(n - 1) / W) * 100).toFixed(2) + '%',
    yPct: ((Y(series[n - 1].balance) / VBH) * 100).toFixed(2) + '%',
  }

  const idxs = [0, Math.floor(n * 0.2), Math.floor(n * 0.4), Math.floor(n * 0.6), Math.floor(n * 0.8), n - 1]
  const lineLabels = [...new Set(idxs)].map((i) => shortDate(series[i].date))

  return { linePath, lineArea, lineLabels, gridLines, yAxis, lineEnd, endValue: series[n - 1].balance }
}
