import type { CSSProperties } from 'react'

/** The app has a single, fixed layout density ("editorial"). This returns the
 * spacing scale plus the live accent color as CSS custom properties, spread
 * onto the app root's inline style. (The former "terminal" density and its
 * toggle were removed.) */
export function themeVars(accentColor: string): CSSProperties {
  return {
    '--yellow': accentColor,
    '--px': '36px',
    '--scp': '16px',
    '--cpad': '18px',
    '--gap': '14px',
    '--rowpad': '11px 16px',
    '--statnum': '26px',
    '--statlabel': '11px',
    '--chippad': '7px 13px',
    '--secgap': '20px',
  } as CSSProperties
}
