import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  PanelLeft,
  PanelRight,
  RotateCw,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { DocOutline } from '@/components/DocOutline'
import { LocalSourcePanel } from '@/components/LocalSourcePanel'
import { RecentFilesPanel, type RecentItem } from '@/components/RecentFilesPanel'
import { SourceInput } from '@/components/SourceInput'
import { Button } from '@/components/ui/button'
import { useFileWatch } from '@/hooks/useFileWatch'
import { useHeadingSpy, useIframeDocument } from '@/hooks/useIframeDocument'
import { usePersistentToggle } from '@/hooks/usePersistentToggle'
import type { ResolvedLocalFile } from '@/lib/fs-access'
import { ensureReadPermission } from '@/lib/fs-access'
import type { AssetResolver } from '@/lib/localAssets'
import { createAssetResolver } from '@/lib/localAssets'
import type { MarkdownHeading } from '@/lib/markdown'
import { renderMarkdownDocument } from '@/lib/markdown'
import type { LocalMdSource } from '@/lib/mdSource'
import {
  sourceFromHistory,
  sourceFromRelativeLink,
  sourceFromResolved,
} from '@/lib/mdSource'
import { cn } from '@/lib/utils'
import { getLocalRoots, localRootsReady } from '@/store/localRoots'
import type { MdHistoryEntry } from '@/store/mdHistory'
import {
  clearMdHistory,
  recordMdVisit,
  removeMdHistoryEntry,
  useMdHistory,
} from '@/store/mdHistory'

const MD_FILE_TYPES: FilePickerAcceptType[] = [
  {
    accept: { 'text/markdown': ['.md', '.markdown', '.mdown', '.mkd'] },
    description: 'Markdown',
  },
]

const MD_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd']

const NO_HEADINGS: MarkdownHeading[] = []

function toRecentItem(entry: MdHistoryEntry): RecentItem {
  return {
    id: entry.id,
    name: entry.name,
    openedAt: entry.openedAt,
    subtitle: entry.relPath,
    title: entry.path,
  }
}

interface LoadedMarkdown {
  headings: MarkdownHeading[]
  /** Null for pasted or dropped source — nothing on disk to point back at. */
  source: LocalMdSource | null
  title: string
  /** Object URL of the rendered HTML document — iframe src + open in new tab. */
  url: string
}

/** In-session back/forward trail, independent of the persisted recent-files list. */
interface Trail {
  cursor: number
  stack: LocalMdSource[]
}

