import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { contributeToGoal, createGoal, deleteGoal, listGoals, updateGoal, type GoalInput } from '../api/goals'
import { queryKeys } from './queryKeys'

export function useGoals() {
  return useQuery({ queryKey: queryKeys.goals, queryFn: listGoals })
}

function useInvalidateGoals() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: queryKeys.goals })
}

export function useCreateGoal() {
  const onSuccess = useInvalidateGoals()
  return useMutation({ mutationFn: (input: GoalInput) => createGoal(input), onSuccess })
}

export function useUpdateGoal() {
  const onSuccess = useInvalidateGoals()
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<GoalInput> }) => updateGoal(id, patch),
    onSuccess,
  })
}

export function useContributeToGoal() {
  const onSuccess = useInvalidateGoals()
  return useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) => contributeToGoal(id, amount),
    onSuccess,
  })
}

export function useDeleteGoal() {
  const onSuccess = useInvalidateGoals()
  return useMutation({ mutationFn: (id: number) => deleteGoal(id), onSuccess })
}
