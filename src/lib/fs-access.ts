// File System Access API helpers.
//
// Why this exists: a browser cannot open `/Users/me/notes/todo.md` just because
// the user typed that string — `fetch('file://…')` is blocked from an http(s)
// origin, and a plain <input type="file"> deliberately hides the real path.
//
// The workaround is a one-time grant: the user picks a *parent folder* through
// the native picker, we keep that FileSystemDirectoryHandle in IndexedDB, and
// from then on any typed path that lands inside it resolves without a dialog.
// Handles also give us two things a File object can't: re-reading the same file
// later (live reload) and reading its siblings (relative images).

export interface FsAccessSupport {
  /** `showDirectoryPicker` — the one that makes typed paths work. */
  directory: boolean
  /** `showOpenFilePicker` — single-file picks, handle included. */
  file: boolean
}

export function fsAccessSupport(): FsAccessSupport {
  return {
    directory: typeof window.showDirectoryPicker === 'function',
    file: typeof window.showOpenFilePicker === 'function',
  }
}

/** True when the user aborted a picker dialog — never worth surfacing as an error. */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

export async function pickLocalFile(
  types?: FilePickerAcceptType[],
): Promise<FileSystemFileHandle | null> {
  if (!window.showOpenFilePicker) return null
  try {
    const [handle] = await window.showOpenFilePicker({ multiple: false, types })
    return handle ?? null
  } catch (err) {
    if (isAbortError(err)) return null
    throw err
  }
}

export async function pickLocalDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!window.showDirectoryPicker) return null
  try {
    return await window.showDirectoryPicker({ id: 'web-previews-root', mode: 'read' })
  } catch (err) {
    if (isAbortError(err)) return null
    throw err
  }
}

/**
 * Re-check (and if needed re-request) read access. Handles restored from
 * IndexedDB come back in a `prompt` state after a browser restart, so this must
 * run from a user gesture before the first read.
 */
export async function ensureReadPermission(handle: FileSystemHandle): Promise<boolean> {
  const opts: FileSystemHandlePermissionDescriptor = { mode: 'read' }
  if (!handle.queryPermission) return true // no permission model → nothing to ask
  if ((await handle.queryPermission(opts)) === 'granted') return true
  if (!handle.requestPermission) return false
  try {
    return (await handle.requestPermission(opts)) === 'granted'
  } catch (err) {
    if (isAbortError(err)) return false
    throw err
  }
}

