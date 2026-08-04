// Recently previewed Markdown files.
//
// Only files opened from the local machine land here: we keep the
// FileSystemFileHandle, which is what makes an entry re-openable on a later
// visit. Pasted source has nothing durable to point at, so it is never stored.

import { createPersistedList, usePersistedList } from '@/store/persisted-list'

const MAX_ENTRIES = 40

export interface MdHistoryEntry {
  file: FileSystemFileHandle
  id: string
  /** Basename, for the list label. */
  name: string
  openedAt: number
  /** Absolute path when known, otherwise `rootName/relPath`. */
  path: string
  relPath: string
  rootId: null | string
}

const list = createPersistedList<MdHistoryEntry>('md-history', {
  sanitize: (items) =>
    items.filter((e) => e?.file?.kind === 'file').slice(0, MAX_ENTRIES),
})

export function useMdHistory(): MdHistoryEntry[] {
  return usePersistedList(list)
}

export function mdHistoryReady(): Promise<void> {
  return list.whenReady()
}

/**
 * Record a visit. Re-opening a file moves it to the front rather than adding a
 * duplicate, so the list stays a most-recent-first history.
 */
export function recordMdVisit(entry: Omit<MdHistoryEntry, 'id' | 'openedAt'>): void {
  const rest = list.snapshot().filter((e) => e.path !== entry.path)
  list.set([{ ...entry, id: crypto.randomUUID(), openedAt: Date.now() }, ...rest])
}

export function removeMdHistoryEntry(id: string): void {
  list.set(list.snapshot().filter((e) => e.id !== id))
}

export function clearMdHistory(): void {
  list.set([])
}
