/* global self, caches */
// Service Worker for web-previews.
// Hosts an in-memory virtual filesystem keyed by project id.
// Intercepts fetches under <base>/preview/<id>/* and serves files from memory.
// All paths inside the SW are absolute (start with '/'), matching iframe requests.

const VERSION = 'web-previews-sw-v1'
const SCOPE = new URL(self.registration.scope).pathname // e.g. '/web-previews/'
const PREVIEW_PREFIX = SCOPE + 'preview/'

/** @type {Map<string, Map<string, Uint8Array>>} */
const projects = new Map()

const MIME = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  mjs: 'application/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  map: 'application/json; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  webm: 'video/webm',
  wasm: 'application/wasm',
  pdf: 'application/pdf',
}

function mimeFor(pathname) {
  const ext = pathname.split('.').pop()?.toLowerCase() ?? ''
  return MIME[ext] ?? 'application/octet-stream'
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || typeof data !== 'object') return

  // Clients use MessageChannel for request/response, so the reply target is
  // event.ports[0]. Fall back to event.source for plain postMessage callers.
  const reply = (msg) => {
    const port = event.ports && event.ports[0]
    if (port) port.postMessage(msg)
    else if (event.source) event.source.postMessage(msg)
  }

  switch (data.type) {
    case 'ping': {
      reply({ type: 'pong', version: VERSION })
      break
    }
    case 'register-project': {
      // { type, id, files: Record<string, Uint8Array> }
      const fileMap = new Map()
      for (const [path, bytes] of Object.entries(data.files)) {
        fileMap.set(normalize(path), bytes)
      }
      projects.set(data.id, fileMap)
      reply({ type: 'project-registered', id: data.id })
      break
    }
    case 'unregister-project': {
      projects.delete(data.id)
      reply({ type: 'project-unregistered', id: data.id })
      break
    }
    default:
      // ignore
      break
  }
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return
  if (!url.pathname.startsWith(PREVIEW_PREFIX)) return

  event.respondWith(serve(url))
})

async function serve(url) {
  // url.pathname looks like: /web-previews/preview/<id>/<asset>
  const rest = url.pathname.slice(PREVIEW_PREFIX.length)
  const slash = rest.indexOf('/')
  const id = slash === -1 ? rest : rest.slice(0, slash)
  let assetPath = slash === -1 ? '' : rest.slice(slash + 1)

  if (assetPath === '' || assetPath.endsWith('/')) {
    assetPath += 'index.html'
  }
  assetPath = normalize(assetPath)

  const files = projects.get(id)
  if (!files) {
    return new Response('Project not loaded. Re-upload to preview again.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  let bytes = files.get(assetPath)
  if (!bytes) {
    // try with index.html appended (for directory-style paths)
    bytes = files.get(normalize(assetPath + '/index.html'))
  }
  if (!bytes) {
    return new Response(`Not found: ${assetPath}`, {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  return new Response(bytes, {
    status: 200,
    headers: {
      'content-type': mimeFor(assetPath),
      'cache-control': 'no-store',
    },
  })
}

function normalize(p) {
  // collapse '..' and '.', strip leading '/', drop query/hash if any
  let s = p.replace(/[?#].*$/, '')
  if (s.startsWith('/')) s = s.slice(1)
  const parts = []
  for (const seg of s.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  return parts.join('/')
}
