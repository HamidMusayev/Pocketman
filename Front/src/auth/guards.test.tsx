import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { TOKEN_STORAGE_KEY } from '../api/client'
import { renderWithProviders } from '../test-utils'
import { RootRedirect } from './guards'

const mocks = vi.hoisted(() => ({ getAuthStatus: vi.fn() }))
vi.mock('../api/auth', () => ({ getAuthStatus: mocks.getAuthStatus }))

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/setup" element={<div>SETUP SCREEN</div>} />
      <Route path="/login" element={<div>LOGIN SCREEN</div>} />
      <Route path="/overview" element={<div>OVERVIEW SCREEN</div>} />
    </Routes>
  )
}

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('RootRedirect auth gate', () => {
  it('sends a brand-new install to /setup', async () => {
    mocks.getAuthStatus.mockResolvedValue({ setup_complete: false })
    renderWithProviders(<AppRoutes />)
    expect(await screen.findByText('SETUP SCREEN')).toBeInTheDocument()
  })

  it('sends a set-up but locked user to /login', async () => {
    mocks.getAuthStatus.mockResolvedValue({ setup_complete: true })
    renderWithProviders(<AppRoutes />)
    expect(await screen.findByText('LOGIN SCREEN')).toBeInTheDocument()
  })

  it('sends an authenticated user straight to /overview', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'a-token')
    mocks.getAuthStatus.mockResolvedValue({ setup_complete: true })
    renderWithProviders(<AppRoutes />)
    await waitFor(() => expect(screen.getByText('OVERVIEW SCREEN')).toBeInTheDocument())
  })
})
