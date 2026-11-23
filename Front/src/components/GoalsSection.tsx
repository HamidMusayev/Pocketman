import { useState } from 'react'
import { apiErrorMessage } from '../api/client'
import type { Goal } from '../api/types'
import { useContributeToGoal, useCreateGoal, useDeleteGoal, useGoals, useUpdateGoal } from '../hooks/useGoals'
import { GOAL_ICON_KEYS, GOAL_ICON_LABELS } from '../lib/constants'
import { formatDateLabel } from '../lib/dates'
import { formatMoney, parseAmount } from '../lib/money'
import { CategoryIcon } from './CategoryIcon'
import { Modal } from './Modal'

interface MoneyProps {
  currency: string
  showCents: boolean
}

/** Savings goals: "10 000 for a car by December", with progress and how much
 * to put aside each month to get there on time. */
export function GoalsSection({ currency, showCents }: MoneyProps) {
  const { data: goals } = useGoals()
  const [form, setForm] = useState<Goal | 'new' | null>(null)
  const [contributing, setContributing] = useState<Goal | null>(null)
  const list = goals ?? []
  const money = (n: number) => formatMoney(n, currency, showCents)

  return (
    <>
      <div className="pm-section-head section-gap">
        <h2 className="pm-section-title">Savings goals</h2>
        <button className="pm-btn pm-btn-ghost pm-btn-sm" onClick={() => setForm('new')}>
          + Goal
        </button>
      </div>
      <div className="list-card">
        {list.map((g) => (
          <div className="list-row goal-row" key={g.id}>
            <span className="icon-badge">
              <CategoryIcon iconKey={g.icon} size={18} />
            </span>
            <button className="list-main goal-main" onClick={() => setForm(g)} aria-label={`Edit ${g.name}`}>
              <span className="list-title">
                {g.name}
                {g.completed && <span className="goal-done"> · reached 🎉</span>}
              </span>
              <span className="bar bar-thin">
                <span
                  className="bar-fill"
                  style={{ width: g.pct + '%', background: g.completed ? 'var(--up)' : 'var(--yellow)' }}
                />
              </span>
              <span className="list-sub">
                {money(g.saved_amount)} of {money(g.target_amount)} · {g.pct}%
                {g.target_date && !g.completed && (
                  <>
                    {' '}· by {formatDateLabel(g.target_date)}
                    {g.monthly_needed != null && g.months_left
                      ? ` · ${money(g.monthly_needed)}/month`
                      : g.months_left === 0
                        ? ' · date passed'
                        : ''}
                  </>
                )}
              </span>
            </button>
            <button className="pm-btn pm-btn-ghost pm-btn-sm" onClick={() => setContributing(g)}>
              Add money
            </button>
          </div>
        ))}
        {list.length === 0 && (
          <div className="pm-empty">A car, a trip, a safety cushion… set a target and track how close you are.</div>
        )}
      </div>

      {form && <GoalFormModal goal={form === 'new' ? undefined : form} onClose={() => setForm(null)} />}
      {contributing && (
        <ContributeModal goal={contributing} currency={currency} showCents={showCents} onClose={() => setContributing(null)} />
      )}
    </>
  )
}

