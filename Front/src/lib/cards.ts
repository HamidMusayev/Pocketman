/** Decorative values for the account card faces on the Accounts tab.
 *
 * Accounts hold no card number or expiry — the data model has name, type,
 * icon, net and transaction_count and nothing else. These helpers derive
 * stable-looking filler from the account's id + name purely so the card
 * skeuomorph reads as a card and doesn't reshuffle on every render. Nothing
 * here is real card data, and it is rendered `aria-hidden`. */

/** FNV-1a, so the same account always produces the same digits. */
function hash(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

interface CardSeed {
  id: number
  name: string
}

/** The four digits shown after the masked groups, e.g. "6489". */
export function cardDigits(account: CardSeed): string {
  return String(hash(`${account.id}:${account.name}`) % 10000).padStart(4, '0')
}

/** An expiry-shaped label for the bottom-right of the card, e.g. "06/28". */
export function cardExpiry(account: CardSeed): string {
  const h = hash(`exp:${account.id}:${account.name}`)
  const month = (h % 12) + 1
  const year = 26 + ((h >>> 8) % 8)
  return `${String(month).padStart(2, '0')}/${year}`
}
