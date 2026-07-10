import { useEffect, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import type { Frequency, TxnType } from '../api/types'
import { CategoryIcon } from '../components/CategoryIcon'
import { useAccounts } from '../hooks/useAccounts'
import { useCategories } from '../hooks/useCategories'
import { useCategoryIconById } from '../hooks/useCategoryIcons'
import {
  useApprovePending,
  useCatchUp,
  useCreateRecurring,
  useDeleteRecurring,
  useDismissPending,
  usePending,
  useRecurringRules,
} from '../hooks/useRecurring'
import { useSettings } from '../hooks/useSettings'
import { FREQUENCIES } from '../lib/constants'
import { formatDateLabel } from '../lib/dates'
import { formatTransactionAmount } from '../lib/money'
import './pages.css'

export function Recurring() {
  const { data: rules } = useRecurringRules()
  const { data: pending } = usePending()
  const { data: categories } = useCategories()
  const { data: accounts } = useAccounts()
  const { data: settings } = useSettings()
  const iconById = useCategoryIconById()

  const currency = settings?.currency_symbol ?? '$'
  const showCents = settings?.show_cents ?? true

  const createRecurring = useCreateRecurring()
  const deleteRecurring = useDeleteRecurring()
  const catchUp = useCatchUp()
  const approve = useApprovePending()
  const dismiss = useDismissPending()

  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<TxnType>('expense')
  const [frequency, setFrequency] = useState<Frequency>('Monthly')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [accountId, setAccountId] = useState<number | null>(null)
  const [startDate, setStartDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  // default the selects once data loads
  useEffect(() => {
    if (categoryId == null && categories?.length) setCategoryId(categories[0].id)
  }, [categories, categoryId])
  useEffect(() => {
    if (accountId == null && accounts?.length) setAccountId(accounts[0].id)
  }, [accounts, accountId])

  async function onAdd() {
    const amt = Number(amount)
    if (!amt || amt <= 0 || !desc.trim() || !categoryId || !accountId) {
      setError('Enter a description, amount, category and account.')
      return
    }
    setError(null)
    try {
      await createRecurring.mutateAsync({
        description: desc.trim(),
        amount: amt,
        category_id: categoryId,
        account_id: accountId,
        type,
        frequency,
        ...(startDate ? { start_date: startDate } : {}),
      })
      setDesc('')
      setAmount('')
      setStartDate('')
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not add recurring rule.'))
    }
  }

  const pendingList = pending ?? []
  const ruleList = rules ?? []

  return (
    <div>
      {/* add recurring */}
      <div className="rec-form">
        <div className="pm-section-title" style={{ marginBottom: 20 }}>
          Add recurring transaction
        </div>
        <div className="rec-form-grid">
          <div className="rec-desc-field">
            <div className="pm-field-label">Description</div>
            <input
              className="pm-input"
              style={{ width: '100%' }}
              placeholder="e.g. Netflix"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>
          <div className="rec-form-field">
            <div className="pm-field-label">Amount ({currency})</div>
            <input
              className="pm-input pm-input-mono"
              style={{ width: '100%' }}
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="rec-form-field">
            <div className="pm-field-label">Category</div>
            <select
              className="pm-select"
              style={{ width: '100%' }}
              value={categoryId ?? ''}
              onChange={(e) => setCategoryId(Number(e.target.value))}
            >
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="rec-form-field">
            <div className="pm-field-label">Account</div>
            <select
              className="pm-select"
              style={{ width: '100%' }}
              value={accountId ?? ''}
              onChange={(e) => setAccountId(Number(e.target.value))}
            >
              {(accounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: 150 }}>
            <div className="pm-field-label">Type</div>
            <div className="rec-type-toggle">
              <button className={type === 'expense' ? 'exp-active' : ''} onClick={() => setType('expense')}>
                Expense
              </button>
              <button className={type === 'income' ? 'inc-active' : ''} onClick={() => setType('income')}>
                Income
              </button>
            </div>
          </div>
        </div>

        <div className="rec-form-second">
          <div style={{ minWidth: 150 }}>
            <div className="pm-field-label">Frequency</div>
            <select
              className="pm-select"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as Frequency)}
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: 160 }}>
            <div className="pm-field-label">Start date (optional)</div>
            <input
              className="pm-input"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <button className="pm-btn pm-btn-primary" onClick={onAdd} disabled={createRecurring.isPending}>
            + Add
          </button>
        </div>
        {error && <div className="pm-inline-error">{error}</div>}
      </div>

      {/* pending approval */}
      <div className="pm-section-head">
        <div className="pm-section-title">Pending approval</div>
        <div className="pending-label">{pendingList.length ? `${pendingList.length} pending` : 'None pending'}</div>
      </div>
      <div className="pending-list">
        {pendingList.map((p) => (
          <div className="pending-row" key={p.id}>
            <div style={{ flex: 1 }}>
              <div className="txn-desc">{p.description}</div>
              <div className="pending-meta">
                {p.category_name} · {p.account_name} · {formatDateLabel(p.due_date)}
              </div>
            </div>
            <div className="pending-amount" style={{ color: p.type === 'income' ? 'var(--up)' : 'var(--down)' }}>
              {formatTransactionAmount(p.type, p.amount, currency, showCents)}
            </div>
            <button className="btn-approve" onClick={() => approve.mutate(p.id)}>
              Approve
            </button>
            <button className="btn-skip" onClick={() => dismiss.mutate(p.id)}>
              Skip
            </button>
          </div>
        ))}
        {pendingList.length === 0 && <div className="pm-empty">No pending transactions — all caught up.</div>}
      </div>

      {/* rules */}
      <div className="pm-section-head">
        <div className="pm-section-title">Recurring rules</div>
        <button className="pm-btn pm-btn-ghost" onClick={() => catchUp.mutate()} disabled={catchUp.isPending}>
          {catchUp.isPending ? 'Catching up…' : 'Catch up now'}
        </button>
      </div>
      <div className="rule-list">
        {ruleList.map((r) => (
          <div className="rule-row" key={r.id}>
            <span className="icon-badge">
              <CategoryIcon iconKey={iconById(r.category_id)} size={17} />
            </span>
            <div style={{ flex: 1 }}>
              <div className="txn-desc">{r.description}</div>
              <div className="rule-meta">
                {r.frequency} · {r.category_name} · {r.account_name} · next {formatDateLabel(r.next_due_date)}
              </div>
            </div>
            <div className="rule-amount" style={{ color: r.type === 'income' ? 'var(--up)' : 'var(--down)' }}>
              {formatTransactionAmount(r.type, r.amount, currency, showCents)}
            </div>
            <button className="row-icon-btn" onClick={() => deleteRecurring.mutate(r.id)} aria-label="Remove">
              ×
            </button>
          </div>
        ))}
        {ruleList.length === 0 && <div className="pm-empty">No recurring rules yet.</div>}
      </div>
    </div>
  )
}
