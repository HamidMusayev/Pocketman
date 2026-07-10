import { describe, expect, it } from 'vitest'
import { formatDateLabel, newTransactionDate, todayIso } from './dates'

describe('formatDateLabel', () => {
  it('renders a short human date', () => {
    expect(formatDateLabel('2026-07-04')).toBe('Jul 4, 2026')
  })
})

describe('newTransactionDate', () => {
  it('lands on the 15th of the viewed month when monthly', () => {
    expect(newTransactionDate('monthly', 2026, 7)).toBe('2026-07-15')
    expect(newTransactionDate('monthly', 2026, 12)).toBe('2026-12-15')
  })

  it('uses a real date (not the prototype constant) otherwise', () => {
    expect(newTransactionDate('all', 2026, 7)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(newTransactionDate('all', 2026, 7)).toBe(todayIso())
  })
})
