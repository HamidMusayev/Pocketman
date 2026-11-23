import { apiClient } from './client'
import type { ImportResult, PeriodParams, Transaction, TransactionPage, TransactionType } from './types'

export interface TransactionFilters extends PeriodParams {
  search?: string
  category_id?: number
  account_id?: number
  type?: TransactionType
  tag?: string
}

export async function listTransactions(filters: TransactionFilters): Promise<Transaction[]> {
  const res = await apiClient.get('/transactions', { params: filters })
  return res.data
}

/** One page, newest first, plus how many rows match in total. */
export async function listTransactionsPage(
  filters: TransactionFilters,
  limit: number,
  offset: number,
): Promise<TransactionPage> {
  const res = await apiClient.get('/transactions', { params: { ...filters, limit, offset } })
  const header = Number(res.headers['x-total-count'])
  const items: Transaction[] = res.data
  return { items, total: Number.isFinite(header) ? header : offset + items.length }
}

export interface TransactionInput {
  type: TransactionType
  amount: number
  description: string
  category_id?: number | null
  account_id: number
  transfer_account_id?: number | null
  date: string
  note?: string | null
  tags?: string[]
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  const res = await apiClient.post('/transactions', input)
  return res.data
}

export async function updateTransaction(
  id: number,
  patch: Partial<TransactionInput>,
): Promise<Transaction> {
  const res = await apiClient.put(`/transactions/${id}`, patch)
  return res.data
}

export async function deleteTransaction(id: number): Promise<void> {
  await apiClient.delete(`/transactions/${id}`)
}

export async function exportTransactionsCsv(filters: TransactionFilters): Promise<Blob> {
  const res = await apiClient.get('/transactions/export', { params: filters, responseType: 'blob' })
  return res.data
}

export async function importTransactionsCsv(file: File): Promise<ImportResult> {
  const form = new FormData()
  form.append('file', file)
  const res = await apiClient.post('/transactions/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export function downloadCsvBlob(blob: Blob, filename = 'pocketman-transactions.csv') {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
