import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'

import { IndexRoute } from '@/routes/IndexRoute'
import { PreviewRoute } from '@/routes/PreviewRoute'
import { RootLayout } from '@/routes/RootLayout'
import { CssPrettifyRoute } from '@/routes/tools/CssPrettifyRoute'
import { ImageConvertRoute } from '@/routes/tools/ImageConvertRoute'
import { ImageCropRoute } from '@/routes/tools/ImageCropRoute'
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

const imageCropRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tools/image-crop',
  component: ImageCropRoute,
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

const imageConvertRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tools/image-convert',
  component: ImageConvertRoute,
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
  imageCropRoute,
  imageConvertRoute,
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
