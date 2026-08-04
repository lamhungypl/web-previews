import { unzip } from 'fflate'

export interface UnpackedProject {
  /** Path of the entrypoint within `files`, e.g. 'index.html'. */
  entrypoint: string
  files: Map<string, Uint8Array>
}

/** Unzip a .zip File and return a normalized virtual filesystem. */
export async function unzipFile(file: File): Promise<UnpackedProject> {
  const buf = new Uint8Array(await file.arrayBuffer())
  const raw = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(buf, (err, data) => (err ? reject(err) : resolve(data)))
  })

  // Drop directory entries (paths ending in '/' with zero bytes — fflate may or
  // may not include these depending on the zip producer).
  const cleaned: Record<string, Uint8Array> = {}
  for (const [path, bytes] of Object.entries(raw)) {
    if (path.endsWith('/')) continue
    cleaned[path] = bytes
  }

  const stripped = stripCommonRoot(cleaned)
  const files = new Map<string, Uint8Array>(Object.entries(stripped))
  const entrypoint = findEntrypoint(files)
  if (!entrypoint) {
    throw new Error(
      'No index.html found, and the zip contains more than one HTML file — could not pick an entrypoint.',
    )
  }
  return { files, entrypoint }
}

/**
 * Wrap an already-read set of files (e.g. a folder read off disk) as a project.
 * `preferredEntry` wins when present — that's the file the user actually asked
 * for, which beats guessing at `index.html`.
 */
export function packFiles(
  files: Map<string, Uint8Array>,
  preferredEntry?: string,
): UnpackedProject {
  if (preferredEntry && files.has(preferredEntry)) {
    return { files, entrypoint: preferredEntry }
  }
  const entrypoint = findEntrypoint(files)
  if (!entrypoint) {
    throw new Error(
      'No index.html found, and the folder contains more than one HTML file — could not pick an entrypoint.',
    )
  }
  return { files, entrypoint }
}

/** Build an UnpackedProject from a single .html file upload. */
export async function packSingleHtml(file: File): Promise<UnpackedProject> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const files = new Map<string, Uint8Array>([['index.html', bytes]])
  return { files, entrypoint: 'index.html' }
}

/** Build an UnpackedProject from raw HTML source (e.g. pasted from the clipboard). */
export function packHtmlSource(source: string): UnpackedProject {
  const bytes = new TextEncoder().encode(source)
  const files = new Map<string, Uint8Array>([['index.html', bytes]])
  return { files, entrypoint: 'index.html' }
}

/** If every entry shares a common top-level folder (e.g. `project/...`), strip it. */
function stripCommonRoot(files: Record<string, Uint8Array>): Record<string, Uint8Array> {
  const keys = Object.keys(files)
  if (keys.length === 0) return files
  const firstSlash = keys[0].indexOf('/')
  if (firstSlash === -1) return files
  const root = keys[0].slice(0, firstSlash + 1)
  if (!keys.every((k) => k.startsWith(root))) return files
  const out: Record<string, Uint8Array> = {}
  for (const k of keys) out[k.slice(root.length)] = files[k]
  return out
}

/**
 * Locate the HTML entrypoint:
 *   1. `index.html` at the root.
 *   2. Otherwise, the shallowest `*\/index.html`.
 *   3. Escape hatch: if the zip contains exactly one .html/.htm file overall,
 *      use it regardless of name. Picks up zips like `report.html` or
 *      `MyDemo.htm` without forcing the user to rename.
 */
function findEntrypoint(files: Map<string, Uint8Array>): string | null {
  if (files.has('index.html')) return 'index.html'

  let shallowestIndex: string | null = null
  let shallowestDepth = Infinity
  const htmlFiles: string[] = []

  for (const path of files.keys()) {
    const lower = path.toLowerCase()
    if (!lower.endsWith('.html') && !lower.endsWith('.htm')) continue
    htmlFiles.push(path)
    if (lower.endsWith('/index.html')) {
      const depth = path.split('/').length
      if (depth < shallowestDepth) {
        shallowestIndex = path
        shallowestDepth = depth
      }
    }
  }

  if (shallowestIndex) return shallowestIndex
  if (htmlFiles.length === 1) return htmlFiles[0]
  return null
}
