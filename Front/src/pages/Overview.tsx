import { useMemo, useRef, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { downloadCsvBlob, exportTransactionsCsv, type TransactionFilters } from '../api/transactions'
import type { ImportResult, Transaction, TransactionType } from '../api/types'
import { CategoryIcon } from '../components/CategoryIcon'
import { TransactionEditModal } from '../components/TransactionEditModal'
import { usePeriod, usePeriodParams } from '../context/PeriodContext'
import { useAccounts } from '../hooks/useAccounts'
import { useCategories } from '../hooks/useCategories'
import { useCategoryIconById } from '../hooks/useCategoryIcons'
import { useSettings } from '../hooks/useSettings'
import {
  useCreateTransaction,
  useDeleteTransaction,
  useImportTransactions,
  useTransactions,
} from '../hooks/useTransactions'
import { formatDayShort, formatWeekday, newTransactionDate } from '../lib/dates'
import { formatMoney, formatTransactionAmount } from '../lib/money'
import './pages.css'

const TYPES: { key: TransactionType; label: string }[] = [
  { key: 'expense', label: 'Expense' },
  { key: 'income', label: 'Income' },
  { key: 'transfer', label: 'Transfer' },
]

function TypeIcon({ type }: { type: TransactionType }) {
  if (type === 'transfer') return <CategoryIcon iconKey="transfer" size={14} strokeWidth={1.9} />
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {type === 'income' ? <path d="M12 19V5m0 0-6 6m6-6 6 6" /> : <path d="M12 5v14m0 0 6-6m-6 6-6-6" />}
    </svg>
  )
}

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

