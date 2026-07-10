import type { TransactionType } from '../api/types'

export interface DailyTotal {
  income: number
  expense: number
}

export interface DayCell {
  day: number
  dateIso: string
  income: number
  expense: number
}

/** Sum income/expense per ISO date. Transfers move money between accounts and
 * are neither income nor expense, so they're skipped. */
export function groupByDay(
  txns: { date: string; type: TransactionType; amount: number }[],
): Record<string, DailyTotal> {
  const out: Record<string, DailyTotal> = {}
  for (const t of txns) {
    if (t.type !== 'income' && t.type !== 'expense') continue
    const cur = out[t.date] ?? { income: 0, expense: 0 }
    if (t.type === 'income') cur.income += t.amount
    else cur.expense += t.amount
    out[t.date] = cur
  }
  return out
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** A month laid out as Sun-first weeks. `null` cells pad the first and last
 * weeks so every row has 7 entries; real days carry their daily totals.
 * `month0` is 0-indexed (JS Date convention). */
export function buildMonthGrid(
  year: number,
  month0: number,
  totals: Record<string, DailyTotal>,
): (DayCell | null)[][] {
  const startDow = new Date(year, month0, 1).getDay()
  const daysIn = new Date(year, month0 + 1, 0).getDate()

  const cells: (DayCell | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let day = 1; day <= daysIn; day++) {
    const dateIso = `${year}-${pad2(month0 + 1)}-${pad2(day)}`
    const t = totals[dateIso] ?? { income: 0, expense: 0 }
    cells.push({ day, dateIso, income: t.income, expense: t.expense })
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: (DayCell | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}
