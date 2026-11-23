/** Central query-key roots so mutations can invalidate every affected view
 * without importing each feature's hook module (avoids import cycles). */
export const queryKeys = {
  accounts: ['accounts'] as const,
  categories: ['categories'] as const,
  budgetSummary: ['budget-summary'] as const,
  transactions: ['transactions'] as const,
  recurring: ['recurring'] as const,
  pending: ['recurring-pending'] as const,
  stats: ['stats'] as const,
  tags: ['tags'] as const,
  goals: ['goals'] as const,
}
