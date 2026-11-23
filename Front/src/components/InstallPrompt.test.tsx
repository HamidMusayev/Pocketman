import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { _resetInstallForTests, initInstallCapture, isIos, isIosSafari } from '../lib/install'
import { InstallPrompt } from './InstallPrompt'
import { InstallSettingRow } from './InstallSettingRow'

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1'
const IPAD_DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'

function firePrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: string }>
  }
  e.prompt = vi.fn().mockResolvedValue(undefined)
  e.userChoice = Promise.resolve({ outcome })
  act(() => {
    window.dispatchEvent(e)
  })
  return e
}

beforeAll(() => initInstallCapture())

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  act(() => _resetInstallForTests())
})

describe('platform detection', () => {
  it('spots iOS Safari, including iPadOS posing as a Mac', () => {
    expect(isIosSafari(IPHONE_SAFARI, 5)).toBe(true)
    expect(isIosSafari(IPHONE_CHROME, 5)).toBe(false)
    expect(isIos(IPAD_DESKTOP_UA, 5)).toBe(true)
    expect(isIos(IPAD_DESKTOP_UA, 0)).toBe(false)
  })
})

describe('InstallPrompt banner', () => {
  it('stays hidden when the browser offers no way to install', () => {
    render(<InstallPrompt />)
    expect(screen.queryByText(/add pocketman to your home screen/i)).not.toBeInTheDocument()
  })

  it('opens the native prompt and disappears once installed', async () => {
    render(
      <>
        <InstallPrompt />
        <InstallSettingRow />
      </>,
    )
    const e = firePrompt('accepted')
    expect(e.defaultPrevented).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(e.prompt).toHaveBeenCalled()
    expect(screen.queryByText(/add pocketman to your home screen/i)).not.toBeInTheDocument()
    expect(screen.getByText('✓ Installed')).toBeInTheDocument()
  })

  it('"Not now" is remembered, but Settings can still install', async () => {
    const { unmount } = render(
      <>
        <InstallPrompt />
        <InstallSettingRow />
      </>,
    )
    const e = firePrompt('accepted')
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.queryByText(/add pocketman to your home screen/i)).not.toBeInTheDocument()
    unmount()

    // next visit: the banner stays away
    render(
      <>
        <InstallPrompt />
        <InstallSettingRow />
      </>,
    )
    expect(screen.queryByText(/add pocketman to your home screen/i)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /add to home screen/i }))
    expect(e.prompt).toHaveBeenCalled()
  })

  it('declining the native dialog also counts as "not now"', async () => {
    render(<InstallPrompt />)
    firePrompt('dismissed')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(localStorage.getItem('pocketman_install_dismissed')).toBe('1')
  })

  it('shows Share → Add to Home Screen steps on iPhone Safari', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE_SAFARI)
    act(() => _resetInstallForTests())
    render(<InstallPrompt />)
    await userEvent.click(screen.getByRole('button', { name: 'Show me' }))
    expect(screen.getByText(/scroll down and choose/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(screen.queryByText(/add pocketman to your home screen/i)).not.toBeInTheDocument()
  })
})
