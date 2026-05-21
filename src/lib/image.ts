// Canvas-based image transforms. Cropping logic adapted from
// kot-asean-fe/src/utils/image.ts (which was itself adapted from the
// react-image-crop README example), extended to support arbitrary
// output formats and a quality knob — so the same util powers both the
// cropper and the converter tools.

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

interface CropOptions {
  flip?: Flip
  format?: OutputFormat
  imageSrc: string
  pixelCrop: PixelArea
  /** 0..1 for lossy formats; ignored for PNG. */
  quality?: number
  rotation?: number
}

/** Crop + (optionally) rotate/flip an image, returning a Blob in the requested format. */
export async function cropImage({
  flip = { horizontal: false, vertical: false },
  format = 'image/jpeg',
  imageSrc,
  pixelCrop,
  quality = 0.92,
  rotation = 0,
}: CropOptions): Promise<Blob> {
  const image = await createImage(imageSrc)
  const rotRad = radians(rotation)

  const { width: boxW, height: boxH } = rotatedSize(image.width, image.height, rotation)

  const stage = document.createElement('canvas')
  stage.width = boxW
  stage.height = boxH
  const stageCtx = stage.getContext('2d')
  if (!stageCtx) throw new Error('Could not create 2D canvas context.')

  stageCtx.translate(boxW / 2, boxH / 2)
  stageCtx.rotate(rotRad)
  stageCtx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1)
  stageCtx.translate(-image.width / 2, -image.height / 2)
  stageCtx.drawImage(image, 0, 0)

  const cropCanvas = document.createElement('canvas')
  cropCanvas.width = pixelCrop.width
  cropCanvas.height = pixelCrop.height
  const cropCtx = cropCanvas.getContext('2d')
  if (!cropCtx) throw new Error('Could not create 2D canvas context.')

  cropCtx.drawImage(
    stage,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  )

  return await canvasToBlob(cropCanvas, format, quality)
}

interface ConvertOptions {
  format: OutputFormat
  imageSrc: string
  /** Optional max edge resize; preserves aspect ratio. */
  maxEdge?: number
  quality?: number
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
 * Used by the cropper for "Rotate 90°" / "Flip" buttons so the crop UI
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

/** Re-encode an image into a different format / size. */
export async function convertImage({
  format,
  imageSrc,
  maxEdge,
  quality = 0.92,
}: ConvertOptions): Promise<Blob> {
  const image = await createImage(imageSrc)
  let { width, height } = image
  if (maxEdge && Math.max(width, height) > maxEdge) {
    const scale = maxEdge / Math.max(width, height)
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create 2D canvas context.')
  ctx.drawImage(image, 0, 0, width, height)
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
