import { useMemo, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import type { Account } from '../api/types'
import { CategoryIcon } from '../components/CategoryIcon'
import { GoalsSection } from '../components/GoalsSection'
import { Modal } from '../components/Modal'
import { useAccounts, useCreateAccount, useDeleteAccount, useUpdateAccount } from '../hooks/useAccounts'
import { useSettings } from '../hooks/useSettings'
import { ACCOUNT_ICON_KEYS, ACCOUNT_ICON_LABELS, ACCOUNT_TYPES } from '../lib/constants'
import { rampColor } from '../lib/colorRamp'
import { formatMoney, formatSignedMoney, parseAmount, sumMoney } from '../lib/money'
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
  const assets = useMemo(() => sumMoney(list.filter((a) => a.net > 0).map((a) => a.net)), [list])
  const debts = useMemo(() => sumMoney(list.filter((a) => a.net < 0).map((a) => -a.net)), [list])

  return (
    <div>
      <div className="page-head acc-page-head">
        <h1 className="page-title">Accounts</h1>
        <button className="pm-btn pm-btn-primary acc-add-btn" onClick={() => setForm('new')}>
          + Add account
        </button>
      </div>

      {/* ----------------------------- net worth ----------------------------- */}
      <section className="acc-hero" aria-label="Net worth">
        <div className="acc-hero-top">
          <div>
            <div className="summary-label">Net worth</div>
            <div className="summary-balance">{formatSignedMoney(total, currency, showCents)}</div>
          </div>
          <div className="acc-hero-stats">
            <div>
              <div className="summary-label">Assets</div>
              <div className="summary-stat-value" style={{ color: 'var(--up)' }}>
                {formatMoney(assets, currency, showCents)}
              </div>
            </div>
            <div>
              <div className="summary-label">Debts</div>
              <div className="summary-stat-value" style={{ color: debts > 0 ? 'var(--down)' : 'var(--muted2)' }}>
                {formatMoney(debts, currency, showCents)}
              </div>
            </div>
            <div>
              <div className="summary-label">Accounts</div>
              <div className="summary-stat-value">{list.length}</div>
            </div>
          </div>
        </div>

        {/* where the money sits: one bar, a segment per account with a positive balance */}
        {assets > 0 && (
          <div className="acc-share" aria-hidden="true">
            {list
              .filter((a) => a.net > 0)
              .map((a) => (
                <span
                  key={a.id}
                  title={a.name}
                  style={{ width: `${(a.net / assets) * 100}%`, background: rampColor(list.indexOf(a)) }}
                />
              ))}
          </div>
        )}
        {assets > 0 && (
          <div className="acc-share-legend">
            {list
              .filter((a) => a.net > 0)
              .map((a) => (
                <span key={a.id}>
                  <i style={{ background: rampColor(list.indexOf(a)) }} />
                  {a.name} <em>{Math.round((a.net / assets) * 100)}%</em>
                </span>
              ))}
          </div>
        )}
      </section>

      {/* ------------------------------ accounts ----------------------------- */}
      <div className="acc-grid">
        {list.map((a, i) => (
          <button className="acc-card" key={a.id} onClick={() => setForm(a)} aria-label={`Edit ${a.name}`}>
            <span className="acc-card-top">
              <span className="icon-badge" style={{ color: rampColor(i) }}>
                <CategoryIcon iconKey={a.icon} size={19} />
              </span>
              <span className="acc-card-type">{a.type[0].toUpperCase() + a.type.slice(1)}</span>
            </span>
            <span className="acc-card-name">{a.name}</span>
            <span className="acc-card-balance" style={{ color: a.net < 0 ? 'var(--down)' : 'var(--strong)' }}>
              {formatSignedMoney(a.net, currency, showCents)}
            </span>
            <span className="acc-card-sub">
              {a.transaction_count} transaction{a.transaction_count === 1 ? '' : 's'}
            </span>
          </button>
        ))}
        <button className="acc-card acc-card-new" onClick={() => setForm('new')}>
          <span className="acc-card-new-plus">+</span>
          <span>New account</span>
        </button>
      </div>

      <GoalsSection currency={currency} showCents={showCents} />

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
