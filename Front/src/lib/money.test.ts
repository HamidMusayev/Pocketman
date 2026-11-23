import { describe, expect, it } from 'vitest'
import { formatCompactMoney, formatMoney, formatSignedMoney, formatTransactionAmount, parseAmount, sumMoney } from './money'

describe('formatMoney', () => {
  it('adds thousands separators and two decimals when showCents is on', () => {
    expect(formatMoney(1234.5, '$', true)).toBe('$1,234.50')
  })

  it('rounds to whole numbers when showCents is off', () => {
    expect(formatMoney(1234.56, '$', false)).toBe('$1,235')
    expect(formatMoney(1000, '$', false)).toBe('$1,000')
  })

  it('uses the absolute value (never a sign)', () => {
    expect(formatMoney(-50, '$', true)).toBe('$50.00')
  })

  it('respects a custom currency symbol', () => {
    expect(formatMoney(42, '₼', false)).toBe('₼42')
  })
})

describe('formatSignedMoney', () => {
  it('prefixes negatives with a real minus glyph', () => {
    expect(formatSignedMoney(-50, '$', true)).toBe('−$50.00')
  })

  it('leaves positives unsigned', () => {
    expect(formatSignedMoney(50, '$', true)).toBe('$50.00')
  })
})

describe('formatTransactionAmount', () => {
  it('prefixes income with + and expense with −', () => {
    expect(formatTransactionAmount('income', 20, '$', true)).toBe('+$20.00')
    expect(formatTransactionAmount('expense', 20, '$', true)).toBe('−$20.00')
  })
})

describe('formatCompactMoney', () => {
  it('abbreviates thousands and millions, dropping trailing .0', () => {
    expect(formatCompactMoney(200, '$')).toBe('$200')
    expect(formatCompactMoney(3000, '$')).toBe('$3k')
    expect(formatCompactMoney(3200, '$')).toBe('$3.2k')
    expect(formatCompactMoney(1_250_000, '$')).toBe('$1.3M')
    expect(formatCompactMoney(0, '$')).toBe('$0')
  })
})

describe('sumMoney', () => {
  it('adds in cents so there is no float drift', () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3)
    expect(sumMoney([])).toBe(0)
    expect(sumMoney([10, -2.5])).toBe(7.5)
  })
})

describe('parseAmount', () => {
  it('accepts dots, commas and rounds to cents', () => {
    expect(parseAmount('12.5')).toBe(12.5)
    expect(parseAmount('12,50')).toBe(12.5)
    expect(parseAmount(' 3.456 ')).toBe(3.46)
    expect(parseAmount('.5')).toBe(0.5)
  })
  it('rejects junk, zero and negatives unless allowed', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('0')).toBeNull()
    expect(parseAmount('-5')).toBeNull()
    expect(parseAmount('-5', { allowNegative: true })).toBe(-5)
    expect(parseAmount('0', { allowZero: true })).toBe(0)
  })
})

describe('formatTransactionAmount for transfers', () => {
  it('is neutral', () => {
    expect(formatTransactionAmount('transfer', 5, '$', true)).toBe('⇄ $5.00')
  })
})
