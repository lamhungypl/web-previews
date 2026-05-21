// Service Worker client helpers.
// The SW lives at <BASE_URL>sw.js with scope <BASE_URL>. We register once at
// app boot and resolve `swReady` only after a ping/pong round-trip, so callers
// can be sure the SW is actually controlling the page before they navigate
// the iframe to a virtual URL.

const BASE = import.meta.env.BASE_URL // e.g. '/web-previews/'

let readyPromise: Promise<ServiceWorker> | null = null

export function swReady(): Promise<ServiceWorker> {
  if (readyPromise) return readyPromise
  readyPromise = registerAndPing()
  return readyPromise
}

async function registerAndPing(): Promise<ServiceWorker> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported in this browser.')
  }

  await navigator.serviceWorker.register(`${BASE}sw.js`, { scope: BASE })
  const reg = await navigator.serviceWorker.ready

  // After `ready` we still need an active worker that controls THIS page.
  // If we're the first client, controller may be null until we reload —
  // but our SW uses skipWaiting + clients.claim, so this usually resolves
  // within a tick.
  const active = reg.active ?? (await waitForActive(reg))
  await waitForController()
  await ping(active)
  return active
}

function waitForActive(reg: ServiceWorkerRegistration): Promise<ServiceWorker> {
  return new Promise((resolve, reject) => {
    const sw = reg.installing ?? reg.waiting
    if (!sw) return reject(new Error('No installing/waiting service worker.'))
    sw.addEventListener('statechange', () => {
      if (sw.state === 'activated') resolve(sw)
    })
  })
}

function waitForController(): Promise<void> {
  if (navigator.serviceWorker.controller) return Promise.resolve()
  return new Promise((resolve) => {
    navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
      once: true,
    })
  })
}

function ping(sw: ServiceWorker): Promise<void> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel()
    const timeout = setTimeout(() => reject(new Error('SW ping timed out.')), 3000)
    channel.port1.onmessage = (e) => {
      if (e.data?.type === 'pong') {
        clearTimeout(timeout)
        resolve()
      }
    }
    sw.postMessage({ type: 'ping' }, [channel.port2])
  })
}

export async function registerProject(
  id: string,
  files: Map<string, Uint8Array>,
): Promise<void> {
  const sw = await swReady()
  const filesObj: Record<string, Uint8Array> = {}
  for (const [path, bytes] of files) filesObj[path] = bytes

  return new Promise((resolve, reject) => {
    const channel = new MessageChannel()
    const timeout = setTimeout(
      () => reject(new Error('SW project register timed out.')),
      5000,
    )
    channel.port1.onmessage = (e) => {
      if (e.data?.type === 'project-registered' && e.data.id === id) {
        clearTimeout(timeout)
        resolve()
      }
    }
    sw.postMessage({ type: 'register-project', id, files: filesObj }, [channel.port2])
  })
}

export async function unregisterProject(id: string): Promise<void> {
  const sw = await swReady().catch(() => null)
  if (!sw) return
  sw.postMessage({ type: 'unregister-project', id })
}

export function previewUrlFor(id: string, entrypoint = 'index.html'): string {
  const clean = entrypoint.replace(/^\/+/, '')
  return `${BASE}preview/${id}/${clean}`
}
