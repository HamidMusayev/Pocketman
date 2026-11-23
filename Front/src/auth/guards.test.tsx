import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { TOKEN_STORAGE_KEY } from '../api/client'
import { renderWithProviders } from '../test-utils'
import { RegisterRoute, RootRedirect } from './guards'

const mocks = vi.hoisted(() => ({ getAuthStatus: vi.fn() }))
vi.mock('../api/auth', () => ({ getAuthStatus: mocks.getAuthStatus }))

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route
        path="/register"
        element={
          <RegisterRoute>
            <div>REGISTER SCREEN</div>
          </RegisterRoute>
        }
      />
      <Route path="/login" element={<div>LOGIN SCREEN</div>} />
      <Route path="/overview" element={<div>OVERVIEW SCREEN</div>} />
    </Routes>
  )
}

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('auth gate', () => {
  it('sends a signed-out visitor to /login', async () => {
    renderWithProviders(<AppRoutes />)
    expect(await screen.findByText('LOGIN SCREEN')).toBeInTheDocument()
  })

  it('sends an authenticated user straight to /overview', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'a-token')
    renderWithProviders(<AppRoutes />)
    expect(await screen.findByText('OVERVIEW SCREEN')).toBeInTheDocument()
  })

  it('shows the sign-up page when registration is open', async () => {
    mocks.getAuthStatus.mockResolvedValue({ registration_enabled: true })
    renderWithProviders(<AppRoutes />, { route: '/register' })
    expect(await screen.findByText('REGISTER SCREEN')).toBeInTheDocument()
  })

  it('redirects /register to /login when registration is disabled', async () => {
    mocks.getAuthStatus.mockResolvedValue({ registration_enabled: false })
    renderWithProviders(<AppRoutes />, { route: '/register' })
    expect(await screen.findByText('LOGIN SCREEN')).toBeInTheDocument()
  })
})
