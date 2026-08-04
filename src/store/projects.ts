// In-memory registry mapping project id → entrypoint path.
// The actual file bytes live inside the Service Worker; the host app only
// needs to remember "what URL should the iframe point at" for a given id.
// Hard-reload wipes this (and the SW's memory), which is intentional for v1.

import { useSyncExternalStore } from 'react'

interface ProjectEntry {
  /**
   * Folder the project was read from, when it came off the local disk. Keeping
   * the handle is what lets Reload pick up edits instead of just re-rendering
   * the snapshot we already have.
   */
  dir: FileSystemDirectoryHandle | null
  entrypoint: string
  /** Display label (original filename) — purely cosmetic. */
  label: string
}

const projects = new Map<string, ProjectEntry>()
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function addProject(id: string, entry: ProjectEntry): void {
  projects.set(id, entry)
  emit()
}

export function removeProject(id: string): void {
  projects.delete(id)
  emit()
}

export function getProject(id: string): ProjectEntry | undefined {
  return projects.get(id)
}

export function useProject(id: string): ProjectEntry | undefined {
  return useSyncExternalStore(
    subscribe,
    () => projects.get(id),
    () => undefined,
  )
}
