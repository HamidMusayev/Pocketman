import { useState } from 'react'
import { apiErrorMessage } from '../api/client'
import type { MmbakPreview, MmbakResult } from '../api/types'
import { useImportMmbak } from '../hooks/useTransactions'
import { formatTransactionAmount } from '../lib/money'
import { Modal } from './Modal'

interface Props {
  file: File
  preview: MmbakPreview
  currencySymbol: string
  showCents: boolean
  onClose: () => void
  onDone: (result: MmbakResult) => void
}

function names(list: string[], max = 6) {
  if (list.length <= max) return list.join(', ')
  return `${list.slice(0, max).join(', ')} +${list.length - max} more`
}

/** Shows what a Money Manager backup would add, and imports it on confirm. */
export function MmbakImportModal({ file, preview: p, currencySymbol, showCents, onClose, onDone }: Props) {
  const importMmbak = useImportMmbak()
  const [error, setError] = useState<string | null>(null)
  const sourceSymbol = p.currency_symbol
  const [useCurrency, setUseCurrency] = useState(false)

  const total = p.income + p.expense + p.transfer
  const nothingNew = total === 0 && p.adjustments === 0

  return (
    <Modal title="Import Money Manager backup" onClose={onClose}>
      <div className="mmbak-preview">
        <div className="mmbak-file">{file.name}</div>
        {p.date_from && p.date_to && (
          <div className="set-row-hint">
            {p.date_from} – {p.date_to}
            {p.currency_iso && ` · ${p.currency_iso}`}
          </div>
        )}

        <dl className="mmbak-stats">
          <div>
            <dt>Income</dt>
            <dd>{p.income}</dd>
          </div>
          <div>
            <dt>Expenses</dt>
            <dd>{p.expense}</dd>
          </div>
          <div>
            <dt>Transfers</dt>
            <dd>{p.transfer}</dd>
          </div>
          {p.duplicates > 0 && (
            <div>
              <dt>Already imported</dt>
              <dd>{p.duplicates}</dd>
            </div>
          )}
        </dl>

        <ul className="mmbak-notes">
          {p.new_accounts.length > 0 && (
            <li>
              New accounts: <b>{names(p.new_accounts)}</b>
            </li>
          )}
          {p.existing_accounts.length > 0 && <li>Matched accounts: {names(p.existing_accounts)}</li>}
          {p.new_categories.length > 0 && (
            <li>
              New categories: <b>{names(p.new_categories)}</b>
            </li>
          )}
          {p.adjustments > 0 && (
            <li>{p.adjustments} balance adjustment(s) go into the accounts' starting balance.</li>
          )}
          {p.skipped > 0 && <li>{p.skipped} row(s) could not be read and will be skipped.</li>}
          {p.warnings.map((w) => (
            <li key={w} className="mmbak-warn">
              {w}
            </li>
          ))}
        </ul>

        {p.sample.length > 0 && (
          <div className="mmbak-sample">
            <div className="modal-label">Latest rows</div>
            {p.sample.map((t, i) => (
              <div className="mmbak-sample-row" key={i}>
                <span className="mmbak-sample-main">
                  <span className="mmbak-sample-desc">{t.description}</span>
                  <span className="set-row-hint">
                    {t.date} · {t.type === 'transfer' ? `${t.account} → ${t.to_account}` : `${t.category} · ${t.account}`}
                  </span>
                </span>
                <span className={'mmbak-amt mmbak-amt-' + t.type}>
                  {formatTransactionAmount(t.type, t.amount, sourceSymbol || currencySymbol, showCents)}
                </span>
              </div>
            ))}
          </div>
        )}

        {sourceSymbol && sourceSymbol !== currencySymbol && (
          <label className="mmbak-check">
            <input type="checkbox" checked={useCurrency} onChange={(e) => setUseCurrency(e.target.checked)} />
            Use {sourceSymbol} as my currency symbol (now {currencySymbol})
          </label>
        )}

        {error && <div className="settings-error">{error}</div>}
      </div>

      <div className="modal-actions">
        <button className="pm-btn pm-btn-ghost-elev" onClick={onClose}>
          Cancel
        </button>
        <button
          className="pm-btn pm-btn-primary"
          disabled={importMmbak.isPending || nothingNew}
          onClick={async () => {
            setError(null)
            try {
              onDone(await importMmbak.mutateAsync({ file, useCurrency }))
            } catch (err) {
              setError(apiErrorMessage(err, 'Could not import the backup.'))
            }
          }}
        >
          {importMmbak.isPending ? 'Importing…' : nothingNew ? 'Nothing new' : `Import ${total} transaction${total === 1 ? '' : 's'}`}
        </button>
      </div>
    </Modal>
  )
}
