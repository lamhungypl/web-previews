import { History, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatRelativeTime } from '@/lib/time'
import { cn } from '@/lib/utils'

export interface RecentItem {
  id: string
  name: string
  openedAt: number
  /** Second line — relative path, folder name, whatever locates it. */
  subtitle: string
  /** Full path; the tooltip, and what marks the entry as the active one. */
  title: string
}

interface RecentFilesPanelProps {
  activeTitle?: null | string
  emptyHint?: string
  items: RecentItem[]
  label?: string
  onClear: () => void
  onOpen: (item: RecentItem) => void
  onRemove: (id: string) => void
}

/**
 * Files previewed from this machine, most recent first — and it survives
 * reloads, because each entry keeps the handle it was opened with. Pasted
 * source is deliberately absent: there'd be nothing to re-open.
 */
export function RecentFilesPanel({
  activeTitle = null,
  emptyHint = 'Files you open from this machine show up here.',
  items,
  label = 'Recent files',
  onClear,
  onOpen,
  onRemove,
}: RecentFilesPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <History className="size-3.5 text-muted-foreground" />
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        {items.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 px-2 text-xs text-muted-foreground"
            onClick={onClear}
          >
            Clear
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="p-3 text-xs text-muted-foreground">{emptyHint}</p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {items.map((item) => (
            <li key={item.id} className="group/item relative">
              <button
                type="button"
                onClick={() => onOpen(item)}
                title={item.title}
                className={cn(
                  'w-full rounded-md px-2 py-1.5 pr-7 text-left transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  item.title === activeTitle && 'bg-accent text-accent-foreground',
                )}
              >
                <div className="truncate text-xs font-medium">{item.name}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {item.subtitle}
                </div>
                <div className="text-[11px] text-muted-foreground/70">
                  {formatRelativeTime(item.openedAt)}
                </div>
              </button>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                aria-label={`Remove ${item.name} from history`}
                className="absolute top-1.5 right-1 rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover/item:opacity-100 hover:bg-background hover:text-foreground focus-visible:opacity-100"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
