/** Light/dark mode is a per-device preference (kept in localStorage, not the
 * backend), so a phone and a laptop can differ. Dark is the default. */
export type ThemeMode = 'dark' | 'light' | 'system'

const KEY = 'pocketman_theme'

export function getThemeMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'system' || v === 'dark') return v
  } catch {
    /* storage unavailable — fall through to the default */
  }
  return 'dark'
}

export function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
  if (mode !== 'system') return mode
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function applyThemeMode(mode: ThemeMode) {
  document.documentElement.dataset.theme = resolveTheme(mode)
}

export function setThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    /* ignore */
  }
  applyThemeMode(mode)
}
