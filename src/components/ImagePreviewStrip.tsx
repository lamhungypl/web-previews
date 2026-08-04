import { Expand } from 'lucide-react'
import { useState } from 'react'

import { type GalleryItem, ImageGalleryOverlay } from '@/components/ImageGalleryOverlay'

interface ImagePreviewStripProps {
  /** Tiles with a null `src` render as disabled placeholders. */
  items: GalleryItem[]
}

/**
 * Row of preview thumbnails; clicking one opens the pan/pinch-zoom gallery at
 * that image, with the other previews reachable via prev/next.
 */
export function ImagePreviewStrip({ items }: ImagePreviewStripProps) {
  const openable = items.filter((item): item is { src: string } & GalleryItem =>
    Boolean(item.src),
  )
  const [requestedIndex, setRequestedIndex] = useState<number | null>(null)

  // A preview can disappear (e.g. the result is cleared) while the gallery is
  // open, so clamp on render rather than letting the index dangle.
  const openIndex =
    requestedIndex !== null && requestedIndex < openable.length ? requestedIndex : null

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const galleryIndex = item.src
            ? openable.findIndex((candidate) => candidate.src === item.src)
            : -1
          return (
            <div key={item.title} className="flex min-w-0 flex-col gap-1">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="text-xs font-medium">{item.title}</span>
                {item.meta ? (
                  <span className="truncate text-xs text-muted-foreground">
                    {item.meta}
                  </span>
                ) : null}
              </div>
              {item.src ? (
                <button
                  type="button"
                  onClick={() => setRequestedIndex(galleryIndex)}
                  title="Open in zoomable gallery"
                  className="group relative flex h-44 items-center justify-center overflow-hidden rounded-md border bg-muted transition-colors hover:border-primary focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <img
                    src={item.src}
                    alt={item.title}
                    className="max-h-full max-w-full object-contain"
                  />
                  <span className="absolute top-1.5 right-1.5 rounded bg-black/55 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Expand className="size-3.5" />
                  </span>
                </button>
              ) : (
                <div className="flex h-44 items-center justify-center rounded-md border border-dashed bg-muted/40 text-sm text-muted-foreground">
                  —
                </div>
              )}
            </div>
          )
        })}
      </div>

      {openIndex !== null ? (
        <ImageGalleryOverlay
          items={openable}
          index={openIndex}
          onIndexChange={setRequestedIndex}
          onClose={() => setRequestedIndex(null)}
        />
      ) : null}
    </>
  )
}
