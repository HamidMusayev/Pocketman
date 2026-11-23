import { apiClient } from './client'
import type { Forecast, PlannedItem } from './types'
import type { TransactionInput } from './transactions'

export async function listPlanned(): Promise<PlannedItem[]> {
  const res = await apiClient.get('/planned')
  return res.data
}

export async function getForecast(): Promise<Forecast> {
  const res = await apiClient.get('/planned/forecast')
  return res.data
}

/** Same fields as a transaction; `date` is when it's expected. */
export async function createPlanned(input: TransactionInput): Promise<PlannedItem> {
  const res = await apiClient.post('/planned', input)
  return res.data
}

export async function updatePlanned(id: number, patch: Partial<TransactionInput>): Promise<PlannedItem> {
  const res = await apiClient.put(`/planned/${id}`, patch)
  return res.data
}

/** "Yes, it happened" — optionally with the real amount / date. */
export async function confirmPlanned(id: number, body: { amount?: number; date?: string } = {}): Promise<{ id: number }> {
  const res = await apiClient.post(`/planned/${id}/confirm`, body)
  return res.data
}

export async function postponePlanned(id: number, date: string): Promise<PlannedItem> {
  const res = await apiClient.post(`/planned/${id}/postpone`, { date })
  return res.data
}

export async function deletePlanned(id: number): Promise<void> {
  await apiClient.delete(`/planned/${id}`)
}
