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
    throw new Error('No index.html found in the uploaded zip.')
  }
  return { files, entrypoint }
}

/** Build an UnpackedProject from a single .html file upload. */
export async function packSingleHtml(file: File): Promise<UnpackedProject> {
  const bytes = new Uint8Array(await file.arrayBuffer())
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

/** Locate an index.html: prefer root, otherwise the shallowest one. */
function findEntrypoint(files: Map<string, Uint8Array>): string | null {
  if (files.has('index.html')) return 'index.html'
  let best: string | null = null
  let bestDepth = Infinity
  for (const path of files.keys()) {
    if (!path.toLowerCase().endsWith('/index.html')) continue
    const depth = path.split('/').length
    if (depth < bestDepth) {
      best = path
      bestDepth = depth
    }
  }
  return best
}
