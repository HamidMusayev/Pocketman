import { describe, expect, it } from 'vitest'
import { addDaysIso, daysBetween, dueLabel, formatDateLabel, newTransactionDate, todayIso } from './dates'

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

describe('planned-item dates', () => {
  it('adds days across month ends', () => {
    expect(addDaysIso('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDaysIso('2026-11-23', 7)).toBe('2026-11-30')
  })

  it('labels due dates relative to today', () => {
    expect(dueLabel('2026-11-23', '2026-11-23')).toBe('Today')
    expect(dueLabel('2026-11-22', '2026-11-23')).toBe('Yesterday')
    expect(dueLabel('2026-11-20', '2026-11-23')).toBe('3 days ago')
    expect(dueLabel('2026-11-24', '2026-11-23')).toBe('Tomorrow')
    expect(dueLabel('2026-12-01', '2026-11-23')).toBe('In 8 days')
    expect(daysBetween('2026-10-25', '2026-10-26')).toBe(1) // DST change doesn't break it
  })
})
