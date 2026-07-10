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

/** Landing route ("/"): sends the visitor to the right place based on
 * whether the app has ever been set up and whether they're logged in. */
export function RootRedirect() {
  const { data, isLoading } = useAuthStatus()
  const { isAuthenticated } = useAuth()
  if (isLoading || !data) return <FullScreenLoading />
  if (!data.setup_complete) return <Navigate to="/setup" replace />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Navigate to="/overview" replace />
}

export function SetupRoute({ children }: { children: ReactNode }) {
  const { data, isLoading } = useAuthStatus()
  if (isLoading || !data) return <FullScreenLoading />
  if (data.setup_complete) return <Navigate to="/login" replace />
  return <>{children}</>
}

export function LoginRoute({ children }: { children: ReactNode }) {
  const { data, isLoading } = useAuthStatus()
  const { isAuthenticated } = useAuth()
  if (isLoading || !data) return <FullScreenLoading />
  if (!data.setup_complete) return <Navigate to="/setup" replace />
  if (isAuthenticated) return <Navigate to="/overview" replace />
  return <>{children}</>
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}
