import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { Dropzone } from '@/components/Dropzone'
import { SourceInput } from '@/components/SourceInput'
import { registerProject } from '@/lib/sw-client'
import {
  packHtmlSource,
  packSingleHtml,
  type UnpackedProject,
  unzipFile,
} from '@/lib/unzip'
import { addProject } from '@/store/projects'

export function IndexRoute() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  async function loadProject(project: UnpackedProject, label: string) {
    setBusy(true)
    try {
      const id = crypto.randomUUID()
      await registerProject(id, project.files)
      addProject(id, { entrypoint: project.entrypoint, label })
      navigate({ to: '/view/$projectId', params: { projectId: id } })
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Failed to load project.')
    } finally {
      setBusy(false)
    }
  }

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

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col justify-center px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Preview an HTML project</h1>
        <p className="mt-2 text-muted-foreground">
          Drop a single <code className="rounded bg-muted px-1.5 py-0.5">.html</code>{' '}
          file, or a <code className="rounded bg-muted px-1.5 py-0.5">.zip</code> of a
          project containing{' '}
          <code className="rounded bg-muted px-1.5 py-0.5">index.html</code>. Everything
          runs in your browser.
        </p>
      </div>
      <Dropzone onFile={handleFile} busy={busy} />
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <SourceInput
        busy={busy}
        onSubmit={(text) => loadProject(packHtmlSource(text), 'Pasted HTML')}
        placeholder="Paste or type HTML here…"
      />
    </div>
  )
}
