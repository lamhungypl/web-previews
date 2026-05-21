# web-previews

A fully-static React SPA that lets you preview an HTML file or an uploaded zipped web project entirely in your browser. Deployed to GitHub Pages.

## What it does

- Drop a single `.html` file → instant preview.
- Drop a `.zip` containing at least `index.html` (plus assets, sub-pages, etc.) → preview the project as if it were hosted. Relative paths, `fetch()`, multi-page navigation, and CSS `@import` all work, because a Service Worker hosts an in-memory virtual filesystem and intercepts iframe requests.

No upload — files never leave your machine.

## Run locally

```bash
pnpm install
pnpm dev
# open http://localhost:5173/web-previews/
```

## Build

```bash
pnpm build
pnpm preview
```

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and publishes to GitHub Pages. Make sure **Settings → Pages → Source** is set to _GitHub Actions_.

The site lives at `https://<your-user>.github.io/web-previews/`. If you fork it under a different repo name, change `base` in `vite.config.ts` and `basepath` in `src/routes.tsx`.
