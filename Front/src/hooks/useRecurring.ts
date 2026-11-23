import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  approvePending,
  catchUp,
  createRecurring,
  deleteRecurring,
  dismissPending,
  listPending,
  listRecurring,
  updateRecurring,
  type RecurringInput,
  type RecurringPatch,
} from '../api/recurring'
import { queryKeys } from './queryKeys'

export function useRecurringRules() {
  return useQuery({ queryKey: queryKeys.recurring, queryFn: listRecurring })
}

export function usePending() {
  return useQuery({ queryKey: queryKeys.pending, queryFn: listPending })
}

export function useCreateRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RecurringInput) => createRecurring(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.recurring }),
  })
}

export function useUpdateRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: RecurringPatch }) => updateRecurring(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.recurring }),
  })
}

export function useDeleteRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteRecurring(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.recurring }),
  })
}

export function useCatchUp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: catchUp,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: queryKeys.pending })
      qc.invalidateQueries({ queryKey: queryKeys.recurring })
      if (result.posted > 0) {
        // auto-approve rules just added real transactions
        qc.invalidateQueries({ queryKey: queryKeys.transactions })
        qc.invalidateQueries({ queryKey: queryKeys.accounts })
        qc.invalidateQueries({ queryKey: queryKeys.budgetSummary })
        qc.invalidateQueries({ queryKey: queryKeys.stats })
      }
    },
  })
}

function useInvalidateAfterApprovalChange() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.pending })
    qc.invalidateQueries({ queryKey: queryKeys.transactions })
    qc.invalidateQueries({ queryKey: queryKeys.accounts })
    qc.invalidateQueries({ queryKey: queryKeys.budgetSummary })
    qc.invalidateQueries({ queryKey: queryKeys.stats })
  }
}

export function useApprovePending() {
  const invalidate = useInvalidateAfterApprovalChange()
  return useMutation({
    mutationFn: (id: number) => approvePending(id),
    onSuccess: invalidate,
  })
}

export function useDismissPending() {
  const invalidate = useInvalidateAfterApprovalChange()
  return useMutation({
    mutationFn: (id: number) => dismissPending(id),
    onSuccess: invalidate,
  })
}
