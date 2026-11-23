import { describe, expect, it } from 'vitest'
import { passwordError, usernameError } from './validation'

describe('usernameError', () => {
  it.each(['abc_12', 'hamid_musayev', 'user123', 'a'.repeat(32)])('accepts %s', (u) => {
    expect(usernameError(u)).toBeNull()
  })

  it.each(['short', 'Hamid_1', 'hamid-01', 'hamid 01', 'əlizadə1', 'a'.repeat(33), ''])('rejects %s', (u) => {
    expect(usernameError(u)).not.toBeNull()
  })
})

describe('passwordError', () => {
  it.each(['abcdefg1', 'secret123', 'Şifrə2024'])('accepts %s', (p) => {
    expect(passwordError(p)).toBeNull()
  })

  it.each(['short1a', 'onlyletters', '12345678', '', 'a1'.repeat(40)])('rejects %s', (p) => {
    expect(passwordError(p)).not.toBeNull()
  })
})