export function Overview() {
  const params = usePeriodParams()
  const { monthLabel } = usePeriod()
  const { data: settings } = useSettings()
  const { data: categories } = useCategories()
  const { data: accounts } = useAccounts()
  const iconById = useCategoryIconById()

  const currency = settings?.currency_symbol ?? '$'
  const showCents = settings?.show_cents ?? true

  const createTransaction = useCreateTransaction()
  const deleteTransaction = useDeleteTransaction()
  const importTransactions = useImportTransactions()

  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [desc, setDesc] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [accountId, setAccountId] = useState<number | null>(null)
  const [transferAccountId, setTransferAccountId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState<string>('all')
  const [filterAcc, setFilterAcc] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')

  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const isTransfer = type === 'transfer'

  const formCategories = useMemo(
    () => (categories ?? []).filter((c) => c.type === type),
    [categories, type],
  )

  const effectiveAccountId = accountId ?? accounts?.[0]?.id ?? null
  const effectiveTransferId =
    transferAccountId ?? accounts?.find((a) => a.id !== effectiveAccountId)?.id ?? null

  const filters: TransactionFilters = {
    ...params,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(filterCat !== 'all' ? { category_id: Number(filterCat) } : {}),
    ...(filterAcc !== 'all' ? { account_id: Number(filterAcc) } : {}),
    ...(filterType !== 'all' ? { type: filterType as TransactionType } : {}),
  }
  const { data: transactions } = useTransactions(filters)

  function onTypeChange(next: TransactionType) {
    setType(next)
    setCategoryId(null)
  }

  async function onAdd() {
    const amt = Number(amount)
    const date = newTransactionDate(params.period, params.year, params.month)
    try {
      if (isTransfer) {
        if (!amt || amt <= 0 || !effectiveAccountId || !effectiveTransferId) {
          setError('Enter an amount and pick both accounts.')
          return
        }
        if (effectiveAccountId === effectiveTransferId) {
          setError('Transfer accounts must be different.')
          return
        }
        setError(null)
        await createTransaction.mutateAsync({
          type: 'transfer',
          amount: amt,
          description: desc || 'Transfer',
          account_id: effectiveAccountId,
          transfer_account_id: effectiveTransferId,
          date,
        })
      } else {
        if (!amt || amt <= 0 || !categoryId || !effectiveAccountId) {
          setError('Enter an amount and pick a category.')
          return
        }
        setError(null)
        await createTransaction.mutateAsync({
          type,
          amount: amt,
          description: desc || formCategories.find((c) => c.id === categoryId)?.name || '',
          category_id: categoryId,
          account_id: effectiveAccountId,
          date,
        })
      }
      setAmount('')
      setDesc('')
      setCategoryId(null)
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not add transaction.'))
    }
  }

  async function onExport() {
    const blob = await exportTransactionsCsv(filters)
    downloadCsvBlob(blob)
  }

  async function onImportFile(file: File) {
    setError(null)
    try {
      const result = await importTransactions.mutateAsync(file)
      setImportResult(result)
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not import CSV.'))
    }
  }

  const list = transactions ?? []
  const days = useMemo(() => groupByDay(transactions ?? []), [transactions])

  return (
    <div>
      {/* ---------------------------- composer ---------------------------- */}
      <div className="composer">
        <div className="composer-main">
          <div className="composer-amount">
            <span className="composer-currency">{currency}</span>
            <input
              type="number"
              placeholder="0.00"
              aria-label="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onAdd()}
            />
          </div>

          <input
            className="composer-desc"
            type="text"
            aria-label="Description"
            placeholder={isTransfer ? 'Note (optional)' : "What's it for?"}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAdd()}
          />

          <span className="composer-note">Adding to {monthLabel}</span>

          <div className="composer-accounts">
            {isTransfer ? (
              <>
                <select
                  className="pm-select composer-select"
                  title="From account"
                  aria-label="From account"
                  value={effectiveAccountId ?? ''}
                  onChange={(e) => setAccountId(Number(e.target.value))}
                >
                  {(accounts ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      From: {a.name}
                    </option>
                  ))}
                </select>
                <span className="composer-xfer-arrow">→</span>
                <select
                  className="pm-select composer-select"
                  title="To account"
                  aria-label="To account"
                  value={effectiveTransferId ?? ''}
                  onChange={(e) => setTransferAccountId(Number(e.target.value))}
                >
                  {(accounts ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      To: {a.name}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <select
                className="pm-select composer-select"
                aria-label="Account"
                value={effectiveAccountId ?? ''}
                onChange={(e) => setAccountId(Number(e.target.value))}
              >
                {(accounts ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button className="composer-add" onClick={onAdd} disabled={createTransaction.isPending}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add
          </button>
        </div>

        <div className="composer-detail">
          <div className="composer-col composer-col-type">
            <div className="composer-legend">Type</div>
            <div className="composer-types">
              {TYPES.map((t) => (
                <button
                  key={t.key}
                  className={'type-btn ' + t.key + (type === t.key ? ' active' : '')}
                  aria-pressed={type === t.key}
                  onClick={() => onTypeChange(t.key)}
                >
                  <TypeIcon type={t.key} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="composer-col composer-col-cat">
            <div className="composer-legend">{isTransfer ? 'Accounts' : 'Category'}</div>
            {isTransfer ? (
              <p className="composer-hint">
                Transfers move money between your own accounts — pick the source and destination
                above. No category needed.
              </p>
            ) : (
              <div className="cat-chips">
                {formCategories.map((c) => (
                  <button
                    key={c.id}
                    className={'cat-chip' + (categoryId === c.id ? ' active' : '')}
                    aria-pressed={categoryId === c.id}
                    onClick={() => setCategoryId(c.id)}
                  >
                    <CategoryIcon iconKey={c.icon} size={15} strokeWidth={1.8} />
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="pm-inline-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* ------------------------ search + csv tools ----------------------- */}
      <div className="ov-toolbar">
        <div className="ov-search-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            className="ov-search"
            type="text"
            placeholder="Search description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="ov-tool-btn" onClick={onExport}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
          Export CSV
        </button>
        <button
          className="ov-tool-btn"
          onClick={() => fileInput.current?.click()}
          disabled={importTransactions.isPending}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 21V9m0 0 4 4m-4-4-4 4M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2" />
          </svg>
          {importTransactions.isPending ? 'Importing…' : 'Import CSV'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onImportFile(file)
            e.target.value = ''
          }}
        />
      </div>

      {importResult && (
        <div className="import-summary">
          Imported {importResult.created} transaction{importResult.created === 1 ? '' : 's'}
          {importResult.skipped > 0 && `, skipped ${importResult.skipped}`}.
          {importResult.errors.length > 0 && (
            <ul>
              {importResult.errors.slice(0, 8).map((e, i) => (
                <li key={i}>
                  Row {e.row}: {e.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* -------------------------- header + filters ----------------------- */}
      <div className="pm-section-head">
        <div className="pm-section-title">
          Transactions <span className="txn-count">· {list.length}</span>
        </div>
        <div className="txn-filters">
          <select
            className="txn-filter"
            aria-label="Filter by category"
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
          >
            <option value="all">All categories</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className="txn-filter"
            aria-label="Filter by account"
            value={filterAcc}
            onChange={(e) => setFilterAcc(e.target.value)}
          >
            <option value="all">All accounts</option>
            {(accounts ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select
            className="txn-filter"
            aria-label="Filter by type"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>
      </div>

      {/* ---------------------- transactions, by day ----------------------- */}
      <div className="txn-days">
        {days.map((day) => (
          <section className="txn-day" key={day.date}>
            <header className="day-head">
              <span className="day-head-date">{formatDayShort(day.date)}</span>
              <span className="day-head-sub">
                {formatWeekday(day.date)} · {day.items.length} item
                {day.items.length === 1 ? '' : 's'}
              </span>
              <span className="day-head-rule" />
              <span className={'day-head-net' + (day.net > 0 ? ' pos' : '')}>
                {day.net >= 0 ? '+' : '−'}
                {formatMoney(day.net, currency, showCents)}
              </span>
            </header>

            <div className="txn-group">
              {day.items.map((t) => (
                <div className="txn-row" key={t.id} onClick={() => setEditing(t)}>
                  <span className="icon-badge">
                    <CategoryIcon
                      iconKey={t.type === 'transfer' ? 'transfer' : iconById(t.category_id)}
                      size={18}
                    />
                  </span>
                  <div className="txn-main">
                    <div className="txn-desc">{t.description}</div>
                    <div className="txn-tags">
                      {t.type === 'transfer' ? (
                        <>
                          <span className="txn-tag">Transfer</span>
                          <span className="txn-account">
                            {t.account_name} → {t.transfer_account_name}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="txn-tag">{t.category_name}</span>
                          <span className="txn-account">{t.account_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div
                    className={'txn-amount' + (t.type === 'transfer' ? ' txn-transfer' : '')}
                    style={
                      t.type === 'transfer'
                        ? undefined
                        : { color: t.type === 'income' ? 'var(--up)' : 'var(--down)' }
                    }
                  >
                    {t.type === 'transfer'
                      ? `⇄ ${formatMoney(t.amount, currency, showCents)}`
                      : formatTransactionAmount(t.type, t.amount, currency, showCents)}
                  </div>
                  <button
                    className="row-edit-btn"
                    aria-label={`Edit ${t.description}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditing(t)
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </button>
                  <button
                    className="row-icon-btn"
                    aria-label={`Remove ${t.description}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteTransaction.mutate(t.id)
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}
        {list.length === 0 && <div className="pm-empty">No transactions match this view.</div>}
      </div>

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
