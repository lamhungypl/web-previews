import { type RefObject, useEffect, useState } from 'react'

import type { MarkdownHeading } from '@/lib/markdown'

/**
 * The document inside a same-origin iframe, tracked across (re)loads.
 *
 * The Markdown preview renders to a blob URL, which inherits this origin, and
 * the iframe is sandboxed *without* `allow-scripts` — so the document can't run
 * anything, and reaching into it from the host is safe. That access is what
 * powers scroll-spy and in-document link handling without injecting any script.
 */
export function useIframeDocument(
  ref: RefObject<HTMLIFrameElement | null>,
  docKey: string,
): Document | null {
  const [doc, setDoc] = useState<Document | null>(null)

  useEffect(() => {
    const iframe = ref.current
    if (!iframe) return
    setDoc(null)

    function read(): Document | null {
      try {
        return iframe?.contentDocument ?? null
      } catch {
        return null // cross-origin — outline features degrade to nothing
      }
    }

    function sync() {
      const next = read()
      // about:blank shows up before the real document lands.
      if (next && next.readyState !== 'loading' && next.body?.childElementCount) {
        setDoc(next)
      }
    }

    iframe.addEventListener('load', sync)
    sync()
    return () => {
      iframe.removeEventListener('load', sync)
    }
  }, [ref, docKey])

  return doc
}

/** Offset from the top of the frame at which a heading counts as "current". */
const ACTIVE_OFFSET = 88

/** Which heading the reader is currently looking at, driven by iframe scroll. */
export function useHeadingSpy(
  doc: Document | null,
  headings: MarkdownHeading[],
): null | string {
  const [activeId, setActiveId] = useState<null | string>(null)

  useEffect(() => {
    if (!doc || headings.length === 0) return
    const win = doc.defaultView
    if (!win) return

    let frame = 0
    function compute() {
      frame = 0
      const scroller = doc!.scrollingElement
      // At the very bottom, the last heading is what's on screen even though
      // its top scrolled past the offset long ago. Only for a document that
      // actually scrolls — a short one sits at "the bottom" from the start.
      if (
        scroller &&
        scroller.scrollHeight > scroller.clientHeight &&
        scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4
      ) {
        setActiveId(headings[headings.length - 1].id)
        return
      }
      let current = headings[0].id
      for (const heading of headings) {
        const el = doc!.getElementById(heading.id)
        if (!el) continue
        if (el.getBoundingClientRect().top > ACTIVE_OFFSET) break
        current = heading.id
      }
      setActiveId(current)
    }

    function schedule() {
      if (frame === 0) frame = win!.requestAnimationFrame(compute)
    }

    // Scheduled rather than called outright: the first measurement must not run
    // synchronously inside the effect, or it cascades an extra render.
    schedule()
    win.addEventListener('scroll', schedule, { passive: true })
    win.addEventListener('resize', schedule)
    return () => {
      if (frame !== 0) win.cancelAnimationFrame(frame)
      win.removeEventListener('scroll', schedule)
      win.removeEventListener('resize', schedule)
    }
  }, [doc, headings])

  // Ignore an id left over from the previous document instead of clearing it in
  // an effect — one frame later the scheduled measurement supplies the real one.
  return headings.some((h) => h.id === activeId) ? activeId : null
}
