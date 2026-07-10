import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { apiErrorMessage } from '../api/client'
import { LogoMark } from '../components/Logo'
import { useAuth } from './AuthContext'
import './auth.css'

export function Login() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { setToken } = useAuth()
  const navigate = useNavigate()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { token } = await login(password)
      setToken(token)
      navigate('/overview', { replace: true })
    } catch (err) {
      setError(apiErrorMessage(err, 'Incorrect password.'))
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
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Enter your password to unlock Pocketman.</p>
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
              autoFocus
            />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Unlocking…' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  )
}
