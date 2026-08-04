import { useCallback, useEffect, useRef, useState } from 'react'

import { useElementSize } from '@/hooks/useElementSize'
import {
  clampOffset,
  computeFitScale,
  computeFitTransform,
  getScaleBounds,
  type ViewportPoint,
  type ViewportSize,
  type ViewportTransform,
  zoomAtPoint,
} from '@/lib/imageViewport'

const BUTTON_ZOOM_FACTOR = 1.25
const WHEEL_ZOOM_SENSITIVITY = 0.01
/** Firefox reports wheel deltas in lines; roughly one text line each. */
const WHEEL_LINE_PX = 16
const SCALE_EPSILON = 0.001
/** Fit never magnifies past 1:1, so a tiny image doesn't fill the surface as blur. */
const FIT_MAX_SCALE = 1

export const SURFACE_PADDING = 16

const IDENTITY: ViewportTransform = { scale: 1, x: 0, y: 0 }

export interface UseViewport {
  canZoomIn: boolean
  canZoomOut: boolean
  fitToView: () => void
  /** True while the view matches fit-to-view — for highlighting the Fit button. */
  isFit: boolean
  isPanning: boolean
  /** Handles `+` / `-` / `0`; unrecognised keys are left alone for the caller. */
  onKeyDown: (event: React.KeyboardEvent) => void
  panHandlers: SurfacePanHandlers
  /** False until the surface is measured and the content's size is known. */
  ready: boolean
  transform: ViewportTransform
  zoomIn: () => void
  zoomOut: () => void
}

export interface SurfacePanHandlers {
  onPointerCancel: (event: React.PointerEvent) => void
  onPointerDown: (event: React.PointerEvent) => void
  onPointerMove: (event: React.PointerEvent) => void
  onPointerUp: (event: React.PointerEvent) => void
}

export interface UseViewportOptions {
  containerRef: React.RefObject<HTMLElement | null>
  /** Intrinsic pixel size of the content, or null while it is still loading. */
  natural: ViewportSize | null
  /**
   * Identity of the content — pass the current image's src. Switching to a
   * different key shows that content fitted; switching back to the key that was
   * last zoomed/panned restores it, which is what you want when flipping
   * between two images to compare the same detail.
   */
  resetKey: string
}

/**
 * Figma-like viewport for a single image inside a fixed surface: fit on load,
 * drag (or two-finger drag) to pan, pinch or ctrl/cmd+wheel to zoom at the
 * cursor, plain wheel to pan. All geometry lives in `@/lib/imageViewport`; this
 * hook only wires DOM events to it.
 *
 * The transform is *derived*, not stored: gestures are kept as an override
 * tagged with the `resetKey` they belong to, and fit is recomputed from the
 * current surface and content size on every render. That means a new image or a
 * resized surface is handled without an effect round-trip, so there is never a
 * painted frame showing content at a scale computed for different dimensions.
 *
 * The surface element must set `touch-action: none`, otherwise the browser
 * claims touch gestures before the pointer handlers see them.
 */
