import { apiClient } from './client'
import type { Tag } from './types'

export async function listTags(): Promise<Tag[]> {
  const res = await apiClient.get('/tags')
  return res.data
}

export async function deleteTag(id: number): Promise<void> {
  await apiClient.delete(`/tags/${id}`)
}
