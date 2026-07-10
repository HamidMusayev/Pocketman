import { useMemo, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import type { Category, CategoryBudgetItem } from '../api/types'
import { CategoryFormModal } from '../components/CategoryFormModal'
import { CategoryIcon } from '../components/CategoryIcon'
import { usePeriodParams } from '../context/PeriodContext'
import { useBudgetSummary, useCategories, useDeleteCategory, useUpdateCategory } from '../hooks/useCategories'
import { useSettings } from '../hooks/useSettings'
import { budgetColor, ringColor, ringDash } from '../lib/charts'
import { formatMoney, formatSignedMoney } from '../lib/money'
import './pages.css'

export function Categories() {
  const params = usePeriodParams()
  const { data: summary } = useBudgetSummary(params)
  const { data: categories } = useCategories()
  const { data: settings } = useSettings()
  const deleteCategory = useDeleteCategory()

  const currency = settings?.currency_symbol ?? '$'
  const showCents = settings?.show_cents ?? true

  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Category | null>(null)
  const [adding, setAdding] = useState(false)

  const incomeCategories = useMemo(
    () => (categories ?? []).filter((c) => c.type === 'income'),
    [categories],
  )

  async function onRemove(id: number) {
    setError(null)
    try {
      await deleteCategory.mutateAsync(id)
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not remove category.'))
    }
  }

  const ringPct = summary?.pct ?? 0
  const spentTotal = summary?.spent_total ?? 0
  const budgetTotal = summary?.budget_total ?? 0
  const remaining = budgetTotal - spentTotal
  const rc = ringColor(ringPct)

  return (
    <div>
      <div className="budget-header">
        <div className="budget-ring">
          <svg width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="30" fill="none" stroke="var(--elev)" strokeWidth="8" />
            <circle
              cx="36"
              cy="36"
              r="30"
              fill="none"
              stroke={rc}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={ringDash(spentTotal, budgetTotal, 30)}
              transform="rotate(-90 36 36)"
            />
          </svg>
          <div className="budget-ring-pct">{ringPct}%</div>
        </div>
        <div className="budget-header-main">
          <div className="budget-header-title">Budget used · {params.period === 'monthly' ? 'this month' : 'this period'}</div>
          <div className="budget-header-sub">
            {formatMoney(spentTotal, currency, showCents)} of {formatMoney(budgetTotal, currency, showCents)}{' '}
            budgeted across {summary?.budgeted_count ?? 0} categories
          </div>
        </div>
        <div className="budget-header-remain">
          <div className="budget-header-remain-val" style={{ color: rc }}>
            {formatSignedMoney(remaining, currency, showCents)}
          </div>
          <div className="budget-header-remain-label">remaining</div>
        </div>
      </div>

      <div className="pm-section-head">
        <div className="pm-section-title">Expense categories</div>
        <button className="pm-btn pm-btn-ghost" onClick={() => setAdding(true)}>
          + Add category
        </button>
      </div>

      <div className="cat-grid">
        {(summary?.categories ?? []).map((c) => (
          <ExpenseCard
            key={c.category_id}
            item={c}
            currency={currency}
            showCents={showCents}
            onEdit={() => {
              const full = categories?.find((x) => x.id === c.category_id)
              if (full) setEditing(full)
            }}
            onRemove={() => onRemove(c.category_id)}
          />
        ))}
      </div>

      {incomeCategories.length > 0 && (
        <>
          <div className="pm-section-head section-gap">
            <div className="pm-section-title">Income categories</div>
          </div>
          <div className="cat-income-list">
            {incomeCategories.map((c) => (
              <div className="cat-income-row" key={c.id}>
                <span className="icon-badge">
                  <CategoryIcon iconKey={c.icon} size={16} />
                </span>
                <div className="cat-income-name">{c.name}</div>
                <button className="row-edit-btn" onClick={() => setEditing(c)}>
                  edit
                </button>
                <button className="row-icon-btn" onClick={() => onRemove(c.id)} aria-label="Remove">
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {error && <div className="pm-inline-error">{error}</div>}

      {adding && <CategoryFormModal onClose={() => setAdding(false)} />}
      {editing && <CategoryFormModal category={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function ExpenseCard({
  item,
  currency,
  showCents,
  onEdit,
  onRemove,
}: {
  item: CategoryBudgetItem
  currency: string
  showCents: boolean
  onEdit: () => void
  onRemove: () => void
}) {
  const updateCategory = useUpdateCategory()
  const [draft, setDraft] = useState(item.budget != null ? String(item.budget) : '')

  const pctUsed = item.pct_used
  const barWidth = pctUsed != null ? Math.min(100, pctUsed) : 0
  const barColor = budgetColor(pctUsed)

  async function onSave() {
    const value = draft.trim() === '' ? null : Number(draft)
    await updateCategory.mutateAsync({ id: item.category_id, patch: { budget: value } })
  }

  return (
    <div className="cat-card">
      <div className="cat-card-head">
        <span className="icon-badge">
          <CategoryIcon iconKey={item.icon} size={17} />
        </span>
        <div className="cat-card-name">{item.name}</div>
        <button className="row-edit-btn" onClick={onEdit}>
          edit
        </button>
        <button className="row-icon-btn" onClick={onRemove} aria-label="Remove">
          ×
        </button>
      </div>
      <div className="cat-bar">
        <div className="cat-bar-fill" style={{ width: barWidth + '%', background: barColor }} />
      </div>
      <div className="cat-card-stats">
        <span className="cat-card-spent">{formatMoney(item.spent, currency, showCents)} spent</span>
        <span className="cat-card-pct">{pctUsed != null ? pctUsed + '%' : '—'}</span>
      </div>
      <div className="cat-budget-row">
        <span>Budget:</span>
        <input
          className="cat-budget-input"
          type="number"
          placeholder="optional"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSave()}
        />
        <button className="cat-budget-save" onClick={onSave} disabled={updateCategory.isPending}>
          Save
        </button>
      </div>
    </div>
  )
}
