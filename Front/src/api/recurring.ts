import { apiClient } from './client'
import type { CatchUpResult, Frequency, PendingApproval, RecurringRule, TransactionType } from './types'

export async function listRecurring(): Promise<RecurringRule[]> {
  const res = await apiClient.get('/recurring')
  return res.data
}

export interface RecurringInput {
  description: string
  amount: number
  category_id?: number | null
  account_id: number
  transfer_account_id?: number | null
  type: TransactionType
  frequency: Frequency
  auto_approve?: boolean
  start_date?: string
}

export type RecurringPatch = Partial<Omit<RecurringInput, 'start_date'>> & { next_due_date?: string }

export async function createRecurring(input: RecurringInput): Promise<RecurringRule> {
  const res = await apiClient.post('/recurring', input)
  return res.data
}

export async function updateRecurring(id: number, patch: RecurringPatch): Promise<RecurringRule> {
  const res = await apiClient.put(`/recurring/${id}`, patch)
  return res.data
}

export async function deleteRecurring(id: number): Promise<void> {
  await apiClient.delete(`/recurring/${id}`)
}

export async function catchUp(): Promise<CatchUpResult> {
  const res = await apiClient.post('/recurring/catch-up')
  return res.data
}

export async function listPending(): Promise<PendingApproval[]> {
  const res = await apiClient.get('/recurring/pending')
  return res.data
}

export async function approvePending(id: number): Promise<{ id: number }> {
  const res = await apiClient.post(`/recurring/pending/${id}/approve`)
  return res.data
}

export async function dismissPending(id: number): Promise<void> {
  await apiClient.delete(`/recurring/pending/${id}`)
}
