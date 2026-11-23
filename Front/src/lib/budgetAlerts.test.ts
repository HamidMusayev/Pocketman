import { describe, expect, it } from 'vitest'
import { budgetAlerts } from './budgetAlerts'

const item = (name: string, spent: number, budget: number | null) => ({
  category_id: name.length,
  name,
  icon: 'other',
  spent,
  budget,
  pct_used: budget ? Math.round((spent / budget) * 100) : null,
})

describe('budgetAlerts', () => {
  it('flags categories at 80%+ and marks those at 100%+ as over, worst first', () => {
    const alerts = budgetAlerts([
      item('Food', 79, 100),
      item('Fuel', 80, 100),
      item('Rent', 120, 100),
      item('Misc', 500, null),
    ])
    expect(alerts.map((a) => [a.name, a.level])).toEqual([
      ['Rent', 'over'],
      ['Fuel', 'near'],
    ])
  })
})
