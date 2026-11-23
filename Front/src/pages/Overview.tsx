import { useMemo, useState } from 'react'
import type { TransactionFilters } from '../api/transactions'
import type { Transaction, TransactionType } from '../api/types'
import { AddTransactionModal } from '../components/AddTransactionModal'
import { CategoryIcon } from '../components/CategoryIcon'
import { PendingPanel } from '../components/PendingPanel'
import { PeriodPicker } from '../components/PeriodPicker'
import { TransactionEditModal } from '../components/TransactionEditModal'
import { usePeriod, usePeriodParams } from '../context/PeriodContext'
import { useAccounts } from '../hooks/useAccounts'
import { useCategories } from '../hooks/useCategories'
import { useCategoryIconById } from '../hooks/useCategoryIcons'
import { useSettings } from '../hooks/useSettings'
import { useSummary } from '../hooks/useStats'
import { useTransactions } from '../hooks/useTransactions'
import { defaultEntryDate, formatDayShort, formatWeekday } from '../lib/dates'
import { formatMoney, formatSignedMoney, formatTransactionAmount } from '../lib/money'
import './pages.css'

/** One calendar day's worth of rows, plus that day's net (transfers move money
 * between accounts, so they don't count toward it). */
interface DayGroup {
  date: string
  items: Transaction[]
  net: number
}

