import { useMemo, useState } from 'react'
import type { Category, RecurringRule } from '../api/types'
import { CategoryFormModal } from '../components/CategoryFormModal'
import { CategoryIcon } from '../components/CategoryIcon'
import { PeriodPicker } from '../components/PeriodPicker'
import { RecurringFormModal } from '../components/RecurringFormModal'
import { usePeriodParams } from '../context/PeriodContext'
import { useAccounts } from '../hooks/useAccounts'
import { useBudgetSummary, useCategories } from '../hooks/useCategories'
import { useCategoryIconById } from '../hooks/useCategoryIcons'
import { useRecurringRules } from '../hooks/useRecurring'
import { useSettings } from '../hooks/useSettings'
import { budgetColor, ringColor } from '../lib/charts'
import { formatDateLabel } from '../lib/dates'
import { formatMoney, formatTransactionAmount, sumMoney } from '../lib/money'
import './pages.css'

/** Budgets per category, plus the recurring payments that feed them. */
export function Budget() {
  const params = usePeriodParams()
  const { data: summary } = useBudgetSummary(params)
  const { data: categories } = useCategories()
  const { data: accounts } = useAccounts()
  const { data: rules } = useRecurringRules()
  const { data: settings } = useSettings()
  const iconById = useCategoryIconById()

  const currency = settings?.currency_symbol ?? '$'
  const showCents = settings?.show_cents ?? true

  const [editing, setEditing] = useState<Category | null>(null)
  const [addingCategory, setAddingCategory] = useState(false)
  const [addingRule, setAddingRule] = useState(false)
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null)

  const incomeCategories = useMemo(() => (categories ?? []).filter((c) => c.type === 'income'), [categories])

  // all spending this period (the summary only totals categories that have a budget)
  const spentAll = sumMoney((summary?.categories ?? []).map((c) => c.spent))
  const spent = summary?.spent_total ?? 0
  const budgeted = summary?.budget_total ?? 0
  const pct = summary?.pct ?? 0
  const hasBudget = budgeted > 0

  // Spending categories, the ones with money spent first.
  const rows = [...(summary?.categories ?? [])].sort((a, b) => b.spent - a.spent)

  function edit(id: number) {
    const full = categories?.find((c) => c.id === id)
    if (full) setEditing(full)
  }

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Budget</h1>
        <div className="page-head-actions">
          <PeriodPicker />
        </div>
      </div>

      <div className="split">
      <aside className="split-side">
      {/* ---------------------------- total ---------------------------- */}
      <section className="summary budget-total">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="summary-label">Spent</div>
          <div className="summary-balance">{formatMoney(spentAll, currency, showCents)}</div>
          {hasBudget ? (
            <>
              <div className="bar">
                <div className="bar-fill" style={{ width: Math.min(100, pct) + '%', background: ringColor(pct) }} />
              </div>
              <div className="budget-total-sub">
                Budgeted categories: {formatMoney(spent, currency, showCents)} of {formatMoney(budgeted, currency, showCents)} ·{' '}
                {budgeted - spent >= 0
                  ? `${formatMoney(budgeted - spent, currency, showCents)} left`
                  : `${formatMoney(spent - budgeted, currency, showCents)} over`}
              </div>
            </>
          ) : (
            <div className="budget-total-sub">Tap a category to give it a monthly budget.</div>
          )}
        </div>
      </section>

      {/* --------------------------- recurring ------------------------- */}
      <div className="pm-section-head" id="recurring">
        <h2 className="pm-section-title">Recurring payments</h2>
        <button className="pm-btn pm-btn-ghost pm-btn-sm" onClick={() => setAddingRule(true)}>
          + New
        </button>
      </div>
      <div className="list-card">
        {(rules ?? []).map((r) => (
          <button className="list-row" key={r.id} onClick={() => setEditingRule(r)} aria-label={`Edit ${r.description}`}>
            <span className="icon-badge">
              <CategoryIcon iconKey={r.type === 'transfer' ? 'transfer' : iconById(r.category_id)} size={17} />
            </span>
            <span className="list-main">
              <span className="list-title">{r.description}</span>
              <span className="list-sub">
                {r.type === 'transfer' && `${r.account_name} → ${r.transfer_account_name} · `}
                {r.frequency} · next {formatDateLabel(r.next_due_date)}
                {r.auto_approve && ' · automatic'}
              </span>
            </span>
            <span
              className={'list-value' + (r.type === 'transfer' ? ' txn-transfer' : '')}
              style={r.type === 'transfer' ? undefined : { color: r.type === 'income' ? 'var(--up)' : 'var(--down)' }}
            >
              {formatTransactionAmount(r.type, r.amount, currency, showCents)}
            </span>
          </button>
        ))}
        {(rules ?? []).length === 0 && (
          <div className="pm-empty">Rent, subscriptions, salary, savings transfers… add them once; approve each time or let them post automatically.</div>
        )}
      </div>

      </aside>

      <div className="split-main">
      {/* -------------------------- categories ------------------------- */}
      <div className="pm-section-head">
        <h2 className="pm-section-title">Spending by category</h2>
        <button className="pm-btn pm-btn-ghost pm-btn-sm" onClick={() => setAddingCategory(true)}>
          + Category
        </button>
      </div>
      <div className="list-card">
        {rows.map((c) => (
          <button className="list-row" key={c.category_id} onClick={() => edit(c.category_id)}>
            <span className="icon-badge">
              <CategoryIcon iconKey={c.icon} size={17} />
            </span>
            <span className="list-main">
              <span className="list-title">{c.name}</span>
              {c.budget != null && (
                <span className="bar bar-thin">
                  <span
                    className="bar-fill"
                    style={{ width: Math.min(100, c.pct_used ?? 0) + '%', background: budgetColor(c.pct_used) }}
                  />
                </span>
              )}
            </span>
            <span className="list-value">
              {formatMoney(c.spent, currency, showCents)}
              {c.budget != null && (
                <span className="list-value-sub"> / {formatMoney(c.budget, currency, showCents)}</span>
              )}
            </span>
          </button>
        ))}
        {rows.length === 0 && <div className="pm-empty">No spending categories yet.</div>}
      </div>

      {incomeCategories.length > 0 && (
        <div className="income-cats">
          <span className="summary-label">Income categories:</span>
          {incomeCategories.map((c) => (
            <button className="add-chip" key={c.id} onClick={() => setEditing(c)}>
              <CategoryIcon iconKey={c.icon} size={14} strokeWidth={1.9} />
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      )}

      </div>
      </div>

      {addingCategory && <CategoryFormModal onClose={() => setAddingCategory(false)} />}
      {editing && <CategoryFormModal category={editing} onClose={() => setEditing(null)} />}
      {(addingRule || editingRule) && (
        <RecurringFormModal
          categories={categories ?? []}
          accounts={accounts ?? []}
          currency={currency}
          rule={editingRule ?? undefined}
          onClose={() => {
            setAddingRule(false)
            setEditingRule(null)
          }}
        />
      )}
    </div>
  )
}
