import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCategory,
  deleteCategory,
  getBudgetSummary,
  listCategories,
  updateCategory,
  type CategoryInput,
} from '../api/categories'
import type { PeriodParams } from '../api/types'

const KEY = ['categories']

export function useCategories() {
  return useQuery({ queryKey: KEY, queryFn: listCategories })
}

export function useBudgetSummary(params: PeriodParams) {
  return useQuery({
    queryKey: ['budget-summary', params],
    queryFn: () => getBudgetSummary(params),
  })
}

function useInvalidateCategoryQueries() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: KEY })
    qc.invalidateQueries({ queryKey: ['budget-summary'] })
  }
}

export function useCreateCategory() {
  const invalidate = useInvalidateCategoryQueries()
  return useMutation({
    mutationFn: (input: CategoryInput) => createCategory(input),
    onSuccess: invalidate,
  })
}

export function useUpdateCategory() {
  const invalidate = useInvalidateCategoryQueries()
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<CategoryInput> }) => updateCategory(id, patch),
    onSuccess: invalidate,
  })
}

export function useDeleteCategory() {
  const invalidate = useInvalidateCategoryQueries()
  return useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: invalidate,
  })
}