/** Strip `file://`, `~/`, `./` and quotes, collapse slashes, drop `.` segments. */
export function normalizePathInput(input: string): string {
  let p = input.trim().replace(/^['"]|['"]$/g, '')
  p = p.replace(/^file:\/\//, '')
  try {
    // Paths pasted from a terminal or Finder may be percent-encoded.
    if (p.includes('%')) p = decodeURIComponent(p)
  } catch {
    // Not valid encoding — leave as typed.
  }
  p = p.replace(/\\ /g, ' ') // shell-escaped spaces
  return p.replace(/\/+/g, '/')
}

function toSegments(relPath: string): string[] {
  return relPath
    .split('/')
    .filter((s) => s.length > 0 && s !== '.')
    .reduce<string[]>((acc, seg) => {
      if (seg === '..') acc.pop()
      else acc.push(seg)
      return acc
    }, [])
}

/** Walk `relPath` from `dir`, returning the file handle and its parent folder. */
export async function getFileInDirectory(
  dir: FileSystemDirectoryHandle,
  relPath: string,
): Promise<{ dir: FileSystemDirectoryHandle; file: FileSystemFileHandle }> {
  const segments = toSegments(relPath)
  if (segments.length === 0) throw new Error('Path is empty.')
  const fileName = segments.pop() as string
  let cursor = dir
  for (const segment of segments) {
    cursor = await cursor.getDirectoryHandle(segment)
  }
  return { dir: cursor, file: await cursor.getFileHandle(fileName) }
}

export interface LocalRootLike {
  /** Absolute path of the root, learned from a successful resolve. */
  absPath?: string
  handle: FileSystemDirectoryHandle
  id: string
  name: string
}

export interface ResolvedLocalFile {
  /** Absolute path if we could work it out, otherwise `root/relPath`. */
  displayPath: string
  file: FileSystemFileHandle
  /**
   * Parent folder of the file — the base for relative images and links. Null
   * for a file picked from outside every granted root, where the API gives us
   * the file and nothing around it.
   */
  parent: FileSystemDirectoryHandle | null
  relPath: string
  rootId: null | string
}

/**
 * Candidate paths relative to a root, most-specific first:
 *   1. below the root's known absolute path,
 *   2. after the last `/<rootName>/` in the input (handles a pasted absolute
 *      path when we've never learned the root's own absolute path),
 *   3. with a leading `<rootName>/` stripped,
 *   4. the input taken as already-relative.
 */
function candidateRelPaths(input: string, root: LocalRootLike): string[] {
  const out: string[] = []
  const push = (p: string) => {
    const clean = p.replace(/^\/+/, '')
    if (clean && !out.includes(clean)) out.push(clean)
  }

  if (root.absPath && input.startsWith(`${root.absPath}/`)) {
    push(input.slice(root.absPath.length))
  }
  const marker = `/${root.name}/`
  const at = input.lastIndexOf(marker)
  if (at !== -1) push(input.slice(at + marker.length))
  if (input.startsWith(`${root.name}/`)) push(input.slice(root.name.length + 1))
  push(input.replace(/^~\//, ''))
  return out
}

/**
 * Resolve a user-typed path against the granted roots. Returns null when the
 * path doesn't live under any of them (the caller should then offer to grant a
 * folder). Permission prompts are the caller's job — call from a user gesture.
 */
export async function resolveLocalPath(
  input: string,
  roots: LocalRootLike[],
): Promise<ResolvedLocalFile | null> {
  const path = normalizePathInput(input)
  if (!path) return null

  for (const root of roots) {
    if (!(await ensureReadPermission(root.handle))) continue
    for (const relPath of candidateRelPaths(path, root)) {
      try {
        const { dir, file } = await getFileInDirectory(root.handle, relPath)
        // If the input was absolute and ends with the relative part we just
        // walked, everything before it is the root's absolute path.
        const displayPath = path.endsWith(relPath) ? path : `${root.name}/${relPath}`
        return { displayPath, file, parent: dir, relPath, rootId: root.id }
      } catch {
        // Not under this root (or not this candidate) — try the next one.
      }
    }
  }
  return null
}

/**
 * Locate an already-picked file inside the granted roots. `resolve()` tells us
 * the relative path, which gets us the parent folder (for relative images) and
 * a durable rootId + relPath we can replay from history later.
 */
export async function locateInRoots(
  file: FileSystemFileHandle,
  roots: LocalRootLike[],
): Promise<ResolvedLocalFile | null> {
  for (const root of roots) {
    let segments: string[] | null
    try {
      segments = await root.handle.resolve(file)
    } catch {
      continue
    }
    if (!segments) continue
    const relPath = segments.join('/')
    try {
      const { dir } = await getFileInDirectory(root.handle, relPath)
      const displayPath = root.absPath
        ? `${root.absPath}/${relPath}`
        : `${root.name}/${relPath}`
      return { displayPath, file, parent: dir, relPath, rootId: root.id }
    } catch {
      continue
    }
  }
  return null
}

/**
 * Describe a file the user picked through the native dialog. If it happens to
 * live under a granted root we get its folder and a replayable relative path;
 * otherwise it's a one-off — previewable, but with no siblings to read.
 */
export async function describePickedFile(
  file: FileSystemFileHandle,
  roots: LocalRootLike[],
): Promise<ResolvedLocalFile> {
  const located = await locateInRoots(file, roots)
  if (located) return located
  return {
    displayPath: file.name,
    file,
    parent: null,
    relPath: file.name,
    rootId: null,
  }
}

/** Learn a root's absolute path from a resolved file, so later paths match faster. */
export function inferRootAbsPath(resolved: ResolvedLocalFile): string | null {
  const { displayPath, relPath } = resolved
  if (!displayPath.startsWith('/')) return null
  if (!displayPath.endsWith(relPath)) return null
  const prefix = displayPath.slice(0, displayPath.length - relPath.length)
  return prefix.replace(/\/+$/, '') || null
}

const SKIP_DIRS = new Set(['.git', '.svn', '.hg', 'node_modules', '.DS_Store'])

export interface ReadDirectoryResult {
  files: Map<string, Uint8Array>
  /** Entries left out because a cap was hit — surfaced as a warning. */
  skipped: string[]
  totalBytes: number
}

export interface ReadDirectoryOptions {
  maxFiles?: number
  maxTotalBytes?: number
}

/**
 * Read a folder into an in-memory virtual filesystem for the Service Worker.
 * Version-control and dependency folders are skipped — they are never part of
 * what you want to preview and would blow the size cap instantly.
 */
export async function readDirectoryRecursive(
  root: FileSystemDirectoryHandle,
  { maxFiles = 3000, maxTotalBytes = 150 * 1024 * 1024 }: ReadDirectoryOptions = {},
): Promise<ReadDirectoryResult> {
  const files = new Map<string, Uint8Array>()
  const skipped: string[] = []
  let totalBytes = 0

  async function walk(dir: FileSystemDirectoryHandle, prefix: string): Promise<void> {
    for await (const [name, handle] of dir.entries()) {
      if (SKIP_DIRS.has(name)) continue
      const path = prefix ? `${prefix}/${name}` : name
      if (handle.kind === 'directory') {
        await walk(handle, path)
        continue
      }
      if (files.size >= maxFiles) {
        skipped.push(path)
        continue
      }
      const file = await handle.getFile()
      if (totalBytes + file.size > maxTotalBytes) {
        skipped.push(path)
        continue
      }
      files.set(path, new Uint8Array(await file.arrayBuffer()))
      totalBytes += file.size
    }
  }

  await walk(root, '')
  return { files, skipped, totalBytes }
}

/** Cheap change stamp for a file — mtime alone misses same-second edits. */
export function fileStamp(file: File): string {
  return `${file.lastModified}:${file.size}`
}
