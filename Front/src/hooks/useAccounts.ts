import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createAccount, deleteAccount, listAccounts, updateAccount, type AccountInput } from '../api/accounts'

const KEY = ['accounts']

export function useAccounts() {
  return useQuery({ queryKey: KEY, queryFn: listAccounts })
}

export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AccountInput) => createAccount(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<AccountInput> }) => updateAccount(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteAccount(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
