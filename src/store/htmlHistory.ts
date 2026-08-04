// Recently previewed HTML projects opened from the local machine.
//
// An entry is (folder, entrypoint): that covers both "previewed a folder" and
// "opened one .html file by path", since the latter is served with its own
// folder as the asset root. `file` is the fallback for a lone .html picked from
// outside every granted folder, where there are no siblings to read.

import { createPersistedList, usePersistedList } from '@/store/persisted-list'

const MAX_ENTRIES = 30

export interface HtmlHistoryEntry {
  dir: FileSystemDirectoryHandle | null
  /** Path of the entry document within `dir`, e.g. `index.html`. */
  entrypoint: string
  file: FileSystemFileHandle | null
  id: string
  name: string
  openedAt: number
  /** What the user sees: absolute path when known, otherwise folder/entry. */
  path: string
}

const list = createPersistedList<HtmlHistoryEntry>('html-history', {
  sanitize: (items) =>
    items
      .filter((e) => e?.dir?.kind === 'directory' || e?.file?.kind === 'file')
      .slice(0, MAX_ENTRIES),
})

export function useHtmlHistory(): HtmlHistoryEntry[] {
  return usePersistedList(list)
}

export function htmlHistoryReady(): Promise<void> {
  return list.whenReady()
}

/** Record a visit, moving a repeat open to the front instead of duplicating it. */
export function recordHtmlVisit(entry: Omit<HtmlHistoryEntry, 'id' | 'openedAt'>): void {
  const rest = list.snapshot().filter((e) => e.path !== entry.path)
  list.set([{ ...entry, id: crypto.randomUUID(), openedAt: Date.now() }, ...rest])
}

export function removeHtmlHistoryEntry(id: string): void {
  list.set(list.snapshot().filter((e) => e.id !== id))
}

export function clearHtmlHistory(): void {
  list.set([])
}
