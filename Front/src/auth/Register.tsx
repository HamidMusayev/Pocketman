import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api/auth'
import { apiErrorMessage } from '../api/client'
import { AuthCardHeader } from './AuthCardHeader'
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
    <div className="auth-screen">
      <div className="auth-card">
        <AuthCardHeader />
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
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
