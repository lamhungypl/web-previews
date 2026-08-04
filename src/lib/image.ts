// Canvas-based image transforms. Cropping logic adapted from
// kot-asean-fe/src/utils/image.ts (which was itself adapted from the
// react-image-crop README example), extended to support arbitrary
// output formats, resizing and a quality knob — one util covers both the
// crop and the re-encode halves of the Image Studio tool.

export type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp'

export interface PixelArea {
  height: number
  width: number
  x: number
  y: number
}

export interface Flip {
  horizontal: boolean
  vertical: boolean
}

export function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', reject)
    image.src = url
  })
}

export function radians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** Bounding box of a rectangle after rotation. */
export function rotatedSize(width: number, height: number, rotation: number) {
  const r = radians(rotation)
  return {
    height: Math.abs(Math.sin(r) * width) + Math.abs(Math.cos(r) * height),
    width: Math.abs(Math.cos(r) * width) + Math.abs(Math.sin(r) * height),
  }
}

/**
 * Output pixel size for a source region once `maxEdge` is applied. Exported so
 * the UI can show the export dimensions without actually encoding.
 */
export function computeOutputSize(
  source: { height: number; width: number },
  maxEdge?: number,
): { height: number; width: number } {
  const width = Math.max(1, Math.round(source.width))
  const height = Math.max(1, Math.round(source.height))
  const longest = Math.max(width, height)
  if (!maxEdge || longest <= maxEdge) return { height, width }
  const scale = maxEdge / longest
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  }
}

interface ExportOptions {
  flip?: Flip
  format?: OutputFormat
  imageSrc: string
  /** Cap on the longest output edge; preserves aspect ratio. */
  maxEdge?: number
  /** Region of the source in natural pixels. Omit to export the whole image. */
  pixelCrop?: PixelArea
  /** 0..1 for lossy formats; ignored for PNG. */
  quality?: number
  rotation?: number
}

/**
 * Crop (optionally), rotate/flip, resize and re-encode in one pass, returning a
 * Blob in the requested format.
 */
export async function exportImage({
  flip = { horizontal: false, vertical: false },
  format = 'image/jpeg',
  imageSrc,
  maxEdge,
  pixelCrop,
  quality = 0.92,
  rotation = 0,
}: ExportOptions): Promise<Blob> {
  const image = await createImage(imageSrc)

  // Rotation/flip has to be baked into an intermediate canvas before a region
  // can be addressed in the rotated coordinate space.
  let source: CanvasImageSource = image
  let sourceWidth = image.naturalWidth
  let sourceHeight = image.naturalHeight
  if (rotation !== 0 || flip.horizontal || flip.vertical) {
    const box = rotatedSize(sourceWidth, sourceHeight, rotation)
    const stage = document.createElement('canvas')
    stage.width = Math.max(1, Math.round(box.width))
    stage.height = Math.max(1, Math.round(box.height))
    const stageCtx = stage.getContext('2d')
    if (!stageCtx) throw new Error('Could not create 2D canvas context.')
    stageCtx.translate(stage.width / 2, stage.height / 2)
    stageCtx.rotate(radians(rotation))
    stageCtx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1)
    stageCtx.translate(-sourceWidth / 2, -sourceHeight / 2)
    stageCtx.drawImage(image, 0, 0)
    source = stage
    sourceWidth = stage.width
    sourceHeight = stage.height
  }

  const region: PixelArea = pixelCrop
    ? {
        height: Math.max(1, Math.round(pixelCrop.height)),
        width: Math.max(1, Math.round(pixelCrop.width)),
        x: Math.round(pixelCrop.x),
        y: Math.round(pixelCrop.y),
      }
    : { height: sourceHeight, width: sourceWidth, x: 0, y: 0 }

  const out = computeOutputSize(region, maxEdge)
  const canvas = document.createElement('canvas')
  canvas.width = out.width
  canvas.height = out.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create 2D canvas context.')
  ctx.imageSmoothingQuality = 'high'
  // JPEG has no alpha channel, so transparency would otherwise come out black.
  if (format === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, out.width, out.height)
  }
  ctx.drawImage(
    source,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    out.width,
    out.height,
  )

  return await canvasToBlob(canvas, format, quality)
}

interface TransformOptions {
  flip?: Flip
  /** Re-encode as PNG by default so repeated transforms don't lose quality. */
  format?: OutputFormat
  imageSrc: string
  quality?: number
  /** Degrees clockwise; 90 / 180 / 270 supported (and 0 = identity). */
  rotation?: number
}

/**
 * Re-encode an image with rotation and/or flip applied.
 * Used by the cropper's "Rotate 90°" / "Flip" buttons so the crop UI
 * always sees an upright source.
 */
export async function transformImage({
  flip = { horizontal: false, vertical: false },
  format = 'image/png',
  imageSrc,
  quality = 1,
  rotation = 0,
}: TransformOptions): Promise<Blob> {
  const image = await createImage(imageSrc)
  const { width: outW, height: outH } = rotatedSize(image.width, image.height, rotation)
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create 2D canvas context.')

  ctx.translate(outW / 2, outH / 2)
  ctx.rotate(radians(rotation))
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1)
  ctx.translate(-image.width / 2, -image.height / 2)
  ctx.drawImage(image, 0, 0)

  return await canvasToBlob(canvas, format, quality)
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error(`Failed to encode image as ${format}.`))
      },
      format,
      quality,
    )
  })
}

export function extensionFor(format: OutputFormat): string {
  switch (format) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}