export function MdPreviewRoute() {
  const [doc, setDoc] = useState<LoadedMarkdown | null>(null)
  const [nonce, setNonce] = useState(0)
  const [busy, setBusy] = useState(false)
  const [trail, setTrail] = useState<Trail>({ cursor: -1, stack: [] })
  const [watching, setWatching] = useState(true)

  const history = useMdHistory()
  const [historyOpen, toggleHistory] = usePersistentToggle('md-history-open', false)
  const [outlineOpen, toggleOutline] = usePersistentToggle(
    'md-outline-open',
    () => window.innerWidth >= 1024,
  )

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const iframeDoc = useIframeDocument(iframeRef, `${doc?.url ?? ''}#${nonce}`)
  const activeId = useHeadingSpy(iframeDoc, doc?.headings ?? NO_HEADINGS)

  // Blob URLs handed to the iframe (document + on-disk images) have to be
  // released by hand; keep the previous document's set until it's replaced.
  const assetsRef = useRef<AssetResolver | null>(null)
  const pendingScrollRef = useRef<null | number>(null)

  useEffect(() => {
    return () => {
      if (doc?.url) URL.revokeObjectURL(doc.url)
    }
  }, [doc])

  // Live reload replaces the document, which resets the iframe to the top.
  // Put the reader back where they were.
  useEffect(() => {
    if (!iframeDoc || pendingScrollRef.current === null) return
    scrollFrameTo(iframeRef.current, pendingScrollRef.current)
    pendingScrollRef.current = null
  }, [iframeDoc])

  const render = useCallback(
    async (markdown: string, title: string, source: LocalMdSource | null) => {
      const resolver = source
        ? createAssetResolver({
            parent: source.parent,
            relPath: source.relPath,
            root: source.root,
          })
        : null
      const { headings, html } = await renderMarkdownDocument(markdown, {
        resolveAsset: resolver ? resolver.resolve : undefined,
        title,
      })
      assetsRef.current?.revokeAll()
      assetsRef.current = resolver
      setDoc({
        headings,
        source,
        title,
        url: URL.createObjectURL(new Blob([html], { type: 'text/html' })),
      })
      setNonce(0)
    },
    [],
  )

  /** Read a file from disk and render it. `track` is false for reloads. */
  const openSource = useCallback(
    async (source: LocalMdSource, { track = true }: { track?: boolean } = {}) => {
      setBusy(true)
      try {
        if (!(await ensureReadPermission(source.file))) {
          toast.error('Read access to that file was not granted.')
          return
        }
        const file = await source.file.getFile()
        await render(await file.text(), source.name, source)
        if (!track) return
        recordMdVisit({
          file: source.file,
          name: source.name,
          path: source.path,
          relPath: source.relPath,
          rootId: source.rootId,
        })
        setTrail(({ cursor, stack }) => ({
          cursor: cursor + 1,
          stack: [...stack.slice(0, cursor + 1), source],
        }))
      } catch (err) {
        console.error(err)
        toast.error(err instanceof Error ? err.message : 'Could not open that file.')
      } finally {
        setBusy(false)
      }
    },
    [render],
  )

  async function openResolved(resolved: ResolvedLocalFile) {
    await localRootsReady()
    await openSource(sourceFromResolved(resolved, getLocalRoots()))
  }

  async function reopen(item: RecentItem) {
    const entry = history.find((e) => e.id === item.id)
    if (!entry) return
    await localRootsReady()
    await openSource(await sourceFromHistory(entry, getLocalRoots()))
  }

  async function loadText(markdown: string, title: string) {
    setBusy(true)
    try {
      await render(markdown, title, null)
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Could not render Markdown.')
    } finally {
      setBusy(false)
    }
  }

  /** Re-read the file in place, keeping the scroll position and the trail. */
  const reload = useCallback(() => {
    const source = doc?.source
    if (!source) {
      setNonce((n) => n + 1)
      return
    }
    pendingScrollRef.current = iframeDoc?.scrollingElement?.scrollTop ?? null
    void openSource(source, { track: false })
  }, [doc?.source, iframeDoc, openSource])

  useFileWatch(doc?.source?.file ?? null, watching && doc?.source != null, reload)

  // Relative links between local Markdown files navigate inside the viewer.
  const source = doc?.source ?? null
  useEffect(() => {
    if (!iframeDoc || !source) return

    async function follow(href: string) {
      try {
        await openSource(await sourceFromRelativeLink(source!, href))
      } catch (err) {
        console.error(err)
        toast.error(
          `Could not open ${href} — ${err instanceof Error ? err.message : 'unknown error'}`,
        )
      }
    }

    function onClick(event: MouseEvent) {
      const target = event.target as Element | null
      const href = target?.closest?.('a[data-local-md]')?.getAttribute('data-local-md')
      if (!href) return
      event.preventDefault()
      void follow(href)
    }

    iframeDoc.addEventListener('click', onClick)
    return () => iframeDoc.removeEventListener('click', onClick)
  }, [iframeDoc, source, openSource])

  const canGoBack = trail.cursor > 0
  const canGoForward = trail.cursor >= 0 && trail.cursor < trail.stack.length - 1

  const step = useCallback(
    (delta: number) => {
      const next = trail.cursor + delta
      const source = trail.stack[next]
      if (!source) return
      setTrail((t) => ({ ...t, cursor: next }))
      void openSource(source, { track: false })
    },
    [trail, openSource],
  )

  // Browser-style history keys, on Alt so they don't fight the real back/forward.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.altKey || event.metaKey || event.ctrlKey) return
      if (event.key === 'ArrowLeft' && canGoBack) {
        event.preventDefault()
        step(-1)
      } else if (event.key === 'ArrowRight' && canGoForward) {
        event.preventDefault()
        step(1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canGoBack, canGoForward, step])

  function scrollToHeading(id: string) {
    iframeDoc?.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!doc) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Markdown Preview</h1>
          <p className="text-sm text-muted-foreground">
            Render Markdown with GitHub-like styling. Everything stays on this machine.
          </p>
        </div>

        <SourceInput
          busy={busy}
          onSubmit={(text) => void loadText(text, 'Pasted Markdown')}
          placeholder="Paste or type Markdown here…"
        />

        <Divider />

        <LocalSourcePanel
          busy={busy}
          extensions={MD_EXTENSIONS}
          fileTypes={MD_FILE_TYPES}
          onFile={async (file) => loadText(await file.text(), file.name)}
          onResolved={openResolved}
          placeholder="/Users/you/notes/README.md"
          recent={
            <RecentFilesPanel
              items={history.map(toRecentItem)}
              onClear={clearMdHistory}
              onOpen={(item) => void reopen(item)}
              onRemove={removeMdHistoryEntry}
            />
          }
        />
      </div>
    )
  }

  const local = doc.source

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b px-2 py-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => step(-1)}
          disabled={!canGoBack}
          title="Back (⌥←)"
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => step(1)}
          disabled={!canGoForward}
          title="Forward (⌥→)"
        >
          <ChevronRight />
        </Button>

        <div className="mx-2 min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{doc.title}</div>
          {local ? (
            <div className="truncate font-mono text-[11px] text-muted-foreground">
              {local.path}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          {local ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setWatching((w) => !w)}
              title={
                watching
                  ? 'Watching the file — reloads when you save'
                  : 'Not watching the file'
              }
              className={cn(watching && 'text-primary')}
            >
              {watching ? <Eye /> : <EyeOff />}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleHistory}
            title="Toggle recent files"
            className={cn(historyOpen && 'bg-accent')}
          >
            <PanelLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleOutline}
            title="Toggle table of contents"
            className={cn(outlineOpen && 'bg-accent')}
          >
            <PanelRight />
          </Button>
          <Button variant="ghost" size="icon" onClick={reload} title="Reload preview">
            <RotateCw />
          </Button>
          <Button variant="ghost" size="icon" asChild title="Open in new tab">
            <a href={doc.url} target="_blank" rel="noreferrer noopener">
              <ExternalLink />
            </a>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDoc(null)}>
            <X /> Load another
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {historyOpen ? (
          <aside className="w-56 shrink-0 overflow-hidden border-r">
            <RecentFilesPanel
              activeTitle={local?.path ?? null}
              items={history.map(toRecentItem)}
              onClear={clearMdHistory}
              onOpen={(item) => void reopen(item)}
              onRemove={removeMdHistoryEntry}
            />
          </aside>
        ) : null}

        <iframe
          key={`${doc.url}#${nonce}`}
          ref={iframeRef}
          src={doc.url}
          title={doc.title}
          sandbox="allow-popups allow-same-origin"
          className="min-w-0 flex-1 border-0 bg-white"
        />

        {outlineOpen ? (
          <aside className="w-56 shrink-0 overflow-y-auto border-l">
            <DocOutline
              activeId={activeId}
              headings={doc.headings}
              onSelect={scrollToHeading}
            />
          </aside>
        ) : null}
      </div>
    </div>
  )
}

function scrollFrameTo(iframe: HTMLIFrameElement | null, top: number): void {
  const scroller = iframe?.contentDocument?.scrollingElement
  if (scroller) scroller.scrollTop = top
}

function Divider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}
