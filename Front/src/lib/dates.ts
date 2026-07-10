/** Ported from the prototype's `dateLabel()` / `pad()` helpers. */
export function formatDateLabel(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
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
