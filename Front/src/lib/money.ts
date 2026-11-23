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

/** Adds money amounts in whole cents so 0.1 + 0.2 is exactly 0.3. */
export function sumMoney(amounts: Iterable<number>): number {
  let cents = 0
  for (const a of amounts) cents += Math.round(a * 100)
  return cents / 100
}

/** Parses what someone typed into an amount box ("12,50" or "12.5") to a
 * number rounded to cents, or null if it isn't one. By default only amounts
 * above zero are accepted. */
export function parseAmount(
  text: string,
  { allowNegative = false, allowZero = false } = {},
): number | null {
  const cleaned = text.trim().replace(/\s/g, '').replace(',', '.')
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null
  const n = Math.round(Number(cleaned) * 100) / 100 || 0 // -0 → 0
  if (!Number.isFinite(n)) return null
  if (n === 0 && !allowZero) return null
  if (n < 0 && !allowNegative) return null
  return n
}

/** Transaction amount text with a leading +/- matching type, e.g. "+$12.00".
 * Transfers get a neutral "⇄". */
export function formatTransactionAmount(
  type: 'income' | 'expense' | 'transfer',
  amount: number,
  currencySymbol: string,
  showCents: boolean,
): string {
  if (type === 'transfer') return '⇄ ' + formatMoney(amount, currencySymbol, showCents)
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
