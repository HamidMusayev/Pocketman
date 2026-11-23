import { useRef, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { downloadCsvBlob, exportTransactionsCsv } from '../api/transactions'
import type { ImportResult } from '../api/types'
import { useSettings, useUpdateSettings } from '../hooks/useSettings'
import { useImportTransactions } from '../hooks/useTransactions'
import { AccountSecurity, Chevron } from './AccountSecurity'
import { ACCENT_COLORS } from '../lib/constants'
import { getThemeMode, setThemeMode, type ThemeMode } from '../lib/themeMode'
import { useAuth } from '../auth/AuthContext'
import './Settings.css'

export function SettingsPage() {
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()

  const [themeMode, setThemeModeState] = useState<ThemeMode>(getThemeMode)

  const importTransactions = useImportTransactions()
  const fileInput = useRef<HTMLInputElement>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  if (!settings) return null

  return (
    <div className="settings-page">
      <div className="page-head">
        <h1 className="page-title">Settings</h1>
      </div>

      <ProfileCard />

      <h2 className="set-group-title">Appearance</h2>
      <section className="set-group">
        <div className="set-row set-row-stack">
          <span className="set-row-label">Theme</span>
          <div className="seg" role="group" aria-label="Theme">
            {(['dark', 'light', 'system'] as ThemeMode[]).map((m) => (
              <button
                key={m}
                className={'seg-btn' + (themeMode === m ? ' active' : '')}
                aria-pressed={themeMode === m}
                onClick={() => {
                  setThemeMode(m)
                  setThemeModeState(m)
                }}
              >
                {m === 'dark' ? 'Dark' : m === 'light' ? 'Light' : 'Auto'}
              </button>
            ))}
          </div>
        </div>
        <div className="set-row">
          <span className="set-row-label">Accent color</span>
          <div className="accent-swatches">
            {ACCENT_COLORS.map((a) => (
              <button
                key={a.value}
                className={'accent-swatch' + (settings.accent_color === a.value ? ' active' : '')}
                style={{ background: a.value }}
                title={a.label}
                aria-label={a.label}
                aria-pressed={settings.accent_color === a.value}
                onClick={() => updateSettings.mutate({ accent_color: a.value })}
              />
            ))}
          </div>
        </div>
      </section>

      <h2 className="set-group-title">Numbers</h2>
      <section className="set-group">
        <label className="set-row" htmlFor="currency">
          <span className="set-row-label">Currency symbol</span>
          <input
            id="currency"
            className="settings-input settings-input-narrow"
            value={settings.currency_symbol}
            onChange={(e) => updateSettings.mutate({ currency_symbol: e.target.value })}
            maxLength={4}
          />
        </label>
        <label className="set-row">
          <span className="set-row-label">Show cents</span>
          <input
            type="checkbox"
            className="set-switch"
            role="switch"
            checked={settings.show_cents}
            onChange={(e) => updateSettings.mutate({ show_cents: e.target.checked })}
          />
        </label>
      </section>

      <h2 className="set-group-title">Data</h2>
      <section className="set-group">
        <button
          className="set-row set-row-btn"
          onClick={async () => downloadCsvBlob(await exportTransactionsCsv({ period: 'all' }))}
        >
          <span>
            <span className="set-row-label">Export CSV</span>
            <span className="set-row-hint">Download every transaction</span>
          </span>
          <Chevron />
        </button>
        <button
          className="set-row set-row-btn"
          onClick={() => fileInput.current?.click()}
          disabled={importTransactions.isPending}
        >
          <span>
            <span className="set-row-label">{importTransactions.isPending ? 'Importing…' : 'Import CSV'}</span>
            <span className="set-row-hint">Bring transactions in from a file</span>
          </span>
          <Chevron />
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            setImportError(null)
            try {
              setImportResult(await importTransactions.mutateAsync(file))
            } catch (err) {
              setImportError(apiErrorMessage(err, 'Could not import CSV.'))
            }
          }}
        />
        {(importError || importResult) && (
          <div className="set-row-note">
            {importError && <div className="settings-error">{importError}</div>}
            {importResult && (
              <div className="settings-success">
                Imported {importResult.created} transaction{importResult.created === 1 ? '' : 's'}
                {importResult.skipped > 0 && `, skipped ${importResult.skipped}`}.
                {importResult.errors.length > 0 && (
                  <ul className="settings-import-errors">
                    {importResult.errors.slice(0, 8).map((er, i) => (
                      <li key={i}>
                        Row {er.row}: {er.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <AccountSecurity />
    </div>
  )
}

/** Who is signed in, with the log-out action right next to it. */
function ProfileCard() {
  const { username } = useAuth()
  return (
    <section className="set-profile">
      <span className="set-avatar" aria-hidden="true">
        {(username ?? '?').slice(0, 1).toUpperCase()}
      </span>
      <span className="set-profile-main">
        <span className="set-profile-name">{username ?? 'Signed in'}</span>
        <span className="set-row-hint">Signed in on this device</span>
      </span>
    </section>
  )
}
