import { useMemo, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import type { Account, Category, Transaction, TransactionType } from '../api/types'
import { useDeleteTransaction, useUpdateTransaction } from '../hooks/useTransactions'
import { useSettings } from '../hooks/useSettings'
import { parseAmount } from '../lib/money'
import { formatTags, parseTags, tagsError } from '../lib/tags'
import { Modal } from './Modal'
import { TagInput } from './TagInput'

interface Props {
  transaction: Transaction
  categories: Category[]
  accounts: Account[]
  onClose: () => void
}

export function TransactionEditModal({ transaction, categories, accounts, onClose }: Props) {
  const updateTransaction = useUpdateTransaction()
  const deleteTransaction = useDeleteTransaction()
  const { data: settings } = useSettings()
  const currency = settings?.currency_symbol ?? '$'

  const [type, setType] = useState<TransactionType>(transaction.type)
  const [amount, setAmount] = useState(String(transaction.amount))
  const [desc, setDesc] = useState(transaction.description)
  const [categoryId, setCategoryId] = useState<number | null>(transaction.category_id)
  const [accountId, setAccountId] = useState<number>(transaction.account_id)
  const [transferAccountId, setTransferAccountId] = useState<number | null>(
    transaction.transfer_account_id ?? accounts.find((a) => a.id !== transaction.account_id)?.id ?? null,
  )
  const [date, setDate] = useState(transaction.date)
  const [note, setNote] = useState(transaction.note ?? '')
  const [tagText, setTagText] = useState(formatTags(transaction.tags ?? []))
  const [error, setError] = useState<string | null>(null)

  const isTransfer = type === 'transfer'
  const typeCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type],
  )

  function onTypeChange(next: TransactionType) {
    setType(next)
    if (next !== 'transfer') {
      const stillValid = categories.find((c) => c.id === categoryId)?.type === next
      if (!stillValid) setCategoryId(categories.find((c) => c.type === next)?.id ?? null)
    }
  }

  async function onSave() {
    const amt = parseAmount(amount)
    if (amt === null) {
      setError('Amount must be greater than zero.')
      return
    }
    const tags = parseTags(tagText)
    const tagProblem = tagsError(tags)
    if (tagProblem) {
      setError(tagProblem)
      return
    }
    const extras = { note: note.trim() || null, tags }
    try {
      if (isTransfer) {
        if (!transferAccountId || transferAccountId === accountId) {
          setError('Transfer accounts must be different.')
          return
        }
        setError(null)
        await updateTransaction.mutateAsync({
          id: transaction.id,
          patch: {
            type: 'transfer',
            amount: amt,
            description: desc || 'Transfer',
            account_id: accountId,
            transfer_account_id: transferAccountId,
            date,
            ...extras,
          },
        })
      } else {
        if (!categoryId) {
          setError('Pick a category.')
          return
        }
        setError(null)
        await updateTransaction.mutateAsync({
          id: transaction.id,
          patch: {
            type,
            amount: amt,
            description: desc || '',
            category_id: categoryId,
            account_id: accountId,
            date,
            ...extras,
          },
        })
      }
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update transaction.'))
    }
  }

  return (
    <Modal title="Edit transaction" onClose={onClose}>
      <div className="modal-field">
        <label className="modal-label">Type</label>
        <div className="type-toggle">
          <button
            type="button"
            className={type === 'expense' ? 'exp-active' : ''}
            onClick={() => onTypeChange('expense')}
          >
            Expense
          </button>
          <button
            type="button"
            className={type === 'income' ? 'inc-active' : ''}
            onClick={() => onTypeChange('income')}
          >
            Income
          </button>
          <button
            type="button"
            className={type === 'transfer' ? 'xfer-active' : ''}
            onClick={() => onTypeChange('transfer')}
          >
            Transfer
          </button>
        </div>
      </div>

      <div className="modal-field">
        <label className="modal-label">Amount ({currency})</label>
        <input
          className="pm-input pm-input-mono"
          style={{ width: '100%' }}
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <div className="modal-field">
        <label className="modal-label">Description</label>
        <input className="pm-input" style={{ width: '100%' }} value={desc} onChange={(e) => setDesc(e.target.value)} />
      </div>

      {isTransfer ? (
        <>
          <div className="modal-field">
            <label className="modal-label">From account</label>
            <select
              className="pm-select"
              style={{ width: '100%' }}
              value={accountId}
              onChange={(e) => setAccountId(Number(e.target.value))}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="modal-field">
            <label className="modal-label">To account</label>
            <select
              className="pm-select"
              style={{ width: '100%' }}
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
        </>
      ) : (
        <>
          <div className="modal-field">
            <label className="modal-label">Category</label>
            <select
              className="pm-select"
              style={{ width: '100%' }}
              value={categoryId ?? ''}
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
            <select
              className="pm-select"
              style={{ width: '100%' }}
              value={accountId}
              onChange={(e) => setAccountId(Number(e.target.value))}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div className="modal-field">
        <label className="modal-label">Date</label>
        <input
          className="pm-input"
          style={{ width: '100%' }}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="modal-field">
        <label className="modal-label">Note</label>
        <textarea
          className="pm-input pm-textarea"
          aria-label="Note"
          rows={2}
          placeholder="Optional"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="modal-field">
        <label className="modal-label">Tags</label>
        <TagInput value={tagText} onChange={setTagText} />
      </div>

      {error && <div className="pm-inline-error">{error}</div>}

      <div className="modal-actions">
        <button
          className="pm-btn modal-danger"
          disabled={deleteTransaction.isPending}
          onClick={async () => {
            if (!window.confirm(`Delete "${transaction.description}"?`)) return
            try {
              await deleteTransaction.mutateAsync(transaction.id)
              onClose()
            } catch (err) {
              setError(apiErrorMessage(err, 'Could not delete transaction.'))
            }
          }}
        >
          Delete
        </button>
        <button className="pm-btn pm-btn-ghost-elev" onClick={onClose}>
          Cancel
        </button>
        <button className="pm-btn pm-btn-primary" onClick={onSave} disabled={updateTransaction.isPending}>
          Save
        </button>
      </div>
    </Modal>
  )
}
