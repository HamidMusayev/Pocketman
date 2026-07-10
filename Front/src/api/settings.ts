import { apiClient } from './client'
import type { Settings } from './types'

export async function getSettings(): Promise<Settings> {
  const res = await apiClient.get('/settings')
  return res.data
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const res = await apiClient.put('/settings', patch)
  return res.data
}
