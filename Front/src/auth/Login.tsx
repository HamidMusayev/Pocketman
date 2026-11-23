import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { apiErrorMessage } from '../api/client'
import { useAuthStatus } from '../hooks/useAuthStatus'
import { AuthCardHeader } from './AuthCardHeader'
import { useAuth } from './AuthContext'
import './auth.css'

export function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { setSession } = useAuth()
  const { data: status } = useAuthStatus()
  const navigate = useNavigate()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!username.trim() || !password) {
      setError('Enter your username and password.')
      return
    }
    setLoading(true)
    try {
      const res = await login(username.trim().toLowerCase(), password)
      setSession(res.token, res.username)
      navigate('/overview', { replace: true })
    } catch (err) {
      setError(apiErrorMessage(err, 'Incorrect username or password.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <AuthCardHeader />
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to your Pocketman account.</p>
        <form onSubmit={onSubmit} noValidate>
          <div className="auth-field">
            <label className="auth-label" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              className="auth-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
            />
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
              autoComplete="current-password"
            />
          </div>
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        {status?.registration_enabled && (
          <p className="auth-switch">
            No account yet? <Link to="/register">Create one</Link>
          </p>
        )}
      </div>
    </div>
  )
}
