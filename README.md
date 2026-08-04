# web-previews

A fully-static React SPA that lets you preview an HTML file or an uploaded zipped web project entirely in your browser. Deployed to GitHub Pages.

## What it does

- Drop a single `.html` file → instant preview.
- Drop a `.zip` containing at least `index.html` (plus assets, sub-pages, etc.) → preview the project as if it were hosted. Relative paths, `fetch()`, multi-page navigation, and CSS `@import` all work, because a Service Worker hosts an in-memory virtual filesystem and intercepts iframe requests.
- Open a file **by its path on this machine** — no zipping, no re-uploading (see below).
- Preview a whole local folder as a project, and hit Reload to re-read it after editing.
- Markdown preview with a sticky table of contents, a recent-files list, back/forward between documents, relative images loaded off disk, and live reload on save.

No upload — files never leave your machine.

## Opening files by local path

A browser can't read `/Users/me/notes/todo.md` just because you typed it: `fetch('file://…')` is blocked from an http(s) origin, and `<input type="file">` deliberately hides the real path.

So the first time a path misses, the app asks for the **folder above it** through the native picker. That grant is kept in IndexedDB — handles are structured-cloneable, which is why localStorage can't hold them — and from then on any path inside that folder opens with no dialog. A grant also unlocks two things a plain `File` can't do:

- **Live reload**: the file handle is re-read on an interval (there is no filesystem change event on the web), so saving in your editor refreshes the preview.
- **Relative assets**: `![](./img/flow.png)` and links to sibling `.md` files are read through the folder handle, including `../` hops.

This needs the File System Access API — Chrome or Edge. Elsewhere the app falls back to drag & drop, which still previews but can't offer history, live reload, or local images.

Dropping a file uses `getAsFileSystemHandle()` when available, so a dropped file gets the full treatment too, not just a one-off render.

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
