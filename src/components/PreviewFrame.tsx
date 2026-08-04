import { ExternalLink, RotateCw, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { previewUrlFor } from '@/lib/sw-client'
import { cn } from '@/lib/utils'

interface PreviewFrameProps {
  entrypoint: string
  label: string
  onClear: () => void
  /** Re-read the source before reloading — set for projects opened from disk. */
  onRefresh?: () => Promise<void>
  projectId: string
}

export function PreviewFrame({
  projectId,
  entrypoint,
  label,
  onClear,
  onRefresh,
}: PreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [nonce, setNonce] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const url = previewUrlFor(projectId, entrypoint)

  async function reload() {
    if (onRefresh) {
      setRefreshing(true)
      try {
        await onRefresh()
      } catch (err) {
        console.error(err)
        toast.error(err instanceof Error ? err.message : 'Could not re-read the folder.')
      } finally {
        setRefreshing(false)
      }
    }
    setNonce((n) => n + 1)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <div className="truncate text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className="mx-2 text-muted-foreground">/</span>
          <span className="font-mono">{entrypoint}</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void reload()}
            disabled={refreshing}
            title={onRefresh ? 'Re-read from disk and reload' : 'Reload preview'}
          >
            <RotateCw className={cn(refreshing && 'animate-spin')} />
          </Button>
          <Button variant="ghost" size="icon" asChild title="Open in new tab">
            <a href={url} target="_blank" rel="noreferrer noopener">
              <ExternalLink />
            </a>
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X /> Load another
          </Button>
        </div>
      </div>
      <iframe
        key={nonce}
        ref={iframeRef}
        src={url}
        title={label}
        sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-same-origin"
        className="flex-1 border-0 bg-white"
      />
    </div>
  )
}
