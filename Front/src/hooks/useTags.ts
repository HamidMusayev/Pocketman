import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteTag, listTags } from '../api/tags'
import { queryKeys } from './queryKeys'

export function useTags() {
  return useQuery({ queryKey: queryKeys.tags, queryFn: listTags })
}

export function useDeleteTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteTag(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tags })
      qc.invalidateQueries({ queryKey: queryKeys.transactions })
    },
  })
}
