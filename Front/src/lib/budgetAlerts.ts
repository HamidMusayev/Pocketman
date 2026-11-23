import type { CategoryBudgetItem } from '../api/types'

/** A category starts warning at this share of its budget. */
export const BUDGET_WARN_PCT = 80

export type BudgetAlert = CategoryBudgetItem & { level: 'near' | 'over' }

/** Budgeted categories at ≥80% ("near") or ≥100% ("over"), worst first. */
export function budgetAlerts(categories: CategoryBudgetItem[]): BudgetAlert[] {
  return categories
    .filter((c) => c.budget != null && c.budget > 0 && (c.pct_used ?? 0) >= BUDGET_WARN_PCT)
    .map((c) => ({ ...c, level: (c.pct_used ?? 0) >= 100 ? ('over' as const) : ('near' as const) }))
    .sort((a, b) => (b.pct_used ?? 0) - (a.pct_used ?? 0))
}
