/** Ported from the prototype's `money()` helper. */
export function formatMoney(amount: number, currencySymbol: string, showCents: boolean): string {
  const abs = Math.abs(amount)
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  })
  return currencySymbol + formatted
}

/** Signed money text with a minus sign for negatives (prototype uses a real
 * minus sign '−', not a hyphen, to match the mono font's glyph width). */
export function formatSignedMoney(amount: number, currencySymbol: string, showCents: boolean): string {
  const sign = amount < 0 ? '−' : ''
  return sign + formatMoney(amount, currencySymbol, showCents)
}

/** Transaction amount text with a leading +/- matching type, e.g. "+$12.00". */
export function formatTransactionAmount(
  type: 'income' | 'expense',
  amount: number,
  currencySymbol: string,
  showCents: boolean,
): string {
  const sign = type === 'income' ? '+' : '−'
  return sign + formatMoney(amount, currencySymbol, showCents)
}

/** Abbreviated, space-tight money for cramped UI (e.g. calendar day cells):
 * "$200", "$3.2k", "$1.3M". Uses the absolute value — sign is added by callers. */
export function formatCompactMoney(amount: number, currencySymbol: string): string {
  const abs = Math.abs(amount)
  let body: string
  if (abs >= 1_000_000) body = (abs / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  else if (abs >= 1_000) body = (abs / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  else body = String(Math.round(abs))
  return currencySymbol + body
}
