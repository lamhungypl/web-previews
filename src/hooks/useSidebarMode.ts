import { useCallback, useState } from 'react'

/**
 * How much of the tool sidebar is showing, mirroring Chrome's tab sidebar:
 * icons only, icons with names, or icons with names and descriptions.
 */
export type SidebarMode = 'compact' | 'full' | 'rail'

/** Cycle order: widest first, so the button always reads as "collapse further". */
const ORDER: SidebarMode[] = ['full', 'compact', 'rail']

const STORAGE_KEY = 'sidebar-mode'

export const SIDEBAR_WIDTH: Record<SidebarMode, string> = {
  // w-48 rather than w-44: the longest tool name ("Markdown Preview") needs it
  // to sit on one line without truncating.
  compact: 'w-48',
  full: 'w-64',
  rail: 'w-14',
}

/** Names the mode the button switches *to*, for its tooltip. */
export const SIDEBAR_MODE_LABEL: Record<SidebarMode, string> = {
  compact: 'names only',
  full: 'names and descriptions',
  rail: 'icons only',
}

function isMode(value: unknown): value is SidebarMode {
  return typeof value === 'string' && ORDER.includes(value as SidebarMode)
}

export function useSidebarMode(): {
  cycle: () => void
  mode: SidebarMode
  /** The mode a cycle would land on — the button labels itself with this. */
  next: SidebarMode
} {
  const [mode, setMode] = useState<SidebarMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isMode(stored) ? stored : 'full'
  })

  const cycle = useCallback(() => {
    setMode((prev) => {
      const next = ORDER[(ORDER.indexOf(prev) + 1) % ORDER.length]
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }, [])

  return { cycle, mode, next: ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length] }
}
