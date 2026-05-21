import {
  Download,
  FlipHorizontal,
  ImageIcon,
  Maximize2,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useRef, useState } from 'react'
import ReactCrop, {
  centerCrop,
  type Crop,
  makeAspectCrop,
  type PixelCrop,
} from 'react-image-crop'
import { toast } from 'sonner'

import { FilePicker } from '@/components/FilePicker'
import { Button } from '@/components/ui/button'
import {
  cropImage,
  extensionFor,
  formatBytes,
  type OutputFormat,
  transformImage,
} from '@/lib/image'

import 'react-image-crop/dist/ReactCrop.css'

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
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null)
  const [aspect, setAspect] = useState<number | undefined>(1)
  const [format, setFormat] = useState<OutputFormat>('image/jpeg')
  const [quality, setQuality] = useState(0.92)
  const [busy, setBusy] = useState(false)
  /** 'fit' = scale-to-viewport (default). Number = absolute zoom vs. natural size. */
  const [displayZoom, setDisplayZoom] = useState<'fit' | number>('fit')
  const [imgNatural, setImgNatural] = useState<{
    height: number
    width: number
  } | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  function handleFile(file: File) {
    if (src) URL.revokeObjectURL(src)
    setSrc(URL.createObjectURL(file))
    setFileName(file.name.replace(/\.[^.]+$/, '') || 'image')
    setCrop(undefined)
    setCompletedCrop(null)
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget
    const { width, height, naturalWidth, naturalHeight } = img
    setImgNatural({ height: naturalHeight, width: naturalWidth })
    // Initial 90%-of-image centered selection at the current aspect.
    const initial = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, aspect ?? width / height, width, height),
      width,
      height,
    )
    setCrop(initial)
  }

  function zoomOut() {
    setDisplayZoom((z) => {
      if (z === 'fit') return 0.75
      return Math.max(0.25, +(z - 0.25).toFixed(2))
    })
  }

  function zoomIn() {
    setDisplayZoom((z) => {
      if (z === 'fit') return 1.25
      return Math.min(4, +(z + 0.25).toFixed(2))
    })
  }

  function setAspectAndRecenter(next: number | undefined) {
    setAspect(next)
    const img = imgRef.current
    if (!img) return
    const { width, height } = img
    const newCrop = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, next ?? width / height, width, height),
      width,
      height,
    )
    setCrop(newCrop)
  }

  async function rotate90() {
    if (!src) return
    setBusy(true)
    try {
      const blob = await transformImage({ imageSrc: src, rotation: 90 })
      URL.revokeObjectURL(src)
      setSrc(URL.createObjectURL(blob))
      setCrop(undefined)
      setCompletedCrop(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rotate failed.')
    } finally {
      setBusy(false)
    }
  }

  async function flip(axis: 'horizontal' | 'vertical') {
    if (!src) return
    setBusy(true)
    try {
      const blob = await transformImage({
        flip: { horizontal: axis === 'horizontal', vertical: axis === 'vertical' },
        imageSrc: src,
      })
      URL.revokeObjectURL(src)
      setSrc(URL.createObjectURL(blob))
      setCrop(undefined)
      setCompletedCrop(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Flip failed.')
    } finally {
      setBusy(false)
    }
  }

  async function download() {
    if (!src || !completedCrop || !imgRef.current) return
    setBusy(true)
    try {
      // react-image-crop returns pixels in the displayed image's space; scale
      // to natural-image pixels before cropping on a canvas.
      const img = imgRef.current
      const scaleX = img.naturalWidth / img.width
      const scaleY = img.naturalHeight / img.height
      const blob = await cropImage({
        format,
        imageSrc: src,
        pixelCrop: {
          height: completedCrop.height * scaleY,
          width: completedCrop.width * scaleX,
          x: completedCrop.x * scaleX,
          y: completedCrop.y * scaleY,
        },
        quality,
      })
      triggerDownload(blob, `${fileName}-cropped.${extensionFor(format)}`)
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
      <ToolShell
        title="Image Cropper"
        hint="Drag the corners to crop. Aspect, rotation and flip below."
      >
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

  const isFit = displayZoom === 'fit'
  // react-image-crop's inner wrapper uses `max-height: inherit`, so we must set
  // the cap on the ReactCrop wrapper (not the img) for fit-mode to work.
  const cropWrapperStyle = isFit ? { maxHeight: '60vh' } : undefined
  const imgStyle =
    !isFit && imgNatural
      ? {
          height: imgNatural.height * displayZoom,
          maxHeight: 'none',
          maxWidth: 'none',
          width: imgNatural.width * displayZoom,
        }
      : undefined

  return (
    <ToolShell title="Image Cropper">
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="flex max-h-[64vh] items-center justify-center overflow-auto rounded-lg border bg-muted p-2">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspect}
            ruleOfThirds
            keepSelection
            disabled={busy}
            style={cropWrapperStyle}
          >
            <img
              ref={imgRef}
              src={src}
              alt=""
              onLoad={onImageLoad}
              style={imgStyle}
              className="block select-none"
            />
          </ReactCrop>
        </div>

        <div className="flex flex-col gap-4">
          <Field label="Aspect">
            <div className="flex flex-wrap gap-1">
              {ASPECTS.map((a) => (
                <Button
                  key={a.label}
                  size="sm"
                  variant={aspect === a.value ? 'default' : 'outline'}
                  onClick={() => setAspectAndRecenter(a.value)}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          </Field>

          <Field label="Rotate / Flip">
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={rotate90}
                disabled={busy}
                title="Rotate 90° clockwise"
              >
                <RotateCw /> 90°
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => flip('horizontal')}
                disabled={busy}
                title="Flip horizontally"
              >
                <FlipHorizontal /> H
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => flip('vertical')}
                disabled={busy}
                title="Flip vertically"
              >
                <FlipHorizontal className="rotate-90" /> V
              </Button>
            </div>
          </Field>

          <Field label={`View · ${isFit ? 'Fit' : `${Math.round(displayZoom * 100)}%`}`}>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={isFit ? 'default' : 'outline'}
                onClick={() => setDisplayZoom('fit')}
                title="Fit image in view"
              >
                <Maximize2 /> Fit
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={zoomOut}
                disabled={!isFit && displayZoom <= 0.25}
                title="Zoom out"
              >
                <ZoomOut />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={zoomIn}
                disabled={!isFit && displayZoom >= 4}
                title="Zoom in"
              >
                <ZoomIn />
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

          {completedCrop ? (
            <p className="text-xs text-muted-foreground">
              Selection:{' '}
              <span className="font-mono">
                {Math.round(completedCrop.width)} × {Math.round(completedCrop.height)} px
                (displayed)
              </span>
            </p>
          ) : null}

          <div className="mt-auto flex flex-col gap-2">
            <Button onClick={download} disabled={!completedCrop || busy}>
              <Download /> {busy ? 'Encoding…' : 'Download cropped'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                URL.revokeObjectURL(src)
                setSrc(null)
                setCompletedCrop(null)
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

function Field({ children, label }: { children: React.ReactNode; label: string }) {
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
