import { Download, ImageIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { FilePicker } from '@/components/FilePicker'
import { Button } from '@/components/ui/button'
import { convertImage, extensionFor, formatBytes, type OutputFormat } from '@/lib/image'

const FORMATS: OutputFormat[] = ['image/jpeg', 'image/png', 'image/webp']

export function ImageConvertRoute() {
  const [src, setSrc] = useState<string | null>(null)
  const [originalSize, setOriginalSize] = useState(0)
  const [fileName, setFileName] = useState('image')
  const [format, setFormat] = useState<OutputFormat>('image/webp')
  const [quality, setQuality] = useState(0.85)
  const [maxEdge, setMaxEdge] = useState<number | ''>('')
  const [result, setResult] = useState<{ blob: Blob; url: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const resultUrlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (src) URL.revokeObjectURL(src)
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    }
  }, [src])

  function handleFile(file: File) {
    if (src) URL.revokeObjectURL(src)
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current)
      resultUrlRef.current = null
    }
    setSrc(URL.createObjectURL(file))
    setOriginalSize(file.size)
    setFileName(file.name.replace(/\.[^.]+$/, '') || 'image')
    setResult(null)
  }

  async function convert() {
    if (!src) return
    setBusy(true)
    try {
      const blob = await convertImage({
        format,
        imageSrc: src,
        maxEdge: typeof maxEdge === 'number' ? maxEdge : undefined,
        quality,
      })
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
      const url = URL.createObjectURL(blob)
      resultUrlRef.current = url
      setResult({ blob, url })
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Conversion failed.')
    } finally {
      setBusy(false)
    }
  }

  function download() {
    if (!result) return
    const ext = extensionFor(format)
    const a = document.createElement('a')
    a.href = result.url
    a.download = `${fileName}.${ext}`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const sizeDelta = useMemo(() => {
    if (!result) return null
    const delta = result.blob.size - originalSize
    const pct = (delta / originalSize) * 100
    return { delta, pct }
  }, [result, originalSize])

  if (!src) {
    return (
      <ToolShell title="Image Converter" hint="Re-encode to JPEG / PNG / WebP.">
        <FilePicker
          accept={{ 'image/*': [] }}
          icon={ImageIcon}
          label="Drop an image, or click to choose"
          onFile={handleFile}
        />
      </ToolShell>
    )
  }

  return (
    <ToolShell title="Image Converter">
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Preview label={`Original · ${formatBytes(originalSize)}`} src={src} />
            <Preview
              label={
                result
                  ? `Converted · ${formatBytes(result.blob.size)}${
                      sizeDelta
                        ? ` (${sizeDelta.pct > 0 ? '+' : ''}${sizeDelta.pct.toFixed(1)}%)`
                        : ''
                    }`
                  : 'Converted · (run to preview)'
              }
              src={result?.url}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Field label="Output format">
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as OutputFormat)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f.replace('image/', '').toUpperCase()}
                </option>
              ))}
            </select>
          </Field>

          {format !== 'image/png' ? (
            <Field label={`Quality · ${Math.round(quality * 100)}%`}>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.01}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full"
              />
            </Field>
          ) : null}

          <Field label="Resize (max edge, px)">
            <input
              type="number"
              min={16}
              step={1}
              placeholder="Original size"
              value={maxEdge}
              onChange={(e) => {
                const v = e.target.value
                setMaxEdge(v === '' ? '' : Number(v))
              }}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            />
          </Field>

          <Button onClick={convert} disabled={busy}>
            {busy ? 'Encoding…' : 'Convert'}
          </Button>
          <Button onClick={download} disabled={!result} variant="outline">
            <Download /> Download
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              URL.revokeObjectURL(src)
              setSrc(null)
              setResult(null)
            }}
          >
            Load another image
          </Button>
        </div>
      </div>
    </ToolShell>
  )
}

function Preview({ label, src }: { label: string; src?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex h-64 items-center justify-center overflow-hidden rounded-md border bg-muted">
        {src ? (
          <img src={src} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { children: React.ReactNode; label: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
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
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  )
}
