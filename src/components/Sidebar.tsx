import { Link, useRouterState } from '@tanstack/react-router'
import {
  BookOpenText,
  ChevronsLeft,
  ChevronsRight,
  Code2,
  Crop,
  FileText,
  Globe,
  type LucideIcon,
  Paintbrush,
} from 'lucide-react'

import { SIDEBAR_MODE_LABEL, type SidebarMode } from '@/hooks/useSidebarMode'
import { cn } from '@/lib/utils'

interface ToolEntry {
  description: string
  icon: LucideIcon
  matchPrefix?: string
  title: string
  to: string
}

export const TOOLS: ToolEntry[] = [
  {
    description: 'Preview .html files or zipped projects',
    icon: Globe,
    matchPrefix: '/view',
    title: 'HTML Preview',
    to: '/',
  },
  {
    description: 'Render .md files with GitHub-like styling',
    icon: BookOpenText,
    title: 'Markdown Preview',
    to: '/tools/md-preview',
  },
  {
    description: 'Crop, rotate, resize and re-encode to JPEG / PNG / WebP',
    icon: Crop,
    title: 'Image Studio',
    to: '/tools/image-crop',
  },
  {
    description: 'Render PDFs page by page, fully local',
    icon: FileText,
    title: 'PDF Preview',
    to: '/tools/pdf-preview',
  },
  {
    description: 'Format and indent CSS',
    icon: Paintbrush,
    title: 'CSS Prettify',
    to: '/tools/css-prettify',
  },
  {
    description: 'Format JavaScript / TypeScript',
    icon: Code2,
    title: 'JS Prettify',
    to: '/tools/js-prettify',
  },
]

interface SidebarProps {
  /** Omit to cycle nothing — the mobile drawer is always fully expanded. */
  cycleMode?: () => void
  mode?: SidebarMode
  nextMode?: SidebarMode
  onNavigate?: () => void
}

export function Sidebar({
  cycleMode,
  mode = 'full',
  nextMode,
  onNavigate,
}: SidebarProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const rail = mode === 'rail'

  return (
    <nav className="flex h-full flex-col gap-1 overflow-hidden p-2">
      {cycleMode ? (
        <button
          type="button"
          onClick={cycleMode}
          title={nextMode ? `Show ${SIDEBAR_MODE_LABEL[nextMode]}` : 'Resize sidebar'}
          aria-label={
            nextMode ? `Show ${SIDEBAR_MODE_LABEL[nextMode]}` : 'Resize sidebar'
          }
          className={cn(
            'mb-1 flex items-center rounded-md p-2 text-muted-foreground transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            rail ? 'justify-center' : 'justify-end',
          )}
        >
          {rail ? (
            <ChevronsRight className="size-4" />
          ) : (
            <ChevronsLeft className="size-4" />
          )}
        </button>
      ) : null}

      {TOOLS.map((tool) => {
        const active = isActive(pathname, tool)
        const Icon = tool.icon
        return (
          <Link
            key={tool.to}
            to={tool.to}
            onClick={onNavigate}
            // Collapsed, the name lives only in the tooltip — so put it there.
            title={rail ? `${tool.title} — ${tool.description}` : undefined}
            aria-label={rail ? tool.title : undefined}
            className={cn(
              'flex gap-3 rounded-md text-sm transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              active && 'bg-accent text-accent-foreground',
              rail ? 'justify-center p-2' : 'p-2.5',
              mode === 'full' ? 'items-start' : 'items-center',
            )}
          >
            <Icon className={cn('size-4 shrink-0', mode === 'full' && 'mt-0.5')} />
            {rail ? null : (
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{tool.title}</div>
                {mode === 'full' ? (
                  <div className="truncate text-xs text-muted-foreground">
                    {tool.description}
                  </div>
                ) : null}
              </div>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

function isActive(pathname: string, tool: ToolEntry): boolean {
  // basepath is /web-previews, so pathname here is what comes AFTER that.
  if (tool.to === '/') {
    return pathname === '/' || pathname.startsWith('/view')
  }
  if (tool.matchPrefix && pathname.startsWith(tool.matchPrefix)) return true
  return pathname === tool.to || pathname.startsWith(`${tool.to}/`)
}
