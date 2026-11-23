import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createTransaction,
  deleteTransaction,
  importTransactionsCsv,
  listTransactions,
  listTransactionsPage,
  updateTransaction,
  type TransactionFilters,
  type TransactionInput,
} from '../api/transactions'
import { importMmbak } from '../api/imports'
import { queryKeys } from './queryKeys'

export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: [...queryKeys.transactions, filters],
    queryFn: () => listTransactions(filters),
  })
}

export const TRANSACTIONS_PAGE_SIZE = 50

/** The Overview list: loads 50 at a time, `fetchNextPage` for more. */
export function useTransactionPages(filters: TransactionFilters) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.transactions, 'pages', filters],
    queryFn: ({ pageParam }) => listTransactionsPage(filters, TRANSACTIONS_PAGE_SIZE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0)
      return loaded < last.total && last.items.length > 0 ? loaded : undefined
    },
  })
}

function useInvalidateAfterTransactionChange() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.transactions })
    qc.invalidateQueries({ queryKey: queryKeys.tags })
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
      qc.invalidateQueries({ queryKey: queryKeys.accounts })
    },
  })
}

export function useImportMmbak() {
  const invalidate = useInvalidateAfterTransactionChange()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, useCurrency }: { file: File; useCurrency: boolean }) => importMmbak(file, useCurrency),
    onSuccess: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: queryKeys.categories })
      qc.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}
