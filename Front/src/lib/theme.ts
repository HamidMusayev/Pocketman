import type { CSSProperties } from 'react'

/** The accent color is the one theme token chosen at runtime (Settings →
 * Appearance); everything else — colors and the spacing scale — is constant in
 * `theme.css :root`. Spread onto the app root's inline style so the whole tree
 * recolors live. */
export function themeVars(accentColor: string): CSSProperties {
  return { '--yellow': accentColor } as CSSProperties
}
