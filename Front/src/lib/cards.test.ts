import { describe, expect, it } from 'vitest'
import { cardDigits, cardExpiry } from './cards'

describe('decorative card face values', () => {
  it('are stable for the same account', () => {
    const account = { id: 1, name: 'Main' }
    expect(cardDigits(account)).toBe(cardDigits({ ...account }))
    expect(cardExpiry(account)).toBe(cardExpiry({ ...account }))
  })

  it('differ between accounts', () => {
    expect(cardDigits({ id: 1, name: 'Main' })).not.toBe(cardDigits({ id: 2, name: 'Cash' }))
  })

  it('are always four digits', () => {
    for (let id = 1; id <= 50; id++) {
      expect(cardDigits({ id, name: `Account ${id}` })).toMatch(/^\d{4}$/)
    }
  })

  it('read as a MM/YY expiry with a valid month', () => {
    for (let id = 1; id <= 50; id++) {
      const expiry = cardExpiry({ id, name: `Account ${id}` })
      expect(expiry).toMatch(/^\d{2}\/\d{2}$/)
      const month = Number(expiry.slice(0, 2))
      expect(month).toBeGreaterThanOrEqual(1)
      expect(month).toBeLessThanOrEqual(12)
    }
  })
})