function groupByDay(list: Transaction[]): DayGroup[] {
  const groups: DayGroup[] = []
  const byDate = new Map<string, DayGroup>()
  for (const t of list) {
    let group = byDate.get(t.date)
    if (!group) {
      group = { date: t.date, items: [], net: 0 }
      byDate.set(t.date, group)
      groups.push(group)
    }
    group.items.push(t)
    if (t.type === 'income') group.net += t.amount
    else if (t.type === 'expense') group.net -= t.amount
  }
  return groups
}

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export function Overview() {
  const params = usePeriodParams()
  const { periodName } = usePeriod()
  const { data: settings } = useSettings()
  const { data: categories } = useCategories()
  const { data: accounts } = useAccounts()
  const { data: summary } = useSummary(params)
  const iconById = useCategoryIconById()

  const currency = settings?.currency_symbol ?? '$'
  const showCents = settings?.show_cents ?? true

  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filterCat, setFilterCat] = useState<string>('all')
  const [filterAcc, setFilterAcc] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)

  const activeFilters = [filterCat, filterAcc, filterType].filter((f) => f !== 'all').length

  const filters: TransactionFilters = {
    ...params,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(filterCat !== 'all' ? { category_id: Number(filterCat) } : {}),
    ...(filterAcc !== 'all' ? { account_id: Number(filterAcc) } : {}),
    ...(filterType !== 'all' ? { type: filterType as TransactionType } : {}),
  }
  const { data: transactions } = useTransactions(filters)

  const list = transactions ?? []
  const days = useMemo(() => groupByDay(transactions ?? []), [transactions])

  const income = summary?.income ?? 0
  const expense = summary?.expense ?? 0
  const savingsRate = summary?.savings_rate ?? 0

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Overview</h1>
        <div className="page-head-actions">
          <PeriodPicker />
          <button className="pm-btn pm-btn-primary add-btn-desktop" onClick={() => setAdding(true)}>
            <PlusIcon /> Add
          </button>
        </div>
      </div>

      {/* ------------------------------ summary ------------------------------ */}
      <section className="summary" aria-label="Summary">
        <div>
          <div className="summary-label">Balance · {periodName}</div>
          <div className="summary-balance">{formatSignedMoney(summary?.balance ?? 0, currency, showCents)}</div>
        </div>
        <div className="summary-stats">
          <div>
            <div className="summary-label">Income</div>
            <div className="summary-stat-value" style={{ color: 'var(--up)' }}>
              {formatMoney(income, currency, showCents)}
            </div>
          </div>
          <div>
            <div className="summary-label">Expenses</div>
            <div className="summary-stat-value" style={{ color: 'var(--down)' }}>
              {formatMoney(expense, currency, showCents)}
            </div>
          </div>
          <div>
            <div className="summary-label">Saved</div>
            <div className="summary-stat-value">{savingsRate}%</div>
          </div>
        </div>
      </section>

      <PendingPanel currency={currency} showCents={showCents} />

      {/* -------------------------- search + filters ------------------------- */}
      <div className="ov-toolbar">
        <div className="ov-search-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            className="ov-search"
            type="search"
            placeholder="Search transactions"
            aria-label="Search transactions"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          className={'ov-tool-btn' + (showFilters || activeFilters ? ' active' : '')}
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          <span className="ov-tool-label">Filter</span>
          {activeFilters > 0 && <span className="ov-filter-count">{activeFilters}</span>}
        </button>
      </div>

      {showFilters && (
        <div className="txn-filters">
          <select className="txn-filter" aria-label="Filter by type" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
          </select>
          <select className="txn-filter" aria-label="Filter by category" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
            <option value="all">All categories</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className="txn-filter" aria-label="Filter by account" value={filterAcc} onChange={(e) => setFilterAcc(e.target.value)}>
            <option value="all">All accounts</option>
            {(accounts ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {activeFilters > 0 && (
            <button
              className="pm-btn pm-btn-ghost-elev"
              onClick={() => {
                setFilterCat('all')
                setFilterAcc('all')
                setFilterType('all')
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* ---------------------- transactions, by day ----------------------- */}
      <div className="txn-days">
        {days.map((day) => (
          <section className="txn-day" key={day.date}>
            <header className="day-head">
              <span className="day-head-date">{formatDayShort(day.date)}</span>
              <span className="day-head-sub">{formatWeekday(day.date)}</span>
              <span className="day-head-rule" />
              <span className={'day-head-net' + (day.net > 0 ? ' pos' : '')}>
                {day.net >= 0 ? '+' : '−'}
                {formatMoney(day.net, currency, showCents)}
              </span>
            </header>

            <div className="txn-group">
              {day.items.map((t) => (
                <button className="txn-row" key={t.id} onClick={() => setEditing(t)} aria-label={`Edit ${t.description}`}>
                  <span className="icon-badge">
                    <CategoryIcon iconKey={t.type === 'transfer' ? 'transfer' : iconById(t.category_id)} size={18} />
                  </span>
                  <span className="txn-main">
                    <span className="txn-desc">{t.description}</span>
                    <span className="txn-sub">
                      {t.type === 'transfer'
                        ? `${t.account_name} → ${t.transfer_account_name}`
                        : `${t.category_name} · ${t.account_name}`}
                    </span>
                  </span>
                  <span
                    className={'txn-amount' + (t.type === 'transfer' ? ' txn-transfer' : '')}
                    style={t.type === 'transfer' ? undefined : { color: t.type === 'income' ? 'var(--up)' : 'var(--down)' }}
                  >
                    {t.type === 'transfer'
                      ? `⇄ ${formatMoney(t.amount, currency, showCents)}`
                      : formatTransactionAmount(t.type, t.amount, currency, showCents)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
        {list.length === 0 && (
          <div className="pm-empty">
            {search || activeFilters ? 'Nothing matches this search.' : 'No transactions yet. Tap + to add one.'}
          </div>
        )}
      </div>

      {/* phones: a floating add button above the bottom nav */}
      <button className="fab" onClick={() => setAdding(true)} aria-label="Add transaction">
        <PlusIcon />
      </button>

      {adding && (
        <AddTransactionModal
          categories={categories ?? []}
          accounts={accounts ?? []}
          recent={list}
          currency={currency}
          defaultDate={defaultEntryDate(params.period, params.year, params.month)}
          onClose={() => setAdding(false)}
        />
      )}

      {editing && (
        <TransactionEditModal
          transaction={editing}
          categories={categories ?? []}
          accounts={accounts ?? []}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
