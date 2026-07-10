import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSettings, updateSettings } from '../api/settings'
import type { Settings } from '../api/types'

const KEY = ['settings']

export function useSettings() {
  return useQuery({ queryKey: KEY, queryFn: getSettings })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<Settings>) => updateSettings(patch),
    onSuccess: (data) => {
      qc.setQueryData(KEY, data)
    },
  })
}
