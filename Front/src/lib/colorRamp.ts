/** Ported verbatim from the prototype's `RAMP` array — assigns chart colors
 * by sort order (highest spend first), not stored per-category. */
export const RAMP = [
  '#FCD535', '#c9a83a', '#929aa5', '#2dbdb6', '#3b82f6', '#0ecb81',
  '#a855f7', '#f6465d', '#e08a3c', '#6b7280', '#8b5cf6', '#14b8a6',
  '#eab308', '#5a6472', '#94a3b8', '#475569',
]

export function rampColor(index: number): string {
  return RAMP[index % RAMP.length]
}
