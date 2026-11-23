import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createAccount, deleteAccount, listAccounts, updateAccount, type AccountInput } from '../api/accounts'

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
    },
  })
}

export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteAccount(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
