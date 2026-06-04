import { ExternalLink, FileText, RotateCw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { FilePicker } from '@/components/FilePicker'
import { SourceInput } from '@/components/SourceInput'
import { Button } from '@/components/ui/button'
import { renderMarkdownDocument } from '@/lib/markdown'

interface LoadedMarkdown {
  fileName: string
  /** Object URL of the rendered HTML document — iframe src + open in new tab. */
  url: string
}

export function MdPreviewRoute() {
  const [doc, setDoc] = useState<LoadedMarkdown | null>(null)
  const [nonce, setNonce] = useState(0)
  const [busy, setBusy] = useState(false)

  // Clean up object URL when doc changes/unmounts.
  useEffect(() => {
    return () => {
      if (doc?.url) URL.revokeObjectURL(doc.url)
    }
  }, [doc])

  async function loadMarkdown(markdown: string, fileName: string) {
    setBusy(true)
    try {
      const html = await renderMarkdownDocument(markdown, fileName)
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
      setDoc({ fileName, url })
      setNonce(0)
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Could not render Markdown.')
    } finally {
      setBusy(false)
    }
  }

  async function handleFile(file: File) {
    await loadMarkdown(await file.text(), file.name)
  }

  if (!doc) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Markdown Preview</h1>
          <p className="text-sm text-muted-foreground">
            Render Markdown with GitHub-like styling. Everything stays on this machine.
          </p>
        </div>
        <FilePicker
          accept={{ 'text/markdown': ['.md', '.markdown'] }}
          icon={FileText}
          label={busy ? 'Loading…' : 'Drop a Markdown file, or click to choose'}
          busy={busy}
          onFile={handleFile}
        />
        <Divider />
        <SourceInput
          busy={busy}
          onSubmit={(text) => loadMarkdown(text, 'Pasted Markdown')}
          placeholder="Paste or type Markdown here…"
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <div className="truncate font-mono text-sm">{doc.fileName}</div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setNonce((n) => n + 1)}
            title="Reload preview"
          >
            <RotateCw />
          </Button>
          <Button variant="ghost" size="icon" asChild title="Open in new tab">
            <a href={doc.url} target="_blank" rel="noreferrer noopener">
              <ExternalLink />
            </a>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDoc(null)}>
            <X /> Load another
          </Button>
        </div>
      </div>
      <iframe
        key={nonce}
        src={doc.url}
        title={doc.fileName}
        sandbox="allow-popups allow-same-origin"
        className="flex-1 border-0 bg-white"
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
