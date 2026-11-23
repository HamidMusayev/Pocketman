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
