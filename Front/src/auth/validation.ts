// Mirrors Backend/app/validation.py — keep both in sync.

export const USERNAME_MIN = 6
export const USERNAME_MAX = 32
export const PASSWORD_MIN = 8
export const PASSWORD_MAX_BYTES = 72

/** Returns an error message, or null when the username is valid. */
export function usernameError(v: string): string | null {
  if (v.length < USERNAME_MIN) return `Username must be at least ${USERNAME_MIN} characters.`
  if (v.length > USERNAME_MAX) return `Username must be at most ${USERNAME_MAX} characters.`
  if (!/^[a-z0-9_]+$/.test(v)) return 'Username may only contain lowercase letters, digits and _.'
  return null
}

/** Returns an error message, or null when the password is valid. */
export function passwordError(v: string): string | null {
  if (v.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`
  if (new TextEncoder().encode(v).length > PASSWORD_MAX_BYTES)
    return `Password must be at most ${PASSWORD_MAX_BYTES} bytes.`
  if (!/\p{L}/u.test(v)) return 'Password must contain at least one letter.'
  if (!/\p{Nd}/u.test(v)) return 'Password must contain at least one digit.'
  return null
}
