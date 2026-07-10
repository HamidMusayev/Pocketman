import { useState } from 'react'
import { apiErrorMessage } from '../api/client'
import type { Category, TxnType } from '../api/types'
import { useCreateCategory, useUpdateCategory } from '../hooks/useCategories'
import { CATEGORY_ICON_KEYS } from '../lib/constants'
import { CategoryIcon } from './CategoryIcon'
import { Modal } from './Modal'
import './categoryForm.css'

interface Props {
  /** When provided, the modal edits this category; otherwise it creates a new one. */
  category?: Category
  onClose: () => void
}

export function CategoryFormModal({ category, onClose }: Props) {
  const isEdit = !!category
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()

  const [name, setName] = useState(category?.name ?? '')
  const [type, setType] = useState<TxnType>(category?.type ?? 'expense')
  const [icon, setIcon] = useState(category?.icon ?? 'other')
  const [budget, setBudget] = useState(category?.budget != null ? String(category.budget) : '')
  const [error, setError] = useState<string | null>(null)

  async function onSubmit() {
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    setError(null)
    const budgetValue = budget.trim() === '' ? null : Number(budget)
    try {
      if (isEdit) {
        await updateCategory.mutateAsync({
          id: category!.id,
          patch: { name: name.trim(), icon, budget: type === 'expense' ? budgetValue : null },
        })
      } else {
        await createCategory.mutateAsync({
          name: name.trim(),
          type,
          icon,
          budget: type === 'expense' ? budgetValue : null,
        })
      }
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not save category.'))
    }
  }

  const pending = createCategory.isPending || updateCategory.isPending

  return (
    <Modal title={isEdit ? 'Edit category' : 'New category'} onClose={onClose}>
      <div className="modal-field">
        <label className="modal-label">Name</label>
        <input
          className="pm-input"
          style={{ width: '100%' }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>

      {!isEdit && (
        <div className="modal-field">
          <label className="modal-label">Type</label>
          <div className="type-toggle">
            <button
              type="button"
              className={type === 'expense' ? 'exp-active' : ''}
              onClick={() => setType('expense')}
            >
              Expense
            </button>
            <button
              type="button"
              className={type === 'income' ? 'inc-active' : ''}
              onClick={() => setType('income')}
            >
              Income
            </button>
          </div>
        </div>
      )}

      <div className="modal-field">
        <label className="modal-label">Icon</label>
        <div className="icon-picker">
          {CATEGORY_ICON_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              className={'icon-picker-btn' + (icon === k ? ' active' : '')}
              onClick={() => setIcon(k)}
              title={k}
            >
              <CategoryIcon iconKey={k} size={18} />
            </button>
          ))}
        </div>
      </div>

      {type === 'expense' && (
        <div className="modal-field">
          <label className="modal-label">Monthly budget (optional)</label>
          <input
            className="pm-input pm-input-mono"
            style={{ width: '100%' }}
            type="number"
            placeholder="—"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </div>
      )}

      {error && <div className="pm-inline-error">{error}</div>}

      <div className="modal-actions">
        <button className="pm-btn pm-btn-ghost-elev" onClick={onClose}>
          Cancel
        </button>
        <button className="pm-btn pm-btn-primary" onClick={onSubmit} disabled={pending}>
          {isEdit ? 'Save' : 'Add category'}
        </button>
      </div>
    </Modal>
  )
}
