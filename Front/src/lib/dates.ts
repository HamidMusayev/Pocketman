/** Ported from the prototype's `dateLabel()` / `pad()` helpers. */
export function formatDateLabel(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Short day label used by the transaction list's day headers, e.g. "Jul 4". */
export function formatDayShort(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/** Full weekday name for a day header, e.g. "Saturday". */
export function formatWeekday(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** The date a newly-added transaction should carry, matching the prototype:
 * when viewing a specific month, land it on the 15th of that month so it shows
 * up in the current view; otherwise use the real current date.
 * `month` is 1-indexed (as returned by usePeriodParams). */
export function newTransactionDate(period: string, year: number, month: number): string {
  if (period === 'monthly') return `${year}-${pad(month)}-15`
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Default date for the add form: today when looking at the current month (or
 * a non-monthly window), otherwise the 15th of the month being viewed.
 * `month` is 1-indexed. */
export function defaultEntryDate(period: string, year: number, month: number): string {
  const now = new Date()
  if (period !== 'monthly' || (year === now.getFullYear() && month === now.getMonth() + 1)) return todayIso()
  return newTransactionDate(period, year, month)
}

/** `iso` moved by `days` (negative goes back), as YYYY-MM-DD. */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Whole days from `from` to `to` (both YYYY-MM-DD); negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10))
  return Math.round((b - a) / 86_400_000)
}

/** When a planned item is due, relative to today: "Today", "Yesterday",
 * "3 days ago", "Tomorrow", "In 5 days". */
export function dueLabel(due: string, today: string = todayIso()): string {
  const n = daysBetween(today, due)
  if (n === 0) return 'Today'
  if (n === -1) return 'Yesterday'
  if (n === 1) return 'Tomorrow'
  return n < 0 ? `${-n} days ago` : `In ${n} days`
}
