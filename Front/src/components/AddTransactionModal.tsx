import { useMemo, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import type { Account, Category, Transaction, TransactionType } from '../api/types'
import { useCreateTransaction } from '../hooks/useTransactions'
import { CategoryIcon } from './CategoryIcon'
import { Modal } from './Modal'

const TYPES: { key: TransactionType; label: string }[] = [
  { key: 'expense', label: 'Expense' },
  { key: 'income', label: 'Income' },
  { key: 'transfer', label: 'Transfer' },
]

/** How many category chips show before "More". */
const QUICK_COUNT = 5

interface Props {
  categories: Category[]
  accounts: Account[]
  /** Transactions in view — used to put the most-used categories first. */
  recent: Transaction[]
  currency: string
  defaultDate: string
  onClose: () => void
}

export function AddTransactionModal({ categories, accounts, recent, currency, defaultDate, onClose }: Props) {
  const createTransaction = useCreateTransaction()

  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [desc, setDesc] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [pickedAccount, setAccountId] = useState<number | null>(null)
  const [pickedTransfer, setTransferAccountId] = useState<number | null>(null)
  // fall back to the first accounts once they load, so a quick open still works
  const accountId = pickedAccount ?? accounts[0]?.id ?? null
  const transferAccountId = pickedTransfer ?? accounts.find((a) => a.id !== accountId)?.id ?? null
  const [date, setDate] = useState(defaultDate)
  const [showAll, setShowAll] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isTransfer = type === 'transfer'

  // Categories of this type, most-used first.
  const ordered = useMemo(() => {
    const uses = new Map<number, number>()
    for (const t of recent) if (t.category_id != null) uses.set(t.category_id, (uses.get(t.category_id) ?? 0) + 1)
    return categories
      .filter((c) => c.type === type)
      .sort((a, b) => (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0))
  }, [categories, recent, type])

  const selected = ordered.find((c) => c.id === categoryId)
  let visible = showAll ? ordered : ordered.slice(0, QUICK_COUNT)
  if (selected && !visible.includes(selected)) visible = [...visible, selected]

  async function onSubmit() {
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      setError('Enter an amount.')
      return
    }
    if (!accountId) {
      setError('Pick an account.')
      return
    }
    try {
      if (isTransfer) {
        if (!transferAccountId || transferAccountId === accountId) {
          setError('Pick two different accounts.')
          return
        }
        setError(null)
        await createTransaction.mutateAsync({
          type: 'transfer',
          amount: amt,
          description: desc.trim() || 'Transfer',
          account_id: accountId,
          transfer_account_id: transferAccountId,
          date,
        })
      } else {
        if (!categoryId) {
          setError('Pick a category.')
          return
        }
        setError(null)
        await createTransaction.mutateAsync({
          type,
          amount: amt,
          description: desc.trim() || selected?.name || '',
          category_id: categoryId,
          account_id: accountId,
          date,
        })
      }
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not add transaction.'))
    }
  }

  return (
    <Modal title="New transaction" onClose={onClose}>
      <div className="seg add-type" role="group" aria-label="Type">
        {TYPES.map((t) => (
          <button
            key={t.key}
            className={'seg-btn ' + t.key + (type === t.key ? ' active' : '')}
            aria-pressed={type === t.key}
            onClick={() => {
              setType(t.key)
              setCategoryId(null)
              setShowAll(false)
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="add-amount">
        <span>{currency}</span>
        <input
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          aria-label="Amount"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        />
      </div>

      <input
        className="pm-input add-desc"
        aria-label="Description"
        placeholder={isTransfer ? 'Note (optional)' : "What's it for? (optional)"}
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
      />

      {!isTransfer && (
        <div className="modal-field">
          <label className="modal-label">Category</label>
          <div className="add-chips">
            {visible.map((c) => (
              <button
                key={c.id}
                className={'add-chip' + (categoryId === c.id ? ' active' : '')}
                aria-pressed={categoryId === c.id}
                onClick={() => setCategoryId(c.id)}
              >
                <CategoryIcon iconKey={c.icon} size={14} strokeWidth={1.9} />
                <span>{c.name}</span>
              </button>
            ))}
            {ordered.length > QUICK_COUNT && (
              <button className="add-chip add-chip-more" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Less' : `More (${ordered.length - QUICK_COUNT})`}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="add-row">
        <div className="modal-field">
          <label className="modal-label">{isTransfer ? 'From' : 'Account'}</label>
          <select
            className="pm-select"
            value={accountId ?? ''}
            onChange={(e) => setAccountId(Number(e.target.value))}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        {isTransfer && (
          <div className="modal-field">
            <label className="modal-label">To</label>
            <select
              className="pm-select"
              value={transferAccountId ?? ''}
              onChange={(e) => setTransferAccountId(Number(e.target.value))}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="modal-field">
          <label className="modal-label">Date</label>
          <input className="pm-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {error && <div className="pm-inline-error">{error}</div>}

      <button
        className="pm-btn pm-btn-primary add-submit"
        onClick={onSubmit}
        disabled={createTransaction.isPending}
      >
        Add
      </button>
    </Modal>
  )
}
