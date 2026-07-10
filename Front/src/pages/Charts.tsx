import { useMemo } from 'react'
import { CategoryDonut } from '../components/charts/CategoryDonut'
import { CategoryRanking } from '../components/charts/CategoryRanking'
import { CumulativeLineChart } from '../components/charts/CumulativeLineChart'
import { MonthCalendar } from '../components/charts/MonthCalendar'
import { TrendBars } from '../components/charts/TrendBars'
import { usePeriod, usePeriodParams } from '../context/PeriodContext'
import { useTransactions } from '../hooks/useTransactions'
import { useSettings } from '../hooks/useSettings'
import {
  useCategoryBreakdown,
  useCumulativeBalance,
  useSummary,
  useTrend,
} from '../hooks/useStats'
import { formatMoney } from '../lib/money'
import '../components/charts/charts.css'

export function Charts() {
  const params = usePeriodParams()
  const { period, year, month } = usePeriod()
  const { data: settings } = useSettings()

  const currency = settings?.currency_symbol ?? '$'
  const showCents = settings?.show_cents ?? true

  const { data: summary } = useSummary(params)
  const { data: trend } = useTrend(6, year, month + 1)
  const { data: breakdown } = useCategoryBreakdown(params)
  const { data: cumulative } = useCumulativeBalance()
  const { data: expenseTxns } = useTransactions({ ...params, type: 'expense' })

  const expense = summary?.expense ?? 0
  const savingsRate = summary?.savings_rate ?? 0

  const statStrip = useMemo(() => {
    const list = breakdown ?? []
    const topCat = list[0]

    // days used to average daily spend, matching the prototype
    const daysInMonth = new Date(params.year, params.month, 0).getDate()
    const divDays = period === 'monthly' ? daysInMonth : period === 'range' ? 90 : 30

    const largest = (expenseTxns ?? []).reduce(
      (mx, t) => (t.amount > (mx?.amount ?? 0) ? t : mx),
      null as { amount: number; description: string } | null,
    )

    return [
      {
        label: 'Savings rate',
        value: `${savingsRate}%`,
        sub: 'of income kept',
        color: savingsRate >= 0 ? 'var(--up)' : 'var(--down)',
      },
      {
        label: 'Top category',
        value: topCat?.name ?? '—',
        sub: topCat ? formatMoney(topCat.amount, currency, showCents) : 'no expenses',
        color: 'var(--yellow)',
      },
      {
        label: 'Avg / day',
        value: formatMoney(expense / divDays, currency, showCents),
        sub: 'spending',
        color: 'var(--body)',
      },
      {
        label: 'Largest expense',
        value: largest ? formatMoney(largest.amount, currency, showCents) : '—',
        sub: largest ? largest.description : 'no expenses',
        color: 'var(--down)',
      },
    ]
  }, [breakdown, expenseTxns, savingsRate, expense, period, params.year, params.month, currency, showCents])

  return (
    <div className="charts-page">
      <div className="stat-strip">
        {statStrip.map((st, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-label">{st.label}</div>
            <div className="stat-value" style={{ color: st.color }}>
              {st.value}
            </div>
            <div className="stat-sub">{st.sub}</div>
          </div>
        ))}
      </div>

      <MonthCalendar currency={currency} showCents={showCents} />

      <div className="charts-row">
        <TrendBars trend={trend ?? []} />
        <CategoryDonut breakdown={breakdown ?? []} currency={currency} showCents={showCents} />
      </div>

      <CumulativeLineChart series={cumulative ?? []} currency={currency} showCents={showCents} />

      <CategoryRanking breakdown={breakdown ?? []} currency={currency} showCents={showCents} />
    </div>
  )
}
