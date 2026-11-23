import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createAccount, deleteAccount, listAccounts, updateAccount, type AccountInput } from '../api/accounts'
import { queryKeys } from './queryKeys'

const KEY = ['accounts']
// balances feed net worth and the cumulative-balance chart
const STATS = ['stats']

export function useAccounts() {
  return useQuery({ queryKey: KEY, queryFn: listAccounts })
}

export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AccountInput) => createAccount(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: STATS })
      qc.invalidateQueries({ queryKey: queryKeys.planned })
    },
  })
}

export function useUpdateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<AccountInput> }) => updateAccount(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: STATS })
      qc.invalidateQueries({ queryKey: queryKeys.planned })
    },
  })
}

export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, moveTo }: { id: number; moveTo?: number }) => deleteAccount(id, moveTo),
    // history may have moved to another account: balances, lists and stats all change
    onSuccess: () => qc.invalidateQueries(),
  })
}
