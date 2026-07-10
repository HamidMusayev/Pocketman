import { describe, expect, it } from 'vitest'
import { RAMP, rampColor } from './colorRamp'

describe('rampColor', () => {
  it('returns the yellow accent first', () => {
    expect(rampColor(0)).toBe('#FCD535')
  })

  it('wraps around the ramp length', () => {
    expect(rampColor(RAMP.length)).toBe(rampColor(0))
    expect(rampColor(RAMP.length + 3)).toBe(rampColor(3))
  })
})
