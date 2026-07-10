import { useQuery } from '@tanstack/react-query'
import {
  getCategoryBreakdown,
  getCumulativeBalance,
  getNetWorth,
  getSummary,
  getTopCategories,
  getTrend,
} from '../api/stats'
import type { PeriodParams } from '../api/types'
import { queryKeys } from './queryKeys'

export function useSummary(params: PeriodParams) {
  return useQuery({ queryKey: [...queryKeys.stats, 'summary', params], queryFn: () => getSummary(params) })
}

export function useTrend(months: number, year: number, month: number) {
  return useQuery({
    queryKey: [...queryKeys.stats, 'trend', months, year, month],
    queryFn: () => getTrend(months, year, month),
  })
}

export function useCategoryBreakdown(params: PeriodParams) {
  return useQuery({
    queryKey: [...queryKeys.stats, 'category-breakdown', params],
    queryFn: () => getCategoryBreakdown({ ...params, type: 'expense' }),
  })
}

export function useCumulativeBalance() {
  return useQuery({ queryKey: [...queryKeys.stats, 'cumulative-balance'], queryFn: getCumulativeBalance })
}

export function useTopCategories(params: PeriodParams, limit = 7) {
  return useQuery({
    queryKey: [...queryKeys.stats, 'top-categories', params, limit],
    queryFn: () => getTopCategories({ ...params, limit }),
  })
}

export function useNetWorth() {
  return useQuery({ queryKey: [...queryKeys.stats, 'net-worth'], queryFn: getNetWorth })
}
