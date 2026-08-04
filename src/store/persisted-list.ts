import { useSyncExternalStore } from 'react'

import { idbGet, idbSet } from '@/lib/idb'

/**
 * An ordered list persisted in IndexedDB and readable as a React snapshot.
 *
 * Used for the granted-folder and file-history lists, both of which hold
 * FileSystemHandle objects — structured-cloneable, so IndexedDB works and
 * localStorage does not. Reads are served from an in-memory mirror so the
 * snapshot stays synchronous; writes fire and forget.
 */
export interface PersistedList<T> {
  /** Replace the whole list. */
  set(next: T[]): void
  snapshot(): T[]
  subscribe(fn: () => void): () => void
  /** Resolves once the initial IndexedDB read has landed. */
  whenReady(): Promise<void>
}

export function createPersistedList<T>(
  key: string,
  { sanitize }: { sanitize?: (items: T[]) => T[] } = {},
): PersistedList<T> {
  let items: T[] = []
  const listeners = new Set<() => void>()

  function emit() {
    for (const l of listeners) l()
  }

  const ready = idbGet<T[]>(key)
    .then((stored) => {
      if (Array.isArray(stored) && stored.length > 0) {
        items = sanitize ? sanitize(stored) : stored
        emit()
      }
    })
    .catch((err) => {
      console.warn(`Could not restore "${key}" from IndexedDB.`, err)
    })

  return {
    set(next) {
      items = sanitize ? sanitize(next) : next
      emit()
      idbSet(key, items).catch((err) => {
        console.warn(`Could not persist "${key}" to IndexedDB.`, err)
      })
    },
    snapshot: () => items,
    subscribe(fn) {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    whenReady: () => ready,
  }
}

const EMPTY: never[] = []

export function usePersistedList<T>(list: PersistedList<T>): T[] {
  return useSyncExternalStore(list.subscribe, list.snapshot, () => EMPTY)
}
