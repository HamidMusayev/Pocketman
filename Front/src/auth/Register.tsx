import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api/auth'
import { apiErrorMessage } from '../api/client'
import { AuthLayout } from './AuthLayout'
import { useAuth } from './AuthContext'
import { PASSWORD_MIN, USERNAME_MIN, passwordError, usernameError } from './validation'
import './auth.css'

export function Register() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState({ username: false, password: false })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [savedIt, setSavedIt] = useState(false)
  const { setSession } = useAuth()
  const navigate = useNavigate()

  const uErr = usernameError(username)
  const pErr = passwordError(password)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setTouched({ username: true, password: true })
    if (uErr || pErr) return
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (!savedIt) {
      setError('Confirm that you saved your password somewhere safe.')
      return
    }
    setLoading(true)
    try {
      const res = await register(username, password)
      setSession(res.token, res.username)
      navigate('/overview', { replace: true })
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create the account.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">Your data is private to your account.</p>
        <form onSubmit={onSubmit} noValidate>
          <div className="auth-field">
            <label className="auth-label" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              className="auth-input"
              value={username}
              // usernames are lowercase-only, so fold capitals as the user types
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              onBlur={() => setTouched((t) => ({ ...t, username: true }))}
              placeholder={`At least ${USERNAME_MIN} characters`}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={touched.username && !!uErr}
              aria-describedby="username-hint"
              autoFocus
            />
            <div id="username-hint" className={'auth-hint' + (touched.username && uErr ? ' bad' : '')}>
              {touched.username && uErr ? uErr : 'Lowercase letters, digits and _ only.'}
            </div>
          </div>
          <div className="auth-field">
            <label className="auth-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="auth-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              placeholder={`At least ${PASSWORD_MIN} characters`}
              autoComplete="new-password"
              aria-invalid={touched.password && !!pErr}
              aria-describedby="password-hint"
            />
            <div id="password-hint" className={'auth-hint' + (touched.password && pErr ? ' bad' : '')}>
              {touched.password && pErr ? pErr : 'Must include letters and digits.'}
            </div>
          </div>
          <div className="auth-field">
            <label className="auth-label" htmlFor="confirm">
              Confirm password
            </label>
            <input
              id="confirm"
              className="auth-input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="auth-warn" role="note">
            <div className="auth-warn-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3 2 20h20L12 3Z" />
                <path d="M12 10v4M12 17.5v.01" />
              </svg>
              There is no password recovery
            </div>
            <p>
              Pocketman doesn't ask for an email or phone number, so a forgotten password can't be reset. If you lose
              it, you won't be able to sign in again. Keep it in a password manager or another safe place.
            </p>
            <label className="auth-check">
              <input type="checkbox" checked={savedIt} onChange={(e) => setSavedIt(e.target.checked)} />
              I've saved my password somewhere safe
            </label>
          </div>
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}
          <button className="auth-submit" type="submit" disabled={loading || !savedIt}>
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
    </AuthLayout>
  )
}
