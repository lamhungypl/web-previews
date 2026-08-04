import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'

import { IndexRoute } from '@/routes/IndexRoute'
import { PreviewRoute } from '@/routes/PreviewRoute'
import { RootLayout } from '@/routes/RootLayout'
import { CssPrettifyRoute } from '@/routes/tools/CssPrettifyRoute'
import { ImageStudioRoute } from '@/routes/tools/ImageStudioRoute'
import { JsPrettifyRoute } from '@/routes/tools/JsPrettifyRoute'
import { MdPreviewRoute } from '@/routes/tools/MdPreviewRoute'
import { PdfPreviewRoute } from '@/routes/tools/PdfPreviewRoute'

const rootRoute = createRootRoute({ component: RootLayout })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexRoute,
})

const previewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/view/$projectId',
  component: PreviewRoute,
})

// Path kept from when this was crop-only; it now also covers re-encoding, which
// the standalone Image Converter tool used to do.
const imageStudioRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tools/image-crop',
  component: ImageStudioRoute,
})

const mdPreviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tools/md-preview',
  component: MdPreviewRoute,
})

const pdfPreviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tools/pdf-preview',
  component: PdfPreviewRoute,
})

const cssPrettifyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tools/css-prettify',
  component: CssPrettifyRoute,
})

const jsPrettifyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tools/js-prettify',
  component: JsPrettifyRoute,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  previewRoute,
  imageStudioRoute,
  mdPreviewRoute,
  pdfPreviewRoute,
  cssPrettifyRoute,
  jsPrettifyRoute,
])

export const router = createRouter({
  routeTree,
  basepath: '/web-previews',
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
