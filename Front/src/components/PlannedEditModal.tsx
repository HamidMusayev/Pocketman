import { useState } from 'react'
import { apiErrorMessage } from '../api/client'
import type { PlannedItem } from '../api/types'
import { useConfirmPlanned, useDeletePlanned, useUpdatePlanned } from '../hooks/usePlanned'
import { todayIso } from '../lib/dates'
import { parseAmount } from '../lib/money'
import { Modal } from './Modal'

/** Edit an upcoming planned item: amount, description, date — or drop it,
 * or mark it as already done. */
export function PlannedEditModal({ item, currency, onClose }: { item: PlannedItem; currency: string; onClose: () => void }) {
  const update = useUpdatePlanned()
  const remove = useDeletePlanned()
  const confirm = useConfirmPlanned()
  const [amount, setAmount] = useState(String(item.amount))
  const [desc, setDesc] = useState(item.description)
  const [date, setDate] = useState(item.due_date)
  const [error, setError] = useState<string | null>(null)
  const busy = update.isPending || remove.isPending || confirm.isPending

  async function run(action: () => Promise<unknown>, fallback: string) {
    setError(null)
    try {
      await action()
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err, fallback))
    }
  }

  function onSave() {
    const amt = parseAmount(amount)
    if (amt === null) return setError('Enter an amount.')
    if (!desc.trim()) return setError('Enter a description.')
    if (!date) return setError('Pick a date.')
    run(() => update.mutateAsync({ id: item.id, patch: { amount: amt, description: desc.trim(), date } }), 'Could not save.')
  }

  return (
    <Modal title="Planned" onClose={onClose}>
      <p className="planned-hint">
        Not counted in your balance yet. On {date || 'the day'} Pocketman asks whether it happened.
      </p>
      <div className="add-amount">
        <span>{currency}</span>
        <input type="text" inputMode="decimal" aria-label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <input className="pm-input add-desc" aria-label="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <div className="modal-field">
        <label className="modal-label">Expected on</label>
        <input className="pm-input" style={{ width: '100%' }} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {error && <div className="pm-inline-error">{error}</div>}

      <div className="modal-actions">
        <button
          className="pm-btn modal-danger"
          disabled={busy}
          onClick={() => {
            if (!window.confirm(`Delete planned "${item.description}"?`)) return
            run(() => remove.mutateAsync(item.id), 'Could not delete.')
          }}
        >
          Delete
        </button>
        <button
          className="pm-btn pm-btn-ghost-elev"
          disabled={busy}
          title="It already happened: add it to your transactions today"
          onClick={() => {
            const amt = parseAmount(amount)
            if (amt === null) return setError('Enter an amount.')
            run(() => confirm.mutateAsync({ id: item.id, amount: amt, date: todayIso() }), 'Could not save.')
          }}
        >
          Done today
        </button>
        <button className="pm-btn pm-btn-primary" onClick={onSave} disabled={busy}>
          Save
        </button>
      </div>
    </Modal>
  )
}
