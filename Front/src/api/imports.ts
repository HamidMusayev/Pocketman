import { apiClient } from './client'
import type { MmbakPreview, MmbakResult } from './types'

/** Largest Money Manager backup the server accepts (mirrors MMBAK_MAX_UPLOAD_BYTES). */
export const MMBAK_MAX_BYTES = 20 * 1024 * 1024

function form(file: File, extra: Record<string, string> = {}) {
  const f = new FormData()
  f.append('file', file)
  for (const [k, v] of Object.entries(extra)) f.append(k, v)
  return f
}

export async function previewMmbak(file: File): Promise<MmbakPreview> {
  const res = await apiClient.post('/import/mmbak/preview', form(file), {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export async function importMmbak(file: File, useCurrency: boolean): Promise<MmbakResult> {
  const res = await apiClient.post('/import/mmbak', form(file, { use_currency: String(useCurrency) }), {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}
