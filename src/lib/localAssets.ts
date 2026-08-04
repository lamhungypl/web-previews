// Turn relative links in a locally-opened document into blob URLs.
//
// A Markdown file opened from disk usually points at images next to it
// (`![](./diagrams/flow.png)`). The iframe can't reach the filesystem, so we
// read each sibling through the granted folder handle and hand the iframe a
// blob URL instead.

import { getFileInDirectory } from '@/lib/fs-access'

export interface AssetResolverSource {
  /** Folder holding the document — used when there's no root to walk from. */
  parent: FileSystemDirectoryHandle | null
  /** Document path relative to `root`, e.g. `docs/guide.md`. */
  relPath: string
  /** Granted root, if the document lives under one. Lets `../` work. */
  root: FileSystemDirectoryHandle | null
}

export interface AssetResolver {
  resolve: (href: string) => Promise<null | string>
  /** Release every blob URL handed out. Call before rendering a new document. */
  revokeAll: () => void
}

export function createAssetResolver({
  parent,
  relPath,
  root,
}: AssetResolverSource): AssetResolver {
  const cache = new Map<string, null | string>()
  // Resolving from the root rather than the parent folder is what makes `../`
  // references work — the API offers no way to walk upwards from a handle.
  const baseDir = root ? relPath.split('/').slice(0, -1).join('/') : ''
  const from = root ?? parent

  return {
    async resolve(href) {
      if (cache.has(href)) return cache.get(href) ?? null
      const url = from ? await readAsBlobUrl(from, baseDir, href) : null
      cache.set(href, url)
      return url
    },
    revokeAll() {
      for (const url of cache.values()) if (url) URL.revokeObjectURL(url)
      cache.clear()
    },
  }
}

async function readAsBlobUrl(
  dir: FileSystemDirectoryHandle,
  baseDir: string,
  href: string,
): Promise<null | string> {
  const target = joinRelative(baseDir, stripQuery(href))
  if (!target) return null
  try {
    const { file } = await getFileInDirectory(dir, target)
    return URL.createObjectURL(await file.getFile())
  } catch {
    return null
  }
}

function stripQuery(href: string): string {
  const cut = href.search(/[?#]/)
  const path = cut === -1 ? href : href.slice(0, cut)
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

/** Join and normalize, resolving `..` — returns '' if it escapes the base. */
export function joinRelative(baseDir: string, href: string): string {
  const segments = `${baseDir}/${href}`.split('/')
  const out: string[] = []
  for (const segment of segments) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      if (out.length === 0) return ''
      out.pop()
      continue
    }
    out.push(segment)
  }
  return out.join('/')
}