export function useViewport({
  containerRef,
  natural,
  resetKey,
}: UseViewportOptions): UseViewport {
  const containerSize = useElementSize(containerRef)
  const [override, setOverride] = useState<{
    key: string
    transform: ViewportTransform
  } | null>(null)
  const [isPanning, setIsPanning] = useState(false)

  const ready = natural !== null && containerSize.width > 0 && containerSize.height > 0
  const fitScale = ready
    ? computeFitScale(containerSize, natural, SURFACE_PADDING, FIT_MAX_SCALE)
    : 1
  const bounds = getScaleBounds(fitScale)

  let transform = IDENTITY
  if (ready && natural) {
    if (override?.key === resetKey) {
      // Re-clamp on every render so shrinking the surface can't strand the
      // content outside it, and so a stored scale stays within current bounds.
      const scale = Math.min(bounds.max, Math.max(bounds.min, override.transform.scale))
      transform = {
        scale,
        ...clampOffset(containerSize, natural, scale, override.transform),
      }
    } else {
      transform = computeFitTransform(
        containerSize,
        natural,
        SURFACE_PADDING,
        FIT_MAX_SCALE,
      )
    }
  }

  // Event handlers read geometry through a ref so they never need re-creating
  // (one is attached as a non-passive native listener).
  const latest = useRef({ bounds, containerSize, natural, resetKey, transform })
  useEffect(() => {
    latest.current = { bounds, containerSize, natural, resetKey, transform }
  })

  const pointersRef = useRef(new Map<number, ViewportPoint>())
  const panRef = useRef<{ last: ViewportPoint; pointerId: number } | null>(null)
  const pinchRef = useRef<{ distance: number; midpoint: ViewportPoint } | null>(null)

  /**
   * Applies `next` to whatever transform is currently in effect. Uses a
   * functional update so several calls batched into one render (pinch zooms
   * *and* pans) compose instead of overwriting each other.
   */
  const applyTransform = useCallback(
    (next: (previous: ViewportTransform) => ViewportTransform) => {
      setOverride((previous) => {
        const { resetKey: key, transform: derived } = latest.current
        const base = previous?.key === key ? previous.transform : derived
        return { key, transform: next(base) }
      })
    },
    [],
  )

  const zoomBy = useCallback(
    (factor: number, point?: ViewportPoint) => {
      const { bounds: limits, containerSize: size, natural: content } = latest.current
      if (!content || size.width <= 0 || size.height <= 0) return
      const anchor = point ?? { x: size.width / 2, y: size.height / 2 }
      applyTransform((previous) => {
        const scale = Math.min(limits.max, Math.max(limits.min, previous.scale * factor))
        return zoomAtPoint(previous, scale, anchor, size, content)
      })
    },
    [applyTransform],
  )

  const panBy = useCallback(
    (deltaX: number, deltaY: number) => {
      const { containerSize: size, natural: content } = latest.current
      if (!content) return
      applyTransform((previous) => ({
        ...previous,
        ...clampOffset(size, content, previous.scale, {
          x: previous.x + deltaX,
          y: previous.y + deltaY,
        }),
      }))
    },
    [applyTransform],
  )

  const zoomIn = useCallback(() => zoomBy(BUTTON_ZOOM_FACTOR), [zoomBy])
  const zoomOut = useCallback(() => zoomBy(1 / BUTTON_ZOOM_FACTOR), [zoomBy])
  /** Dropping the override falls back to the derived fit transform. */
  const fitToView = useCallback(() => setOverride(null), [])

  // React's synthetic wheel handler is passive, so preventDefault needs a
  // manually attached listener.
  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      if (!latest.current.natural) return
      event.preventDefault()
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? WHEEL_LINE_PX : 1
      // Trackpad pinch arrives as a ctrl-modified wheel event.
      if (event.ctrlKey || event.metaKey) {
        const rect = element.getBoundingClientRect()
        const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
        zoomBy(Math.exp(-event.deltaY * unit * WHEEL_ZOOM_SENSITIVITY), point)
        return
      }
      panBy(-event.deltaX * unit, -event.deltaY * unit)
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [containerRef, panBy, zoomBy])

  const localPoint = useCallback(
    (client: ViewportPoint): ViewportPoint => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return client
      return { x: client.x - rect.left, y: client.y - rect.top }
    },
    [containerRef],
  )

  /** Distance + midpoint of the first two live pointers, in client coordinates. */
  function readPinch() {
    const [a, b] = [...pointersRef.current.values()]
    if (!a || !b) return null
    return {
      distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    }
  }

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    // Register first: capture is an optimisation (it keeps a drag alive outside
    // the surface) and throws if the pointer is already gone, which must not
    // abandon the gesture half-tracked.
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer released before we got here — the gesture still works, it just
      // ends if the cursor leaves the surface.
    }

    if (pointersRef.current.size >= 2) {
      // Second finger down: hand over from panning to pinching.
      panRef.current = null
      pinchRef.current = readPinch()
      setIsPanning(false)
      return
    }
    panRef.current = {
      last: { x: event.clientX, y: event.clientY },
      pointerId: event.pointerId,
    }
    setIsPanning(true)
  }, [])

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const pointers = pointersRef.current
      if (!pointers.has(event.pointerId)) return
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

      const previous = pinchRef.current
      if (pointers.size >= 2 && previous) {
        const next = readPinch()
        if (!next) return
        pinchRef.current = next
        zoomBy(next.distance / previous.distance, localPoint(previous.midpoint))
        // A two-finger drag pans as well as zooms.
        panBy(
          next.midpoint.x - previous.midpoint.x,
          next.midpoint.y - previous.midpoint.y,
        )
        return
      }

      const pan = panRef.current
      if (!pan || pan.pointerId !== event.pointerId) return
      panBy(event.clientX - pan.last.x, event.clientY - pan.last.y)
      pan.last = { x: event.clientX, y: event.clientY }
    },
    [localPoint, panBy, zoomBy],
  )

  const endPointer = useCallback((event: React.PointerEvent) => {
    const pointers = pointersRef.current
    if (!pointers.delete(event.pointerId)) return
    if (pointers.size < 2) pinchRef.current = null
    const [remainingId] = [...pointers.keys()]
    const remaining = remainingId === undefined ? null : pointers.get(remainingId)
    if (remainingId !== undefined && remaining) {
      // Lifting one finger of a pinch resumes a plain pan with the other.
      panRef.current = { last: remaining, pointerId: remainingId }
      setIsPanning(true)
      return
    }
    panRef.current = null
    setIsPanning(false)
  }, [])

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const actions: Record<string, () => void> = {
        '+': zoomIn,
        '-': zoomOut,
        0: fitToView,
        '=': zoomIn,
        _: zoomOut,
      }
      const action = actions[event.key]
      if (!action) return
      event.preventDefault()
      action()
    },
    [fitToView, zoomIn, zoomOut],
  )

  return {
    canZoomIn: ready && transform.scale < bounds.max - SCALE_EPSILON,
    canZoomOut: ready && transform.scale > bounds.min + SCALE_EPSILON,
    fitToView,
    isFit: ready && Math.abs(transform.scale - fitScale) < SCALE_EPSILON,
    isPanning,
    onKeyDown,
    panHandlers: {
      onPointerCancel: endPointer,
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
    },
    ready,
    transform,
    zoomIn,
    zoomOut,
  }
}
