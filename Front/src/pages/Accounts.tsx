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
  const [removing, setRemoving] = useState<Account | null>(null)

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
          <div className="acc-card" key={a.id}>
            <span className="acc-card-top">
              <span className="icon-badge" style={{ color: rampColor(i) }}>
                <CategoryIcon iconKey={a.icon} size={19} />
              </span>
              <span className="acc-card-actions">
                <button className="acc-act" onClick={() => setForm(a)} aria-label={`Edit ${a.name}`} title="Edit">
                  <PencilIcon />
                </button>
                <button
                  className="acc-act acc-act-danger"
                  onClick={() => setRemoving(a)}
                  aria-label={`Delete ${a.name}`}
                  title="Delete"
                >
                  <TrashIcon />
                </button>
              </span>
            </span>
            <span className="acc-card-name">{a.name}</span>
            <span className="acc-card-balance" style={{ color: a.net < 0 ? 'var(--down)' : 'var(--strong)' }}>
              {formatSignedMoney(a.net, currency, showCents)}
            </span>
            <span className="acc-card-sub">
              {a.type[0].toUpperCase() + a.type.slice(1)} · {a.transaction_count} transaction
              {a.transaction_count === 1 ? '' : 's'}
            </span>
          </div>
        ))}
        <button className="acc-card acc-card-new" onClick={() => setForm('new')}>
          <span className="acc-card-new-plus">+</span>
          <span>New account</span>
        </button>
      </div>

      <GoalsSection currency={currency} showCents={showCents} />

      {form && (
        <AccountFormModal
          account={form === 'new' ? undefined : form}
          onClose={() => setForm(null)}
          onDelete={(a) => {
            setForm(null)
            setRemoving(a)
          }}
        />
      )}
      {removing && (
        <DeleteAccountModal
          account={removing}
          others={list.filter((a) => a.id !== removing.id)}
          currency={currency}
          showCents={showCents}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  )
}

function AccountFormModal({
  account,
  onClose,
  onDelete,
}: {
  account?: Account
  onClose: () => void
  onDelete: (a: Account) => void
}) {
  const createAccount = useCreateAccount()
  const updateAccount = useUpdateAccount()

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
        {account && (
          <button className="pm-btn modal-danger" onClick={() => onDelete(account)}>
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

/** Confirm removing an account. If it has history, pick the account that takes
 * it over (transactions, recurring rules and the starting balance move there). */
function DeleteAccountModal({
  account,
  others,
  currency,
  showCents,
  onClose,
}: {
  account: Account
  others: Account[]
  currency: string
  showCents: boolean
  onClose: () => void
}) {
  const deleteAccount = useDeleteAccount()
  const [moveTo, setMoveTo] = useState<number | null>(others[0]?.id ?? null)
  const [error, setError] = useState<string | null>(null)
  const hasHistory = account.transaction_count > 0 || account.opening_balance !== 0

  async function onConfirm() {
    setError(null)
    try {
      await deleteAccount.mutateAsync({ id: account.id, moveTo: hasHistory ? (moveTo ?? undefined) : undefined })
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not remove account.'))
    }
  }

  return (
    <Modal title={`Delete "${account.name}"?`} onClose={onClose}>
      {others.length === 0 ? (
        <p className="acc-del-text">
          This is your only account. Add another account first, then you can delete this one.
        </p>
      ) : hasHistory ? (
        <>
          <p className="acc-del-text">
            This account has {account.transaction_count} transaction{account.transaction_count === 1 ? '' : 's'} and a
            balance of <strong>{formatSignedMoney(account.net, currency, showCents)}</strong>. Nothing is lost: its
            transactions, recurring payments and balance move to the account you pick. Transfers between the two
            accounts are removed.
          </p>
          <div className="modal-field">
            <label className="modal-label" htmlFor="move-to">
              Move everything to
            </label>
            <select
              id="move-to"
              className="pm-select"
              style={{ width: '100%' }}
              value={moveTo ?? ''}
              onChange={(e) => setMoveTo(Number(e.target.value))}
            >
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : (
        <p className="acc-del-text">This account is empty, so deleting it changes nothing else.</p>
      )}

      {error && <div className="pm-inline-error">{error}</div>}

      <div className="modal-actions">
        <button className="pm-btn pm-btn-ghost-elev" onClick={onClose}>
          Cancel
        </button>
        {others.length > 0 && (
          <button className="pm-btn modal-danger-solid" onClick={onConfirm} disabled={deleteAccount.isPending}>
            {deleteAccount.isPending ? 'Deleting…' : 'Delete account'}
          </button>
        )}
      </div>
    </Modal>
  )
}

const PencilIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
    <path d="m13.5 6.5 4 4" />
  </svg>
)

const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
)
