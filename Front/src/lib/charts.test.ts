import { describe, expect, it } from 'vitest'
import type { CategoryBreakdownItem, CumulativePoint, TrendPoint } from '../api/types'
import {
  budgetColor,
  cumulativeLine,
  donutSegments,
  ringColor,
  trendBars,
} from './charts'

function breakdown(items: [string, number, number][]): CategoryBreakdownItem[] {
  return items.map(([name, amount, pct], i) => ({ category_id: i + 1, name, amount, pct }))
}

describe('budgetColor', () => {
  it('greys out unbudgeted categories', () => {
    expect(budgetColor(null)).toBe('var(--elev)')
  })
  it('follows the 100 / 80 thresholds', () => {
    expect(budgetColor(120)).toBe('var(--down)')
    expect(budgetColor(100)).toBe('var(--down)')
    expect(budgetColor(80)).toBe('var(--yellow)')
    expect(budgetColor(79)).toBe('var(--up)')
    expect(budgetColor(0)).toBe('var(--up)')
  })
})

describe('ringColor', () => {
  it('is green at 0 and red at/over 100', () => {
    expect(ringColor(0)).toBe('var(--up)')
    expect(ringColor(85)).toBe('var(--yellow)')
    expect(ringColor(100)).toBe('var(--down)')
  })
})

describe('donutSegments', () => {
  it('sizes each arc by share and accumulates the offset', () => {
    const segs = donutSegments(breakdown([['A', 75, 75], ['B', 25, 25]]), 66)
    expect(segs).toHaveLength(2)
    // circumference = 2π·66 = 414.69
    expect(segs[0].dash).toBe('311.02 414.69')
    expect(segs[0].offset).toBe('0.00')
    expect(segs[1].dash).toBe('103.67 414.69')
    expect(segs[1].offset).toBe('-311.02')
    expect(segs[0].color).toBe('#FCD535')
  })
  it('is empty for no data', () => {
    expect(donutSegments([], 66)).toEqual([])
  })
})

describe('trendBars', () => {
  it('scales bar heights against the max income/expense', () => {
    const trend: TrendPoint[] = [
      { label: 'Jan', year: 2026, month: 1, income: 100, expense: 50 },
      { label: 'Feb', year: 2026, month: 2, income: 0, expense: 200 },
    ]
    const bars = trendBars(trend)
    expect(bars[0]).toEqual({ label: 'Jan', incH: '50%', expH: '25%' })
    expect(bars[1]).toEqual({ label: 'Feb', incH: '0%', expH: '100%' })
  })
})

describe('cumulativeLine', () => {
  it('builds a path and axis over the series', () => {
    const series: CumulativePoint[] = [
      { date: '2026-01-01', balance: 100 },
      { date: '2026-02-01', balance: 200 },
    ]
    const geo = cumulativeLine(series)
    expect(geo.linePath).toBe('M0.0,110.0 L900.0,12.0')
    expect(geo.endValue).toBe(200)
    expect(geo.gridLines).toHaveLength(5)
    expect(geo.yAxis).toHaveLength(5)
    expect(geo.yAxis[0].value).toBe(200)
    expect(geo.yAxis[4].value).toBe(0)
    expect(geo.lineEnd?.xPct).toBe('100.00%')
  })
  it('returns an empty geometry for no data', () => {
    const geo = cumulativeLine([])
    expect(geo.linePath).toBe('')
    expect(geo.endValue).toBeNull()
    expect(geo.lineEnd).toBeNull()
  })
})
