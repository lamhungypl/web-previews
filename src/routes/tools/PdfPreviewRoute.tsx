import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { FilePicker } from '@/components/FilePicker'
import { Button } from '@/components/ui/button'
import { loadPdfjs } from '@/lib/pdf'

interface LoadedPdf {
  doc: PDFDocumentProxy
  fileName: string
  numPages: number
  /** Object URL of the original bytes — used for the download button. */
  url: string
}

export function PdfPreviewRoute() {
  const [pdf, setPdf] = useState<LoadedPdf | null>(null)
  const [page, setPage] = useState(1)
  const [scale, setScale] = useState(1.25)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Render current page whenever pdf/page/scale changes.
  useEffect(() => {
    if (!pdf || !canvasRef.current) return
    let cancelled = false
    const canvas = canvasRef.current
    ;(async () => {
      try {
        const p = await pdf.doc.getPage(page)
        const dpr = window.devicePixelRatio || 1
        const viewport = p.getViewport({ scale: scale * dpr })
        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.style.width = `${viewport.width / dpr}px`
        canvas.style.height = `${viewport.height / dpr}px`
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Could not create 2D canvas context.')
        if (cancelled) return
        await p.render({ canvas, canvasContext: ctx, viewport }).promise
      } catch (err) {
        if (cancelled) return
        console.error(err)
        setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pdf, page, scale])

  // Clean up object URL when pdf changes/unmounts.
  useEffect(() => {
    return () => {
      if (pdf?.url) URL.revokeObjectURL(pdf.url)
    }
  }, [pdf])

  async function handleFile(file: File) {
    setBusy(true)
    setError(null)
    try {
      const pdfjs = await loadPdfjs()
      const bytes = new Uint8Array(await file.arrayBuffer())
      const url = URL.createObjectURL(file)
      // pdf.js consumes the buffer, so we pass a copy.
      const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise
      setPdf({ doc, fileName: file.name, numPages: doc.numPages, url })
      setPage(1)
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Could not load PDF.')
    } finally {
      setBusy(false)
    }
  }

  function download() {
    if (!pdf) return
    const a = document.createElement('a')
    a.href = pdf.url
    a.download = pdf.fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  if (!pdf) {
    return (
      <ToolShell
        title="PDF Preview"
        hint="Render a PDF locally. Pages stay on this machine."
      >
        <FilePicker
          accept={{ 'application/pdf': ['.pdf'] }}
          icon={FileText}
          label={busy ? 'Loading…' : 'Drop a PDF, or click to choose'}
          busy={busy}
          onFile={handleFile}
        />
      </ToolShell>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <div className="truncate text-sm">
          <span className="text-muted-foreground">{pdf.fileName}</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            title="Previous page"
          >
            <ChevronLeft />
          </Button>
          <div className="flex items-center gap-1 text-sm">
            <input
              type="number"
              min={1}
              max={pdf.numPages}
              value={page}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (Number.isFinite(v)) {
                  setPage(Math.min(pdf.numPages, Math.max(1, Math.floor(v))))
                }
              }}
              className="h-7 w-14 rounded border bg-background px-2 text-center"
            />
            <span className="text-muted-foreground">/ {pdf.numPages}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPage((p) => Math.min(pdf.numPages, p + 1))}
            disabled={page >= pdf.numPages}
            title="Next page"
          >
            <ChevronRight />
          </Button>
          <span className="mx-2 h-5 w-px bg-border" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setScale((s) => Math.max(0.25, +(s - 0.25).toFixed(2)))}
            title="Zoom out"
          >
            <ZoomOut />
          </Button>
          <span className="w-12 text-center font-mono text-xs">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setScale((s) => Math.min(4, +(s + 0.25).toFixed(2)))}
            title="Zoom in"
          >
            <ZoomIn />
          </Button>
          <span className="mx-2 h-5 w-px bg-border" />
          <Button variant="ghost" size="icon" asChild title="Open in new tab">
            <a href={pdf.url} target="_blank" rel="noreferrer noopener">
              <ExternalLink />
            </a>
          </Button>
          <Button variant="ghost" size="icon" onClick={download} title="Download">
            <Download />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (pdf.url) URL.revokeObjectURL(pdf.url)
              setPdf(null)
            }}
          >
            Load another
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-muted p-6">
        {error ? (
          <div className="mx-auto max-w-xl rounded-md border border-destructive bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <div className="mx-auto w-fit shadow-lg">
            <canvas ref={canvasRef} className="block bg-white" />
          </div>
        )}
      </div>
    </div>
  )
}

function ToolShell({
  children,
  hint,
  title,
}: {
  children: React.ReactNode
  hint?: string
  title: string
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  )
}
