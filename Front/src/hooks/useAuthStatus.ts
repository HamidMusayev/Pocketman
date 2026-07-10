import { useQuery } from '@tanstack/react-query'
import { getAuthStatus } from '../api/auth'

export function useAuthStatus() {
  return useQuery({
    queryKey: ['auth-status'],
    queryFn: getAuthStatus,
    staleTime: 0,
    retry: false,
  })
}
