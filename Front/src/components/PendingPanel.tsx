import { useState } from 'react'
import { useApprovePending, useDismissPending, usePending } from '../hooks/useRecurring'
import { formatDateLabel } from '../lib/dates'
import { formatTransactionAmount } from '../lib/money'

/** Recurring payments that came due and wait for a yes/no. Hidden when there
 * are none; collapsed to one line until opened. */
export function PendingPanel({ currency, showCents }: { currency: string; showCents: boolean }) {
  const { data: pending } = usePending()
  const approve = useApprovePending()
  const dismiss = useDismissPending()
  const [open, setOpen] = useState(false)

  const list = pending ?? []
  if (list.length === 0) return null

  return (
    <div className="pending-panel">
      <button className="pending-panel-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="pending-dot" />
        {list.length} payment{list.length === 1 ? '' : 's'} to approve
        <span className="pending-panel-toggle">{open ? 'Hide' : 'Review'}</span>
      </button>
      {open && (
        <div className="pending-panel-list">
          {list.map((p) => (
            <div className="pending-panel-row" key={p.id}>
              <div className="pending-panel-main">
                <div className="txn-desc">{p.description}</div>
                <div className="pending-meta">
                  {p.category_name} · {p.account_name} · {formatDateLabel(p.due_date)}
                </div>
              </div>
              <div
                className="pending-amount"
                style={{ color: p.type === 'income' ? 'var(--up)' : 'var(--down)' }}
              >
                {formatTransactionAmount(p.type, p.amount, currency, showCents)}
              </div>
              <div className="pending-panel-actions">
                <button className="btn-approve" onClick={() => approve.mutate(p.id)}>
                  Approve
                </button>
                <button className="btn-skip" onClick={() => dismiss.mutate(p.id)}>
                  Skip
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
