import { useCallback, useState } from 'react'

/** A boolean remembered in localStorage — panel visibility and the like. */
export function usePersistentToggle(
  key: string,
  fallback: boolean | (() => boolean),
): [boolean, () => void] {
  const [value, setValue] = useState(() => {
    const stored = localStorage.getItem(key)
    if (stored === 'true') return true
    if (stored === 'false') return false
    return typeof fallback === 'function' ? fallback() : fallback
  })

  const toggle = useCallback(() => {
    setValue((prev) => {
      localStorage.setItem(key, String(!prev))
      return !prev
    })
  }, [key])

  return [value, toggle]
}
