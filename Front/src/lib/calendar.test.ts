import { describe, expect, it } from 'vitest'
import type { TransactionType } from '../api/types'
import { buildMonthGrid, groupByDay } from './calendar'

function txn(date: string, type: TransactionType, amount: number) {
  return { date, type, amount }
}

describe('groupByDay', () => {
  it('sums income and expense per date', () => {
    const totals = groupByDay([
      txn('2026-07-01', 'income', 3000),
      txn('2026-07-01', 'expense', 200),
      txn('2026-07-01', 'expense', 50),
      txn('2026-07-04', 'income', 100),
    ])
    expect(totals['2026-07-01']).toEqual({ income: 3000, expense: 250 })
    expect(totals['2026-07-04']).toEqual({ income: 100, expense: 0 })
    expect(totals['2026-07-02']).toBeUndefined()
  })

  it('excludes transfers (they are neither income nor expense)', () => {
    const totals = groupByDay([
      txn('2026-07-01', 'expense', 200),
      txn('2026-07-01', 'transfer', 500),
    ])
    expect(totals['2026-07-01']).toEqual({ income: 0, expense: 200 })
  })
})

describe('buildMonthGrid', () => {
  it('lays out a month into padded Sun-first weeks', () => {
    const totals = groupByDay([txn('2026-07-15', 'expense', 42)])
    const weeks = buildMonthGrid(2026, 6, totals) // July 2026 (month0 = 6)

    // every row has 7 cells and the total is a whole number of weeks
    expect(weeks.every((w) => w.length === 7)).toBe(true)

    const flat = weeks.flat()
    const days = flat.filter((c): c is NonNullable<typeof c> => c !== null)
    expect(days).toHaveLength(31) // July has 31 days

    // leading nulls equal the weekday index of the 1st
    const startDow = new Date(2026, 6, 1).getDay()
    expect(flat.slice(0, startDow).every((c) => c === null)).toBe(true)
    expect(flat[startDow]?.day).toBe(1)

    // day totals are wired through
    const d15 = days.find((c) => c.day === 15)
    expect(d15).toMatchObject({ dateIso: '2026-07-15', income: 0, expense: 42 })

    // days with no activity are zeroed, not missing
    expect(days.find((c) => c.day === 2)).toMatchObject({ income: 0, expense: 0 })
  })

  it('pads a month that starts on Sunday with no leading blanks', () => {
    // 2026-03-01 is a Sunday
    const weeks = buildMonthGrid(2026, 2, {})
    expect(weeks[0][0]?.day).toBe(1)
  })
})
