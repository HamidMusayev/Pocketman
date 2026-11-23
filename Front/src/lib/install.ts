/** "Add to home screen" support.
 *
 * Chrome/Edge/Android fire `beforeinstallprompt` once, early, often before
 * React has mounted — so `initInstallCapture()` runs from main.tsx and keeps
 * the event here for later. iOS Safari has no such event; there we can only
 * show the user the Share → Add to Home Screen steps.
 *
 * If the user dismisses the banner we remember it (per device, localStorage)
 * and never show it again; Settings → App still lets them install later. */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>
}

export type InstallMode =
  /** already running as an installed app */
  | 'installed'
  /** browser gave us a native install prompt */
  | 'native'
  /** iPhone/iPad Safari: manual Share → Add to Home Screen */
  | 'ios'
  /** no prompt available (Firefox, iOS non-Safari, prompt already used…) */
  | 'manual'

const DISMISS_KEY = 'pocketman_install_dismissed'

let deferred: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
let snapshot: InstallMode | null = null

function emit() {
  snapshot = null
  listeners.forEach((l) => l())
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  if (window.matchMedia?.('(display-mode: fullscreen)').matches) return true
  // iOS Safari's own flag for home-screen apps
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function isIos(ua = navigator.userAgent, maxTouchPoints = navigator.maxTouchPoints ?? 0): boolean {
  if (/iPad|iPhone|iPod/.test(ua)) return true
  // iPadOS 13+ reports itself as a Mac; touch support gives it away
  return /Macintosh/.test(ua) && maxTouchPoints > 1
}

/** Only Safari can add to the home screen on older iOS; Chrome/Firefox/etc. on
 * iOS have "CriOS"/"FxiOS"/"EdgiOS" in the UA. */
export function isIosSafari(ua = navigator.userAgent, maxTouchPoints = navigator.maxTouchPoints ?? 0): boolean {
  return isIos(ua, maxTouchPoints) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua)
}

export function initInstallCapture() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // we show our own banner instead of the mini-infobar
    deferred = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferred = null
    emit()
  })
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', emit)
}

export function getInstallMode(): InstallMode {
  if (snapshot) return snapshot
  if (installed || isStandalone()) snapshot = 'installed'
  else if (deferred) snapshot = 'native'
  else if (isIosSafari()) snapshot = 'ios'
  else snapshot = 'manual'
  return snapshot
}

export function subscribeInstall(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Opens the browser's install dialog. Resolves to true if the user accepted.
 * The event can only be used once, so afterwards we wait for a new one. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred
  if (!e) return false
  deferred = null
  await e.prompt()
  const { outcome } = await e.userChoice
  if (outcome === 'accepted') installed = true
  emit()
  return outcome === 'accepted'
}

export function isInstallDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissInstall() {
  try {
    localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    /* storage unavailable — banner just comes back next visit */
  }
  emit()
}

/** test helper */
export function _resetInstallForTests() {
  deferred = null
  installed = false
  emit()
}
