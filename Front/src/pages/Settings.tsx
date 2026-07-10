import { useState, type FormEvent } from 'react'
import { changePassword } from '../api/auth'
import { apiErrorMessage } from '../api/client'
import { useSettings, useUpdateSettings } from '../hooks/useSettings'
import './Settings.css'

const ACCENTS = [
  { value: '#FCD535', label: 'Yellow' },
  { value: '#2dbdb6', label: 'Turquoise' },
  { value: '#0ecb81', label: 'Green' },
  { value: '#3b82f6', label: 'Blue' },
]

export function SettingsPage() {
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  async function onChangePassword(e: FormEvent) {
    e.preventDefault()
    setPwError(null)
    setPwSuccess(false)
    setPwLoading(true)
    try {
      await changePassword(currentPassword, newPassword)
      setPwSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      setPwError(apiErrorMessage(err, 'Could not change password.'))
    } finally {
      setPwLoading(false)
    }
  }

  if (!settings) return null

  return (
    <div className="settings-page">
      <h1 className="settings-title">Settings</h1>

      <section className="settings-section">
        <h2 className="settings-section-title">Appearance</h2>
        <div className="settings-field">
          <div className="settings-field-label">Accent color</div>
          <div className="accent-swatches">
            {ACCENTS.map((a) => (
              <button
                key={a.value}
                className={'accent-swatch' + (settings.accent_color === a.value ? ' active' : '')}
                style={{ background: a.value }}
                title={a.label}
                onClick={() => updateSettings.mutate({ accent_color: a.value })}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Numbers</h2>
        <div className="settings-field">
          <label className="settings-field-label" htmlFor="currency">
            Currency symbol
          </label>
          <input
            id="currency"
            className="settings-input settings-input-narrow"
            value={settings.currency_symbol}
            onChange={(e) => updateSettings.mutate({ currency_symbol: e.target.value })}
            maxLength={4}
          />
        </div>
        <label className="settings-checkbox">
          <input
            type="checkbox"
            checked={settings.show_cents}
            onChange={(e) => updateSettings.mutate({ show_cents: e.target.checked })}
          />
          Show cents
        </label>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Change password</h2>
        <form onSubmit={onChangePassword} className="settings-password-form">
          <input
            className="settings-input"
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <input
            className="settings-input"
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          {pwError && <div className="settings-error">{pwError}</div>}
          {pwSuccess && <div className="settings-success">Password changed.</div>}
          <button className="settings-submit" type="submit" disabled={pwLoading}>
            {pwLoading ? 'Changing…' : 'Change password'}
          </button>
        </form>
      </section>
    </div>
  )
}
