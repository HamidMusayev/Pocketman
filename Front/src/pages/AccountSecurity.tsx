import { useState, type FormEvent } from 'react'
import { changePassword, changeUsername, logoutAll } from '../api/auth'
import { apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { passwordError, usernameError } from '../auth/validation'

type Status = { kind: 'error' | 'success'; text: string } | null

function StatusLine({ status }: { status: Status }) {
  if (!status) return null
  return (
    <div className={status.kind === 'error' ? 'settings-error' : 'settings-success'} role="status">
      {status.text}
    </div>
  )
}

/** Settings → Account: who is signed in, rename, change password, sign out everywhere. */
export function AccountSecurity() {
  const { username, setSession } = useAuth()

  const [newUsername, setNewUsername] = useState('')
  const [unPassword, setUnPassword] = useState('')
  const [unStatus, setUnStatus] = useState<Status>(null)
  const [unLoading, setUnLoading] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwStatus, setPwStatus] = useState<Status>(null)
  const [pwLoading, setPwLoading] = useState(false)

  const [allStatus, setAllStatus] = useState<Status>(null)

  async function onChangeUsername(e: FormEvent) {
    e.preventDefault()
    const err = usernameError(newUsername)
    if (err) return setUnStatus({ kind: 'error', text: err })
    if (!unPassword) return setUnStatus({ kind: 'error', text: 'Enter your password to confirm.' })
    setUnLoading(true)
    setUnStatus(null)
    try {
      const res = await changeUsername(newUsername, unPassword)
      setSession(res.token, res.username)
      setNewUsername('')
      setUnPassword('')
      setUnStatus({ kind: 'success', text: `Username changed to ${res.username}.` })
    } catch (er) {
      setUnStatus({ kind: 'error', text: apiErrorMessage(er, 'Could not change username.') })
    } finally {
      setUnLoading(false)
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault()
    const err = passwordError(newPassword)
    if (err) return setPwStatus({ kind: 'error', text: err })
    if (newPassword !== confirm) return setPwStatus({ kind: 'error', text: 'New passwords do not match.' })
    setPwLoading(true)
    setPwStatus(null)
    try {
      const res = await changePassword(currentPassword, newPassword)
      setSession(res.token, res.username)
      setCurrentPassword('')
      setNewPassword('')
      setConfirm('')
      setPwStatus({ kind: 'success', text: 'Password changed. Other devices have been signed out.' })
    } catch (er) {
      setPwStatus({ kind: 'error', text: apiErrorMessage(er, 'Could not change password.') })
    } finally {
      setPwLoading(false)
    }
  }

  async function onLogoutAll() {
    setAllStatus(null)
    try {
      const res = await logoutAll()
      setSession(res.token, res.username)
      setAllStatus({ kind: 'success', text: 'All other devices have been signed out.' })
    } catch (er) {
      setAllStatus({ kind: 'error', text: apiErrorMessage(er, 'Could not sign out other devices.') })
    }
  }

  return (
    <section className="settings-section">
      <h2 className="settings-section-title">Account</h2>
      {username && (
        <p className="settings-hint">
          Signed in as <strong>{username}</strong>
        </p>
      )}

      <form onSubmit={onChangeUsername} className="settings-password-form" noValidate>
        <div className="settings-field-label">Change username</div>
        <input
          className="settings-input"
          placeholder="New username"
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
        />
        <input
          className="settings-input"
          type="password"
          placeholder="Password"
          value={unPassword}
          onChange={(e) => setUnPassword(e.target.value)}
          autoComplete="current-password"
        />
        <StatusLine status={unStatus} />
        <button className="settings-submit" type="submit" disabled={unLoading}>
          {unLoading ? 'Saving…' : 'Change username'}
        </button>
      </form>

      <form onSubmit={onChangePassword} className="settings-password-form" noValidate>
        <div className="settings-field-label">Change password</div>
        <input
          className="settings-input"
          type="password"
          placeholder="Current password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
        />
        <input
          className="settings-input"
          type="password"
          placeholder="New password (8+ characters, letters and digits)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
        />
        <input
          className="settings-input"
          type="password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
        <StatusLine status={pwStatus} />
        <button className="settings-submit" type="submit" disabled={pwLoading}>
          {pwLoading ? 'Changing…' : 'Change password'}
        </button>
      </form>

      <div className="settings-password-form">
        <div className="settings-field-label">Sessions</div>
        <button className="pm-btn pm-btn-ghost" type="button" onClick={onLogoutAll} style={{ alignSelf: 'flex-start' }}>
          Sign out other devices
        </button>
        <StatusLine status={allStatus} />
      </div>
    </section>
  )
}
