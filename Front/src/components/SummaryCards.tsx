import type { ReactNode } from 'react'
import { usePeriod, usePeriodParams } from '../context/PeriodContext'
import { useSettings } from '../hooks/useSettings'
import { useSummary } from '../hooks/useStats'
import { formatSignedMoney } from '../lib/money'
import './shell.css'

function ArrowUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19V5m0 0-6 6m6-6 6 6" />
    </svg>
  )
}

function ArrowDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14m0 0 6-6m-6 6-6-6" />
    </svg>
  )
}

function TrendUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  )
}

function Contactless() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M5.5 9.5a4 4 0 0 1 0 5" />
      <path d="M9.5 6.5a8 8 0 0 1 0 11" />
      <path d="M13.5 4a12 12 0 0 1 0 16" />
    </svg>
  )
}

function StatRow({
  icon,
  tone,
  label,
  value,
  color,
}: {
  icon: ReactNode
  tone: string
  label: string
  value: string
  color: string
}) {
  return (
    <div className="sum-row">
      <span className={'sum-icon ' + tone}>{icon}</span>
      <span className="sum-label">{label}</span>
      <span className="sum-value" style={{ color }}>
        {value}
      </span>
    </div>
  )
}

export function SummaryCards() {
  const params = usePeriodParams()
  const { periodName } = usePeriod()
  const { data: settings } = useSettings()
  const { data: summary } = useSummary(params)

  const currency = settings?.currency_symbol ?? '$'
  const showCents = settings?.show_cents ?? true

  const income = summary?.income ?? 0
  const expense = summary?.expense ?? 0
  const balance = summary?.balance ?? 0
  const savingsRate = summary?.savings_rate ?? 0

  return (
    <div className="summary-grid">
      <div className="balance-card">
        <span className="balance-card-glow" aria-hidden="true" />
        <div className="balance-card-top">
          <div className="balance-card-brand">
            <span className="balance-card-chip">P</span>
            Pocketman
          </div>
          <span className="balance-card-wave">
            <Contactless />
          </span>
        </div>
        <div>
          <div className="balance-card-label">Net balance · {periodName}</div>
          <div className="balance-card-value">{formatSignedMoney(balance, currency, showCents)}</div>
        </div>
      </div>

      <div className="sum-stack">
        <StatRow
          icon={<ArrowUp />}
          tone="up"
          label="Income"
          value={formatSignedMoney(income, currency, showCents)}
          color="var(--up)"
        />
        <StatRow
          icon={<ArrowDown />}
          tone="down"
          label="Expenses"
          value={formatSignedMoney(expense, currency, showCents)}
          color="var(--down)"
        />
        <StatRow
          icon={<TrendUp />}
          tone="accent"
          label="Savings rate"
          value={`${savingsRate}%`}
          color={savingsRate >= 0 ? 'var(--up)' : 'var(--down)'}
        />
      </div>
    </div>
  )
}
