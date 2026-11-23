import { useMemo, useState } from 'react'
import type { TransactionFilters } from '../api/transactions'
import type { Transaction, TransactionType } from '../api/types'
import { AddTransactionModal } from '../components/AddTransactionModal'
import { BudgetAlerts } from '../components/BudgetAlerts'
import { CategoryIcon } from '../components/CategoryIcon'
import { PendingPanel } from '../components/PendingPanel'
import { PeriodPicker } from '../components/PeriodPicker'
import { TransactionEditModal } from '../components/TransactionEditModal'
import { usePeriod, usePeriodParams } from '../context/PeriodContext'
import { useAccounts } from '../hooks/useAccounts'
import { useCategories } from '../hooks/useCategories'
import { useCategoryIconById } from '../hooks/useCategoryIcons'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useSettings } from '../hooks/useSettings'
import { useCategoryBreakdown, useSummary } from '../hooks/useStats'
import { useTags } from '../hooks/useTags'
import { useTransactionPages } from '../hooks/useTransactions'
import { RAMP } from '../lib/colorRamp'
import { defaultEntryDate, formatDayShort, formatWeekday } from '../lib/dates'
import { formatMoney, formatSignedMoney, formatTransactionAmount, sumMoney } from '../lib/money'
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
  }
  for (const g of groups) {
    // summed in cents so a day of 0.10s and 0.20s doesn't show 0.30000000004
    g.net = sumMoney(
      g.items.map((t) => (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0)),
    )
  }
  return groups
}

const PlusIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
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
  const { data: breakdown } = useCategoryBreakdown(params)
  const topSpending = (breakdown ?? []).slice(0, 5)
  const iconById = useCategoryIconById()

  const currency = settings?.currency_symbol ?? '$'
  const showCents = settings?.show_cents ?? true

  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filterCat, setFilterCat] = useState<string>('all')
  const [filterAcc, setFilterAcc] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterTag, setFilterTag] = useState<string>('all')
  const { data: tags } = useTags()
  // one request once typing pauses, not one per keystroke
  const debouncedSearch = useDebouncedValue(search.trim(), 300)

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)

  const activeFilters = [filterCat, filterAcc, filterType, filterTag].filter((f) => f !== 'all').length

  const filters: TransactionFilters = {
    ...params,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(filterCat !== 'all' ? { category_id: Number(filterCat) } : {}),
    ...(filterAcc !== 'all' ? { account_id: Number(filterAcc) } : {}),
    ...(filterType !== 'all' ? { type: filterType as TransactionType } : {}),
    ...(filterTag !== 'all' ? { tag: filterTag } : {}),
  }
  const pages = useTransactionPages(filters)

  const list = useMemo(() => (pages.data?.pages ?? []).flatMap((p) => p.items), [pages.data])
  const total = pages.data?.pages[0]?.total ?? 0
  const days = useMemo(() => groupByDay(list), [list])

  const income = summary?.income ?? 0
  const expense = summary?.expense ?? 0
  const savingsRate = summary?.savings_rate ?? 0

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Overview</h1>
        <div className="page-head-actions">
          <PeriodPicker />
        </div>
      </div>

      <div className="split">
      <aside className="split-side">
      {/* wide screens: the main action sits right at the top of the side column */}
      <button className="add-btn-side" onClick={() => setAdding(true)}>
        <PlusIcon size={20} /> Add transaction
      </button>

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

      <BudgetAlerts currency={currency} showCents={showCents} />

      {/* wide screens: where the money went, so the side column isn't empty */}
      {topSpending.length > 0 && (
        <section className="side-card top-spending" aria-label="Top spending">
          <div className="side-card-title">Top spending</div>
          {topSpending.map((c, i) => (
            <div className="ts-row" key={c.category_id}>
              <div className="ts-line">
                <span className="ts-name">
                  <span className="ts-dot" style={{ background: RAMP[i % RAMP.length] }} />
                  {c.name}
                </span>
                <span className="ts-amt">{formatMoney(c.amount, currency, showCents)} <em>{c.pct}%</em></span>
              </div>
              <div className="ts-bar">
                <span style={{ width: `${Math.max(3, (c.amount / topSpending[0].amount) * 100)}%`, background: RAMP[i % RAMP.length] }} />
              </div>
            </div>
          ))}
        </section>
      )}
      </aside>

      <div className="split-main">
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
          {(tags ?? []).length > 0 && (
            <select className="txn-filter" aria-label="Filter by tag" value={filterTag} onChange={(e) => setFilterTag(e.target.value)}>
              <option value="all">All tags</option>
              {(tags ?? []).map((t) => (
                <option key={t.id} value={t.name}>
                  #{t.name}
                </option>
              ))}
            </select>
          )}
          {activeFilters > 0 && (
            <button
              className="pm-btn pm-btn-ghost-elev"
              onClick={() => {
                setFilterCat('all')
                setFilterAcc('all')
                setFilterType('all')
                setFilterTag('all')
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
                      {t.note && (
                        <span className="txn-note-mark" title={t.note} aria-label="Has a note">
                          {' '}· ✎
                        </span>
                      )}
                    </span>
                    {(t.tags ?? []).length > 0 && (
                      <span className="txn-tags">
                        {t.tags.map((tag) => (
                          <span className="tag-chip" key={tag}>
                            #{tag}
                          </span>
                        ))}
                      </span>
                    )}
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
        {pages.hasNextPage && (
          <button
            className="pm-btn pm-btn-ghost load-more"
            onClick={() => pages.fetchNextPage()}
            disabled={pages.isFetchingNextPage}
          >
            {pages.isFetchingNextPage ? 'Loading…' : `Show more (${total - list.length} left)`}
          </button>
        )}
        {list.length === 0 && !pages.isLoading && (
          <div className="pm-empty">
            {search || activeFilters ? 'Nothing matches this search.' : 'No transactions yet. Use + to add your first one.'}
          </div>
        )}
      </div>
      </div>
      </div>

      {/* phones/tablets: a big floating add button above the bottom nav */}
      <button className="fab" onClick={() => setAdding(true)} title="Add transaction">
        <PlusIcon size={22} />
        <span>Add</span>
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
