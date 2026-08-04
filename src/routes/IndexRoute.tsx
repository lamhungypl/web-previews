import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { LocalSourcePanel } from '@/components/LocalSourcePanel'
import { RecentFilesPanel, type RecentItem } from '@/components/RecentFilesPanel'
import { SourceInput } from '@/components/SourceInput'
import type { ResolvedLocalFile } from '@/lib/fs-access'
import { ensureReadPermission, readDirectoryRecursive } from '@/lib/fs-access'
import { registerProject } from '@/lib/sw-client'
import {
  packFiles,
  packHtmlSource,
  packSingleHtml,
  type UnpackedProject,
  unzipFile,
} from '@/lib/unzip'
import {
  clearHtmlHistory,
  type HtmlHistoryEntry,
  htmlHistoryReady,
  recordHtmlVisit,
  removeHtmlHistoryEntry,
  useHtmlHistory,
} from '@/store/htmlHistory'
import { addProject } from '@/store/projects'

const HTML_FILE_TYPES: FilePickerAcceptType[] = [
  { accept: { 'text/html': ['.html', '.htm'] }, description: 'HTML' },
]

const DROP_EXTENSIONS = ['.html', '.htm', '.zip']

export function IndexRoute() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const history = useHtmlHistory()

  async function loadProject(
    project: UnpackedProject,
    label: string,
    dir: FileSystemDirectoryHandle | null = null,
  ) {
    setBusy(true)
    try {
      const id = crypto.randomUUID()
      await registerProject(id, project.files)
      addProject(id, { dir, entrypoint: project.entrypoint, label })
      navigate({ to: '/view/$projectId', params: { projectId: id } })
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Failed to load project.')
    } finally {
      setBusy(false)
    }
  }

  /** A dropped or uploaded file — no handle, so nothing to record in history. */
  async function handleFile(file: File) {
    setBusy(true)
    try {
      const isZip =
        file.type === 'application/zip' ||
        file.type === 'application/x-zip-compressed' ||
        file.name.toLowerCase().endsWith('.zip')
      const project = isZip ? await unzipFile(file) : await packSingleHtml(file)
      await loadProject(project, file.name)
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Failed to load project.')
      setBusy(false)
    }
  }

  /** Read a folder off disk straight into the virtual filesystem. */
  async function loadDirectory(
    dir: FileSystemDirectoryHandle,
    entrypoint?: string,
    displayPath?: string,
  ) {
    const { files, skipped } = await readDirectoryRecursive(dir)
    if (files.size === 0) throw new Error(`"${dir.name}" has no readable files.`)
    if (skipped.length > 0) {
      toast.warning(
        `${skipped.length} file${skipped.length === 1 ? '' : 's'} skipped — the folder exceeds the in-memory limit.`,
      )
    }
    const project = packFiles(files, entrypoint)
    recordHtmlVisit({
      dir,
      entrypoint: project.entrypoint,
      file: null,
      name: project.entrypoint.split('/').pop() ?? dir.name,
      path: displayPath ?? `${dir.name}/${project.entrypoint}`,
    })
    await loadProject(project, dir.name, dir)
  }

  /**
   * A path to a single .html file: preview it with its own folder as the asset
   * root, so stylesheets, scripts and sibling pages resolve the way they do
   * when the file is served.
   */
  async function openResolved(resolved: ResolvedLocalFile) {
    if (!resolved.parent) {
      const file = await resolved.file.getFile()
      recordHtmlVisit({
        dir: null,
        entrypoint: file.name,
        file: resolved.file,
        name: file.name,
        path: resolved.displayPath,
      })
      await loadProject(await packSingleHtml(file), file.name)
      toast.info(
        'Previewing that file on its own — add its folder to load stylesheets and images too.',
      )
      return
    }
    await loadDirectory(
      resolved.parent,
      resolved.relPath.split('/').pop(),
      resolved.displayPath,
    )
  }

  async function openHistoryEntry(entry: HtmlHistoryEntry) {
    await htmlHistoryReady()
    const handle = entry.dir ?? entry.file
    if (!handle) throw new Error('That entry is no longer openable.')
    if (!(await ensureReadPermission(handle))) {
      throw new Error('Read access was not granted.')
    }
    if (entry.dir) {
      await loadDirectory(entry.dir, entry.entrypoint, entry.path)
      return
    }
    const file = await entry.file!.getFile()
    await loadProject(await packSingleHtml(file), file.name)
  }

  async function reopen(item: RecentItem) {
    const entry = history.find((e) => e.id === item.id)
    if (!entry) return
    setBusy(true)
    try {
      await openHistoryEntry(entry)
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Could not reopen that project.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col justify-center px-4 py-8">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Preview an HTML project</h1>
        <p className="mt-2 text-muted-foreground">
          Paste source, or open a file, folder or{' '}
          <code className="rounded bg-muted px-1.5 py-0.5">.zip</code> from this machine.
          Everything runs in your browser.
        </p>
      </div>

      <SourceInput
        busy={busy}
        onSubmit={(text) => void loadProject(packHtmlSource(text), 'Pasted HTML')}
        placeholder="Paste or type HTML here…"
      />

      <Divider />

      <LocalSourcePanel
        busy={busy}
        extensions={DROP_EXTENSIONS}
        fileTypes={HTML_FILE_TYPES}
        onDirectory={(dir) => loadDirectory(dir)}
        onFile={handleFile}
        onResolved={openResolved}
        placeholder="/Users/you/project/index.html"
        recent={
          <RecentFilesPanel
            items={history.map((entry) => ({
              id: entry.id,
              name: entry.name,
              openedAt: entry.openedAt,
              subtitle: entry.dir ? entry.dir.name : 'single file',
              title: entry.path,
            }))}
            label="Recent projects"
            emptyHint="Folders and files you open from this machine show up here."
            onClear={clearHtmlHistory}
            onOpen={(item) => void reopen(item)}
            onRemove={removeHtmlHistoryEntry}
          />
        }
      />
    </div>
  )
}

function Divider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}
