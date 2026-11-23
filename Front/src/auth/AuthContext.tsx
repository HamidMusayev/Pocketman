import { useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { TOKEN_STORAGE_KEY, USERNAME_STORAGE_KEY } from '../api/client'

interface AuthContextValue {
  token: string | null
  username: string | null
  isAuthenticated: boolean
  /** Store a session; cached data is dropped when a different user signs in. */
  setSession: (token: string, username: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY))
  const [username, setUsernameState] = useState<string | null>(() =>
    localStorage.getItem(USERNAME_STORAGE_KEY),
  )

  const setSession = (t: string, u: string) => {
    // a different account on the same browser must never see the previous one's cached data
    if (u !== username) queryClient.clear()
    localStorage.setItem(TOKEN_STORAGE_KEY, t)
    localStorage.setItem(USERNAME_STORAGE_KEY, u)
    setTokenState(t)
    setUsernameState(u)
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem(USERNAME_STORAGE_KEY)
    setTokenState(null)
    setUsernameState(null)
    queryClient.clear()
  }

  return (
    <AuthContext.Provider value={{ token, username, isAuthenticated: !!token, setSession, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
