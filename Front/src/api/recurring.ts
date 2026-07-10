import { apiClient } from './client'
import type { CatchUpResult, Frequency, PendingApproval, RecurringRule, TxnType } from './types'

export async function listRecurring(): Promise<RecurringRule[]> {
  const res = await apiClient.get('/recurring')
  return res.data
}

export interface RecurringInput {
  description: string
  amount: number
  category_id: number
  account_id: number
  type: TxnType
  frequency: Frequency
  start_date?: string
}

export async function createRecurring(input: RecurringInput): Promise<RecurringRule> {
  const res = await apiClient.post('/recurring', input)
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
