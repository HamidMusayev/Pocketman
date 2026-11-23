import { useState } from 'react'
import { apiErrorMessage } from '../api/client'
import type { PlannedItem } from '../api/types'
import { useConfirmPlanned, useDeletePlanned, usePlanned, usePostponePlanned } from '../hooks/usePlanned'
import { addDaysIso, dueLabel, todayIso } from '../lib/dates'
import { formatTransactionAmount, parseAmount } from '../lib/money'

interface Props {
  currency: string
  showCents: boolean
}

/** Planned items whose day has come, one card each: "Did it happen?" */
export function PlannedPanel({ currency, showCents }: Props) {
  const { data } = usePlanned()
  const today = todayIso()
  const due = (data ?? []).filter((p) => p.due_date <= today)
  if (due.length === 0) return null

  return (
    <section className="due-list" aria-label="Planned items to check">
      {due.map((p) => (
        <DueCard key={p.id} item={p} today={today} currency={currency} showCents={showCents} />
      ))}
    </section>
  )
}

type Step = 'ask' | 'yes' | 'no' | 'pick-date'

function DueCard({ item, today, currency, showCents }: { item: PlannedItem; today: string; currency: string; showCents: boolean }) {
  const confirm = useConfirmPlanned()
  const postpone = usePostponePlanned()
  const remove = useDeletePlanned()
  const [step, setStep] = useState<Step>('ask')
  const [amount, setAmount] = useState(String(item.amount))
  const [date, setDate] = useState(item.due_date)
  const [later, setLater] = useState(addDaysIso(today, 1))
  const [error, setError] = useState<string | null>(null)
  const busy = confirm.isPending || postpone.isPending || remove.isPending

  const color = item.type === 'transfer' ? undefined : item.type === 'income' ? 'var(--up)' : 'var(--down)'
  const overdue = item.due_date < today

  async function run(action: () => Promise<unknown>, fallback: string) {
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(apiErrorMessage(err, fallback))
    }
  }

  function onConfirm() {
    const amt = parseAmount(amount)
    if (amt === null) {
      setError('Enter an amount.')
      return
    }
    run(() => confirm.mutateAsync({ id: item.id, amount: amt, date }), 'Could not save it.')
  }

  const moveTo = (d: string) => run(() => postpone.mutateAsync({ id: item.id, date: d }), 'Could not postpone it.')

  return (
    <div className="due-card">
      <div className="due-card-top">
        <div className="due-card-main">
          <div className="due-card-title">{item.description}</div>
          <div className="pending-meta">
            <span className={overdue ? 'due-overdue' : undefined}>{dueLabel(item.due_date, today)}</span>
            {' · '}
            {item.type === 'transfer'
              ? `${item.account_name} → ${item.transfer_account_name}`
              : `${item.category_name} · ${item.account_name}`}
            {item.frequency && ` · ${item.frequency}`}
          </div>
        </div>
        <div className="pending-amount" style={color ? { color } : undefined}>
          {formatTransactionAmount(item.type, item.amount, currency, showCents)}
        </div>
      </div>

      {step === 'ask' && (
        <div className="due-card-row">
          <span className="due-question">Did it happen?</span>
          <div className="due-actions">
            <button className="btn-approve" onClick={() => setStep('yes')}>
              Yes
            </button>
            <button className="btn-skip" onClick={() => setStep('no')}>
              No
            </button>
          </div>
        </div>
      )}

      {step === 'yes' && (
        <div className="due-card-form">
          <label className="due-field">
            <span>Amount</span>
            <span className="due-amount-input">
              {currency}
              <input
                type="text"
                inputMode="decimal"
                aria-label="Actual amount"
                value={amount}
                autoFocus
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
              />
            </span>
          </label>
          <label className="due-field">
            <span>Date</span>
            <input className="pm-input" type="date" aria-label="Actual date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          </label>
          <div className="due-actions">
            <button className="btn-approve" onClick={onConfirm} disabled={busy}>
              Save
            </button>
            <button className="btn-skip" onClick={() => setStep('ask')} disabled={busy}>
              Back
            </button>
          </div>
        </div>
      )}

      {step === 'no' && (
        <div className="due-card-row due-card-wrap">
          <span className="due-question">Postpone it, or delete?</span>
          <div className="due-actions">
            <button className="btn-skip" onClick={() => moveTo(addDaysIso(today, 1))} disabled={busy}>
              Tomorrow
            </button>
            <button className="btn-skip" onClick={() => moveTo(addDaysIso(today, 7))} disabled={busy}>
              In a week
            </button>
            <button className="btn-skip" onClick={() => setStep('pick-date')} disabled={busy}>
              Pick a date
            </button>
            <button
              className="btn-skip btn-danger-text"
              onClick={() => run(() => remove.mutateAsync(item.id), 'Could not delete it.')}
              disabled={busy}
            >
              Delete
            </button>
            <button className="link-btn" onClick={() => setStep('ask')} disabled={busy}>
              Back
            </button>
          </div>
        </div>
      )}

      {step === 'pick-date' && (
        <div className="due-card-row due-card-wrap">
          <input className="pm-input due-date-input" type="date" aria-label="Postpone to" min={today} value={later} onChange={(e) => setLater(e.target.value)} />
          <div className="due-actions">
            <button className="btn-approve" onClick={() => later && moveTo(later)} disabled={busy || !later}>
              Postpone
            </button>
            <button className="btn-skip" onClick={() => setStep('no')} disabled={busy}>
              Back
            </button>
          </div>
        </div>
      )}

      {error && <div className="pm-inline-error">{error}</div>}
    </div>
  )
}
