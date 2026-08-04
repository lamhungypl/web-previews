import { useEffect, useRef } from 'react'

import type { MarkdownHeading } from '@/lib/markdown'
import { cn } from '@/lib/utils'

interface DocOutlineProps {
  activeId: null | string
  headings: MarkdownHeading[]
  onSelect: (id: string) => void
}

/**
 * Table of contents pinned to the right of the document.
 *
 * Right rather than left on purpose: the reading flow stays top-down,
 * left-to-right, and the outline sits out of the way of it.
 */
export function DocOutline({ activeId, headings, onSelect }: DocOutlineProps) {
  const items = useRef(new Map<string, HTMLButtonElement>())

  // Follow along as the document scrolls, so the active entry stays visible in
  // a long outline.
  useEffect(() => {
    if (!activeId) return
    items.current.get(activeId)?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  if (headings.length === 0) {
    return (
      <p className="px-3 py-4 text-xs text-muted-foreground">
        No headings in this document.
      </p>
    )
  }

  // Indent relative to the shallowest heading — a document whose top level is
  // `##` shouldn't start out indented.
  const minDepth = Math.min(...headings.map((h) => h.depth))

  return (
    <nav aria-label="On this page" className="flex flex-col py-3 pr-2 pl-1">
      <div className="px-3 pb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        On this page
      </div>
      <div className="flex flex-col border-l">
        {headings.map((heading) => {
          const active = heading.id === activeId
          return (
            <button
              key={heading.id}
              ref={(el) => {
                if (el) items.current.set(heading.id, el)
                else items.current.delete(heading.id)
              }}
              type="button"
              onClick={() => onSelect(heading.id)}
              title={heading.text}
              style={{ paddingLeft: 12 + Math.min(heading.depth - minDepth, 3) * 12 }}
              className={cn(
                '-ml-px truncate border-l-2 border-transparent py-1 pr-2 text-left text-xs',
                'text-muted-foreground transition-colors hover:text-foreground',
                active && 'border-primary font-medium text-foreground',
              )}
            >
              {heading.text}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
