import { useMemo, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import type { Account } from '../api/types'
import { CategoryIcon } from '../components/CategoryIcon'
import { useAccounts, useCreateAccount, useDeleteAccount, useUpdateAccount } from '../hooks/useAccounts'
import { useSettings } from '../hooks/useSettings'
import { ACCOUNT_ICON_KEYS, ACCOUNT_ICON_LABELS, ACCOUNT_TYPES } from '../lib/constants'
import { formatSignedMoney } from '../lib/money'
import './pages.css'

export function Accounts() {
  const { data: accounts } = useAccounts()
  const { data: settings } = useSettings()
  const createAccount = useCreateAccount()
  const deleteAccount = useDeleteAccount()

  const currency = settings?.currency_symbol ?? '$'
  const showCents = settings?.show_cents ?? true

  const [newAcc, setNewAcc] = useState({ name: '', icon: 'wallet', type: 'cash' })
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  const { total, accountCount, totalTxns } = useMemo(() => {
    const list = accounts ?? []
    return {
      total: list.reduce((sum, a) => sum + a.net, 0),
      accountCount: list.length,
      totalTxns: list.reduce((sum, a) => sum + a.transaction_count, 0),
    }
  }, [accounts])

  async function onAdd() {
    if (!newAcc.name.trim()) return
    setError(null)
    try {
      await createAccount.mutateAsync({ name: newAcc.name.trim(), type: newAcc.type, icon: newAcc.icon })
      setNewAcc({ name: '', icon: 'wallet', type: 'cash' })
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not add account.'))
    }
  }

  async function onRemove(id: number) {
    setError(null)
    try {
      await deleteAccount.mutateAsync(id)
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not remove account.'))
    }
  }

  return (
    <div>
      <div className="networth-header">
        <div>
          <div className="networth-label">Total net worth</div>
          <div className="networth-value">{formatSignedMoney(total, currency, showCents)}</div>
        </div>
        <div className="networth-sub">
          {accountCount} accounts · {totalTxns} transactions
        </div>
      </div>

      <div className="acc-list">
        {(accounts ?? []).map((a) =>
          editingId === a.id ? (
            <AccountEditRow key={a.id} account={a} onDone={() => setEditingId(null)} onError={setError} />
          ) : (
            <div className="acc-row" key={a.id}>
              <span className="icon-badge">
                <CategoryIcon iconKey={a.icon} size={20} />
              </span>
              <div className="acc-main">
                <div className="acc-name">{a.name}</div>
                <div className="acc-meta">
                  {a.type} · {a.transaction_count} transactions
                </div>
              </div>
              <div className="acc-net" style={{ color: a.net < 0 ? 'var(--down)' : 'var(--body)' }}>
                {formatSignedMoney(a.net, currency, showCents)}
              </div>
              <button className="row-edit-btn" onClick={() => setEditingId(a.id)}>
                edit
              </button>
              {a.removable && (
                <button className="acc-remove" onClick={() => onRemove(a.id)}>
                  remove
                </button>
              )}
            </div>
          ),
        )}
      </div>

      <div className="acc-add">
        <input
          className="pm-input"
          placeholder="Account name…"
          value={newAcc.name}
          onChange={(e) => setNewAcc((s) => ({ ...s, name: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && onAdd()}
        />
        <select
          className="pm-select"
          value={newAcc.icon}
          onChange={(e) => setNewAcc((s) => ({ ...s, icon: e.target.value }))}
        >
          {ACCOUNT_ICON_KEYS.map((k) => (
            <option key={k} value={k}>
              {ACCOUNT_ICON_LABELS[k]}
            </option>
          ))}
        </select>
        <select
          className="pm-select"
          value={newAcc.type}
          onChange={(e) => setNewAcc((s) => ({ ...s, type: e.target.value }))}
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t[0].toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
        <button className="pm-btn pm-btn-primary" onClick={onAdd} disabled={createAccount.isPending}>
          + Add account
        </button>
      </div>

      {error && <div className="pm-inline-error">{error}</div>}
    </div>
  )
}

function AccountEditRow({
  account,
  onDone,
  onError,
}: {
  account: Account
  onDone: () => void
  onError: (msg: string | null) => void
}) {
  const updateAccount = useUpdateAccount()
  const [name, setName] = useState(account.name)
  const [icon, setIcon] = useState(account.icon)
  const [type, setType] = useState(account.type)

  async function onSave() {
    if (!name.trim()) return
    onError(null)
    try {
      await updateAccount.mutateAsync({ id: account.id, patch: { name: name.trim(), icon, type } })
      onDone()
    } catch (err) {
      onError(apiErrorMessage(err, 'Could not update account.'))
    }
  }

  return (
    <div className="acc-row">
      <span className="icon-badge">
        <CategoryIcon iconKey={icon} size={20} />
      </span>
      <div className="acc-edit-fields">
        <input className="pm-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <select className="pm-select" value={icon} onChange={(e) => setIcon(e.target.value)}>
          {ACCOUNT_ICON_KEYS.map((k) => (
            <option key={k} value={k}>
              {ACCOUNT_ICON_LABELS[k]}
            </option>
          ))}
        </select>
        <select className="pm-select" value={type} onChange={(e) => setType(e.target.value)}>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t[0].toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </div>
      <button className="cat-budget-save" onClick={onSave} disabled={updateAccount.isPending}>
        Save
      </button>
      <button className="row-edit-btn" onClick={onDone}>
        cancel
      </button>
    </div>
  )
}
