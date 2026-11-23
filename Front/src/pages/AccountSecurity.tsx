import { useState, type FormEvent } from 'react'
import { changePassword, changeUsername, logoutAll } from '../api/auth'
import { apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { passwordError, usernameError } from '../auth/validation'
import { LogoutIcon } from '../components/TopBar'

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
  const { username, setSession, logout } = useAuth()

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

  const [open, setOpen] = useState<'username' | 'password' | null>(null)
  const toggle = (k: 'username' | 'password') => setOpen((cur) => (cur === k ? null : k))

  return (
    <>
      <h2 className="set-group-title">Security</h2>
      <section className="set-group">
        <button className="set-row set-row-btn" onClick={() => toggle('username')} aria-expanded={open === 'username'}>
          <span>
            <span className="set-row-label">Change username</span>
            <span className="set-row-hint">Currently {username}</span>
          </span>
          <Chevron open={open === 'username'} />
        </button>
        {open === 'username' && (
          <form onSubmit={onChangeUsername} className="set-row-form" noValidate>
            <input
              className="settings-input"
              placeholder="New username"
              aria-label="New username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
            />
            <input
              className="settings-input"
              type="password"
              placeholder="Password"
              aria-label="Password"
              value={unPassword}
              onChange={(e) => setUnPassword(e.target.value)}
              autoComplete="current-password"
            />
            <StatusLine status={unStatus} />
            <button className="settings-submit" type="submit" disabled={unLoading}>
              {unLoading ? 'Saving…' : 'Change username'}
            </button>
          </form>
        )}
        {open !== 'username' && unStatus?.kind === 'success' && (
          <div className="set-row-note">
            <StatusLine status={unStatus} />
          </div>
        )}

        <button className="set-row set-row-btn" onClick={() => toggle('password')} aria-expanded={open === 'password'}>
          <span>
            <span className="set-row-label">Change password</span>
            <span className="set-row-hint">Signs out your other devices</span>
          </span>
          <Chevron open={open === 'password'} />
        </button>
        {open === 'password' && (
          <form onSubmit={onChangePassword} className="set-row-form" noValidate>
            <input
              className="settings-input"
              type="password"
              placeholder="Current password"
              aria-label="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
            <input
              className="settings-input"
              type="password"
              placeholder="New password (8+ characters, letters and digits)"
              aria-label="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
            <input
              className="settings-input"
              type="password"
              placeholder="Confirm new password"
              aria-label="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
            <StatusLine status={pwStatus} />
            <button className="settings-submit" type="submit" disabled={pwLoading}>
              {pwLoading ? 'Changing…' : 'Change password'}
            </button>
          </form>
        )}
        {open !== 'password' && pwStatus?.kind === 'success' && (
          <div className="set-row-note">
            <StatusLine status={pwStatus} />
          </div>
        )}

        <button className="set-row set-row-btn" onClick={onLogoutAll}>
          <span>
            <span className="set-row-label">Sign out other devices</span>
            <span className="set-row-hint">Keeps you signed in here</span>
          </span>
          <Chevron />
        </button>
        {allStatus && (
          <div className="set-row-note">
            <StatusLine status={allStatus} />
          </div>
        )}
      </section>

      <section className="set-group set-group-danger">
        <button className="set-row set-row-btn set-logout-row" onClick={logout}>
          <LogoutIcon />
          <span className="set-row-label">Log out</span>
        </button>
      </section>
    </>
  )
}

export const Chevron = ({ open = false }: { open?: boolean }) => (
  <svg
    className={'set-chevron' + (open ? ' open' : '')}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m9 6 6 6-6 6" />
  </svg>
)