function GoalFormModal({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const createGoal = useCreateGoal()
  const updateGoal = useUpdateGoal()
  const deleteGoal = useDeleteGoal()

  const [name, setName] = useState(goal?.name ?? '')
  const [target, setTarget] = useState(goal ? String(goal.target_amount) : '')
  const [saved, setSaved] = useState(goal ? String(goal.saved_amount) : '')
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? '')
  const [icon, setIcon] = useState(goal?.icon ?? 'target')
  const [error, setError] = useState<string | null>(null)

  async function onSave() {
    const targetAmount = parseAmount(target)
    const savedAmount = saved.trim() === '' ? 0 : parseAmount(saved, { allowZero: true })
    if (!name.trim()) return setError('Give the goal a name.')
    if (targetAmount === null) return setError('Enter a target amount.')
    if (savedAmount === null) return setError('Saved so far must be a number.')
    setError(null)
    const fields = {
      name: name.trim(),
      target_amount: targetAmount,
      saved_amount: savedAmount,
      target_date: targetDate || null,
      icon,
    }
    try {
      if (goal) await updateGoal.mutateAsync({ id: goal.id, patch: fields })
      else await createGoal.mutateAsync(fields)
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save goal.'))
    }
  }

  async function onDelete() {
    if (!goal || !window.confirm(`Delete the "${goal.name}" goal?`)) return
    try {
      await deleteGoal.mutateAsync(goal.id)
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not delete goal.'))
    }
  }

  return (
    <Modal title={goal ? 'Edit goal' : 'New savings goal'} onClose={onClose}>
      <div className="modal-field">
        <label className="modal-label">Name</label>
        <input
          className="pm-input"
          style={{ width: '100%' }}
          placeholder="e.g. New car"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>
      <div className="add-row">
        <div className="modal-field">
          <label className="modal-label">Target</label>
          <input
            className="pm-input pm-input-mono"
            inputMode="decimal"
            placeholder="0.00"
            aria-label="Target amount"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </div>
        <div className="modal-field">
          <label className="modal-label">Saved so far</label>
          <input
            className="pm-input pm-input-mono"
            inputMode="decimal"
            placeholder="0.00"
            aria-label="Saved so far"
            value={saved}
            onChange={(e) => setSaved(e.target.value)}
          />
        </div>
      </div>
      <div className="add-row">
        <div className="modal-field">
          <label className="modal-label">Target date (optional)</label>
          <input className="pm-input" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </div>
        <div className="modal-field">
          <label className="modal-label">Icon</label>
          <select className="pm-select" value={icon} onChange={(e) => setIcon(e.target.value)}>
            {GOAL_ICON_KEYS.map((k) => (
              <option key={k} value={k}>
                {GOAL_ICON_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="pm-inline-error">{error}</div>}

      <div className="modal-actions">
        {goal && (
          <button className="pm-btn modal-danger" onClick={onDelete} disabled={deleteGoal.isPending}>
            Delete
          </button>
        )}
        <button className="pm-btn pm-btn-ghost-elev" onClick={onClose}>
          Cancel
        </button>
        <button
          className="pm-btn pm-btn-primary"
          onClick={onSave}
          disabled={createGoal.isPending || updateGoal.isPending}
        >
          {goal ? 'Save' : 'Add goal'}
        </button>
      </div>
    </Modal>
  )
}

function ContributeModal({ goal, currency, showCents, onClose }: { goal: Goal; onClose: () => void } & MoneyProps) {
  const contribute = useContributeToGoal()
  const [amount, setAmount] = useState('')
  const [withdraw, setWithdraw] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit() {
    const amt = parseAmount(amount)
    if (amt === null) return setError('Enter an amount.')
    setError(null)
    try {
      await contribute.mutateAsync({ id: goal.id, amount: withdraw ? -amt : amt })
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update goal.'))
    }
  }

  return (
    <Modal title={goal.name} onClose={onClose}>
      <div className="seg add-type" role="group" aria-label="Direction">
        <button className={'seg-btn income' + (!withdraw ? ' active' : '')} aria-pressed={!withdraw} onClick={() => setWithdraw(false)}>
          Add
        </button>
        <button className={'seg-btn expense' + (withdraw ? ' active' : '')} aria-pressed={withdraw} onClick={() => setWithdraw(true)}>
          Take out
        </button>
      </div>
      <div className="add-amount">
        <span>{currency}</span>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          aria-label="Amount"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        />
      </div>
      <div className="modal-hint">
        Saved {formatMoney(goal.saved_amount, currency, showCents)} of {formatMoney(goal.target_amount, currency, showCents)}.
        This only tracks the goal; to move real money, add a transfer between accounts too.
      </div>
      {error && <div className="pm-inline-error">{error}</div>}
      <button className="pm-btn pm-btn-primary add-submit" onClick={onSubmit} disabled={contribute.isPending}>
        {withdraw ? 'Take out' : 'Add'}
      </button>
    </Modal>
  )
}
