// Folders the user has granted read access to.
//
// Granting one is what makes a typed path like `/Users/me/notes/todo.md`
// resolvable at all — see lib/fs-access.ts for why.

import type { LocalRootLike } from '@/lib/fs-access'
import { createPersistedList, usePersistedList } from '@/store/persisted-list'

export interface LocalRoot extends LocalRootLike {
  addedAt: number
}

const list = createPersistedList<LocalRoot>('local-roots', {
  // Guard against half-written records from an older schema.
  sanitize: (items) => items.filter((r) => r?.handle?.kind === 'directory').slice(0, 12),
})

export function useLocalRoots(): LocalRoot[] {
  return usePersistedList(list)
}

export function getLocalRoots(): LocalRoot[] {
  return list.snapshot()
}

export function localRootsReady(): Promise<void> {
  return list.whenReady()
}

/** Add a granted folder, replacing an existing entry for the same directory. */
export async function addLocalRoot(
  handle: FileSystemDirectoryHandle,
): Promise<LocalRoot> {
  const existing = await findRootByHandle(handle)
  if (existing) return existing
  const root: LocalRoot = {
    addedAt: Date.now(),
    handle,
    id: crypto.randomUUID(),
    name: handle.name,
  }
  list.set([root, ...list.snapshot()])
  return root
}

export function removeLocalRoot(id: string): void {
  list.set(list.snapshot().filter((r) => r.id !== id))
}

/** Remember a root's absolute path once we've inferred it from a resolved file. */
export function setLocalRootAbsPath(id: string, absPath: string): void {
  const current = list.snapshot()
  const target = current.find((r) => r.id === id)
  if (!target || target.absPath === absPath) return
  list.set(current.map((r) => (r.id === id ? { ...r, absPath } : r)))
}

async function findRootByHandle(
  handle: FileSystemDirectoryHandle,
): Promise<LocalRoot | null> {
  for (const root of list.snapshot()) {
    if (await root.handle.isSameEntry(handle)) return root
  }
  return null
}
