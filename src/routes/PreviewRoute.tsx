import { useNavigate, useParams } from '@tanstack/react-router'
import { useEffect } from 'react'

import { PreviewFrame } from '@/components/PreviewFrame'
import { readDirectoryRecursive } from '@/lib/fs-access'
import { registerProject, unregisterProject } from '@/lib/sw-client'
import { removeProject, useProject } from '@/store/projects'

export function PreviewRoute() {
  const { projectId } = useParams({ from: '/view/$projectId' })
  const navigate = useNavigate()
  const project = useProject(projectId)

  useEffect(() => {
    // If we landed here without a registered project (e.g. hard reload, or
    // pasted URL), go back to the dropzone.
    if (!project) {
      const t = setTimeout(() => navigate({ to: '/' }), 0)
      return () => clearTimeout(t)
    }
  }, [project, navigate])

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Project not loaded — redirecting…
      </div>
    )
  }

  const dir = project.dir

  return (
    <PreviewFrame
      projectId={projectId}
      entrypoint={project.entrypoint}
      label={project.label}
      onRefresh={
        dir
          ? async () => {
              const { files } = await readDirectoryRecursive(dir)
              await registerProject(projectId, files)
            }
          : undefined
      }
      onClear={async () => {
        await unregisterProject(projectId)
        removeProject(projectId)
        navigate({ to: '/' })
      }}
    />
  )
}
