import { useEffect, useState } from 'react'

import type { ViewportSize } from '@/lib/imageViewport'

/**
 * Live content-box size of `ref`'s element — `{0, 0}` until first measured.
 * The returned object is referentially stable while the size is unchanged, so
 * it is safe to use as an effect dependency.
 */
export function useElementSize(ref: React.RefObject<HTMLElement | null>): ViewportSize {
  const [size, setSize] = useState<ViewportSize>({ height: 0, width: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      setSize((prev) =>
        prev.width === rect.width && prev.height === rect.height
          ? prev
          : { height: rect.height, width: rect.width },
      )
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return size
}
