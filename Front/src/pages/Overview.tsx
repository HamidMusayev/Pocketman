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
import { formatDateLabel, newTransactionDate } from '../lib/dates'
import { formatMoney, formatTransactionAmount } from '../lib/money'
import './pages.css'

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

  return (
    <div>
      {/* add transaction */}
      <div className="ov-add">
        <div className="ov-add-top">
          <div className="type-toggle">
            <button className={type === 'expense' ? 'exp-active' : ''} onClick={() => onTypeChange('expense')}>
              Expense
            </button>
            <button className={type === 'income' ? 'inc-active' : ''} onClick={() => onTypeChange('income')}>
              Income
            </button>
            <button className={type === 'transfer' ? 'xfer-active' : ''} onClick={() => onTypeChange('transfer')}>
              Transfer
            </button>
          </div>
          <span className="ov-adding-note">Adding to {monthLabel}</span>
        </div>

        <div className="ov-add-row">
          <div className="ov-amount">
            <span>{currency}</span>
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <input
            className="ov-desc"
            type="text"
            placeholder={isTransfer ? 'Note (optional)' : "What's it for?"}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAdd()}
          />
          {isTransfer ? (
            <>
              <select
                className="pm-select ov-add-select"
                title="From account"
                value={effectiveAccountId ?? ''}
                onChange={(e) => setAccountId(Number(e.target.value))}
              >
                {(accounts ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    From: {a.name}
                  </option>
                ))}
              </select>
              <span className="ov-xfer-arrow">→</span>
              <select
                className="pm-select ov-add-select"
                title="To account"
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
              className="pm-select ov-add-select"
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
          <button className="pm-btn pm-btn-primary ov-add-btn" onClick={onAdd} disabled={createTransaction.isPending}>
            Add
          </button>
        </div>

        {!isTransfer && (
          <div className="ov-chips">
            {formCategories.map((c) => (
              <button
                key={c.id}
                className={'ov-chip' + (categoryId === c.id ? ' active' : '')}
                onClick={() => setCategoryId(c.id)}
              >
                <CategoryIcon iconKey={c.icon} size={14} strokeWidth={1.8} />
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <div className="pm-inline-error" style={{ marginBottom: 12 }}>{error}</div>}

      {/* search + export/import */}
      <div className="ov-toolbar">
        <div className="ov-search-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
          Export CSV
        </button>
        <button className="ov-tool-btn" onClick={() => fileInput.current?.click()} disabled={importTransactions.isPending}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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

      {/* header + filters */}
      <div className="pm-section-head">
        <div className="pm-section-title">
          Transactions <span className="txn-count">· {list.length}</span>
        </div>
        <div className="txn-filters">
          <select className="txn-filter" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
            <option value="all">All categories</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className="txn-filter" value={filterAcc} onChange={(e) => setFilterAcc(e.target.value)}>
            <option value="all">All accounts</option>
            {(accounts ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select className="txn-filter" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>
      </div>

      <div className="txn-list">
        {list.map((t) =>
          t.type === 'transfer' ? (
            <div className="txn-row" key={t.id}>
              <span className="icon-badge">
                <CategoryIcon iconKey="transfer" size={18} />
              </span>
              <div className="txn-main">
                <div className="txn-desc">{t.description}</div>
                <div className="txn-meta">
                  {t.account_name} → {t.transfer_account_name} · {formatDateLabel(t.date)}
                </div>
              </div>
              <div className="txn-amount txn-transfer">⇄ {formatMoney(t.amount, currency, showCents)}</div>
              <button className="row-edit-btn" onClick={() => setEditing(t)}>
                edit
              </button>
              <button className="row-icon-btn" onClick={() => deleteTransaction.mutate(t.id)} aria-label="Remove">
                ×
              </button>
            </div>
          ) : (
            <div className="txn-row" key={t.id}>
              <span className="icon-badge">
                <CategoryIcon iconKey={iconById(t.category_id)} size={18} />
              </span>
              <div className="txn-main">
                <div className="txn-desc">{t.description}</div>
                <div className="txn-meta">
                  {t.category_name} · {t.account_name} · {formatDateLabel(t.date)}
                </div>
              </div>
              <div
                className="txn-amount"
                style={{ color: t.type === 'income' ? 'var(--up)' : 'var(--down)' }}
              >
                {formatTransactionAmount(t.type, t.amount, currency, showCents)}
              </div>
              <button className="row-edit-btn" onClick={() => setEditing(t)}>
                edit
              </button>
              <button className="row-icon-btn" onClick={() => deleteTransaction.mutate(t.id)} aria-label="Remove">
                ×
              </button>
            </div>
          ),
        )}
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
