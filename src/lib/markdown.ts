import { Marked, type Token, type Tokens } from 'marked'

export interface MarkdownHeading {
  /** 1–6, as in h1–h6. */
  depth: number
  id: string
  /** Inline markup stripped, so it can be dropped into the outline as text. */
  text: string
}

export interface RenderedMarkdown {
  headings: MarkdownHeading[]
  html: string
}

export interface RenderMarkdownOptions {
  /**
   * Turn a relative link into something the iframe can load — used to pull
   * sibling images off disk as blob URLs. Return null to leave the link alone.
   */
  resolveAsset?: (href: string) => Promise<null | string>
  title: string
}

/**
 * Render a Markdown string into a complete standalone HTML document with
 * GitHub-flavored styling, plus the heading outline for the table of contents.
 *
 * The result is shown in a sandboxed iframe (and can be opened in a new tab),
 * mirroring how the HTML preview serves documents — so embedded HTML is left
 * as-is, same trust model as previewing raw .html. The iframe gets no
 * `allow-scripts`, so nothing in the document executes; that is what makes it
 * safe for the host page to reach into `contentDocument` for scroll-spy.
 *
 * ```mermaid``` code blocks are rendered to inline SVG here in the host page
 * (mermaid is lazy-loaded), so the iframe document needs no scripts.
 */
