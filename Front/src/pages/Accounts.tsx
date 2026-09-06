import { useMemo, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import type { Account } from '../api/types'
import { CategoryIcon } from '../components/CategoryIcon'
import { useAccounts, useCreateAccount, useDeleteAccount, useUpdateAccount } from '../hooks/useAccounts'
import { useSettings } from '../hooks/useSettings'
import { cardDigits, cardExpiry } from '../lib/cards'
import { ACCOUNT_ICON_KEYS, ACCOUNT_ICON_LABELS, ACCOUNT_TYPES } from '../lib/constants'
import { formatSignedMoney } from '../lib/money'
import './pages.css'

/** EMV-style contact plate on the card face. */
function ChipGlyph() {
  return (
    <svg width="30" height="23" viewBox="0 0 30 23" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <rect x="0.65" y="0.65" width="28.7" height="21.7" rx="4.5" />
      <path d="M0.65 7.5h9.6M19.75 7.5h9.6M0.65 15.5h9.6M19.75 15.5h9.6M10.25 0.65v21.7M19.75 0.65v21.7" />
    </svg>
  )
}

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

  /** The card's × is a much smaller target than the list's "remove", so it
   * asks first. */
  function onRemoveFromCard(account: Account) {
    if (!window.confirm(`Remove the "${account.name}" account?`)) return
    onRemove(account.id)
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

      <div className="pm-section-head">
        <div className="pm-section-title">Cards</div>
      </div>
      <div className="card-grid">
        {(accounts ?? []).map((a) => (
          <AccountCard
            key={a.id}
            account={a}
            currency={currency}
            showCents={showCents}
            onRemove={onRemoveFromCard}
          />
        ))}
        {(accounts ?? []).length === 0 && <div className="pm-empty">No accounts yet.</div>}
      </div>

      <div className="pm-section-head section-gap">
        <div className="pm-section-title">Accounts</div>
        <div className="pm-section-note">Rename, recategorize, add or remove</div>
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

function AccountCard({
  account,
  currency,
  showCents,
  onRemove,
}: {
  account: Account
  currency: string
  showCents: boolean
  onRemove: (account: Account) => void
}) {
  // The seeded account can't be deleted; it reads as the primary card.
  const isPrimary = !account.removable
  const balanceColor =
    account.net < 0 ? 'var(--down)' : isPrimary ? 'var(--yellow)' : '#fff'

  return (
    <article className={'acc-card' + (isPrimary ? ' primary' : '')}>
      {isPrimary && <span className="acc-card-glow" aria-hidden="true" />}

      <div className="acc-card-top">
        <div>
          <div className="acc-card-name">{account.name}</div>
          <div className="acc-card-type">{account.type}</div>
        </div>
        <div className="acc-card-actions">
          {account.removable && (
            <button
              className="acc-card-remove"
              title="Remove account"
              aria-label={`Remove ${account.name}`}
              onClick={() => onRemove(account)}
            >
              ×
            </button>
          )}
          <span className="acc-card-chip">
            <ChipGlyph />
          </span>
        </div>
      </div>

      {/* decorative card face — see lib/cards.ts */}
      <div className="acc-card-number" aria-hidden="true">
        <span>••••</span>
        <span>••••</span>
        <span>••••</span>
        <span className="acc-card-last">{cardDigits(account)}</span>
      </div>

      <div className="acc-card-bottom">
        <div>
          <div className="acc-card-label">Balance</div>
          <div className="acc-card-balance" style={{ color: balanceColor }}>
            {formatSignedMoney(account.net, currency, showCents)}
          </div>
        </div>
        <div className="acc-card-meta">
          <div className="acc-card-exp" aria-hidden="true">
            {cardExpiry(account)}
          </div>
          <div>
            {account.transaction_count} transaction{account.transaction_count === 1 ? '' : 's'}
          </div>
        </div>
      </div>
    </article>
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
