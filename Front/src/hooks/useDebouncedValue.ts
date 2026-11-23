import { useEffect, useState } from 'react'

/** `value`, but only after it has stopped changing for `delayMs` — so a search
 * box sends one request when you pause typing instead of one per keystroke. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}
