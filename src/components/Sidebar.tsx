import { Link, useRouterState } from '@tanstack/react-router'
import { Code2, Crop, FileImage, Globe, type LucideIcon, Paintbrush } from 'lucide-react'

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
    description: 'Crop, rotate, resize and re-encode',
    icon: Crop,
    title: 'Image Cropper',
    to: '/tools/image-crop',
  },
  {
    description: 'PNG ↔ JPEG ↔ WebP with quality control',
    icon: FileImage,
    title: 'Image Converter',
    to: '/tools/image-convert',
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

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <nav className="flex h-full flex-col gap-1 p-3">
      {TOOLS.map((tool) => {
        const active = isActive(pathname, tool)
        const Icon = tool.icon
        return (
          <Link
            key={tool.to}
            to={tool.to}
            onClick={onNavigate}
            className={cn(
              'flex items-start gap-3 rounded-md p-2.5 text-sm transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              active && 'bg-accent text-accent-foreground',
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{tool.title}</div>
              <div className="truncate text-xs text-muted-foreground">
                {tool.description}
              </div>
            </div>
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
