import { useMemo, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import type { Account } from '../api/types'
import { CategoryIcon } from '../components/CategoryIcon'
import { GoalsSection } from '../components/GoalsSection'
import { Modal } from '../components/Modal'
import { useAccounts, useCreateAccount, useDeleteAccount, useUpdateAccount } from '../hooks/useAccounts'
import { useSettings } from '../hooks/useSettings'
import { ACCOUNT_ICON_KEYS, ACCOUNT_ICON_LABELS, ACCOUNT_TYPES } from '../lib/constants'
import { formatSignedMoney, parseAmount, sumMoney } from '../lib/money'
import './pages.css'

export function Accounts() {
  const { data: accounts } = useAccounts()
  const { data: settings } = useSettings()

  const currency = settings?.currency_symbol ?? '$'
  const showCents = settings?.show_cents ?? true

  // null = closed, 'new' = add form, otherwise the account being edited
  const [form, setForm] = useState<Account | 'new' | null>(null)

  const list = useMemo(() => accounts ?? [], [accounts])
  const total = useMemo(() => sumMoney(list.map((a) => a.net)), [list])

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Accounts</h1>
        <div className="page-head-actions">
          <button className="pm-btn pm-btn-ghost pm-btn-sm" onClick={() => setForm('new')}>
            + Account
          </button>
        </div>
      </div>

      <div className="split">
      <aside className="split-side">
      <section className="summary">
        <div>
          <div className="summary-label">Net worth · all accounts</div>
          <div className="summary-balance">{formatSignedMoney(total, currency, showCents)}</div>
        </div>
      </section>
      </aside>

      <div className="split-main">

      <div className="list-card">
        {list.map((a) => (
          <button className="list-row" key={a.id} onClick={() => setForm(a)}>
            <span className="icon-badge">
              <CategoryIcon iconKey={a.icon} size={19} />
            </span>
            <span className="list-main">
              <span className="list-title">{a.name}</span>
              <span className="list-sub">
                {a.type[0].toUpperCase() + a.type.slice(1)} · {a.transaction_count} transaction
                {a.transaction_count === 1 ? '' : 's'}
              </span>
            </span>
            <span className="list-value" style={{ color: a.net < 0 ? 'var(--down)' : 'var(--strong)' }}>
              {formatSignedMoney(a.net, currency, showCents)}
            </span>
          </button>
        ))}
        {list.length === 0 && <div className="pm-empty">No accounts yet.</div>}
      </div>

      <GoalsSection currency={currency} showCents={showCents} />
      </div>
      </div>

      {form && <AccountFormModal account={form === 'new' ? undefined : form} onClose={() => setForm(null)} />}
    </div>
  )
}

function AccountFormModal({ account, onClose }: { account?: Account; onClose: () => void }) {
  const createAccount = useCreateAccount()
  const updateAccount = useUpdateAccount()
  const deleteAccount = useDeleteAccount()

  const [name, setName] = useState(account?.name ?? '')
  const [icon, setIcon] = useState(account?.icon ?? 'wallet')
  const [type, setType] = useState(account?.type ?? 'cash')
  const [opening, setOpening] = useState(account?.opening_balance ? String(account.opening_balance) : '')
  const [error, setError] = useState<string | null>(null)

  async function onSave() {
    if (!name.trim()) {
      setError('Give the account a name.')
      return
    }
    const openingBalance = opening.trim() === '' ? 0 : parseAmount(opening, { allowNegative: true, allowZero: true })
    if (openingBalance === null) {
      setError('Starting balance must be a number.')
      return
    }
    setError(null)
    const fields = { name: name.trim(), icon, type, opening_balance: openingBalance }
    try {
      if (account) await updateAccount.mutateAsync({ id: account.id, patch: fields })
      else await createAccount.mutateAsync(fields)
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save account.'))
    }
  }

  async function onDelete() {
    if (!account || !window.confirm(`Remove the "${account.name}" account?`)) return
    try {
      await deleteAccount.mutateAsync(account.id)
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not remove account.'))
    }
  }

  return (
    <Modal title={account ? 'Edit account' : 'New account'} onClose={onClose}>
      <div className="modal-field">
        <label className="modal-label">Name</label>
        <input
          className="pm-input"
          style={{ width: '100%' }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSave()}
          autoFocus
        />
      </div>
      <div className="add-row">
        <div className="modal-field">
          <label className="modal-label">Type</label>
          <select className="pm-select" value={type} onChange={(e) => setType(e.target.value)}>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t[0].toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="modal-field">
          <label className="modal-label">Icon</label>
          <select className="pm-select" value={icon} onChange={(e) => setIcon(e.target.value)}>
            {ACCOUNT_ICON_KEYS.map((k) => (
              <option key={k} value={k}>
                {ACCOUNT_ICON_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="modal-field">
        <label className="modal-label">Starting balance</label>
        <input
          className="pm-input pm-input-mono"
          style={{ width: '100%' }}
          inputMode="decimal"
          placeholder="0.00"
          aria-label="Starting balance"
          value={opening}
          onChange={(e) => setOpening(e.target.value)}
        />
        <div className="modal-hint">
          What was already in this account when you started using Pocketman. It counts toward the balance, not
          toward income. Use a minus for a card that already carries debt.
        </div>
      </div>

      {error && <div className="pm-inline-error">{error}</div>}

      <div className="modal-actions">
        {account?.removable && (
          <button className="pm-btn modal-danger" onClick={onDelete} disabled={deleteAccount.isPending}>
            Delete
          </button>
        )}
        <button className="pm-btn pm-btn-ghost-elev" onClick={onClose}>
          Cancel
        </button>
        <button
          className="pm-btn pm-btn-primary"
          onClick={onSave}
          disabled={createAccount.isPending || updateAccount.isPending}
        >
          {account ? 'Save' : 'Add account'}
        </button>
      </div>
    </Modal>
  )
}
