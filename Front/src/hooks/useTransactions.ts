import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createTransaction,
  deleteTransaction,
  importTransactionsCsv,
  listTransactions,
  updateTransaction,
  type TransactionFilters,
  type TransactionInput,
} from '../api/transactions'
import { queryKeys } from './queryKeys'

export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: [...queryKeys.transactions, filters],
    queryFn: () => listTransactions(filters),
  })
}

function useInvalidateAfterTransactionChange() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.transactions })
    qc.invalidateQueries({ queryKey: queryKeys.accounts })
    qc.invalidateQueries({ queryKey: queryKeys.budgetSummary })
    qc.invalidateQueries({ queryKey: queryKeys.stats })
  }
}

export function useCreateTransaction() {
  const invalidate = useInvalidateAfterTransactionChange()
  return useMutation({
    mutationFn: (input: TransactionInput) => createTransaction(input),
    onSuccess: invalidate,
  })
}

export function useUpdateTransaction() {
  const invalidate = useInvalidateAfterTransactionChange()
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<TransactionInput> }) => updateTransaction(id, patch),
    onSuccess: invalidate,
  })
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateAfterTransactionChange()
  return useMutation({
    mutationFn: (id: number) => deleteTransaction(id),
    onSuccess: invalidate,
  })
}

export function useImportTransactions() {
  const invalidate = useInvalidateAfterTransactionChange()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => importTransactionsCsv(file),
    onSuccess: () => {
      invalidate()
      // import can auto-create categories/accounts
      qc.invalidateQueries({ queryKey: queryKeys.categories })
    },
  })
}
