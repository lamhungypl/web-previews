import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'

import { IndexRoute } from '@/routes/IndexRoute'
import { PreviewRoute } from '@/routes/PreviewRoute'
import { RootLayout } from '@/routes/RootLayout'

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

const routeTree = rootRoute.addChildren([indexRoute, previewRoute])

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
