import { Link, Outlet } from '@tanstack/react-router'

import { Toaster } from '@/components/ui/sonner'

export function RootLayout() {
  return (
    <div className="flex h-full flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="font-semibold tracking-tight">
            web-previews
          </Link>
          <a
            href="https://github.com/lamhungypl/web-previews"
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            GitHub
          </a>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
      <Toaster richColors position="top-center" />
    </div>
  )
}
