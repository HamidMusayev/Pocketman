import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { setupPassword } from '../api/auth'
import { apiErrorMessage } from '../api/client'
import { LogoMark } from '../components/Logo'
import { useAuth } from './AuthContext'
import './auth.css'

export function Setup() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { setToken } = useAuth()
  const navigate = useNavigate()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 4) {
      setError('Password must be at least 4 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const { token } = await setupPassword(password)
      setToken(token)
      navigate('/overview', { replace: true })
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not set up the app.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-mark">
            <LogoMark />
          </div>
          <div className="auth-logo-text">
            pocket<span>man</span>
          </div>
        </div>
        <h1 className="auth-title">Set up your password</h1>
        <p className="auth-subtitle">This is a one-time setup. Pocketman is local to this device.</p>
        <form onSubmit={onSubmit}>
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
              placeholder="At least 4 characters"
              autoFocus
            />
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
            />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Setting up…' : 'Create password'}
          </button>
        </form>
      </div>
    </div>
  )
}
