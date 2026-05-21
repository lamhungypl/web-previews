// Lazy loader for pdfjs-dist so the ~1MB pdf.js bundle only ships when the
// user opens the PDF preview route. The worker is also loaded on demand via
// Vite's `?url` query so it ends up in dist/assets/ with a hashed name.

import type * as Pdfjs from 'pdfjs-dist'

type PdfJs = typeof Pdfjs

let cached: Promise<PdfJs> | null = null

export function loadPdfjs(): Promise<PdfJs> {
  if (cached) return cached
  cached = (async () => {
    const [pdfjs, workerUrlMod] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ])
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrlMod.default
    return pdfjs
  })()
  return cached
}
