import { apiClient } from './client'
import type {
  CategoryBreakdownItem,
  CumulativePoint,
  PeriodParams,
  Summary,
  TrendPoint,
  TxnType,
} from './types'

export async function getSummary(params: PeriodParams): Promise<Summary> {
  const res = await apiClient.get('/stats/summary', { params })
  return res.data
}

export async function getTrend(months: number, year: number, month: number): Promise<TrendPoint[]> {
  const res = await apiClient.get('/stats/trend', { params: { months, year, month } })
  return res.data
}

export async function getCategoryBreakdown(
  params: PeriodParams & { type?: TxnType },
): Promise<CategoryBreakdownItem[]> {
  const res = await apiClient.get('/stats/category-breakdown', { params })
  return res.data
}

export async function getCumulativeBalance(): Promise<CumulativePoint[]> {
  const res = await apiClient.get('/stats/cumulative-balance')
  return res.data
}
