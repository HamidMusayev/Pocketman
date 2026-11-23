import { useMemo, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import type { Account, Category, Frequency, TxnType } from '../api/types'
import { useCatchUp, useCreateRecurring } from '../hooks/useRecurring'
import { FREQUENCIES } from '../lib/constants'
import { Modal } from './Modal'

interface Props {
  categories: Category[]
  accounts: Account[]
  currency: string
  onClose: () => void
}

export function RecurringFormModal({ categories, accounts, currency, onClose }: Props) {
  const createRecurring = useCreateRecurring()
  const catchUp = useCatchUp()

  const [type, setType] = useState<TxnType>('expense')
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<Frequency>('Monthly')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [accountId, setAccountId] = useState<number | null>(accounts[0]?.id ?? null)
  const [startDate, setStartDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  const typeCategories = useMemo(() => categories.filter((c) => c.type === type), [categories, type])
  const effectiveCategory = categoryId ?? typeCategories[0]?.id ?? null

  async function onSubmit() {
    const amt = Number(amount)
    if (!desc.trim() || !amt || amt <= 0 || !effectiveCategory || !accountId) {
      setError('Enter a name and an amount.')
      return
    }
    setError(null)
    try {
      await createRecurring.mutateAsync({
        description: desc.trim(),
        amount: amt,
        category_id: effectiveCategory,
        account_id: accountId,
        type,
        frequency,
        ...(startDate ? { start_date: startDate } : {}),
      })
      // a rule that starts in the past should surface its due items right away
      catchUp.mutate()
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not add recurring payment.'))
    }
  }

  return (
    <Modal title="New recurring payment" onClose={onClose}>
      <div className="seg add-type" role="group" aria-label="Type">
        {(['expense', 'income'] as TxnType[]).map((t) => (
          <button
            key={t}
            className={'seg-btn ' + t + (type === t ? ' active' : '')}
            aria-pressed={type === t}
            onClick={() => {
              setType(t)
              setCategoryId(null)
            }}
          >
            {t === 'expense' ? 'Expense' : 'Income'}
          </button>
        ))}
      </div>

      <div className="add-row">
        <div className="modal-field">
          <label className="modal-label">Name</label>
          <input className="pm-input" placeholder="e.g. Rent" value={desc} onChange={(e) => setDesc(e.target.value)} autoFocus />
        </div>
        <div className="modal-field">
          <label className="modal-label">Amount ({currency})</label>
          <input
            className="pm-input pm-input-mono"
            type="number"
            inputMode="decimal"
            placeholder="0.00"
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
          <label className="modal-label">First payment</label>
          <input className="pm-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
      </div>

      <div className="add-row">
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
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="pm-inline-error">{error}</div>}

      <button className="pm-btn pm-btn-primary add-submit" onClick={onSubmit} disabled={createRecurring.isPending}>
        Add
      </button>
    </Modal>
  )
}
