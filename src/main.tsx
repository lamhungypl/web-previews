import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { swReady } from '@/lib/sw-client'
import { router } from '@/routes'

import '@/index.css'

// Fire-and-forget SW registration. UI code awaits swReady() at the moment of
// first registerProject() call anyway, so the page can render immediately.
void swReady().catch((err) => {
  console.warn('Service worker failed to register:', err)
})

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root element not found in index.html')

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
