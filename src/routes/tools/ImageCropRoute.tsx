import { Download, FlipHorizontal, ImageIcon, RotateCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { toast } from 'sonner'

import { FilePicker } from '@/components/FilePicker'
import { Button } from '@/components/ui/button'
import {
  cropImage,
  extensionFor,
  type Flip,
  formatBytes,
  type OutputFormat,
} from '@/lib/image'

const ASPECTS: { label: string; value: number | undefined }[] = [
  { label: 'Free', value: undefined },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
]

const FORMATS: OutputFormat[] = ['image/jpeg', 'image/png', 'image/webp']

export function ImageCropRoute() {
  const [src, setSrc] = useState<string | null>(null)
  const [fileName, setFileName] = useState('image')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [aspect, setAspect] = useState<number | undefined>(1)
  const [flip, setFlip] = useState<Flip>({ horizontal: false, vertical: false })
  const [pixelCrop, setPixelCrop] = useState<Area | null>(null)
  const [format, setFormat] = useState<OutputFormat>('image/jpeg')
  const [quality, setQuality] = useState(0.92)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    return () => {
      if (src) URL.revokeObjectURL(src)
    }
  }, [src])

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setPixelCrop(pixels)
  }, [])

  function handleFile(file: File) {
    if (src) URL.revokeObjectURL(src)
    setSrc(URL.createObjectURL(file))
    setFileName(file.name.replace(/\.[^.]+$/, '') || 'image')
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotation(0)
  }

  async function download() {
    if (!src || !pixelCrop) return
    setBusy(true)
    try {
      const blob = await cropImage({
        flip,
        format,
        imageSrc: src,
        pixelCrop,
        quality,
        rotation,
      })
      const ext = extensionFor(format)
      triggerDownload(blob, `${fileName}-cropped.${ext}`)
      toast.success(`Exported ${formatBytes(blob.size)}`)
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Crop failed.')
    } finally {
      setBusy(false)
    }
  }

  if (!src) {
    return (
      <ToolShell title="Image Cropper" hint="Crop, rotate, flip and re-encode.">
        <FilePicker
          accept={{ 'image/*': [] }}
          icon={ImageIcon}
          label="Drop an image, or click to choose"
          hint="JPEG, PNG, WebP, GIF, SVG, etc."
          onFile={handleFile}
        />
      </ToolShell>
    )
  }

  return (
    <ToolShell title="Image Cropper">
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="relative h-[60vh] overflow-hidden rounded-lg border bg-muted">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            transform={`translate(${crop.x}px, ${crop.y}px) rotate(${rotation}deg) scale(${zoom}) scaleX(${flip.horizontal ? -1 : 1}) scaleY(${flip.vertical ? -1 : 1})`}
          />
        </div>

        <div className="flex flex-col gap-4">
          <Field label="Aspect">
            <div className="flex flex-wrap gap-1">
              {ASPECTS.map((a) => (
                <Button
                  key={a.label}
                  size="sm"
                  variant={aspect === a.value ? 'default' : 'outline'}
                  onClick={() => setAspect(a.value)}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          </Field>

          <Field label={`Zoom · ${zoom.toFixed(2)}×`}>
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
            />
          </Field>

          <Field label={`Rotation · ${rotation}°`}>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="w-full"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                title="Rotate 90°"
              >
                <RotateCw />
              </Button>
            </div>
          </Field>

          <Field label="Flip">
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={flip.horizontal ? 'default' : 'outline'}
                onClick={() => setFlip((f) => ({ ...f, horizontal: !f.horizontal }))}
              >
                <FlipHorizontal /> H
              </Button>
              <Button
                size="sm"
                variant={flip.vertical ? 'default' : 'outline'}
                onClick={() => setFlip((f) => ({ ...f, vertical: !f.vertical }))}
              >
                <FlipHorizontal className="rotate-90" /> V
              </Button>
            </div>
          </Field>

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

          <div className="mt-auto flex flex-col gap-2">
            <Button onClick={download} disabled={!pixelCrop || busy}>
              <Download /> {busy ? 'Encoding…' : 'Download cropped'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                URL.revokeObjectURL(src)
                setSrc(null)
                setPixelCrop(null)
              }}
            >
              Load another image
            </Button>
          </div>
        </div>
      </div>
    </ToolShell>
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

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
