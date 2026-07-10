import { apiClient } from './client'
import type { Category, CategoryBudgetSummary, PeriodParams, TxnType } from './types'

export async function listCategories(): Promise<Category[]> {
  const res = await apiClient.get('/categories')
  return res.data
}

export interface CategoryInput {
  name: string
  type: TxnType
  icon: string
  budget?: number | null
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  const res = await apiClient.post('/categories', input)
  return res.data
}

export async function updateCategory(
  id: number,
  patch: Partial<Pick<CategoryInput, 'name' | 'icon' | 'budget'>>,
): Promise<Category> {
  const res = await apiClient.put(`/categories/${id}`, patch)
  return res.data
}

export async function deleteCategory(id: number): Promise<void> {
  await apiClient.delete(`/categories/${id}`)
}

export async function getBudgetSummary(params: PeriodParams): Promise<CategoryBudgetSummary> {
  const res = await apiClient.get('/categories/budget-summary', { params })
  return res.data
}
