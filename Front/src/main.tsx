import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import './theme.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthContext'
import { applyThemeMode, getThemeMode } from './lib/themeMode'
import { initInstallCapture } from './lib/install'

applyThemeMode(getThemeMode())
window.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', () => {
  if (getThemeMode() === 'system') applyThemeMode('system')
})

// keep the browser's install prompt for our own "Add to home screen" banner
initInstallCapture()

// installable app (PWA); only in production builds so dev hot-reload isn't cached
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* not supported here (e.g. plain http on a LAN IP) — the app still works */
    })
  })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
