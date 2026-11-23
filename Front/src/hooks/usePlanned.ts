import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  confirmPlanned,
  createPlanned,
  deletePlanned,
  getForecast,
  listPlanned,
  postponePlanned,
  updatePlanned,
} from '../api/planned'
import type { TransactionInput } from '../api/transactions'
import { queryKeys } from './queryKeys'

export function usePlanned() {
  return useQuery({ queryKey: queryKeys.planned, queryFn: listPlanned })
}

export function useForecast() {
  return useQuery({ queryKey: [...queryKeys.planned, 'forecast'], queryFn: getForecast })
}

function useInvalidatePlanned() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.planned })
    qc.invalidateQueries({ queryKey: queryKeys.pending })
  }
}

/** Confirming posts a real transaction, so every money view refreshes. */
function useInvalidateEverything() {
  const qc = useQueryClient()
  const planned = useInvalidatePlanned()
  return () => {
    planned()
    qc.invalidateQueries({ queryKey: queryKeys.transactions })
    qc.invalidateQueries({ queryKey: queryKeys.accounts })
    qc.invalidateQueries({ queryKey: queryKeys.budgetSummary })
    qc.invalidateQueries({ queryKey: queryKeys.stats })
    qc.invalidateQueries({ queryKey: queryKeys.tags })
  }
}

export function useCreatePlanned() {
  const invalidate = useInvalidatePlanned()
  return useMutation({ mutationFn: (input: TransactionInput) => createPlanned(input), onSuccess: invalidate })
}

export function useUpdatePlanned() {
  const invalidate = useInvalidatePlanned()
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<TransactionInput> }) => updatePlanned(id, patch),
    onSuccess: invalidate,
  })
}

export function useConfirmPlanned() {
  const invalidate = useInvalidateEverything()
  return useMutation({
    mutationFn: ({ id, amount, date }: { id: number; amount?: number; date?: string }) =>
      confirmPlanned(id, { amount, date }),
    onSuccess: invalidate,
  })
}

export function usePostponePlanned() {
  const invalidate = useInvalidatePlanned()
  return useMutation({
    mutationFn: ({ id, date }: { id: number; date: string }) => postponePlanned(id, date),
    onSuccess: invalidate,
  })
}

export function useDeletePlanned() {
  const invalidate = useInvalidatePlanned()
  return useMutation({ mutationFn: (id: number) => deletePlanned(id), onSuccess: invalidate })
}
