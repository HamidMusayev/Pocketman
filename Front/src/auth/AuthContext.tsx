import { createContext, useContext, useState, type ReactNode } from 'react'
import { TOKEN_STORAGE_KEY } from '../api/client'

interface AuthContextValue {
  token: string | null
  isAuthenticated: boolean
  setToken: (token: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY))

  const setToken = (t: string) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, t)
    setTokenState(t)
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setTokenState(null)
  }

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: !!token, setToken, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
