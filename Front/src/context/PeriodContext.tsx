import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Period } from '../api/types'

interface PeriodState {
  period: Period
  year: number
  month: number // 0-indexed, matches JS Date convention
}

interface PeriodContextValue extends PeriodState {
  setPeriod: (p: Period) => void
  prevMonth: () => void
  nextMonth: () => void
  monthLabel: string
  periodName: string
}

const PeriodContext = createContext<PeriodContextValue | null>(null)

export function PeriodProvider({ children }: { children: ReactNode }) {
  const now = new Date()
  const [state, setState] = useState<PeriodState>({
    period: 'monthly',
    year: now.getFullYear(),
    month: now.getMonth(),
  })

  const setPeriod = (period: Period) => setState((s) => ({ ...s, period }))

  const prevMonth = () =>
    setState((s) => {
      let { year, month } = s
      month -= 1
      if (month < 0) {
        month = 11
        year -= 1
      }
      return { ...s, year, month }
    })

  const nextMonth = () =>
    setState((s) => {
      let { year, month } = s
      month += 1
      if (month > 11) {
        month = 0
        year += 1
      }
      return { ...s, year, month }
    })

  const monthLabel = useMemo(
    () => new Date(state.year, state.month, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    [state.year, state.month],
  )

  const periodName =
    state.period === 'all' ? 'All time' : state.period === 'range' ? 'Last 90 days' : monthLabel

  return (
    <PeriodContext.Provider value={{ ...state, setPeriod, prevMonth, nextMonth, monthLabel, periodName }}>
      {children}
    </PeriodContext.Provider>
  )
}

export function usePeriod(): PeriodContextValue {
  const ctx = useContext(PeriodContext)
  if (!ctx) throw new Error('usePeriod must be used within a PeriodProvider')
  return ctx
}

/** Convert the current period selection into the {period, year, month} query
 * params every list/stat endpoint accepts (month is converted to 1-indexed). */
export function usePeriodParams() {
  const { period, year, month } = usePeriod()
  return { period, year, month: month + 1 }
}
