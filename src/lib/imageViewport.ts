// Transform math for a Figma-style pan/zoom surface holding one image.
//
// Recovered from mathgpt_app's ShowWorkGallery — it lived at
// src/utils/imageViewport.ts until 57a1ab9c4b replaced that gallery's
// transform viewport with native scrolling — and trimmed to what this app
// needs (the detected-region auto-zoom helpers went with it).

export interface ViewportPoint {
  x: number
  y: number
}

export interface ViewportSize {
  height: number
  width: number
}

export interface ViewportTransform {
  scale: number
  x: number
  y: number
}

export const VIEWPORT_MAX_SCALE = 8
export const VIEWPORT_MIN_SCALE_FLOOR = 0.1

function hasArea(size: ViewportSize): boolean {
  return size.width > 0 && size.height > 0
}

/**
 * Scale at which `natural` fits inside `container`, leaving `padding` on every
 * edge. `maxScale` caps magnification so a 32px favicon isn't blown up to fill
 * the surface as blur.
 */
export function computeFitScale(
  container: ViewportSize,
  natural: ViewportSize,
  padding = 0,
  maxScale = Infinity,
): number {
  if (!hasArea(container) || !hasArea(natural)) return 1
  const availableWidth = Math.max(1, container.width - padding * 2)
  const availableHeight = Math.max(1, container.height - padding * 2)
  return Math.min(
    availableWidth / natural.width,
    availableHeight / natural.height,
    maxScale,
  )
}

/** Zoom range, widened so a huge image can always be zoomed out to fit. */
export function getScaleBounds(fitScale: number): { max: number; min: number } {
  return {
    max: Math.max(VIEWPORT_MAX_SCALE, fitScale),
    min: Math.min(fitScale, VIEWPORT_MIN_SCALE_FLOOR),
  }
}

function clampAxis(containerLength: number, scaledLength: number, value: number): number {
  if (scaledLength <= containerLength) return (containerLength - scaledLength) / 2
  return Math.min(0, Math.max(containerLength - scaledLength, value))
}

/** Centres content smaller than the viewport; otherwise keeps the edges gap-free. */
export function clampOffset(
  container: ViewportSize,
  natural: ViewportSize,
  scale: number,
  offset: ViewportPoint,
): ViewportPoint {
  return {
    x: clampAxis(container.width, natural.width * scale, offset.x),
    y: clampAxis(container.height, natural.height * scale, offset.y),
  }
}

export function computeFitTransform(
  container: ViewportSize,
  natural: ViewportSize,
  padding = 0,
  maxScale = Infinity,
): ViewportTransform {
  const scale = computeFitScale(container, natural, padding, maxScale)
  return { scale, ...clampOffset(container, natural, scale, { x: 0, y: 0 }) }
}

/**
 * Rescales while keeping whatever sits under `point` (viewport coordinates)
 * stationary, then clamps back into bounds.
 */
export function zoomAtPoint(
  current: ViewportTransform,
  nextScale: number,
  point: ViewportPoint,
  container: ViewportSize,
  natural: ViewportSize,
): ViewportTransform {
  const ratio = nextScale / current.scale
  const offset = clampOffset(container, natural, nextScale, {
    x: point.x - (point.x - current.x) * ratio,
    y: point.y - (point.y - current.y) * ratio,
  })
  return { scale: nextScale, ...offset }
}
