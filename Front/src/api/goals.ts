import { apiClient } from './client'
import type { Goal } from './types'

export interface GoalInput {
  name: string
  target_amount: number
  saved_amount?: number
  target_date?: string | null
  icon?: string
}

export async function listGoals(): Promise<Goal[]> {
  const res = await apiClient.get('/goals')
  return res.data
}

export async function createGoal(input: GoalInput): Promise<Goal> {
  const res = await apiClient.post('/goals', input)
  return res.data
}

export async function updateGoal(id: number, patch: Partial<GoalInput>): Promise<Goal> {
  const res = await apiClient.put(`/goals/${id}`, patch)
  return res.data
}

/** Positive adds to the goal, negative takes money out. */
export async function contributeToGoal(id: number, amount: number): Promise<Goal> {
  const res = await apiClient.post(`/goals/${id}/contribute`, { amount })
  return res.data
}

export async function deleteGoal(id: number): Promise<void> {
  await apiClient.delete(`/goals/${id}`)
}
