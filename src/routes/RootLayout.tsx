import { Link, Outlet } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Sidebar } from '@/components/Sidebar'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'

export function RootLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Lock body scroll while drawer is open.
  useEffect(() => {
    if (!drawerOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [drawerOpen])

  return (
    <div className="flex h-full flex-col">
      <header className="border-b">
        <div className="flex h-14 items-center gap-3 px-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </Button>
          <Link to="/" className="font-semibold tracking-tight">
            web-previews
          </Link>
          <a
            href="https://github.com/lamhungypl/web-previews"
            target="_blank"
            rel="noreferrer noopener"
            className="ml-auto text-sm text-muted-foreground hover:text-foreground"
          >
            GitHub
          </a>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 border-r md:block">
          <Sidebar />
        </aside>

        <main className="min-w-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r bg-background shadow-lg">
            <div className="flex h-14 items-center justify-between border-b px-3">
              <span className="px-2 font-semibold">Tools</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
              >
                <X />
              </Button>
            </div>
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}

      <Toaster richColors position="top-center" />
    </div>
  )
}
