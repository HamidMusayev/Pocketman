import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStatus } from '../hooks/useAuthStatus'
import { useAuth } from './AuthContext'

function FullScreenLoading() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--canvas)', color: 'var(--muted)' }}>
      Loading…
    </div>
  )
}

/** Landing route ("/"): signed-in visitors go to the app, everyone else to login. */
export function RootRedirect() {
  const { isAuthenticated } = useAuth()
  return <Navigate to={isAuthenticated ? '/overview' : '/login'} replace />
}

/** Login page: skipped when already signed in. */
export function LoginRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/overview" replace />
  return <>{children}</>
}

/** Sign-up page: skipped when signed in, and closed when the server disables registration. */
export function RegisterRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const { data, isLoading } = useAuthStatus()
  if (isAuthenticated) return <Navigate to="/overview" replace />
  if (isLoading) return <FullScreenLoading />
  if (data && !data.registration_enabled) return <Navigate to="/login" replace />
  return <>{children}</>
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}
