import { ChevronLeft, ChevronRight, Maximize2, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useViewport } from '@/hooks/useViewport'
import type { ViewportSize } from '@/lib/imageViewport'
import { cn } from '@/lib/utils'

export interface GalleryItem {
  /** Extra detail shown under the label, e.g. dimensions and file size. */
  meta?: string
  /** Null renders a placeholder tile that can't be opened. */
  src: null | string
  title: string
}

interface ImageGalleryOverlayProps {
  index: number
  items: GalleryItem[]
  onClose: () => void
  onIndexChange: (index: number) => void
}

/** Zoom level past which nearest-neighbour sampling is more useful than blur. */
const PIXELATE_AT_SCALE = 3

export function ImageGalleryOverlay({
  index,
  items,
  onClose,
  onIndexChange,
}: ImageGalleryOverlayProps) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const item = items[index]
  const src = item?.src ?? null

  // Keyed by src and derived during render, so `natural` can never lag a render
  // behind `src` — otherwise switching image would briefly fit the new one to
  // the old one's dimensions. Doubles as a cache: coming back to an
  // already-measured image fits on the first frame instead of flashing.
  const [sizes, setSizes] = useState<Record<string, ViewportSize>>({})
  const natural = src ? (sizes[src] ?? null) : null

  const viewport = useViewport({
    containerRef: surfaceRef,
    natural,
    resetKey: src ?? '',
  })

  const step = useCallback(
    (delta: number) => {
      if (items.length < 2) return
      onIndexChange((index + delta + items.length) % items.length)
    },
    [index, items.length, onIndexChange],
  )

  // Focus the surface so the keyboard shortcuts work without a click first.
  useEffect(() => {
    surfaceRef.current?.focus()
  }, [])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      step(-1)
      return
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      step(1)
      return
    }
    viewport.onKeyDown(event)
  }

  if (!item || !src) return null

  const { transform } = viewport

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label={`Image viewer — ${item.title}`}
    >
      <div className="flex items-center gap-3 border-b border-white/10 px-3 py-2 text-white">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{item.title}</div>
          {item.meta ? (
            <div className="truncate text-xs text-white/60">{item.meta}</div>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <DarkButton
            onClick={viewport.fitToView}
            title="Fit to view (0)"
            aria-pressed={viewport.isFit}
            className={cn(viewport.isFit && 'bg-white/15')}
          >
            <Maximize2 />
          </DarkButton>
          <DarkButton
            onClick={viewport.zoomOut}
            disabled={!viewport.canZoomOut}
            title="Zoom out (−)"
          >
            <ZoomOut />
          </DarkButton>
          <span className="w-12 text-center font-mono text-xs tabular-nums">
            {Math.round(transform.scale * 100)}%
          </span>
          <DarkButton
            onClick={viewport.zoomIn}
            disabled={!viewport.canZoomIn}
            title="Zoom in (+)"
          >
            <ZoomIn />
          </DarkButton>
          <span className="mx-1 h-5 w-px bg-white/20" />
          <DarkButton onClick={onClose} title="Close (Esc)">
            <X />
          </DarkButton>
        </div>
      </div>

      <div
        ref={surfaceRef}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        {...viewport.panHandlers}
        className={cn(
          'relative min-h-0 flex-1 touch-none overflow-hidden outline-none',
          viewport.isPanning ? 'cursor-grabbing' : 'cursor-grab',
        )}
      >
        <img
          key={src}
          src={src}
          alt={item.title}
          draggable={false}
          onLoad={(event) => {
            const { naturalHeight, naturalWidth } = event.currentTarget
            setSizes((prev) =>
              prev[src]
                ? prev
                : { ...prev, [src]: { height: naturalHeight, width: naturalWidth } },
            )
          }}
          className="absolute top-0 left-0 max-w-none origin-top-left will-change-transform select-none"
          style={{
            imageRendering: transform.scale >= PIXELATE_AT_SCALE ? 'pixelated' : 'auto',
            opacity: viewport.ready ? 1 : 0,
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
          }}
        />
      </div>

      <div className="flex items-center gap-3 border-t border-white/10 px-3 py-2 text-white">
        {items.length > 1 ? (
          <div className="flex items-center gap-1">
            <DarkButton onClick={() => step(-1)} title="Previous (←)">
              <ChevronLeft />
            </DarkButton>
            <span className="min-w-14 text-center font-mono text-xs tabular-nums">
              {index + 1} / {items.length}
            </span>
            <DarkButton onClick={() => step(1)} title="Next (→)">
              <ChevronRight />
            </DarkButton>
          </div>
        ) : null}
        <p className="ml-auto hidden text-xs text-white/50 sm:block">
          Drag to pan · pinch or ctrl/⌘-scroll to zoom · +/−/0 · Esc to close
        </p>
      </div>
    </div>
  )
}

function DarkButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        'text-white hover:bg-white/15 hover:text-white disabled:opacity-30',
        className,
      )}
      {...props}
    />
  )
}
