// Minimal IndexedDB key-value store.
//
// Why not localStorage: FileSystemHandle objects are structured-cloneable but
// NOT JSON-serializable, and a handle is the only way to re-open a local file
// on a later visit without re-prompting the user for the file itself. IndexedDB
// is the only web storage that can hold them.

const DB_NAME = 'web-previews'
const DB_VERSION = 1
const STORE = 'kv'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Could not open IndexedDB.'))
  })
  return dbPromise
}

function run<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const req = fn(tx.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed.'))
      }),
  )
}

export function idbGet<T>(key: string): Promise<T | undefined> {
  return run<T | undefined>('readonly', (s) => s.get(key) as IDBRequest<T | undefined>)
}

export function idbSet(key: string, value: unknown): Promise<void> {
  return run('readwrite', (s) => s.put(value, key) as IDBRequest<any>).then(
    () => undefined,
  )
}

export function idbDelete(key: string): Promise<void> {
  return run('readwrite', (s) => s.delete(key) as IDBRequest<any>).then(() => undefined)
}
