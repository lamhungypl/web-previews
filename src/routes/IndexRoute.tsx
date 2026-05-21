import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { Dropzone } from '@/components/Dropzone'
import { registerProject } from '@/lib/sw-client'
import { packSingleHtml, unzipFile } from '@/lib/unzip'
import { addProject } from '@/store/projects'

export function IndexRoute() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  async function handleFile(file: File) {
    setBusy(true)
    try {
      const isZip =
        file.type === 'application/zip' ||
        file.type === 'application/x-zip-compressed' ||
        file.name.toLowerCase().endsWith('.zip')
      const project = isZip ? await unzipFile(file) : await packSingleHtml(file)

      const id = crypto.randomUUID()
      await registerProject(id, project.files)
      addProject(id, { entrypoint: project.entrypoint, label: file.name })
      navigate({ to: '/view/$projectId', params: { projectId: id } })
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Failed to load project.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-4 py-8">
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
    </div>
  )
}
