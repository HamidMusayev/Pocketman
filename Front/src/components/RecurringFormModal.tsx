import { useMemo, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import type { Account, Category, Frequency, RecurringRule, TransactionType } from '../api/types'
import { useCatchUp, useCreateRecurring, useDeleteRecurring, useUpdateRecurring } from '../hooks/useRecurring'
import { FREQUENCIES } from '../lib/constants'
import { parseAmount } from '../lib/money'
import { Modal } from './Modal'

const TYPES: { key: TransactionType; label: string }[] = [
  { key: 'expense', label: 'Expense' },
  { key: 'income', label: 'Income' },
  { key: 'transfer', label: 'Transfer' },
]

interface Props {
  categories: Category[]
  accounts: Account[]
  currency: string
  /** edit this rule; omit to create a new one */
  rule?: RecurringRule
  onClose: () => void
}

export function RecurringFormModal({ categories, accounts, currency, rule, onClose }: Props) {
  const createRecurring = useCreateRecurring()
  const updateRecurring = useUpdateRecurring()
  const deleteRecurring = useDeleteRecurring()
  const catchUp = useCatchUp()

  const [type, setType] = useState<TransactionType>(rule?.type ?? 'expense')
  const [desc, setDesc] = useState(rule?.description ?? '')
  const [amount, setAmount] = useState(rule ? String(rule.amount) : '')
  const [frequency, setFrequency] = useState<Frequency>(rule?.frequency ?? 'Monthly')
  const [categoryId, setCategoryId] = useState<number | null>(rule?.category_id ?? null)
  const [accountId, setAccountId] = useState<number | null>(rule?.account_id ?? accounts[0]?.id ?? null)
  const [pickedTransfer, setTransferAccountId] = useState<number | null>(rule?.transfer_account_id ?? null)
  // for a new rule: the first payment; for an existing one: the next one due
  const [date, setDate] = useState(rule?.next_due_date ?? '')
  const [autoApprove, setAutoApprove] = useState(rule?.auto_approve ?? false)
  const [error, setError] = useState<string | null>(null)

  const isTransfer = type === 'transfer'
  const typeCategories = useMemo(() => categories.filter((c) => c.type === type), [categories, type])
  const effectiveCategory =
    (categoryId != null && typeCategories.some((c) => c.id === categoryId) ? categoryId : null) ??
    typeCategories[0]?.id ??
    null
  const transferAccountId = pickedTransfer ?? accounts.find((a) => a.id !== accountId)?.id ?? null

  async function onSubmit() {
    const amt = parseAmount(amount)
    if (!desc.trim() || amt === null || !accountId) {
      setError('Enter a name and an amount.')
      return
    }
    if (isTransfer && (!transferAccountId || transferAccountId === accountId)) {
      setError('Pick two different accounts.')
      return
    }
    if (!isTransfer && !effectiveCategory) {
      setError('Pick a category.')
      return
    }
    setError(null)
    const fields = {
      description: desc.trim(),
      amount: amt,
      type,
      frequency,
      account_id: accountId,
      category_id: isTransfer ? null : effectiveCategory,
      transfer_account_id: isTransfer ? transferAccountId : null,
      auto_approve: autoApprove,
    }
    try {
      if (rule) {
        await updateRecurring.mutateAsync({
          id: rule.id,
          patch: { ...fields, ...(date ? { next_due_date: date } : {}) },
        })
      } else {
        await createRecurring.mutateAsync({ ...fields, ...(date ? { start_date: date } : {}) })
      }
      // a rule that starts in the past should surface its due items right away
      catchUp.mutate()
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save recurring payment.'))
    }
  }

  async function onDelete() {
    if (!rule || !window.confirm(`Stop the recurring payment "${rule.description}"?`)) return
    try {
      await deleteRecurring.mutateAsync(rule.id)
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not remove recurring payment.'))
    }
  }

  const accountOptions = accounts.map((a) => (
    <option key={a.id} value={a.id}>
      {a.name}
    </option>
  ))

  return (
    <Modal title={rule ? 'Edit recurring payment' : 'New recurring payment'} onClose={onClose}>
      <div className="seg add-type" role="group" aria-label="Type">
        {TYPES.map((t) => (
          <button
            key={t.key}
            className={'seg-btn ' + t.key + (type === t.key ? ' active' : '')}
            aria-pressed={type === t.key}
            onClick={() => setType(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="add-row">
        <div className="modal-field">
          <label className="modal-label">Name</label>
          <input
            className="pm-input"
            placeholder={isTransfer ? 'e.g. Monthly savings' : 'e.g. Rent'}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            autoFocus
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">Amount ({currency})</label>
          <input
            className="pm-input pm-input-mono"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            aria-label="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </div>

      <div className="add-row">
        <div className="modal-field">
          <label className="modal-label">Repeats</label>
          <select className="pm-select" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div className="modal-field">
          <label className="modal-label">{rule ? 'Next payment' : 'First payment'}</label>
          <input className="pm-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div className="add-row">
        {isTransfer ? (
          <>
            <div className="modal-field">
              <label className="modal-label">From</label>
              <select className="pm-select" value={accountId ?? ''} onChange={(e) => setAccountId(Number(e.target.value))}>
                {accountOptions}
              </select>
            </div>
            <div className="modal-field">
              <label className="modal-label">To</label>
              <select
                className="pm-select"
                value={transferAccountId ?? ''}
                onChange={(e) => setTransferAccountId(Number(e.target.value))}
              >
                {accountOptions}
              </select>
            </div>
          </>
        ) : (
          <>
            <div className="modal-field">
              <label className="modal-label">Category</label>
              <select
                className="pm-select"
                value={effectiveCategory ?? ''}
                onChange={(e) => setCategoryId(Number(e.target.value))}
              >
                {typeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-field">
              <label className="modal-label">Account</label>
              <select className="pm-select" value={accountId ?? ''} onChange={(e) => setAccountId(Number(e.target.value))}>
                {accountOptions}
              </select>
            </div>
          </>
        )}
      </div>

      <label className="check-row">
        <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} />
        <span>
          Add automatically
          <span className="modal-hint"> Post it on the due date without asking for approval.</span>
        </span>
      </label>

      {error && <div className="pm-inline-error">{error}</div>}

      {rule ? (
        <div className="modal-actions">
          <button className="pm-btn modal-danger" onClick={onDelete} disabled={deleteRecurring.isPending}>
            Delete
          </button>
          <button className="pm-btn pm-btn-ghost-elev" onClick={onClose}>
            Cancel
          </button>
          <button className="pm-btn pm-btn-primary" onClick={onSubmit} disabled={updateRecurring.isPending}>
            Save
          </button>
        </div>
      ) : (
        <button className="pm-btn pm-btn-primary add-submit" onClick={onSubmit} disabled={createRecurring.isPending}>
          Add
        </button>
      )}
    </Modal>
  )
}
