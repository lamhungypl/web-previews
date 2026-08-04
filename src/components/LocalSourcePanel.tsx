import { FileSearch, FolderPlus, HardDrive, Loader2, X } from 'lucide-react'
import { type DragEvent, type ReactNode, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { ResolvedLocalFile } from '@/lib/fs-access'
import {
  describePickedFile,
  fsAccessSupport,
  inferRootAbsPath,
  pickLocalDirectory,
  pickLocalFile,
  resolveLocalPath,
} from '@/lib/fs-access'
import { cn } from '@/lib/utils'
import {
  addLocalRoot,
  getLocalRoots,
  localRootsReady,
  removeLocalRoot,
  setLocalRootAbsPath,
  useLocalRoots,
} from '@/store/localRoots'

interface LocalSourcePanelProps {
  busy?: boolean
  /** Accepted extensions, e.g. ['.md'] — drops outside this set are rejected. */
  extensions: string[]
  fileTypes?: FilePickerAcceptType[]
  /**
   * A dropped or picked folder. Omit and a dropped folder is simply granted as
   * a root, which is what makes typed paths inside it work.
   */
  onDirectory?: (dir: FileSystemDirectoryHandle) => Promise<void> | void
  /** Fallback for browsers that hand over a File but no handle. */
  onFile: (file: File) => Promise<void> | void
  onResolved: (resolved: ResolvedLocalFile) => Promise<void> | void
  placeholder?: string
  /** Slot for the recent-files list, rendered inside this card. */
  recent?: ReactNode
}

type GrantHint = 'none' | 'no-roots' | 'not-found'

/**
 * One surface for everything that comes off the local disk: drop a file or
 * folder on it, type a path, or use the native picker.
 *
 * The path field is the reason the rest exists. A typed path can't be read
 * directly — the browser blocks that — so the first time a path misses we ask
 * for the folder above it. That grant is remembered, and every later path
 * inside it opens with no dialog at all. Dropping is wired to handles too
 * (not just File objects), so a dropped file gets the same history, live
 * reload and local-image support as one opened by path.
 */
export function LocalSourcePanel({
  busy = false,
  extensions,
  fileTypes,
  onDirectory,
  onFile,
  onResolved,
  placeholder = '/Users/you/notes/README.md',
  recent,
}: LocalSourcePanelProps) {
  const roots = useLocalRoots()
  const support = fsAccessSupport()
  const [path, setPath] = useState('')
  const [working, setWorking] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [hint, setHint] = useState<GrantHint>('none')

  const disabled = busy || working
  const accepts = (name: string) =>
    extensions.some((ext) => name.toLowerCase().endsWith(ext))

  /** Remember where a root lives so absolute paths match it directly next time. */
  function learnRootPath(resolved: ResolvedLocalFile) {
    const absPath = inferRootAbsPath(resolved)
    if (absPath && resolved.rootId) setLocalRootAbsPath(resolved.rootId, absPath)
  }

  async function guard(fn: () => Promise<void>, fallbackMessage: string) {
    if (disabled) return
    setWorking(true)
    try {
      await fn()
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : fallbackMessage)
    } finally {
      setWorking(false)
    }
  }

  async function openHandle(file: FileSystemFileHandle) {
    await localRootsReady()
    const resolved = await describePickedFile(file, getLocalRoots())
    setPath(resolved.displayPath)
    setHint('none')
    await onResolved(resolved)
  }

  async function acceptDirectory(dir: FileSystemDirectoryHandle) {
    await localRootsReady()
    await addLocalRoot(dir)
    setHint('none')
    if (onDirectory) {
      await onDirectory(dir)
      return
    }
    toast.success(`Added "${dir.name}" — paths inside it now open without a dialog.`)
    if (path.trim()) await resolvePath()
  }

  async function resolvePath() {
    await localRootsReady()
    const known = getLocalRoots()
    const resolved = await resolveLocalPath(path, known)
    if (!resolved) {
      setHint(known.length === 0 ? 'no-roots' : 'not-found')
      return
    }
    learnRootPath(resolved)
    setHint('none')
    await onResolved(resolved)
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    if (disabled) return

    // DataTransferItem is only valid synchronously, so start both reads now.
    const item = [...event.dataTransfer.items].find((i) => i.kind === 'file')
    if (!item) return
    const handlePromise = item.getAsFileSystemHandle?.()
    const fallback = item.getAsFile()

    void guard(async () => {
      const handle = await handlePromise
      if (handle?.kind === 'directory') {
        await acceptDirectory(handle)
        return
      }
      if (handle?.kind === 'file') {
        if (!accepts(handle.name))
          throw new Error(`${handle.name} is not a supported file.`)
        await openHandle(handle)
        return
      }
      // No handle (Safari, Firefox): a one-off File is still previewable.
      if (!fallback) throw new Error('Nothing readable was dropped.')
      if (!accepts(fallback.name))
        throw new Error(`${fallback.name} is not a supported file.`)
      await onFile(fallback)
    }, 'Could not open what you dropped.')
  }

  return (
    <Card
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={(event) => {
        // Ignore moves between children — only a real exit clears the state.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDragging(false)
        }
      }}
      onDrop={onDrop}
      className={cn(
        'flex flex-col gap-3 border-2 border-dashed p-4 transition-colors',
        dragging && 'border-primary bg-primary/5',
        disabled && 'opacity-70',
      )}
    >
      <div>
        <div className="flex items-center gap-2 text-sm font-medium">
          {working ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <HardDrive className="size-4 text-muted-foreground" />
          )}
          {dragging ? 'Drop to open' : 'Open from this machine'}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Drop a file or folder here, type a path, or pick one below.
        </p>
      </div>

      {support.file || support.directory ? (
        <>
          <div className="flex gap-2">
            <Input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void guard(resolvePath, 'Could not open that path.')
                }
              }}
              placeholder={placeholder}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              disabled={disabled}
              className="font-mono text-xs"
              aria-label="File path on this machine"
            />
            <Button
              onClick={() => void guard(resolvePath, 'Could not open that path.')}
              disabled={!path.trim() || disabled}
            >
              Open
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {support.file ? (
              <Button
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() =>
                  void guard(async () => {
                    const handle = await pickLocalFile(fileTypes)
                    if (handle) await openHandle(handle)
                  }, 'Could not open that file.')
                }
              >
                <FileSearch /> Choose a file…
              </Button>
            ) : null}
            {support.directory ? (
              <Button
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() =>
                  void guard(async () => {
                    const dir = await pickLocalDirectory()
                    if (dir) await acceptDirectory(dir)
                  }, 'Could not open that folder.')
                }
              >
                <FolderPlus /> {onDirectory ? 'Open a folder…' : 'Add a folder…'}
              </Button>
            ) : null}
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Opening by path needs the File System Access API, which this browser
          doesn&apos;t support — try Chrome or Edge. Dropping a file still works.
        </p>
      )}

      {hint !== 'none' ? (
        <p className="rounded-md border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
          {hint === 'no-roots' ? (
            <>
              Browsers can&apos;t read a path on their own. Grant the folder that contains
              this file — once — and every path inside it will open straight away from
              then on.
            </>
          ) : (
            <>
              Not found under the folders you&apos;ve granted. Check the path, or grant a
              folder further up.
            </>
          )}
        </p>
      ) : null}

      {roots.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Granted:</span>
          {roots.map((root) => (
            <span
              key={root.id}
              className="inline-flex items-center gap-1 rounded-full border bg-background py-0.5 pr-0.5 pl-2 text-xs"
              title={root.absPath ?? root.name}
            >
              <span className="max-w-52 truncate font-mono">{root.name}</span>
              <button
                type="button"
                onClick={() => removeLocalRoot(root.id)}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={`Forget ${root.name}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {recent ? (
        <div className="-mx-4 -mb-4 max-h-64 overflow-hidden border-t">{recent}</div>
      ) : null}
    </Card>
  )
}
