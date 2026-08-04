import {
  Download,
  FlipHorizontal,
  ImageIcon,
  Maximize2,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import ReactCrop, {
  centerCrop,
  type Crop,
  makeAspectCrop,
  type PercentCrop,
} from 'react-image-crop'
import { toast } from 'sonner'

import { FilePicker } from '@/components/FilePicker'
import type { GalleryItem } from '@/components/ImageGalleryOverlay'
import { ImagePreviewStrip } from '@/components/ImagePreviewStrip'
import { Button } from '@/components/ui/button'
import {
  computeOutputSize,
  exportImage,
  extensionFor,
  formatBytes,
  type OutputFormat,
  type PixelArea,
  transformImage,
} from '@/lib/image'
import { cn } from '@/lib/utils'

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

/** Smallest `maxEdge` worth honouring; below this the input is treated as empty. */
const MIN_MAX_EDGE = 16
/** Quiet period before re-encoding, so dragging a slider doesn't thrash the CPU. */
const EXPORT_DEBOUNCE_MS = 300

type Region = 'crop' | 'full'

interface Natural {
  height: number
  width: number
}

interface ExportResult {
  blob: Blob
  height: number
  /** Settings this blob was produced from; see `exportKey`. */
  key: string
  url: string
  width: number
}

/**
 * Crop + re-encode in one tool: the crop surface is the main stage, the region
 * can be widened to the whole image (what the old standalone converter did),
 * and the preview strip below re-exports on every change so the size/quality
 * trade-off is visible without a round trip.
 */
export function ImageStudioRoute() {
  const [src, setSrc] = useState<null | string>(null)
  const [fileName, setFileName] = useState('image')
  const [originalSize, setOriginalSize] = useState(0)
  const [natural, setNatural] = useState<Natural | null>(null)

  const [region, setRegion] = useState<Region>('crop')
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PercentCrop | null>(null)
  const [aspect, setAspect] = useState<number | undefined>(1)

  const [format, setFormat] = useState<OutputFormat>('image/jpeg')
  const [quality, setQuality] = useState(0.92)
  const [maxEdge, setMaxEdge] = useState<'' | number>('')

  /** 'fit' = scale-to-viewport (default). Number = absolute zoom vs. natural size. */
  const [displayZoom, setDisplayZoom] = useState<'fit' | number>('fit')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ExportResult | null>(null)
  const [failedKey, setFailedKey] = useState<null | string>(null)

  const imgRef = useRef<HTMLImageElement>(null)
  const srcRef = useRef<null | string>(null)
  const resultUrlRef = useRef<null | string>(null)

  // Object URLs outlive React state, so release them on unmount.
  useEffect(() => {
    return () => {
      if (srcRef.current) URL.revokeObjectURL(srcRef.current)
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    }
  }, [])

  function replaceSrc(next: null | string) {
    if (srcRef.current) URL.revokeObjectURL(srcRef.current)
    srcRef.current = next
    setSrc(next)
  }

  function clearResult() {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
    resultUrlRef.current = null
    setResult(null)
    setFailedKey(null)
  }

  function handleFile(file: File) {
    replaceSrc(URL.createObjectURL(file))
    clearResult()
    setOriginalSize(file.size)
    setFileName(file.name.replace(/\.[^.]+$/, '') || 'image')
    setNatural(null)
    setCrop(undefined)
    setCompletedCrop(null)
    setDisplayZoom('fit')
  }

  function onImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalHeight, naturalWidth } = event.currentTarget
    const size = { height: naturalHeight, width: naturalWidth }
    setNatural(size)
    // Start from a 90%-of-image centred selection at the current aspect.
    const initial = centeredCrop(aspect, size)
    setCrop(initial)
    setCompletedCrop(initial)
  }

  function setAspectAndRecenter(next: number | undefined) {
    setAspect(next)
    if (!natural) return
    const recentred = centeredCrop(next, natural)
    setCrop(recentred)
    setCompletedCrop(recentred)
  }

  function zoomOut() {
    setDisplayZoom((z) => (z === 'fit' ? 0.75 : Math.max(0.25, +(z - 0.25).toFixed(2))))
  }

  function zoomIn() {
    setDisplayZoom((z) => (z === 'fit' ? 1.25 : Math.min(4, +(z + 0.25).toFixed(2))))
  }

  /** Bakes a rotation/flip into the working image so the crop UI stays upright. */
  async function applyTransform(options: Parameters<typeof transformImage>[0]) {
    if (!src) return
    setBusy(true)
    try {
      const blob = await transformImage(options)
      replaceSrc(URL.createObjectURL(blob))
      clearResult()
      setNatural(null)
      setCrop(undefined)
      setCompletedCrop(null)
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Transform failed.')
    } finally {
      setBusy(false)
    }
  }

  const maxEdgeValue =
    typeof maxEdge === 'number' && maxEdge >= MIN_MAX_EDGE ? maxEdge : undefined

  /** Source region in natural pixels — the whole image, or the crop selection. */
  const sourceRegion = useMemo<PixelArea | null>(() => {
    if (!natural) return null
    if (region === 'full') {
      return { height: natural.height, width: natural.width, x: 0, y: 0 }
    }
    if (!completedCrop || completedCrop.width <= 0 || completedCrop.height <= 0) {
      return null
    }
    // Percentages rather than displayed pixels, so the selection survives a
    // change of display zoom.
    return {
      height: (completedCrop.height / 100) * natural.height,
      width: (completedCrop.width / 100) * natural.width,
      x: (completedCrop.x / 100) * natural.width,
      y: (completedCrop.y / 100) * natural.height,
    }
  }, [completedCrop, natural, region])

  const outputSize = sourceRegion ? computeOutputSize(sourceRegion, maxEdgeValue) : null

  /**
   * Identity of the pending export. Stamped onto the result so "is the preview
   * stale?" is derived rather than tracked with a separate loading flag.
   */
  const exportKey =
    src && sourceRegion
      ? [
          src,
          format,
          quality,
          maxEdgeValue ?? 0,
          Math.round(sourceRegion.x),
          Math.round(sourceRegion.y),
          Math.round(sourceRegion.width),
          Math.round(sourceRegion.height),
        ].join('|')
      : null
  const exporting =
    exportKey !== null && result?.key !== exportKey && failedKey !== exportKey

  // Re-export whenever the region or the encoding settings change.
  useEffect(() => {
    if (!src || !sourceRegion || !exportKey) return
    if (result?.key === exportKey || failedKey === exportKey) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const blob = await exportImage({
            format,
            imageSrc: src,
            maxEdge: maxEdgeValue,
            pixelCrop: sourceRegion,
            quality,
          })
          if (cancelled) return
          const size = computeOutputSize(sourceRegion, maxEdgeValue)
          if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current)
          const url = URL.createObjectURL(blob)
          resultUrlRef.current = url
          setResult({
            blob,
            height: size.height,
            key: exportKey,
            url,
            width: size.width,
          })
        } catch (err) {
          if (cancelled) return
          console.error(err)
          // Remember the failure so the preview doesn't sit on "encoding…".
          setFailedKey(exportKey)
          toast.error(err instanceof Error ? err.message : 'Export failed.')
        }
      })()
    }, EXPORT_DEBOUNCE_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    exportKey,
    failedKey,
    format,
    maxEdgeValue,
    quality,
    result?.key,
    sourceRegion,
    src,
  ])

  function download() {
    if (!result) return
    const a = document.createElement('a')
    a.href = result.url
    a.download = `${fileName}${region === 'crop' ? '-cropped' : ''}.${extensionFor(format)}`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  if (!src) {
    return (
      <ToolShell
        title="Image Studio"
        hint="Crop or take the whole frame, rotate, resize and re-encode — all locally."
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
  // react-image-crop's inner wrapper uses `max-height: inherit`, so in crop mode
  // the cap has to sit on the ReactCrop wrapper rather than the img.
  const cropWrapperStyle = isFit ? { maxHeight: '52vh' } : undefined
  const imgStyle =
    !isFit && natural
      ? {
          height: natural.height * displayZoom,
          maxHeight: 'none',
          maxWidth: 'none',
          width: natural.width * displayZoom,
        }
      : undefined

  const image = (
    <img
      ref={imgRef}
      src={src}
      alt=""
      onLoad={onImageLoad}
      style={imgStyle}
      className={cn(
        'block select-none',
        isFit && region === 'full' && 'max-h-[52vh] max-w-full',
      )}
    />
  )

  const sizeDeltaPct =
    result && originalSize > 0
      ? ((result.blob.size - originalSize) / originalSize) * 100
      : null

  const previews: GalleryItem[] = [
    {
      meta: natural ? `${natural.width} × ${natural.height}` : undefined,
      src,
      title: 'Source',
    },
    {
      meta: exporting
        ? 'encoding…'
        : result
          ? `${result.width} × ${result.height} · ${formatBytes(result.blob.size)}${
              sizeDeltaPct === null
                ? ''
                : ` (${sizeDeltaPct > 0 ? '+' : ''}${sizeDeltaPct.toFixed(1)}% vs original)`
            }`
          : sourceRegion
            ? 'export failed'
            : 'select a region to preview',
      src: result?.url ?? null,
      title: 'Result',
    },
  ]

  return (
    <ToolShell title="Image Studio">
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="flex max-h-[56vh] items-center justify-center overflow-auto rounded-lg border bg-muted p-2">
          {region === 'crop' ? (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(_, percentCrop) => setCompletedCrop(percentCrop)}
              aspect={aspect}
              ruleOfThirds
              keepSelection
              disabled={busy}
              style={cropWrapperStyle}
            >
              {image}
            </ReactCrop>
          ) : (
            image
          )}
        </div>

        <div className="flex flex-col gap-4">
          <FieldGroup label="Region">
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={region === 'crop' ? 'default' : 'outline'}
                onClick={() => setRegion('crop')}
              >
                Crop selection
              </Button>
              <Button
                size="sm"
                variant={region === 'full' ? 'default' : 'outline'}
                onClick={() => setRegion('full')}
                title="Export the whole image — no cropping"
              >
                Entire image
              </Button>
            </div>
          </FieldGroup>

          {region === 'crop' ? (
            <FieldGroup label="Aspect">
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
            </FieldGroup>
          ) : null}

          <FieldGroup label="Rotate / Flip">
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => applyTransform({ imageSrc: src, rotation: 90 })}
                disabled={busy}
                title="Rotate 90° clockwise"
              >
                <RotateCw /> 90°
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  applyTransform({
                    flip: { horizontal: true, vertical: false },
                    imageSrc: src,
                  })
                }
                disabled={busy}
                title="Flip horizontally"
              >
                <FlipHorizontal /> H
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  applyTransform({
                    flip: { horizontal: false, vertical: true },
                    imageSrc: src,
                  })
                }
                disabled={busy}
                title="Flip vertically"
              >
                <FlipHorizontal className="rotate-90" /> V
              </Button>
            </div>
          </FieldGroup>

          <FieldGroup
            label={`View · ${isFit ? 'Fit' : `${Math.round(displayZoom * 100)}%`}`}
          >
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
          </FieldGroup>

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
              min={MIN_MAX_EDGE}
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

          <p className="text-xs text-muted-foreground">
            {outputSize ? (
              <>
                Output:{' '}
                <span className="font-mono">
                  {outputSize.width} × {outputSize.height} px
                </span>
                {exporting ? ' · encoding…' : null}
              </>
            ) : (
              'Drag a selection to enable export.'
            )}
          </p>

          <div className="mt-auto flex flex-col gap-2">
            <Button onClick={download} disabled={!result || busy}>
              <Download /> Download {result ? formatBytes(result.blob.size) : ''}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                replaceSrc(null)
                clearResult()
                setNatural(null)
                setCompletedCrop(null)
              }}
            >
              Load another image
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="mb-2 text-sm font-medium">Preview</h2>
        <ImagePreviewStrip items={previews} />
        <p className="mt-2 text-xs text-muted-foreground">
          Click a preview to open the zoomable gallery — drag to pan, pinch or
          ctrl/⌘-scroll to zoom.
        </p>
      </div>
    </ToolShell>
  )
}

function centeredCrop(aspect: number | undefined, size: Natural): PercentCrop {
  return centerCrop(
    makeAspectCrop(
      { unit: '%', width: 90 },
      aspect ?? size.width / size.height,
      size.width,
      size.height,
    ),
    size.width,
    size.height,
  )
}

/** For a single form control — the `<label>` names it. */
function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

/**
 * For a row of buttons. Deliberately not a `<label>`: wrapping several buttons
 * in one would make the group's text the accessible name of every button in it
 * ("Region Crop selection Entire image"), so each button's own name is lost.
 */
function FieldGroup({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
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
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  )
}
