import { useCallback, useSyncExternalStore, type CSSProperties } from 'react'

/** The two layout directions offered by the Terminal / Editorial toggle in the
 * top bar. "Editorial" is the roomy default; "Terminal" tightens the same
 * spacing scale for a denser, more instrument-panel feel. Both share one set of
 * color tokens (see `theme.css`) — only the scale below changes. */
export type Density = 'terminal' | 'editorial'

const SCALES: Record<Density, Record<string, string>> = {
  editorial: {
    '--px': '32px',
    '--scp': '16px',
    '--cpad': '20px',
    '--gap': '18px',
    '--rowpad': '14px 18px',
    '--statnum': '26px',
    '--statlabel': '11px',
    '--chippad': '11px 14px',
    '--secgap': '22px',
    '--heroh': '196px',
  },
  terminal: {
    '--px': '20px',
    '--scp': '12px',
    '--cpad': '14px',
    '--gap': '12px',
    '--rowpad': '9px 13px',
    '--statnum': '21px',
    '--statlabel': '10px',
    '--chippad': '8px 11px',
    '--secgap': '14px',
    '--heroh': '150px',
  },
}

/** Returns the spacing scale for the chosen direction plus the live accent
 * color, as CSS custom properties spread onto the app root's inline style. */
export function themeVars(accentColor: string, density: Density = 'editorial'): CSSProperties {
  return { '--yellow': accentColor, ...SCALES[density] } as CSSProperties
}

/* ---- density store -------------------------------------------------------
   Kept in localStorage rather than the settings table: it's a per-device view
   preference, and the backend's `density` column was dropped. A tiny external
   store lets both `Layout` and `SettingsLayout` read it without a shared
   provider. */

const STORAGE_KEY = 'pocketman.density'
const listeners = new Set<() => void>()

function readStored(): Density {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'terminal' ? 'terminal' : 'editorial'
  } catch {
    return 'editorial'
  }
}

let current: Density = readStored()

export function setDensity(next: Density) {
  if (next === current) return
  current = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* private mode / storage disabled — keep the in-memory value */
  }
  for (const listener of listeners) listener()
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

export function useDensity(): [Density, (next: Density) => void] {
  const density = useSyncExternalStore(
    subscribe,
    () => current,
    () => 'editorial' as Density,
  )
  return [density, useCallback((next: Density) => setDensity(next), [])]
}
