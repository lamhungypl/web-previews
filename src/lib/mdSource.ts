// Where a previewed Markdown document came from on disk.
//
// Everything the viewer needs to re-read the file (live reload), read the
// images next to it, follow a relative link to a sibling document, and put a
// replayable entry in the history list.

import { getFileInDirectory, type ResolvedLocalFile } from '@/lib/fs-access'
import { joinRelative } from '@/lib/localAssets'
import type { LocalRoot } from '@/store/localRoots'
import type { MdHistoryEntry } from '@/store/mdHistory'

export interface LocalMdSource {
  file: FileSystemFileHandle
  /** Basename, for the title and history label. */
  name: string
  parent: FileSystemDirectoryHandle | null
  /** Absolute path when known, otherwise `rootName/relPath`. */
  path: string
  relPath: string
  root: FileSystemDirectoryHandle | null
  rootId: null | string
}

export function basename(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path
}

function dirname(path: string): string {
  return path.split('/').slice(0, -1).join('/')
}

function rootHandle(rootId: null | string, roots: LocalRoot[]) {
  if (!rootId) return null
  return roots.find((r) => r.id === rootId)?.handle ?? null
}

export function sourceFromResolved(
  resolved: ResolvedLocalFile,
  roots: LocalRoot[],
): LocalMdSource {
  return {
    file: resolved.file,
    name: basename(resolved.relPath) || basename(resolved.displayPath),
    parent: resolved.parent,
    path: resolved.displayPath,
    relPath: resolved.relPath,
    root: rootHandle(resolved.rootId, roots),
    rootId: resolved.rootId,
  }
}

/**
 * Rebuild a source from a stored history entry. The parent folder isn't stored
 * — it's re-derived by walking the root, which also verifies the file is still
 * where we left it.
 */
export async function sourceFromHistory(
  entry: MdHistoryEntry,
  roots: LocalRoot[],
): Promise<LocalMdSource> {
  const root = rootHandle(entry.rootId, roots)
  let parent: FileSystemDirectoryHandle | null = null
  if (root) {
    try {
      parent = (await getFileInDirectory(root, entry.relPath)).dir
    } catch {
      parent = null // moved or deleted since; the handle may still open
    }
  }
  return {
    file: entry.file,
    name: entry.name,
    parent,
    path: entry.path,
    relPath: entry.relPath,
    root,
    rootId: entry.rootId,
  }
}

/**
 * Follow a relative link from the current document to a sibling file.
 * Resolution runs from the granted root when there is one, so `../` works —
 * the API gives no way to walk upwards from a folder handle.
 */
export async function sourceFromRelativeLink(
  current: LocalMdSource,
  href: string,
): Promise<LocalMdSource> {
  const base = current.root ? current.root : current.parent
  if (!base) throw new Error('No folder access for this document — grant its folder.')

  const relPath = current.root
    ? joinRelative(dirname(current.relPath), href)
    : joinRelative('', href)
  if (!relPath) throw new Error(`Link points outside the granted folder: ${href}`)

  const { dir, file } = await getFileInDirectory(base, relPath)
  const dir_ = dirname(current.path)
  const joined = joinRelative(dir_.replace(/^\//, ''), href)
  const path = current.path.startsWith('/') ? `/${joined}` : joined

  return {
    file,
    name: basename(relPath),
    parent: dir,
    path,
    relPath: current.root ? relPath : basename(relPath),
    root: current.root,
    rootId: current.rootId,
  }
}