export async function renderMarkdownDocument(
  markdown: string,
  { resolveAsset, title }: RenderMarkdownOptions,
): Promise<RenderedMarkdown> {
  // Async work can't happen inside marked's synchronous renderer hooks, so
  // mermaid diagrams and on-disk images are collected during the parse and
  // spliced in afterwards. The nonce keeps placeholders from colliding with
  // text that happens to look like one.
  const nonce = crypto.randomUUID().slice(0, 8)
  const mermaidBlocks: string[] = []
  const assetHrefs: string[] = []
  const headings: MarkdownHeading[] = []
  const slugger = createSlugger()

  const md = new Marked({ gfm: true })
  md.use({
    renderer: {
      code(token: Tokens.Code): false | string {
        if (token.lang?.trim().split(/\s/)[0] === 'mermaid') {
          mermaidBlocks.push(token.text)
          return `<!--mermaid-${nonce}-${mermaidBlocks.length - 1}-->`
        }
        return false
      },

      heading(this: { parser: { parseInline: (t: Token[]) => string } }, token) {
        const text = inlineText(token.tokens)
        const id = slugger(text)
        headings.push({ depth: token.depth, id, text })
        const inner = this.parser.parseInline(token.tokens)
        return `<h${token.depth} id="${escapeAttr(id)}">${inner}</h${token.depth}>\n`
      },

      image(token: Tokens.Image): false | string {
        if (!resolveAsset || !isRelativeHref(token.href)) return false
        assetHrefs.push(token.href)
        const alt = escapeAttr(token.text ?? '')
        const titleAttr = token.title ? ` title="${escapeAttr(token.title)}"` : ''
        return `<img src="__asset-${nonce}-${assetHrefs.length - 1}__" alt="${alt}"${titleAttr} />`
      },

      link(this: { parser: { parseInline: (t: Token[]) => string } }, token) {
        // Relative links to other Markdown files stay in the viewer: the host
        // page intercepts the click and loads the sibling file from disk.
        if (!isRelativeHref(token.href) || !isMarkdownPath(token.href)) return false
        const inner = this.parser.parseInline(token.tokens)
        const titleAttr = token.title ? ` title="${escapeAttr(token.title)}"` : ''
        return `<a href="${escapeAttr(token.href)}" data-local-md="${escapeAttr(token.href)}"${titleAttr}>${inner}</a>`
      },
    },
  })

  let body = await md.parse(markdown, { async: true })

  if (mermaidBlocks.length > 0) {
    const svgs = await renderMermaidBlocks(mermaidBlocks)
    body = body.replace(
      new RegExp(`<!--mermaid-${nonce}-(\\d+)-->`, 'g'),
      (_, i: string) => svgs[Number(i)],
    )
  }

  if (assetHrefs.length > 0 && resolveAsset) {
    const urls = await Promise.all(
      assetHrefs.map(async (href) => {
        try {
          return await resolveAsset(href)
        } catch {
          return null
        }
      }),
    )
    body = body.replace(new RegExp(`__asset-${nonce}-(\\d+)__`, 'g'), (_, i: string) =>
      escapeAttr(urls[Number(i)] ?? assetHrefs[Number(i)]),
    )
  }

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${MARKDOWN_CSS}</style>
</head>
<body>
<article class="markdown-body">
${body}
</article>
</body>
</html>`

  return { headings, html }
}

/** A link is ours to resolve if it has no scheme, no host and no fragment-only target. */
export function isRelativeHref(href: string): boolean {
  if (!href) return false
  return !/^([a-z][a-z\d+\-.]*:|\/\/|#|\/)/i.test(href)
}

export function isMarkdownPath(path: string): boolean {
  return /\.(md|markdown|mdown|mkd)(\?|$)/i.test(path)
}

/** GitHub-style heading slugs, deduped with a numeric suffix. */
function createSlugger(): (text: string) => string {
  const seen = new Map<string, number>()
  return (text) => {
    const base =
      text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .trim()
        .replace(/\s+/g, '-') || 'section'
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    return count === 0 ? base : `${base}-${count}`
  }
}

/** Flatten inline tokens to plain text for the outline label. */
function inlineText(tokens: Token[] | undefined): string {
  if (!tokens) return ''
  return tokens
    .map((token) => {
      if ('tokens' in token && Array.isArray(token.tokens) && token.type !== 'image') {
        return inlineText(token.tokens as Token[])
      }
      if (token.type === 'image') return (token as Tokens.Image).text ?? ''
      if ('text' in token && typeof token.text === 'string') return token.text
      return 'raw' in token && typeof token.raw === 'string' ? token.raw : ''
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Render mermaid sources to SVG strings; a failed block becomes an error box. */
async function renderMermaidBlocks(blocks: string[]): Promise<string[]> {
  const mermaid = (await import('mermaid')).default
  // suppressErrorRendering: a bad diagram must not splat mermaid's error SVG
  // into the host page — we show our own error box in the document instead.
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
  })

  return Promise.all(
    blocks.map(async (source, i) => {
      try {
        const { svg } = await mermaid.render(
          `mermaid-${crypto.randomUUID().slice(0, 8)}-${i}`,
          source,
        )
        return `<div class="mermaid-diagram">${svg}</div>`
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return `<pre class="mermaid-error">${escapeHtml(message)}\n\n${escapeHtml(source)}</pre>`
      }
    }),
  )
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replaceAll("'", '&#39;')
}

/** Compact GitHub-like markdown styling, light theme. */
const MARKDOWN_CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
html { scroll-padding-top: 16px; }
body {
  margin: 0;
  background: #ffffff;
  color: #1f2328;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  -webkit-text-size-adjust: 100%;
}
.markdown-body {
  max-width: 860px;
  margin: 0 auto;
  padding: 32px 24px 64px;
  word-wrap: break-word;
}
.markdown-body > :first-child { margin-top: 0; }
h1, h2, h3, h4, h5, h6 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
  scroll-margin-top: 16px;
}
h1 { font-size: 2em; padding-bottom: 0.3em; border-bottom: 1px solid #d1d9e0; }
h2 { font-size: 1.5em; padding-bottom: 0.3em; border-bottom: 1px solid #d1d9e0; }
h3 { font-size: 1.25em; }
h4 { font-size: 1em; }
h5 { font-size: 0.875em; }
h6 { font-size: 0.85em; color: #59636e; }
p, blockquote, ul, ol, dl, table, pre { margin-top: 0; margin-bottom: 16px; }
a { color: #0969da; text-decoration: none; }
a:hover { text-decoration: underline; }
blockquote {
  padding: 0 1em;
  color: #59636e;
  border-left: 0.25em solid #d1d9e0;
  margin-left: 0;
  margin-right: 0;
}
ul, ol { padding-left: 2em; }
li + li { margin-top: 0.25em; }
li > p { margin-bottom: 8px; }
code, kbd, pre, samp {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
}
code {
  padding: 0.2em 0.4em;
  font-size: 85%;
  background: #f0f1f3;
  border-radius: 6px;
}
pre {
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background: #f6f8fa;
  border-radius: 6px;
}
pre code { padding: 0; font-size: 100%; background: transparent; border-radius: 0; }
table { border-spacing: 0; border-collapse: collapse; display: block; max-width: 100%; overflow: auto; }
th, td { padding: 6px 13px; border: 1px solid #d1d9e0; }
th { font-weight: 600; }
tr:nth-child(2n) { background: #f6f8fa; }
img { max-width: 100%; height: auto; }
hr {
  height: 0.25em;
  padding: 0;
  margin: 24px 0;
  background: #d1d9e0;
  border: 0;
}
input[type="checkbox"] { margin-right: 0.5em; }
.mermaid-diagram { margin-bottom: 16px; overflow-x: auto; text-align: center; }
.mermaid-diagram svg { max-width: 100%; height: auto; }
.mermaid-error { color: #d1242f; background: #fff1f0; border: 1px solid #ffd7d5; }
li:has(> input[type="checkbox"]) { list-style: none; margin-left: -1.5em; }
`
